// ============================================================================
// CLINE / ROO CODE ADAPTER (v1.9.x)
// ============================================================================
// Converts Cline (saoudrizwan.claude-dev) and Roo Code (rooveterinaryinc.roo-cline)
// VS Code extension conversation history into UniversalMessage.
//
// Cline/Roo store data in the editor's globalStorage directory:
//   <editor>/User/globalStorage/<ext_id>/
//     state/taskHistory.json        -> Cline task index
//     tasks/_index.json (entries)   -> Roo Code task index
//     tasks/<id>/ui_messages.json   -> per-task UI message array
//
// PATTERN REFERENCE: OpenCode adapter (commands/adapters/opencode.rs)
// CLEAN CODE: emits OUR Universal types, reuses opencode helpers.

use crate::commands::adapters::opencode::epoch_ms_to_rfc3339;
use crate::models::universal::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Known Cline-family extension IDs and their display names.
const EXTENSIONS: &[(&str, &str)] = &[
    ("saoudrizwan.claude-dev", "Cline"),
    ("rooveterinaryinc.roo-cline", "Roo Code"),
];

/// Editor directories that may host VS Code globalStorage.
const EDITORS: &[(&str, &str)] = &[
    ("Code", "VS Code"),
    ("Cursor", "Cursor"),
    ("Code - Insiders", "VS Code Insiders"),
    ("Codium", "VSCodium"),
];

/// Separator used inside the `cline://` path scheme.
///
/// `|` is illegal in Windows file paths and effectively never appears in
/// macOS/Linux directory names, so it disambiguates the base globalStorage
/// path from the project cwd / task id (both of which can contain `:` on
/// Windows due to drive letters).
const SCHEME_SEP: char = '|';

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Collect every available Cline/Roo extension base directory across all
/// supported editors and operating systems, paired with a human label.
///
/// Layout per OS:
/// - macOS:   ~/Library/Application Support/<editor>/User/globalStorage/<ext>
/// - Linux:   ~/.config/<editor>/User/globalStorage/<ext>
/// - Windows: %APPDATA%/<editor>/User/globalStorage/<ext>  (dirs::config_dir())
pub fn get_all_cline_base_paths() -> Vec<(PathBuf, String)> {
    let mut roots: Vec<PathBuf> = Vec::new();

    // macOS: ~/Library/Application Support
    #[cfg(target_os = "macos")]
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join("Library").join("Application Support"));
    }

    // Linux: ~/.config  (dirs::config_dir())
    #[cfg(target_os = "linux")]
    if let Some(config) = dirs::config_dir() {
        roots.push(config);
    }

    // Windows: %APPDATA% (dirs::config_dir() resolves to %APPDATA%\Roaming).
    #[cfg(target_os = "windows")]
    if let Some(config) = dirs::config_dir() {
        roots.push(config);
    }

    let mut paths: Vec<(PathBuf, String)> = Vec::new();

    for root in &roots {
        for (editor_dir, editor_label) in EDITORS {
            let global_storage = root.join(editor_dir).join("User").join("globalStorage");
            if !global_storage.is_dir() {
                continue;
            }

            for (ext_id, ext_name) in EXTENSIONS {
                let ext_path = global_storage.join(ext_id);
                if !ext_path.is_dir() {
                    continue;
                }
                // SECURITY: skip symlinked extension directories.
                if is_symlinked(&ext_path) {
                    continue;
                }
                let label = format!("{ext_name} ({editor_label})");
                paths.push((ext_path, label));
            }
        }
    }

    paths
}

/// Return the first available Cline/Roo base directory, if any.
/// Used by the single-source detection flow (`get_cline_path`).
pub fn get_cline_base_path() -> Option<PathBuf> {
    get_all_cline_base_paths().into_iter().next().map(|(p, _)| p)
}

/// Check whether a path is a symlink without following it.
fn is_symlinked(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
}

// ============================================================================
// TASK HISTORY LOADING
// ============================================================================

/// Load the task index for a base directory.
/// Supports both the Cline (`state/taskHistory.json`) and Roo Code
/// (`tasks/_index.json` -> `entries`) formats.
fn load_task_history(base_path: &Path) -> Vec<Value> {
    // Cline: state/taskHistory.json (array of task items)
    let cline_path = base_path.join("state").join("taskHistory.json");
    if cline_path.is_file() {
        if let Ok(data) = fs::read_to_string(&cline_path) {
            if let Ok(items) = serde_json::from_str::<Vec<Value>>(&data) {
                return items;
            }
        }
    }

    // Roo Code: tasks/_index.json -> { entries: [...] }
    let roo_index = base_path.join("tasks").join("_index.json");
    if roo_index.is_file() {
        if let Ok(data) = fs::read_to_string(&roo_index) {
            if let Ok(index) = serde_json::from_str::<Value>(&data) {
                if let Some(entries) = index.get("entries").and_then(Value::as_array) {
                    return entries.clone();
                }
            }
        }
    }

    Vec::new()
}

