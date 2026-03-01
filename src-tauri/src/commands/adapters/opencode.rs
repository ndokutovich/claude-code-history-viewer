// ============================================================================
// OPENCODE ADAPTER (v1.9.0)
// ============================================================================
// Converts OpenCode normalized JSON directory structure to UniversalMessage.
//
// OpenCode stores data in:
//   $OPENCODE_HOME/storage/
//     project/{id}.json          -> project definitions
//     session/{project-id}/{id}.json  -> sessions
//     message/{session-id}/{id}.json  -> messages
//     part/{message-id}/{name}.json   -> message content parts
//
// PATTERN REFERENCE: Cursor adapter (commands/adapters/cursor.rs)
// CLEAN CODE: Explicit types, standardized errors, camelCase metadata keys

use crate::models::universal::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// RAW OPENCODE DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeProject {
    pub id: String,
    pub worktree: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeSession {
    pub id: String,
    pub title: Option<String>,
    pub time: OpenCodeTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeTime {
    pub created: i64,  // epoch milliseconds
    pub updated: i64,  // epoch milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeMessage {
    pub id: String,
    pub role: String,
    #[serde(rename = "modelID")]
    pub model_id: Option<String>,
    #[serde(rename = "parentID")]
    pub parent_id: Option<String>,
    pub time: OpenCodeTime,
    pub tokens: Option<OpenCodeTokens>,
    pub cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeTokens {
    pub input: u64,
    pub output: u64,
}

// ============================================================================
// PART TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodePart {
    #[serde(rename = "type")]
    pub part_type: String,

    // text part
    pub text: Option<String>,

    // reasoning part
    pub reasoning: Option<String>,

    // compaction part
    pub summary: Option<String>,

    // tool part
    pub tool: Option<String>,
    #[serde(rename = "callID")]
    pub call_id: Option<String>,
    pub state: Option<Value>,

    // step-finish part
    pub cost: Option<f64>,

    // file part
    pub file: Option<Value>,

    // patch part
    pub patch: Option<Value>,
}

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Get the OpenCode base path using the standard detection order:
/// 1. $OPENCODE_HOME env var
/// 2. $XDG_DATA_HOME/opencode
/// 3. ~/.local/share/opencode
/// 4. Windows: %APPDATA%/opencode or %LOCALAPPDATA%/opencode
pub fn get_opencode_base_path() -> Option<PathBuf> {
    // Priority 1: $OPENCODE_HOME env var
    if let Ok(opencode_home) = std::env::var("OPENCODE_HOME") {
        let path = PathBuf::from(opencode_home);
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 2: $XDG_DATA_HOME/opencode (Linux/macOS XDG standard)
    if let Ok(xdg_data_home) = std::env::var("XDG_DATA_HOME") {
        let path = PathBuf::from(xdg_data_home).join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 3: ~/.local/share/opencode (Linux/macOS default)
    if let Some(home) = dirs::home_dir() {
        let path = home.join(".local").join("share").join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 4: Windows %APPDATA%/opencode
    if let Ok(appdata) = std::env::var("APPDATA") {
        let path = PathBuf::from(appdata).join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 5: Windows %LOCALAPPDATA%/opencode
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        let path = PathBuf::from(localappdata).join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    None
}

// ============================================================================
// PROJECT SCANNING
// ============================================================================

/// Scan all OpenCode projects from storage/project/{id}.json files
pub fn scan_opencode_projects_impl(
    base_path: &Path,
    source_id: &str,
) -> Result<Vec<UniversalProject>, String> {
    let project_dir = base_path.join("storage").join("project");

    if !project_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&project_dir)
        .map_err(|e| format!("OPENCODE_READ_ERROR: Cannot read project directory: {}", e))?;

    let mut projects: Vec<UniversalProject> = Vec::new();

    for entry_result in entries {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Skipping directory entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        // Only process .json files
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        // Extract ID from filename (strip .json extension)
        let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        if !is_safe_storage_id(&file_stem) {
            eprintln!("OPENCODE_WARN: Skipping unsafe project ID: {}", file_stem);
            continue;
        }

        // Parse JSON
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot read {}: {}", path.display(), e);
                continue;
            }
        };

        let project: OpenCodeProject = match serde_json::from_str(&content) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot parse {}: {}", path.display(), e);
                continue;
            }
        };

        // Count sessions for this project
        let session_count = count_sessions_for_project(base_path, &project.id);

        // Determine display name: title or basename of worktree path
        let display_name = project.title.clone().unwrap_or_else(|| {
            PathBuf::from(&project.worktree)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&project.id)
                .to_string()
        });

        let mut metadata: HashMap<String, Value> = HashMap::new();
        metadata.insert("projectWorktree".to_string(), json!(project.worktree));

        projects.push(UniversalProject {
            id: project.id.clone(),
            source_id: source_id.to_string(),
            provider_id: "opencode".to_string(),
            name: display_name,
            // Virtual path - OpenCode projects are identified by ID, not filesystem path
            path: format!("opencode://{}", project.id),
            session_count,
            total_messages: 0,
            first_activity_at: None,
            last_activity_at: None,
            metadata,
        });
    }

    // Sort by project ID (stable ordering)
    projects.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(projects)
}

