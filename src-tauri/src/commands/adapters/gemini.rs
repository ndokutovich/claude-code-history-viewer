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
        if let Some(parent) = file.parent() {
            let parent_str = parent.to_string_lossy().to_string();
            projects
                .entry(parent_str.clone())
                .or_insert_with(Vec::new)
                .push(file);
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

    // Convert content
    let content = convert_gemini_content(&msg);

    // Convert tool calls
    let tool_calls = convert_gemini_tool_calls(&msg);

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
        tokens: None, // Gemini doesn't expose token counts in session files
        tool_calls,
        thinking: None, // Gemini doesn't have thinking blocks
        attachments: None,
        errors: None,
        original_format: "gemini_json".to_string(),
        provider_metadata,
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
        "system" => MessageRole::System,
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

fn convert_gemini_content(msg: &GeminiMessage) -> Vec<UniversalContent> {
    let mut items = Vec::new();

    if let Some(ref content) = msg.content {
        if let Some(text) = extract_text_from_content(content) {
            items.push(UniversalContent {
                content_type: ContentType::Text,
                data: json!({"text": text}),
                encoding: None,
                mime_type: None,
                size: Some(text.len()),
                hash: None,
            });
        }
    }

    items
}

fn convert_gemini_tool_calls(msg: &GeminiMessage) -> Option<Vec<ToolCall>> {
    if msg.message_type.as_deref() == Some("tool_use")
        || msg.message_type.as_deref() == Some("tool_call")
    {
        let name = msg.name.clone().or(msg.tool.clone())?;
        let input_value = msg.input.clone().unwrap_or(json!({}));

        // Convert Value to HashMap
        let input = if let Some(obj) = input_value.as_object() {
            obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
        } else {
            HashMap::new()
        };

        Some(vec![ToolCall {
            id: format!("tool-{}", uuid::Uuid::new_v4()),
            name,
            input,
            output: None,
            error: None,
            status: ToolCallStatus::Success, // Assume success for Gemini
        }])
    } else {
        None
    }
}
