// ============================================================================
// GEMINI CLI ADAPTER
// ============================================================================
// Converts Gemini CLI JSON format to UniversalMessage
//
// File Location: ~/.gemini/tmp/**/session-*.json
// Format: Single JSON file per session (not JSONL!)
//
// Structure:
// {
//   "sessionId": "...",
//   "projectHash": "sha256-of-cwd",  // IMPORTANT: Used to resolve working directory
//   "startTime": "2025-01-01T00:00:00Z",
//   "lastUpdated": "2025-01-01T01:00:00Z",
//   "model": "gemini-1.5-pro",
//   "messages": [...]
// }

use crate::models::universal::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid;

// ============================================================================
// GEMINI-SPECIFIC TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiSession {
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,

    #[serde(rename = "projectHash")]
    pub project_hash: Option<String>,

    #[serde(rename = "startTime")]
    pub start_time: Option<String>,

    #[serde(rename = "lastUpdated")]
    pub last_updated: Option<String>,

    pub model: Option<String>,

    pub messages: Option<Vec<Value>>,

    // Fallback: root array or history field
    pub history: Option<Vec<Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiMessage {
    #[serde(rename = "type")]
    pub message_type: Option<String>,

    pub role: Option<String>,

    pub content: Option<Value>,

    pub timestamp: Option<String>,

    pub id: Option<String>,

    pub uuid: Option<String>,

    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,

    pub model: Option<String>,

    // Tool calls
    pub name: Option<String>,
    pub tool: Option<String>,
    pub input: Option<Value>,
    pub output: Option<Value>,
}

// ============================================================================
// GEMINI HASH RESOLVER
// ============================================================================
// Maps projectHash (SHA-256) → actual working directory path
// Seeded from Claude Code / Cursor sessions for smart CWD resolution

pub struct GeminiHashResolver {
    map: HashMap<String, String>, // hash → cwd
}

impl GeminiHashResolver {
    pub fn new() -> Self {
        Self {
            map: HashMap::new(),
        }
    }

    /// Resolve projectHash to working directory
    pub fn resolve(&self, hash: &str) -> Option<String> {
        self.map.get(hash).cloned()
    }

    /// Register known CWD (from Claude Code or Cursor sessions)
    pub fn register(&mut self, cwd: &str) {
        let normalized = normalize_path(cwd);
        let hash = compute_sha256(&normalized);
        self.map.insert(hash, cwd.to_string());
    }

    /// Seed resolver with CWDs from other sessions
    pub fn seed_from_sessions(&mut self, sessions: &[UniversalSession]) {
        for session in sessions {
            if let Some(cwd) = session.metadata.get("cwd") {
                if let Some(cwd_str) = cwd.as_str() {
                    self.register(cwd_str);
                }
            }
        }
    }
}

fn normalize_path(path: &str) -> String {
    // Normalize path for consistent hashing
    path.replace("\\", "/").to_lowercase()
}