/// Count how many sessions exist for a given project ID
fn count_sessions_for_project(base_path: &Path, project_id: &str) -> usize {
    let session_dir = base_path
        .join("storage")
        .join("session")
        .join(project_id);

    if !session_dir.exists() {
        return 0;
    }

    fs::read_dir(&session_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json")
                })
                .count()
        })
        .unwrap_or(0)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

/// Load sessions for one OpenCode project from storage/session/{project-id}/{id}.json
pub fn load_opencode_sessions_impl(
    base_path: &Path,
    project_id: &str,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    if !is_safe_storage_id(project_id) {
        return Err(format!(
            "OPENCODE_SECURITY_ERROR: Unsafe project ID: {}",
            project_id
        ));
    }

    let session_dir = base_path
        .join("storage")
        .join("session")
        .join(project_id);

    if !session_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&session_dir)
        .map_err(|e| format!("OPENCODE_READ_ERROR: Cannot read session directory: {}", e))?;

    let mut sessions: Vec<UniversalSession> = Vec::new();

    for entry_result in entries {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Skipping session entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        if !is_safe_storage_id(&file_stem) {
            eprintln!("OPENCODE_WARN: Skipping unsafe session ID: {}", file_stem);
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot read {}: {}", path.display(), e);
                continue;
            }
        };

        let session: OpenCodeSession = match serde_json::from_str(&content) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot parse {}: {}", path.display(), e);
                continue;
            }
        };

        // Count messages for this session
        let message_count = count_messages_for_session(base_path, &session.id);

        let title = session
            .title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| format!("Session {}", &session.id[..8.min(session.id.len())]));

        let first_message_at = epoch_ms_to_rfc3339(session.time.created);
        let last_message_at = epoch_ms_to_rfc3339(session.time.updated);

        let duration = session.time.updated.saturating_sub(session.time.created);

        let checksum = format!("{:x}", session.id.len() ^ (session.time.updated as usize));

        sessions.push(UniversalSession {
            id: session.id.clone(),
            project_id: project_id.to_string(),
            source_id: source_id.to_string(),
            provider_id: "opencode".to_string(),
            title,
            description: session.title.clone(),
            message_count,
            first_message_at,
            last_message_at,
            duration,
            total_tokens: None,
            tool_call_count: 0,
            error_count: 0,
            metadata: HashMap::new(),
            checksum,
        });
    }

    // Sort by updated time descending (most recent first)
    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));

    Ok(sessions)
}

/// Count messages for a session
fn count_messages_for_session(base_path: &Path, session_id: &str) -> usize {
    let message_dir = base_path
        .join("storage")
        .join("message")
        .join(session_id);

    if !message_dir.exists() {
        return 0;
    }

    fs::read_dir(&message_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json")
                })
                .count()
        })
        .unwrap_or(0)
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