// ============================================================================
// PROJECT SCANNING
// ============================================================================

/// Scan all Cline/Roo projects in a single base directory, grouped by the
/// task's initialization cwd. Emits UniversalProject values.
pub fn scan_cline_projects(
    base_path: &Path,
    source_id: &str,
) -> Result<Vec<UniversalProject>, String> {
    let task_history = load_task_history(base_path);
    if task_history.is_empty() {
        return Ok(Vec::new());
    }

    let base_str = base_path.to_string_lossy().to_string();

    // Group tasks by cwd.
    let mut by_cwd: HashMap<String, Vec<&Value>> = HashMap::new();
    for item in &task_history {
        let cwd = item
            .get("cwdOnTaskInitialization")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        by_cwd.entry(cwd).or_default().push(item);
    }

    let mut projects: Vec<UniversalProject> = Vec::new();

    for (cwd, tasks) in &by_cwd {
        let project_name = PathBuf::from(cwd)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| cwd.clone());

        let last_modified_ms = tasks
            .iter()
            .filter_map(|t| t.get("ts").and_then(Value::as_f64))
            .fold(0.0_f64, f64::max) as i64;

        let last_activity = if last_modified_ms > 0 {
            Some(epoch_ms_to_rfc3339(last_modified_ms))
        } else {
            None
        };

        let scheme_path = format!("cline://{}{}{}", base_str, SCHEME_SEP, cwd);

        let mut metadata: HashMap<String, Value> = HashMap::new();
        metadata.insert("clineBasePath".to_string(), json!(base_str));
        metadata.insert("projectWorktree".to_string(), json!(cwd));

        projects.push(UniversalProject {
            id: scheme_path.clone(),
            source_id: source_id.to_string(),
            provider_id: "cline".to_string(),
            name: project_name,
            path: scheme_path,
            session_count: tasks.len(),
            total_messages: 0,
            first_activity_at: None,
            last_activity_at: last_activity,
            metadata,
        });
    }

    projects.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(projects)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

/// Load sessions (one per task item) for a single project cwd.
pub fn load_cline_sessions(
    base_path: &Path,
    project_cwd: &str,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    let task_history = load_task_history(base_path);
    let base_str = base_path.to_string_lossy().to_string();
    let scheme_project = format!("cline://{}{}{}", base_str, SCHEME_SEP, project_cwd);

    let mut sessions: Vec<UniversalSession> = task_history
        .iter()
        .filter(|item| {
            item.get("cwdOnTaskInitialization")
                .and_then(Value::as_str)
                .unwrap_or("")
                == project_cwd
        })
        .filter_map(|item| {
            let id = item.get("id").and_then(Value::as_str)?;
            if !is_safe_task_id(id) {
                return None;
            }

            let ts = item.get("ts").and_then(Value::as_f64).unwrap_or(0.0) as i64;
            let timestamp = epoch_ms_to_rfc3339(ts);

            let task = item.get("task").and_then(Value::as_str).unwrap_or("");
            let model = item.get("modelId").and_then(Value::as_str);

            let summary: Option<String> = if task.is_empty() {
                model.map(String::from)
            } else {
                Some(truncate_chars(task, 100))
            };

            let tokens_in = item.get("tokensIn").and_then(Value::as_u64).unwrap_or(0);
            let tokens_out = item.get("tokensOut").and_then(Value::as_u64).unwrap_or(0);
            let total_tokens = if tokens_in > 0 || tokens_out > 0 {
                Some(TokenUsage {
                    input_tokens: tokens_in.try_into().unwrap_or(i32::MAX),
                    output_tokens: tokens_out.try_into().unwrap_or(i32::MAX),
                    total_tokens: tokens_in
                        .saturating_add(tokens_out)
                        .try_into()
                        .unwrap_or(i32::MAX),
                    cache_creation_tokens: None,
                    cache_read_tokens: None,
                    service_tier: None,
                })
            } else {
                None
            };

            let message_count = count_ui_messages(base_path, id);

            let scheme_session = format!("cline://{}{}{}", base_str, SCHEME_SEP, id);

            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert("filePath".to_string(), json!(scheme_session));
            metadata.insert("clineBasePath".to_string(), json!(base_str));
            metadata.insert("taskId".to_string(), json!(id));
            if let Some(m) = model {
                metadata.insert("model".to_string(), json!(m));
            }
            if let Some(ref s) = summary {
                metadata.insert("summary".to_string(), json!(s));
            }

            Some(UniversalSession {
                id: scheme_session,
                project_id: scheme_project.clone(),
                source_id: source_id.to_string(),
                provider_id: "cline".to_string(),
                title: summary.clone().unwrap_or_else(|| id.to_string()),
                description: summary,
                message_count,
                first_message_at: timestamp.clone(),
                last_message_at: timestamp.clone(),
                duration: 0,
                total_tokens,
                tool_call_count: 0,
                error_count: 0,
                entrypoint: None,
                metadata,
                checksum: format!("{}{}{}", base_str, id, ts),
            })
        })
        .collect();

    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    Ok(sessions)
}