fn compute_sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/// Convert Gemini session file to UniversalProject
///
/// Groups Gemini sessions by parent directory (project hash)
pub fn gemini_sessions_to_projects(
    gemini_root: &Path,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    // Find all session-*.json files
    let session_files = find_gemini_sessions(gemini_root)?;

    // Group by parent directory (each directory is a "project")
    let mut projects: HashMap<String, Vec<PathBuf>> = HashMap::new();

    for file in session_files {
        if let Some(project_dir) = gemini_project_dir(&file) {
            let key = project_dir.to_string_lossy().to_string();
            projects.entry(key).or_insert_with(Vec::new).push(file);
        }
    }

    // Convert to UniversalProject
    let mut result = Vec::new();

    for (project_path, files) in projects {
        let project_name = Path::new(&project_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        // Try to extract projectHash from first file
        let mut project_hash = None;
        if let Some(first_file) = files.first() {
            if let Ok(content) = fs::read_to_string(first_file) {
                if let Ok(session) = serde_json::from_str::<GeminiSession>(&content) {
                    project_hash = session.project_hash.clone();
                }
            }
        }

        let project = UniversalProject {
            id: compute_sha256(&project_path),
            source_id: source_id.clone(),
            provider_id: "gemini".to_string(),
            name: project_name,
            path: project_path.clone(),
            session_count: files.len(),
            total_messages: 0, // Will be calculated when sessions are loaded
            first_activity_at: None,
            last_activity_at: None,
            metadata: {
                let mut meta = HashMap::new();
                if let Some(hash) = project_hash {
                    meta.insert("project_hash".to_string(), json!(hash));
                }
                // Gemini CLI may record the real working directory in `.project_root`
                if let Some(root) = read_gemini_project_root(Path::new(&project_path)) {
                    meta.insert("project_root".to_string(), json!(root));
                    meta.insert("cwd".to_string(), json!(root));
                }
                meta
            },
        };

        result.push(project);
    }

    Ok(result)
}

/// Convert Gemini session file to UniversalSession
pub fn gemini_file_to_session(
    file_path: &Path,
    project_id: String,
    source_id: String,
    resolver: &GeminiHashResolver,
) -> Result<UniversalSession, String> {
    // Read JSON file
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read Gemini session: {}", e))?;

    let session: GeminiSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Gemini session: {}", e))?;

    // Extract messages array (with fallbacks)
    let messages = session
        .messages
        .or(session.history)
        .unwrap_or_else(Vec::new);

    let message_count = messages.len();

    // Extract title from first user message
    let title =
        extract_first_user_text(&messages).unwrap_or_else(|| "Untitled Session".to_string());

    // Resolve CWD from projectHash
    let cwd = session
        .project_hash
        .as_ref()
        .and_then(|hash| resolver.resolve(hash));

    // Session metadata (use camelCase for frontend compatibility)
    let mut metadata = HashMap::new();
    metadata.insert("filePath".to_string(), json!(file_path.to_string_lossy())); // camelCase!
    if let Some(ref hash) = session.project_hash {
        metadata.insert("projectHash".to_string(), json!(hash)); // camelCase!
    }
    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), json!(cwd_path));
    }
    if let Some(ref model) = session.model {
        metadata.insert("model".to_string(), json!(model));
    }

    // File size
    let file_size = fs::metadata(file_path)
        .ok()
        .and_then(|m| Some(m.len() as i32));

    if let Some(size) = file_size {
        metadata.insert("fileSizeBytes".to_string(), json!(size)); // camelCase!
    }

    // Get timestamps with defaults if missing
    let first_message_at = session
        .start_time
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    let last_message_at = session
        .last_updated
        .unwrap_or_else(|| first_message_at.clone());

    Ok(UniversalSession {
        id: compute_sha256(&file_path.to_string_lossy()),
        project_id,
        source_id,
        provider_id: "gemini".to_string(),
        title,
        description: None,
        message_count,
        first_message_at,
        last_message_at,
        duration: 0, // Unknown for Gemini sessions
        total_tokens: None,
        tool_call_count: 0,
        error_count: 0,
        metadata,
        checksum: compute_sha256(&content),
    })
}