/// Load messages for one OpenCode session with pagination
pub fn load_opencode_messages_impl(
    base_path: &Path,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    if !is_safe_storage_id(session_id) {
        return Err(format!(
            "OPENCODE_SECURITY_ERROR: Unsafe session ID: {}",
            session_id
        ));
    }

    let message_dir = base_path
        .join("storage")
        .join("message")
        .join(session_id);

    if !message_dir.exists() {
        return Ok(Vec::new());
    }

    // Collect all message JSON files
    let entries = fs::read_dir(&message_dir)
        .map_err(|e| format!("OPENCODE_READ_ERROR: Cannot read message directory: {}", e))?;

    let mut message_files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json"))
        .collect();

    // Sort files by name for stable ordering
    message_files.sort();

    // Apply pagination
    let total = message_files.len();
    let start = offset.min(total);
    let end = (offset + limit).min(total);
    let page_files = &message_files[start..end];

    let mut messages: Vec<UniversalMessage> = Vec::new();

    for (idx, path) in page_files.iter().enumerate() {
        let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        if !is_safe_storage_id(&file_stem) {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot read {}: {}", path.display(), e);
                continue;
            }
        };

        let raw_msg: OpenCodeMessage = match serde_json::from_str(&content) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot parse {}: {}", path.display(), e);
                continue;
            }
        };

        // Load parts for this message
        let parts = load_parts_for_message(base_path, &raw_msg.id);

        // Convert to UniversalMessage
        let universal = opencode_message_to_universal(
            &raw_msg,
            parts,
            session_id,
            project_id,
            source_id,
            (start + idx) as i32,
        );

        messages.push(universal);
    }

    Ok(messages)
}

/// Load all parts for a message from storage/part/{message-id}/{name}.json
fn load_parts_for_message(base_path: &Path, message_id: &str) -> Vec<OpenCodePart> {
    if !is_safe_storage_id(message_id) {
        return Vec::new();
    }

    let part_dir = base_path
        .join("storage")
        .join("part")
        .join(message_id);

    if !part_dir.exists() {
        return Vec::new();
    }

    let mut part_files: Vec<PathBuf> = fs::read_dir(&part_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json"))
                .collect()
        })
        .unwrap_or_default();

    // Sort part files by name for stable ordering
    part_files.sort();

    let mut parts: Vec<OpenCodePart> = Vec::new();

    for path in &part_files {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let part: OpenCodePart = match serde_json::from_str(&content) {
            Ok(p) => p,
            Err(_) => continue,
        };

        parts.push(part);
    }

    parts
}

// ============================================================================
// CONVERSION TO UNIVERSAL FORMAT
// ============================================================================

/// Convert an OpenCode message + its parts to UniversalMessage
fn opencode_message_to_universal(
    msg: &OpenCodeMessage,
    parts: Vec<OpenCodePart>,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    sequence_number: i32,
) -> UniversalMessage {
    let role = match msg.role.as_str() {
        "user" => MessageRole::User,
        "assistant" => MessageRole::Assistant,
        "system" => MessageRole::System,
        _ => MessageRole::Assistant,
    };

    // Convert parts to UniversalContent items
    let content = convert_parts_to_content(&parts);

    // Extract tokens if available
    let tokens = msg.tokens.as_ref().map(|t| TokenUsage {
        input_tokens: t.input as i32,
        output_tokens: t.output as i32,
        total_tokens: (t.input + t.output) as i32,
        cache_creation_tokens: None,
        cache_read_tokens: None,
        service_tier: None,
    });

    // Collect tool calls from tool parts
    let tool_calls = extract_tool_calls(&parts);
    let tool_calls_opt = if tool_calls.is_empty() {
        None
    } else {
        Some(tool_calls)
    };

    // Extract thinking from reasoning parts
    let thinking = extract_thinking(&parts);

    let mut metadata: HashMap<String, Value> = HashMap::new();
    if let Some(ref cost) = msg.cost {
        metadata.insert("cost".to_string(), json!(cost));
    }

    UniversalMessage {
        id: msg.id.clone(),
        session_id: session_id.to_string(),
        project_id: project_id.to_string(),
        source_id: source_id.to_string(),
        provider_id: "opencode".to_string(),
        timestamp: epoch_ms_to_rfc3339(msg.time.created),
        sequence_number,
        role,
        message_type: MessageType::Message,
        content,
        parent_id: msg.parent_id.clone(),
        depth: None,
        branch_id: None,
        model: msg.model_id.clone(),
        tokens,
        tool_calls: tool_calls_opt,
        thinking,
        attachments: None,
        errors: None,
        original_format: "opencode_json".to_string(),
        provider_metadata: metadata,
    }
}