/// Count the number of raw UI messages in a task's `ui_messages.json`.
fn count_ui_messages(base_path: &Path, task_id: &str) -> usize {
    if !is_safe_task_id(task_id) {
        return 0;
    }
    let ui_path = base_path.join("tasks").join(task_id).join("ui_messages.json");
    fs::read_to_string(&ui_path)
        .ok()
        .and_then(|data| serde_json::from_str::<Vec<Value>>(&data).ok())
        .map(|v| v.len())
        .unwrap_or(0)
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

/// Load messages for a single Cline/Roo task with pagination.
pub fn load_cline_messages(
    base_path: &Path,
    task_id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    if !is_safe_task_id(task_id) {
        return Err(format!("CLINE_SECURITY_ERROR: Unsafe task id: {}", task_id));
    }

    let ui_path = base_path.join("tasks").join(task_id).join("ui_messages.json");
    if !ui_path.is_file() {
        return Ok(Vec::new());
    }

    let data = fs::read_to_string(&ui_path)
        .map_err(|e| format!("CLINE_READ_ERROR: Failed to read ui_messages: {}", e))?;
    let ui_messages: Vec<Value> = serde_json::from_str(&data)
        .map_err(|e| format!("CLINE_PARSE_ERROR: Failed to parse ui_messages: {}", e))?;

    // Convert all rows first (some rows are skipped → indices stay stable per-row),
    // then paginate the resulting universal messages.
    let mut converted: Vec<UniversalMessage> = Vec::with_capacity(ui_messages.len());
    let mut sequence: i32 = 0;
    for row in &ui_messages {
        if let Some(msg) =
            cline_message_to_universal(row, session_id, project_id, source_id, sequence)
        {
            converted.push(msg);
            sequence += 1;
        }
    }

    let total = converted.len();
    let start = offset.min(total);
    let end = offset.saturating_add(limit).min(total);
    Ok(converted[start..end].to_vec())
}

// ============================================================================
// CONVERSION TO UNIVERSAL FORMAT
// ============================================================================

/// Convert a single Cline/Roo `ui_messages.json` row to a UniversalMessage.
/// Returns `None` for internal/metadata rows that should not be displayed.
fn cline_message_to_universal(
    row: &Value,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    sequence_number: i32,
) -> Option<UniversalMessage> {
    let msg_type = row.get("type").and_then(Value::as_str)?;
    let ts = row.get("ts").and_then(Value::as_f64).unwrap_or(0.0) as i64;
    let timestamp = epoch_ms_to_rfc3339(ts);
    let text = row.get("text").and_then(Value::as_str).unwrap_or("");
    let id = format!("cline-{}-{}", session_id, sequence_number);

    match msg_type {
        "say" => {
            let say = row.get("say").and_then(Value::as_str).unwrap_or("");
            convert_say(say, text, row, &id, session_id, project_id, source_id, &timestamp, sequence_number)
        }
        "ask" => {
            let ask = row.get("ask").and_then(Value::as_str).unwrap_or("");
            convert_ask(ask, text, &id, session_id, project_id, source_id, &timestamp, sequence_number)
        }
        _ => None,
    }
}

#[allow(clippy::too_many_arguments)]
fn convert_say(
    say: &str,
    text: &str,
    row: &Value,
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    sequence_number: i32,
) -> Option<UniversalMessage> {
    match say {
        "text" | "completion_result" => {
            if text.is_empty() {
                return None;
            }
            let content = vec![text_content(text)];
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::Assistant, MessageType::Message, content, None, None, sequence_number,
            ))
        }
        "reasoning" => {
            let reasoning = row.get("reasoning").and_then(Value::as_str).unwrap_or(text);
            if reasoning.is_empty() {
                return None;
            }
            let content = vec![thinking_content(reasoning)];
            let thinking = Some(ThinkingBlock {
                content: reasoning.to_string(),
                signature: None,
                model: None,
            });
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::Assistant, MessageType::Message, content, None, thinking, sequence_number,
            ))
        }
        "tool" => {
            let tool_data: Value = serde_json::from_str(text).unwrap_or(Value::Null);
            let tool_name = map_tool_name(
                tool_data.get("tool").and_then(Value::as_str).unwrap_or("unknown"),
            );
            let path = tool_data.get("path").and_then(Value::as_str).unwrap_or("");
            let call_id = format!("cline_tool_{}", id);

            let mut input: HashMap<String, Value> = HashMap::new();
            input.insert("path".to_string(), json!(path));

            let content = vec![UniversalContent {
                content_type: ContentType::ToolUse,
                data: json!({
                    "id": call_id,
                    "name": tool_name,
                    "input": { "path": path },
                }),
                encoding: None,
                mime_type: Some("application/json".to_string()),
                size: None,
                hash: None,
            }];

            let tool_calls = vec![ToolCall {
                id: call_id,
                name: tool_name,
                input,
                output: None,
                error: None,
                status: ToolCallStatus::Success,
            }];

            let mut msg = build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::Assistant, MessageType::Message, content, None, None, sequence_number,
            );
            msg.tool_calls = Some(tool_calls);
            Some(msg)
        }
        "command" => {
            if text.is_empty() {
                return None;
            }
            let call_id = format!("cline_cmd_{}", id);
            let content = vec![UniversalContent {
                content_type: ContentType::ToolUse,
                data: json!({
                    "id": call_id,
                    "name": "Bash",
                    "input": { "command": text },
                }),
                encoding: None,
                mime_type: Some("application/json".to_string()),
                size: None,
                hash: None,
            }];
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::Assistant, MessageType::Message, content, None, None, sequence_number,
            ))
        }
        "command_output" => {
            if text.is_empty() {
                return None;
            }
            let content = vec![text_content(&format!("```\n{}\n```", text))];
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::Assistant, MessageType::Message, content, None, None, sequence_number,
            ))
        }
        "error" => {
            if text.is_empty() {
                return None;
            }
            let content = vec![text_content(text)];
            let mut msg = build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::System, MessageType::Error, content, None, None, sequence_number,
            );
            msg.errors = Some(vec![ErrorInfo {
                code: "cline_error".to_string(),
                message: text.to_string(),
                details: None,
                timestamp: timestamp.to_string(),
            }]);
            Some(msg)
        }
        "user_feedback" | "user_feedback_diff" => {
            if text.is_empty() {
                return None;
            }
            let content = vec![text_content(text)];
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::User, MessageType::Message, content, None, None, sequence_number,
            ))
        }
        // Internal/metadata rows: never displayed.
        "api_req_started"
        | "api_req_finished"
        | "api_req_retried"
        | "deleted_api_reqs"
        | "shell_integration_warning"
        | "shell_integration_warning_with_suggestion"
        | "checkpoint_created"
        | "load_mcp_documentation"
        | "info"
        | "task_progress"
        | "hook_status"
        | "hook_output_stream"
        | "conditional_rules_applied" => None,
        // Any other say subtype carrying text → assistant text.
        _ => {
            if text.is_empty() {
                return None;
            }
            let content = vec![text_content(text)];
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::Assistant, MessageType::Message, content, None, None, sequence_number,
            ))
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn convert_ask(
    ask: &str,
    text: &str,
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    sequence_number: i32,
) -> Option<UniversalMessage> {
    match ask {
        // User-authored prompts and mode responses → user message.
        "followup" | "act_mode_respond" | "plan_mode_respond" => {
            if text.is_empty() {
                return None;
            }
            let content = vec![text_content(text)];
            Some(build_message(
                id, session_id, project_id, source_id, timestamp,
                MessageRole::User, MessageType::Message, content, None, None, sequence_number,
            ))
        }
        // Permission / confirmation prompts are skipped.
        _ => None,
    }
}