/// Convert Gemini message to UniversalMessage
pub fn gemini_message_to_universal(
    msg_value: &Value,
    session_id: String,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> Result<UniversalMessage, String> {
    let msg: GeminiMessage = serde_json::from_value(msg_value.clone())
        .map_err(|e| format!("Failed to parse Gemini message: {}", e))?;

    // Determine role
    let role = determine_gemini_role(&msg);

    // Determine message type
    let message_type = determine_gemini_type(&msg);

    // Convert content (text, thinking, and multi-part: image/file/code/tool_result)
    let content = convert_gemini_content(&msg, msg_value);

    // Convert tool calls (native toolCalls[] + Part-level functionCall + legacy)
    let tool_calls = convert_gemini_tool_calls(&msg, msg_value);

    // Convert token usage (Gemini exposes tokens on assistant messages)
    let tokens = convert_gemini_tokens(msg_value);

    // Build provider_metadata
    let mut provider_metadata = HashMap::new();
    provider_metadata.insert("original_type".to_string(), json!(msg.message_type));
    provider_metadata.insert("raw_content".to_string(), msg_value.clone());

    Ok(UniversalMessage {
        id: msg
            .id
            .or(msg.uuid)
            .unwrap_or_else(|| format!("gemini-{}", sequence_number)),
        session_id,
        project_id,
        source_id,
        provider_id: "gemini".to_string(),
        timestamp: msg
            .timestamp
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        sequence_number,
        role,
        message_type,
        content,
        parent_id: msg.parent_id,
        depth: None,
        branch_id: None,
        model: msg.model,
        tokens,
        tool_calls,
        thinking: None, // Reasoning is emitted as Thinking content blocks (see convert_gemini_content)
        attachments: None,
        errors: None,
        original_format: "gemini_json".to_string(),
        provider_metadata,
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Resolve the project directory for a Gemini session file.
///
/// Gemini CLI stores sessions at `tmp/<projectHash>/chats/session-*.json`, so
/// the project directory is the parent of the `chats` folder. Flat layouts
/// (`tmp/<projectHash>/session-*.json`) fall back to the immediate parent.
fn gemini_project_dir(file: &Path) -> Option<PathBuf> {
    let parent = file.parent()?;
    if parent.file_name().and_then(|n| n.to_str()) == Some("chats") {
        Some(parent.parent().unwrap_or(parent).to_path_buf())
    } else {
        Some(parent.to_path_buf())
    }
}

/// Read the optional `.project_root` file written by Gemini CLI, which records
/// the real working directory for a project. Symlinks are rejected.
fn read_gemini_project_root(project_dir: &Path) -> Option<String> {
    let root_file = project_dir.join(".project_root");
    if fs::symlink_metadata(&root_file)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
    {
        return None;
    }
    fs::read_to_string(root_file)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn find_gemini_sessions(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut sessions = Vec::new();

    fn visit_dirs(dir: &Path, sessions: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, sessions)?;
                } else if let Some(name) = path.file_name() {
                    if let Some(name_str) = name.to_str() {
                        if name_str.starts_with("session-") && name_str.ends_with(".json") {
                            sessions.push(path);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    visit_dirs(root, &mut sessions)
        .map_err(|e| format!("Failed to scan Gemini sessions: {}", e))?;

    Ok(sessions)
}

fn extract_first_user_text(messages: &[Value]) -> Option<String> {
    for msg_value in messages {
        if let Ok(msg) = serde_json::from_value::<GeminiMessage>(msg_value.clone()) {
            let role_str = msg.role.as_deref().or(msg.message_type.as_deref())?;
            if role_str == "user" || role_str == "human" {
                return extract_text_from_content(&msg.content?);
            }
        }
    }
    None
}

fn extract_text_from_content(content: &Value) -> Option<String> {
    match content {
        Value::String(s) => Some(s.clone()),
        Value::Object(obj) => obj
            .get("text")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        Value::Array(arr) => {
            // Try to extract text from array items
            for item in arr {
                if let Some(text) = extract_text_from_content(item) {
                    return Some(text);
                }
            }
            None
        }
        _ => None,
    }
}

fn determine_gemini_role(msg: &GeminiMessage) -> MessageRole {
    let role_str = msg
        .role
        .as_deref()
        .or(msg.message_type.as_deref())
        .unwrap_or("assistant");

    match role_str {
        "user" | "human" => MessageRole::User,
        "gemini" | "model" | "assistant" => MessageRole::Assistant,
        "system" | "info" | "warning" | "error" => MessageRole::System,
        "tool" | "tool_result" => MessageRole::Function,
        _ => MessageRole::Assistant,
    }
}

fn determine_gemini_type(msg: &GeminiMessage) -> MessageType {
    let type_str = msg.message_type.as_deref().unwrap_or("message");

    match type_str {
        "error" => MessageType::Error,
        "summary" => MessageType::Summary,
        _ => MessageType::Message, // tool_use, tool_call, tool_result are all Message type
    }
}

fn text_content(text: String) -> UniversalContent {
    let size = text.len();
    UniversalContent {
        content_type: ContentType::Text,
        data: json!({ "text": text }),
        encoding: None,
        mime_type: None,
        size: Some(size),
        hash: None,
    }
}

fn thinking_content(text: String) -> UniversalContent {
    let size = text.len();
    UniversalContent {
        content_type: ContentType::Thinking,
        data: json!({ "text": text }),
        encoding: None,
        mime_type: None,
        size: Some(size),
        hash: None,
    }
}

/// Convert a Gemini message's content into UniversalContent blocks.
///
/// Handles the native Gemini CLI shapes: top-level `thoughts[]` (reasoning),
/// string content, and `Part[]` arrays (text/thought, inlineData image+file,
/// fileData, executableCode, codeExecutionResult, functionResponse). Plain
/// string and `{ text }` content remain supported for backwards compatibility.
fn convert_gemini_content(msg: &GeminiMessage, raw: &Value) -> Vec<UniversalContent> {
    let mut items = Vec::new();

    // Gemini assistant reasoning lives in a top-level `thoughts` array
    if let Some(thoughts) = raw.get("thoughts").and_then(Value::as_array) {
        for thought in thoughts {
            let subject = thought.get("subject").and_then(Value::as_str).unwrap_or("");
            let description = thought
                .get("description")
                .and_then(Value::as_str)
                .unwrap_or("");
            let text = match (subject.is_empty(), description.is_empty()) {
                (true, true) => continue,
                (true, false) => description.to_string(),
                (false, true) => subject.to_string(),
                (false, false) => format!("**{subject}**\n{description}"),
            };
            items.push(thinking_content(text));
        }
    }

    // Message content: string | Part[] | { text }
    match msg.content.as_ref() {
        Some(Value::String(s)) => {
            if !s.is_empty() {
                items.push(text_content(s.clone()));
            }
        }
        Some(Value::Array(parts)) => {
            for part in parts {
                push_part_content(part, &mut items);
            }
        }
        Some(other @ Value::Object(_)) => {
            if let Some(text) = extract_text_from_content(other) {
                if !text.is_empty() {
                    items.push(text_content(text));
                }
            }
        }
        _ => {}
    }

    items
}

/// Convert a single Gemini `Part` into 0..n content blocks.
/// `functionCall` parts are intentionally skipped here; they are surfaced via
/// `convert_gemini_tool_calls` instead.
fn push_part_content(part: &Value, items: &mut Vec<UniversalContent>) {
    // text (optionally flagged as a `thought`)
    if let Some(text) = part.get("text").and_then(Value::as_str) {
        if part.get("thought").and_then(Value::as_bool).unwrap_or(false) {
            items.push(thinking_content(text.to_string()));
        } else if !text.is_empty() {
            items.push(text_content(text.to_string()));
        }
        return;
    }

    // inlineData (base64 image or other document)
    if let Some(inline) = part.get("inlineData") {
        let mime = inline.get("mimeType").and_then(Value::as_str).unwrap_or("");
        let data = inline.get("data").and_then(Value::as_str).unwrap_or("");
        let content_type = if mime.starts_with("image/") {
            ContentType::Image
        } else {
            ContentType::File
        };
        items.push(UniversalContent {
            content_type,
            data: json!({ "data": data, "mimeType": mime }),
            encoding: Some("base64".to_string()),
            mime_type: (!mime.is_empty()).then(|| mime.to_string()),
            size: None,
            hash: None,
        });
        return;
    }

    // fileData (URI-based file reference)
    if let Some(file_data) = part.get("fileData") {
        let uri = file_data
            .get("fileUri")
            .and_then(Value::as_str)
            .unwrap_or("");
        let mime = file_data
            .get("mimeType")
            .and_then(Value::as_str)
            .unwrap_or("");
        items.push(UniversalContent {
            content_type: ContentType::File,
            data: json!({ "url": uri, "mimeType": mime }),
            encoding: None,
            mime_type: (!mime.is_empty()).then(|| mime.to_string()),
            size: None,
            hash: None,
        });
        return;
    }

    // executableCode (model-generated code)
    if let Some(ec) = part.get("executableCode") {
        let code = ec.get("code").and_then(Value::as_str).unwrap_or("");
        let language = ec
            .get("language")
            .and_then(Value::as_str)
            .unwrap_or("python");
        items.push(UniversalContent {
            content_type: ContentType::Code,
            data: json!({ "code": code, "language": language }),
            encoding: None,
            mime_type: None,
            size: Some(code.len()),
            hash: None,
        });
        return;
    }

    // codeExecutionResult
    if let Some(cer) = part.get("codeExecutionResult") {
        let outcome = cer
            .get("outcome")
            .and_then(Value::as_str)
            .unwrap_or("UNKNOWN");
        let output = cer.get("output").and_then(Value::as_str).unwrap_or("");
        items.push(text_content(format!("[Code Execution: {outcome}]\n{output}")));
        return;
    }

    // functionResponse (Part-level tool result)
    if let Some(fr) = part.get("functionResponse") {
        let name = fr.get("name").and_then(Value::as_str).unwrap_or("unknown");
        let call_id = fr
            .get("id")
            .and_then(Value::as_str)
            .map(String::from)
            .unwrap_or_else(|| format!("fc_{name}"));
        let response_text = fr
            .get("response")
            .and_then(|r| r.get("output"))
            .and_then(Value::as_str)
            .unwrap_or("");
        items.push(UniversalContent {
            content_type: ContentType::ToolResult,
            data: json!({ "tool_use_id": call_id, "name": name, "content": response_text }),
            encoding: None,
            mime_type: None,
            size: None,
            hash: None,
        });
        return;
    }

    // functionCall parts are surfaced via convert_gemini_tool_calls
    if part.get("functionCall").is_some() {
        return;
    }

    // Plain string part (PartUnion = Part | string)
    if let Value::String(s) = part {
        if !s.is_empty() {
            items.push(text_content(s.clone()));
        }
    }
}

fn value_to_map(value: Option<&Value>) -> HashMap<String, Value> {
    value
        .and_then(Value::as_object)
        .map(|obj| obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}

/// Extract a human-readable string from a Gemini tool `result` value.
fn extract_tool_result_text(result: &Value) -> String {
    if let Some(arr) = result.as_array() {
        let texts: Vec<String> = arr
            .iter()
            .filter_map(|item| {
                item.get("functionResponse")
                    .and_then(|fr| fr.get("response"))
                    .and_then(|r| r.get("output"))
                    .and_then(Value::as_str)
                    .map(String::from)
            })
            .collect();
        if !texts.is_empty() {
            return texts.join("\n");
        }
    }
    match result {
        Value::String(s) => s.clone(),
        _ => serde_json::to_string(result).unwrap_or_default(),
    }
}

/// Convert Gemini tool invocations into `ToolCall`s.
///
/// Sources, in order: the native `toolCalls[]` array on assistant messages
/// (with `args`/`result`/`status`), Part-level `functionCall` entries inside
/// content arrays, and finally the legacy single `tool_use`/`tool_call`
/// message shape (preserved for backwards compatibility).
fn convert_gemini_tool_calls(msg: &GeminiMessage, raw: &Value) -> Option<Vec<ToolCall>> {
    let mut calls = Vec::new();

    // A. Native Gemini format: `toolCalls` array on assistant (gemini) messages
    if let Some(arr) = raw.get("toolCalls").and_then(Value::as_array) {
        for tc in arr {
            let name = tc.get("name").and_then(Value::as_str).unwrap_or("unknown");
            let id = tc
                .get("id")
                .and_then(Value::as_str)
                .map(String::from)
                .unwrap_or_else(|| format!("tool-{}", uuid::Uuid::new_v4()));
            let status = match tc.get("status").and_then(Value::as_str) {
                Some("error") => ToolCallStatus::Error,
                Some("pending") | Some("running") | Some("executing") => ToolCallStatus::Pending,
                _ => ToolCallStatus::Success,
            };
            let result_text = tc.get("result").map(extract_tool_result_text);
            let output = result_text.as_ref().map(|t| {
                let mut m = HashMap::new();
                m.insert("content".to_string(), json!(t));
                m
            });
            let error = if matches!(status, ToolCallStatus::Error) {
                result_text
            } else {
                None
            };
            calls.push(ToolCall {
                id,
                name: map_gemini_tool_name(name).to_string(),
                input: value_to_map(tc.get("args")),
                output,
                error,
                status,
            });
        }
    }

    // B. Part-level functionCall entries inside content arrays
    if let Some(Value::Array(parts)) = msg.content.as_ref() {
        for part in parts {
            if let Some(fc) = part.get("functionCall") {
                let name = fc.get("name").and_then(Value::as_str).unwrap_or("unknown");
                let id = fc
                    .get("id")
                    .and_then(Value::as_str)
                    .map(String::from)
                    .unwrap_or_else(|| format!("fc-{}", uuid::Uuid::new_v4()));
                calls.push(ToolCall {
                    id,
                    name: map_gemini_tool_name(name).to_string(),
                    input: value_to_map(fc.get("args")),
                    output: None,
                    error: None,
                    status: ToolCallStatus::Success,
                });
            }
        }
    }

    // C. Legacy single tool_use/tool_call message (preserve prior behavior)
    if calls.is_empty()
        && matches!(
            msg.message_type.as_deref(),
            Some("tool_use") | Some("tool_call")
        )
    {
        if let Some(name) = msg.name.clone().or_else(|| msg.tool.clone()) {
            calls.push(ToolCall {
                id: format!("tool-{}", uuid::Uuid::new_v4()),
                name: map_gemini_tool_name(&name).to_string(),
                input: value_to_map(msg.input.as_ref()),
                output: None,
                error: None,
                status: ToolCallStatus::Success,
            });
        }
    }

    if calls.is_empty() {
        None
    } else {
        Some(calls)
    }
}

/// Parse Gemini `tokens` usage into the universal `TokenUsage`.
fn convert_gemini_tokens(raw: &Value) -> Option<TokenUsage> {
    let t = raw.get("tokens")?;
    if !t.is_object() {
        return None;
    }
    let input = t.get("input").and_then(Value::as_i64).unwrap_or(0) as i32;
    let output = t.get("output").and_then(Value::as_i64).unwrap_or(0) as i32;
    let total = t
        .get("total")
        .and_then(Value::as_i64)
        .map(|v| v as i32)
        .unwrap_or(input + output);
    let cache_read = t.get("cached").and_then(Value::as_i64).map(|v| v as i32);
    Some(TokenUsage {
        input_tokens: input,
        output_tokens: output,
        total_tokens: total,
        cache_creation_tokens: None,
        cache_read_tokens: cache_read,
        service_tier: None,
    })
}

/// Map Gemini CLI tool names to the viewer's canonical tool names.
fn map_gemini_tool_name(name: &str) -> &str {
    match name {
        "read_file" | "ReadFile" => "Read",
        "write_file" | "WriteFile" | "create_file" => "Write",
        "edit_file" | "EditFile" => "Edit",
        "shell" | "run_command" | "execute_command" => "Bash",
        "list_directory" | "list_dir" => "Glob",
        "search_files" | "grep" => "Grep",
        "web_search" => "WebSearch",
        "web_fetch" => "WebFetch",
        _ => name,
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn to_msg(raw: Value) -> UniversalMessage {
        gemini_message_to_universal(
            &raw,
            "session-1".to_string(),
            "project-1".to_string(),
            "source-1".to_string(),
            0,
        )
        .unwrap()
    }

    #[test]
    fn test_string_content_preserved() {
        let msg = to_msg(json!({
            "type": "user",
            "content": "Hello world",
            "timestamp": "2026-03-24T12:00:00Z"
        }));
        assert_eq!(msg.role, MessageRole::User);
        assert_eq!(msg.content.len(), 1);
        assert_eq!(msg.content[0].content_type, ContentType::Text);
        assert_eq!(msg.content[0].data["text"], "Hello world");
    }

    #[test]
    fn test_thoughts_become_thinking() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": "Done.",
            "thoughts": [{"subject": "Planning", "description": "Read the file first"}]
        }));
        assert_eq!(msg.role, MessageRole::Assistant);
        assert_eq!(msg.content[0].content_type, ContentType::Thinking);
        assert!(msg.content[0].data["text"]
            .as_str()
            .unwrap()
            .contains("Planning"));
        assert_eq!(msg.content[1].content_type, ContentType::Text);
    }

    #[test]
    fn test_tool_calls_array_parsed_and_mapped() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": "Let me check.",
            "toolCalls": [{
                "id": "tool-1",
                "name": "read_file",
                "args": {"file_path": "/test.txt"},
                "result": [{"functionResponse": {"name": "read_file", "response": {"output": "file content"}}}],
                "status": "success"
            }]
        }));
        let calls = msg.tool_calls.unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "Read"); // mapped from read_file
        assert_eq!(calls[0].input["file_path"], "/test.txt");
        assert!(matches!(calls[0].status, ToolCallStatus::Success));
        let output = calls[0].output.as_ref().unwrap();
        assert_eq!(output["content"], "file content");
    }

    #[test]
    fn test_tool_call_error_status() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": "",
            "toolCalls": [{
                "id": "tool-err",
                "name": "shell",
                "args": {"command": "exit 1"},
                "result": [{"functionResponse": {"response": {"output": "command failed"}}}],
                "status": "error"
            }]
        }));
        let calls = msg.tool_calls.unwrap();
        assert_eq!(calls[0].name, "Bash");
        assert!(matches!(calls[0].status, ToolCallStatus::Error));
        assert_eq!(calls[0].error.as_deref(), Some("command failed"));
    }

    #[test]
    fn test_tokens_parsed() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": "ok",
            "tokens": {"input": 100, "output": 50, "cached": 5, "total": 155}
        }));
        let tokens = msg.tokens.unwrap();
        assert_eq!(tokens.input_tokens, 100);
        assert_eq!(tokens.output_tokens, 50);
        assert_eq!(tokens.total_tokens, 155);
        assert_eq!(tokens.cache_read_tokens, Some(5));
    }

    #[test]
    fn test_tokens_total_defaults_to_input_plus_output() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": "ok",
            "tokens": {"input": 10, "output": 20}
        }));
        let tokens = msg.tokens.unwrap();
        assert_eq!(tokens.total_tokens, 30);
    }

    #[test]
    fn test_part_inline_image_and_document() {
        let msg = to_msg(json!({
            "type": "user",
            "content": [
                {"inlineData": {"mimeType": "image/png", "data": "abc"}},
                {"inlineData": {"mimeType": "application/pdf", "data": "def"}}
            ]
        }));
        assert_eq!(msg.content[0].content_type, ContentType::Image);
        assert_eq!(msg.content[0].mime_type.as_deref(), Some("image/png"));
        assert_eq!(msg.content[1].content_type, ContentType::File);
        assert_eq!(msg.content[1].mime_type.as_deref(), Some("application/pdf"));
    }

    #[test]
    fn test_part_file_data() {
        let msg = to_msg(json!({
            "type": "user",
            "content": [{"fileData": {"fileUri": "gs://bucket/f.pdf", "mimeType": "application/pdf"}}]
        }));
        assert_eq!(msg.content[0].content_type, ContentType::File);
        assert_eq!(msg.content[0].data["url"], "gs://bucket/f.pdf");
    }

    #[test]
    fn test_part_executable_code() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": [{"executableCode": {"code": "print('hi')", "language": "python"}}]
        }));
        assert_eq!(msg.content[0].content_type, ContentType::Code);
        assert_eq!(msg.content[0].data["language"], "python");
        assert_eq!(msg.content[0].data["code"], "print('hi')");
    }

    #[test]
    fn test_part_code_execution_result() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": [{"codeExecutionResult": {"outcome": "OUTCOME_OK", "output": "hello"}}]
        }));
        assert_eq!(msg.content[0].content_type, ContentType::Text);
        let text = msg.content[0].data["text"].as_str().unwrap();
        assert!(text.contains("OUTCOME_OK"));
        assert!(text.contains("hello"));
    }

    #[test]
    fn test_part_function_call_and_response() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": [
                {"functionCall": {"id": "call_1", "name": "shell", "args": {"command": "ls"}}},
                {"functionResponse": {"id": "call_1", "name": "shell", "response": {"output": "file.txt"}}}
            ]
        }));
        // functionCall -> tool_calls (mapped name, explicit id preserved)
        let calls = msg.tool_calls.unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].id, "call_1");
        assert_eq!(calls[0].name, "Bash");
        assert_eq!(calls[0].input["command"], "ls");
        // functionResponse -> tool_result content block
        let tr = msg
            .content
            .iter()
            .find(|c| c.content_type == ContentType::ToolResult)
            .unwrap();
        assert_eq!(tr.data["content"], "file.txt");
        assert_eq!(tr.data["tool_use_id"], "call_1");
    }

    #[test]
    fn test_part_thought_flag() {
        let msg = to_msg(json!({
            "type": "gemini",
            "content": [
                {"text": "thinking...", "thought": true},
                {"text": "answer"}
            ]
        }));
        assert_eq!(msg.content[0].content_type, ContentType::Thinking);
        assert_eq!(msg.content[1].content_type, ContentType::Text);
        assert_eq!(msg.content[1].data["text"], "answer");
    }

    #[test]
    fn test_info_message_is_system() {
        let msg = to_msg(json!({
            "type": "info",
            "content": "heads up"
        }));
        assert_eq!(msg.role, MessageRole::System);
    }

    #[test]
    fn test_error_message_is_system_error_type() {
        let msg = to_msg(json!({
            "type": "error",
            "content": "boom"
        }));
        assert_eq!(msg.role, MessageRole::System);
        assert_eq!(msg.message_type, MessageType::Error);
    }

    #[test]
    fn test_legacy_tool_use_preserved() {
        let msg = to_msg(json!({
            "type": "tool_use",
            "name": "custom_tool",
            "input": {"a": 1}
        }));
        let calls = msg.tool_calls.unwrap();
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "custom_tool");
        assert_eq!(calls[0].input["a"], 1);
    }

    #[test]
    fn test_gemini_project_dir_chats_aware() {
        let flat = Path::new("/home/u/.gemini/tmp/hash/session-1.json");
        assert_eq!(
            gemini_project_dir(flat).unwrap(),
            PathBuf::from("/home/u/.gemini/tmp/hash")
        );
        let nested = Path::new("/home/u/.gemini/tmp/hash/chats/session-1.json");
        assert_eq!(
            gemini_project_dir(nested).unwrap(),
            PathBuf::from("/home/u/.gemini/tmp/hash")
        );
    }

    #[test]
    fn test_map_gemini_tool_name() {
        assert_eq!(map_gemini_tool_name("write_file"), "Write");
        assert_eq!(map_gemini_tool_name("execute_command"), "Bash");
        assert_eq!(map_gemini_tool_name("search_files"), "Grep");
        assert_eq!(map_gemini_tool_name("unknown_tool"), "unknown_tool");
    }
}