/// Convert OpenCode parts to UniversalContent items
fn convert_parts_to_content(parts: &[OpenCodePart]) -> Vec<UniversalContent> {
    let mut content_items: Vec<UniversalContent> = Vec::new();

    for part in parts {
        match part.part_type.as_str() {
            "text" => {
                if let Some(ref text) = part.text {
                    content_items.push(UniversalContent {
                        content_type: ContentType::Text,
                        data: json!({"text": text}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(text.len()),
                        hash: None,
                    });
                }
            }

            "reasoning" => {
                if let Some(ref reasoning) = part.reasoning {
                    // Reasoning maps to Thinking content type
                    content_items.push(UniversalContent {
                        content_type: ContentType::Thinking,
                        data: json!({"thinking": reasoning}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(reasoning.len()),
                        hash: None,
                    });
                }
            }

            "tool" => {
                let tool_name = part
                    .tool
                    .as_deref()
                    .map(normalize_tool_name)
                    .unwrap_or_else(|| "Unknown".to_string());

                let call_id = part
                    .call_id
                    .clone()
                    .unwrap_or_else(|| format!("call-{}", tool_name.to_lowercase()));

                // Extract state fields
                let (input, status, output, error) = if let Some(ref state) = part.state {
                    let input = state.get("input").cloned().unwrap_or(Value::Null);
                    let normalized_input = normalize_tool_input(input);
                    let status = state
                        .get("status")
                        .and_then(|s| s.as_str())
                        .unwrap_or("pending")
                        .to_string();
                    let output = state.get("output").cloned();
                    let error = state.get("error").cloned();
                    (normalized_input, status, output, error)
                } else {
                    (Value::Object(serde_json::Map::new()), "pending".to_string(), None, None)
                };

                content_items.push(UniversalContent {
                    content_type: ContentType::ToolUse,
                    data: json!({
                        "id": call_id,
                        "name": tool_name,
                        "input": input,
                        "status": status,
                        "output": output,
                        "error": error,
                    }),
                    encoding: None,
                    mime_type: Some("application/json".to_string()),
                    size: None,
                    hash: None,
                });
            }

            "compaction" => {
                if let Some(ref summary) = part.summary {
                    content_items.push(UniversalContent {
                        content_type: ContentType::Text,
                        data: json!({"text": summary, "isCompactionSummary": true}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(summary.len()),
                        hash: None,
                    });
                }
            }

            "file" => {
                if let Some(ref file_val) = part.file {
                    let name = file_val
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let url = file_val
                        .get("url")
                        .and_then(|u| u.as_str())
                        .unwrap_or("")
                        .to_string();

                    content_items.push(UniversalContent {
                        content_type: ContentType::File,
                        data: json!({"name": name, "url": url}),
                        encoding: None,
                        mime_type: None,
                        size: None,
                        hash: None,
                    });
                }
            }

            // step-finish, patch, snapshot, agent, subtask, retry, step-start -> skip
            _ => {}
        }
    }

    content_items
}

/// Extract tool calls from tool parts
fn extract_tool_calls(parts: &[OpenCodePart]) -> Vec<ToolCall> {
    parts
        .iter()
        .filter(|p| p.part_type == "tool")
        .filter_map(|p| {
            let tool_name = p.tool.as_deref().map(normalize_tool_name)?;
            let call_id = p
                .call_id
                .clone()
                .unwrap_or_else(|| format!("call-{}", tool_name.to_lowercase()));

            let (input_map, status, output, error_str) = if let Some(ref state) = p.state {
                let raw_input = state.get("input").cloned().unwrap_or(Value::Null);
                let normalized = normalize_tool_input(raw_input);
                let input_map = if let Value::Object(map) = normalized {
                    map.into_iter()
                        .map(|(k, v)| (k, v))
                        .collect::<HashMap<String, Value>>()
                } else {
                    HashMap::new()
                };
                let status_str = state
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("pending")
                    .to_string();
                let output = state.get("output").and_then(|o| {
                    if o.is_object() {
                        Some(
                            o.as_object()
                                .unwrap()
                                .iter()
                                .map(|(k, v)| (k.clone(), v.clone()))
                                .collect::<HashMap<String, Value>>(),
                        )
                    } else {
                        None
                    }
                });
                let error_str = state
                    .get("error")
                    .and_then(|e| e.as_str())
                    .map(String::from);
                (input_map, status_str, output, error_str)
            } else {
                (HashMap::new(), "pending".to_string(), None, None)
            };

            let call_status = match status.as_str() {
                "complete" | "success" => ToolCallStatus::Success,
                "error" | "failed" => ToolCallStatus::Error,
                _ => ToolCallStatus::Pending,
            };

            Some(ToolCall {
                id: call_id,
                name: tool_name,
                input: input_map,
                output,
                error: error_str,
                status: call_status,
            })
        })
        .collect()
}

/// Extract thinking block from reasoning parts
fn extract_thinking(parts: &[OpenCodePart]) -> Option<ThinkingBlock> {
    let reasoning_texts: Vec<&str> = parts
        .iter()
        .filter(|p| p.part_type == "reasoning")
        .filter_map(|p| p.reasoning.as_deref())
        .collect();

    if reasoning_texts.is_empty() {
        return None;
    }

    Some(ThinkingBlock {
        content: reasoning_texts.join("\n"),
        signature: None,
        model: None,
    })
}

// ============================================================================
// TOOL NAME NORMALIZATION
// ============================================================================

/// Normalize OpenCode lowercase tool names to PascalCase display names
pub fn normalize_tool_name(raw: &str) -> String {
    let lower = raw.to_lowercase();
    match lower.as_str() {
        "read" => "Read".to_string(),
        "bash" => "Bash".to_string(),
        "glob" => "Glob".to_string(),
        "grep" => "Grep".to_string(),
        "write" => "Write".to_string(),
        "edit" => "Edit".to_string(),
        "todowrite" => "TodoWrite".to_string(),
        "webfetch" => "WebFetch".to_string(),
        "task" | "call_omo_agent" => "Task".to_string(),
        _ if lower.starts_with("websearch") => "WebSearch".to_string(),
        _ => {
            // Default: capitalize first letter
            let mut chars = raw.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
    }
}

// ============================================================================
// TOOL INPUT KEY NORMALIZATION
// ============================================================================

/// Normalize camelCase tool input keys to snake_case for consistency
pub fn normalize_tool_input(input: Value) -> Value {
    match input {
        Value::Object(map) => {
            let normalized: serde_json::Map<String, Value> = map
                .into_iter()
                .map(|(k, v)| {
                    let new_key = match k.as_str() {
                        "filePath" => "file_path".to_string(),
                        "oldString" => "old_string".to_string(),
                        "newString" => "new_string".to_string(),
                        "replaceAll" => "replace_all".to_string(),
                        "runInBackground" => "run_in_background".to_string(),
                        "allowedDomains" => "allowed_domains".to_string(),
                        "blockedDomains" => "blocked_domains".to_string(),
                        _ => k,
                    };
                    (new_key, normalize_tool_input(v))
                })
                .collect();
            Value::Object(normalized)
        }
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(normalize_tool_input).collect())
        }
        other => other,
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Convert epoch milliseconds to RFC3339 timestamp string
pub fn epoch_ms_to_rfc3339(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    match Utc.timestamp_opt(secs, nanos) {
        chrono::LocalResult::Single(dt) => dt.to_rfc3339(),
        _ => {
            // Fallback to current time if conversion fails
            Utc::now().to_rfc3339()
        }
    }
}

/// Validate a storage ID to prevent path traversal attacks
/// Only allows alphanumeric characters, hyphens, and underscores
pub fn is_safe_storage_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 256 {
        return false;
    }
    id.chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_tool_name_known_tools() {
        assert_eq!(normalize_tool_name("read"), "Read");
        assert_eq!(normalize_tool_name("bash"), "Bash");
        assert_eq!(normalize_tool_name("glob"), "Glob");
        assert_eq!(normalize_tool_name("grep"), "Grep");
        assert_eq!(normalize_tool_name("write"), "Write");
        assert_eq!(normalize_tool_name("edit"), "Edit");
        assert_eq!(normalize_tool_name("todowrite"), "TodoWrite");
        assert_eq!(normalize_tool_name("webfetch"), "WebFetch");
        assert_eq!(normalize_tool_name("task"), "Task");
        assert_eq!(normalize_tool_name("call_omo_agent"), "Task");
    }

    #[test]
    fn test_normalize_tool_name_websearch_variants() {
        assert_eq!(normalize_tool_name("websearch"), "WebSearch");
        assert_eq!(normalize_tool_name("websearch_brave"), "WebSearch");
        assert_eq!(normalize_tool_name("WEBSEARCH"), "WebSearch");
    }

    #[test]
    fn test_normalize_tool_name_unknown_capitalizes() {
        assert_eq!(normalize_tool_name("unknown_tool"), "Unknown_tool");
        assert_eq!(normalize_tool_name("myTool"), "MyTool");
    }

    #[test]
    fn test_normalize_tool_input_key_mapping() {
        let input = json!({
            "filePath": "/some/path",
            "oldString": "old",
            "newString": "new",
            "replaceAll": true,
        });
        let result = normalize_tool_input(input);
        let obj = result.as_object().unwrap();
        assert!(obj.contains_key("file_path"), "Missing file_path");
        assert!(obj.contains_key("old_string"), "Missing old_string");
        assert!(obj.contains_key("new_string"), "Missing new_string");
        assert!(obj.contains_key("replace_all"), "Missing replace_all");
    }

    #[test]
    fn test_epoch_ms_to_rfc3339_unix_epoch() {
        let result = epoch_ms_to_rfc3339(0);
        assert!(result.starts_with("1970-01-01"));
    }

    #[test]
    fn test_epoch_ms_to_rfc3339_positive() {
        // 2024-01-01T00:00:00Z = 1704067200000 ms
        let result = epoch_ms_to_rfc3339(1_704_067_200_000);
        assert!(result.starts_with("2024-01-01"));
    }

    #[test]
    fn test_is_safe_storage_id_valid() {
        assert!(is_safe_storage_id("abc123"));
        assert!(is_safe_storage_id("my-session-id"));
        assert!(is_safe_storage_id("session_01abc"));
        assert!(is_safe_storage_id("abc-123-DEF"));
    }

    #[test]
    fn test_is_safe_storage_id_invalid() {
        assert!(!is_safe_storage_id(""));
        assert!(!is_safe_storage_id("../etc/passwd"));
        assert!(!is_safe_storage_id("path/with/slash"));
        assert!(!is_safe_storage_id("id with spaces"));
        assert!(!is_safe_storage_id("id.with.dots"));
    }

    #[test]
    fn test_is_safe_storage_id_too_long() {
        let long_id: String = "a".repeat(257);
        assert!(!is_safe_storage_id(&long_id));
    }
}