// ============================================================================
// MESSAGE-BUILDER HELPERS
// ============================================================================

#[allow(clippy::too_many_arguments)]
fn build_message(
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    role: MessageRole,
    message_type: MessageType,
    content: Vec<UniversalContent>,
    model: Option<String>,
    thinking: Option<ThinkingBlock>,
    sequence_number: i32,
) -> UniversalMessage {
    UniversalMessage {
        id: id.to_string(),
        session_id: session_id.to_string(),
        project_id: project_id.to_string(),
        source_id: source_id.to_string(),
        provider_id: "cline".to_string(),
        timestamp: timestamp.to_string(),
        sequence_number,
        role,
        message_type,
        content,
        parent_id: None,
        depth: None,
        branch_id: None,
        model,
        tokens: None,
        tool_calls: None,
        thinking,
        attachments: None,
        errors: None,
        original_format: "cline_ui_messages".to_string(),
        provider_metadata: HashMap::new(),
    }
}

fn text_content(text: &str) -> UniversalContent {
    UniversalContent {
        content_type: ContentType::Text,
        data: json!({ "text": text }),
        encoding: None,
        mime_type: Some("text/plain".to_string()),
        size: Some(text.len()),
        hash: None,
    }
}

fn thinking_content(text: &str) -> UniversalContent {
    UniversalContent {
        content_type: ContentType::Thinking,
        data: json!({ "thinking": text }),
        encoding: None,
        mime_type: Some("text/plain".to_string()),
        size: Some(text.len()),
        hash: None,
    }
}

/// Map Cline/Roo internal tool names to canonical display names.
fn map_tool_name(name: &str) -> String {
    match name {
        "readFile" => "Read",
        "editedExistingFile" | "newFileCreated" | "fileDeleted" => "Write",
        "listFilesTopLevel" | "listFilesRecursive" | "listCodeDefinitionNames" => "Glob",
        "searchFiles" => "Grep",
        "webFetch" => "WebFetch",
        "webSearch" => "WebSearch",
        other => other,
    }
    .to_string()
}

// ============================================================================
// PATH SCHEME PARSING
// ============================================================================

/// Parse a `cline://<base>|<cwd-or-taskid>` scheme path into (base, tail).
pub fn parse_scheme_path(scheme_path: &str) -> Result<(PathBuf, String), String> {
    let body = scheme_path.strip_prefix("cline://").unwrap_or(scheme_path);
    let (base, tail) = body
        .split_once(SCHEME_SEP)
        .ok_or_else(|| format!("CLINE_PATH_ERROR: Invalid cline path: {}", scheme_path))?;
    if base.is_empty() {
        return Err(format!("CLINE_PATH_ERROR: Empty base in: {}", scheme_path));
    }
    Ok((PathBuf::from(base), tail.to_string()))
}

/// Validate a task id, rejecting path-traversal characters.
fn is_safe_task_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 256
        && !id.contains("..")
        && !id.contains('/')
        && !id.contains('\\')
}

/// Truncate a string to at most `max` characters (char-boundary safe),
/// appending an ellipsis when truncation occurs.
fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max).collect();
    format!("{}...", truncated)
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn first_text(msg: &UniversalMessage) -> String {
        msg.content[0]
            .data
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    }

    #[test]
    fn test_ui_messages_role_and_content_mapping() {
        // A minimal ui_messages.json with say:text, say:reasoning and ask:followup.
        let raw = r#"[
            { "ts": 1700000000000, "type": "say", "say": "text", "text": "Hello from Cline" },
            { "ts": 1700000001000, "type": "say", "say": "reasoning", "text": "", "reasoning": "thinking deeply" },
            { "ts": 1700000002000, "type": "ask", "ask": "followup", "text": "Can you explain more?" },
            { "ts": 1700000003000, "type": "say", "say": "api_req_started", "text": "{}" }
        ]"#;

        let rows: Vec<Value> = serde_json::from_str(raw).unwrap();
        let mut out: Vec<UniversalMessage> = Vec::new();
        let mut seq = 0;
        for row in &rows {
            if let Some(m) = cline_message_to_universal(row, "sess", "proj", "src", seq) {
                out.push(m);
                seq += 1;
            }
        }

        // api_req_started is skipped → exactly 3 messages.
        assert_eq!(out.len(), 3, "internal rows must be skipped");

        // say:text → assistant / text
        assert_eq!(out[0].role, MessageRole::Assistant);
        assert_eq!(out[0].content[0].content_type, ContentType::Text);
        assert_eq!(first_text(&out[0]), "Hello from Cline");

        // say:reasoning → assistant / thinking (+ thinking block populated)
        assert_eq!(out[1].role, MessageRole::Assistant);
        assert_eq!(out[1].content[0].content_type, ContentType::Thinking);
        assert_eq!(
            out[1].content[0].data.get("thinking").and_then(Value::as_str),
            Some("thinking deeply")
        );
        assert!(out[1].thinking.is_some());

        // ask:followup → user / text
        assert_eq!(out[2].role, MessageRole::User);
        assert_eq!(out[2].content[0].content_type, ContentType::Text);
        assert_eq!(first_text(&out[2]), "Can you explain more?");
    }

    #[test]
    fn test_say_tool_maps_to_tool_use() {
        let row: Value = serde_json::from_str(
            r#"{ "ts": 1700000000000, "type": "say", "say": "tool",
                 "text": "{\"tool\":\"readFile\",\"path\":\"/test.txt\"}" }"#,
        )
        .unwrap();
        let msg = cline_message_to_universal(&row, "s", "p", "src", 0).unwrap();
        assert_eq!(msg.role, MessageRole::Assistant);
        assert_eq!(msg.content[0].content_type, ContentType::ToolUse);
        assert_eq!(msg.content[0].data.get("name").and_then(Value::as_str), Some("Read"));
        assert!(msg.tool_calls.is_some());
    }

    #[test]
    fn test_say_command_maps_to_bash() {
        let row: Value = serde_json::from_str(
            r#"{ "ts": 1700000000000, "type": "say", "say": "command", "text": "npm test" }"#,
        )
        .unwrap();
        let msg = cline_message_to_universal(&row, "s", "p", "src", 0).unwrap();
        assert_eq!(msg.content[0].content_type, ContentType::ToolUse);
        assert_eq!(msg.content[0].data.get("name").and_then(Value::as_str), Some("Bash"));
    }

    #[test]
    fn test_say_error_maps_to_system_error() {
        let row: Value = serde_json::from_str(
            r#"{ "ts": 1700000000000, "type": "say", "say": "error", "text": "boom" }"#,
        )
        .unwrap();
        let msg = cline_message_to_universal(&row, "s", "p", "src", 0).unwrap();
        assert_eq!(msg.role, MessageRole::System);
        assert_eq!(msg.message_type, MessageType::Error);
        assert!(msg.errors.is_some());
    }

    #[test]
    fn test_parse_scheme_path_windows_drive_letter() {
        // Windows base path with a drive letter and a cwd with a drive letter:
        // the `|` separator must not be confused with the `:` in `C:`.
        let p = "cline://C:\\Users\\me\\AppData\\Roaming\\Code\\User\\globalStorage\\saoudrizwan.claude-dev|C:\\Users\\me\\proj";
        let (base, tail) = parse_scheme_path(p).unwrap();
        assert_eq!(
            base,
            PathBuf::from(
                "C:\\Users\\me\\AppData\\Roaming\\Code\\User\\globalStorage\\saoudrizwan.claude-dev"
            )
        );
        assert_eq!(tail, "C:\\Users\\me\\proj");
    }

    #[test]
    fn test_parse_scheme_path_unix() {
        let p = "cline:///home/me/.config/Code/User/globalStorage/saoudrizwan.claude-dev|/home/me/proj";
        let (base, tail) = parse_scheme_path(p).unwrap();
        assert_eq!(
            base,
            PathBuf::from("/home/me/.config/Code/User/globalStorage/saoudrizwan.claude-dev")
        );
        assert_eq!(tail, "/home/me/proj");
    }

    #[test]
    fn test_is_safe_task_id() {
        assert!(is_safe_task_id("1700000000000-abc-DEF_123"));
        assert!(!is_safe_task_id(""));
        assert!(!is_safe_task_id("../escape"));
        assert!(!is_safe_task_id("a/b"));
        assert!(!is_safe_task_id("a\\b"));
    }

    #[test]
    fn test_map_tool_name() {
        assert_eq!(map_tool_name("readFile"), "Read");
        assert_eq!(map_tool_name("editedExistingFile"), "Write");
        assert_eq!(map_tool_name("searchFiles"), "Grep");
        assert_eq!(map_tool_name("webSearch"), "WebSearch");
        assert_eq!(map_tool_name("customThing"), "customThing");
    }

    #[test]
    fn test_truncate_chars() {
        assert_eq!(truncate_chars("short", 100), "short");
        let long = "x".repeat(150);
        let t = truncate_chars(&long, 100);
        assert_eq!(t.chars().count(), 103); // 100 + "..."
        assert!(t.ends_with("..."));
    }
}
