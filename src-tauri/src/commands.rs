use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageContent {
    pub role: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawClaudeMessage {
    pub uuid: String,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub message: Option<MessageContent>,
    #[serde(rename = "toolUse")]
    pub tool_use: Option<serde_json::Value>,
    #[serde(rename = "toolUseResult")]
    pub tool_use_result: Option<serde_json::Value>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMessage {
    pub uuid: String,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub content: Option<serde_json::Value>,
    #[serde(rename = "toolUse")]
    pub tool_use: Option<serde_json::Value>,
    #[serde(rename = "toolUseResult")]
    pub tool_use_result: Option<serde_json::Value>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeProject {
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub message_count: usize,
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSession {
    pub session_id: String,
    pub project_name: String,
    pub message_count: usize,
    pub first_message_time: String,
    pub last_message_time: String,
    pub has_tool_use: bool,
    pub has_errors: bool,
}

#[tauri::command]
pub async fn get_claude_folder_path() -> Result<String, String> {
    let home_dir = std::env::var("HOME")
        .map_err(|_| "Could not determine home directory".to_string())?;

    let claude_path = PathBuf::from(home_dir).join(".claude");

    if !claude_path.exists() {
        return Err("Claude folder not found in home directory".to_string());
    }

    Ok(claude_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn scan_projects(claude_path: String) -> Result<Vec<ClaudeProject>, String> {
    let projects_path = PathBuf::from(&claude_path).join("projects");

    if !projects_path.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    for entry in WalkDir::new(&projects_path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        let raw_project_name = entry.file_name().to_string_lossy().to_string();
        let project_path = entry.path().to_string_lossy().to_string();
        
        // Extract just the repo name from the full path
        // e.g., "-Users-jack-client-ai-code-tracker" -> "ai-code-tracker"
        let project_name = if raw_project_name.contains('-') {
            raw_project_name
                .split('-')
                .last()
                .unwrap_or(&raw_project_name)
                .to_string()
        } else {
            raw_project_name
        };

        let mut session_count = 0;
        let mut message_count = 0;
        let mut last_modified = std::time::SystemTime::now();

        for jsonl_entry in WalkDir::new(entry.path())
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        {
            session_count += 1;

            if let Ok(metadata) = jsonl_entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if modified > last_modified {
                        last_modified = modified;
                    }
                }
            }

            if let Ok(content) = fs::read_to_string(jsonl_entry.path()) {
                message_count += content.lines().count();
            }
        }

        let dt: DateTime<Utc> = last_modified.into();
        projects.push(ClaudeProject {
            name: project_name,
            path: project_path,
            session_count,
            message_count,
            last_modified: dt.to_rfc3339(),
        });
    }

    Ok(projects)
}

#[tauri::command]
pub async fn load_project_sessions(project_path: String) -> Result<Vec<ClaudeSession>, String> {
    let mut sessions = Vec::new();

    for entry in WalkDir::new(&project_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        if let Ok(content) = fs::read_to_string(entry.path()) {
            let mut messages: Vec<ClaudeMessage> = Vec::new();

            for line in content.lines() {
                if let Ok(raw_message) = serde_json::from_str::<RawClaudeMessage>(line) {
                    let claude_message = ClaudeMessage {
                        uuid: raw_message.uuid,
                        parent_uuid: raw_message.parent_uuid,
                        session_id: raw_message.session_id,
                        timestamp: raw_message.timestamp,
                        message_type: raw_message.message_type,
                        content: raw_message.message.map(|m| m.content),
                        tool_use: raw_message.tool_use,
                        tool_use_result: raw_message.tool_use_result,
                        is_sidechain: raw_message.is_sidechain,
                    };
                    messages.push(claude_message);
                }
            }

            if !messages.is_empty() {
                let session_id = messages[0].session_id.clone();
                let raw_project_name = entry.path()
                    .parent()
                    .and_then(|p| p.file_name())
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string();
                
                // Extract just the repo name from the full path
                let project_name = if raw_project_name.contains('-') {
                    raw_project_name
                        .split('-')
                        .last()
                        .unwrap_or(&raw_project_name)
                        .to_string()
                } else {
                    raw_project_name
                };

                let message_count = messages.len();
                let first_message_time = messages[0].timestamp.clone();
                let last_message_time = messages.last().unwrap().timestamp.clone();

                let has_tool_use = messages.iter().any(|m| m.tool_use.is_some() || m.tool_use_result.is_some());
                let has_errors = messages.iter().any(|m| {
                    if let Some(result) = &m.tool_use_result {
                        if let Some(stderr) = result.get("stderr") {
                            return !stderr.as_str().unwrap_or("").is_empty();
                        }
                    }
                    false
                });

                sessions.push(ClaudeSession {
                    session_id,
                    project_name,
                    message_count,
                    first_message_time,
                    last_message_time,
                    has_tool_use,
                    has_errors,
                });
            }
        }
    }

    Ok(sessions)
}

#[tauri::command]
pub async fn load_session_messages(session_path: String) -> Result<Vec<ClaudeMessage>, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let mut messages = Vec::new();

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<RawClaudeMessage>(line) {
            Ok(raw_message) => {
                let claude_message = ClaudeMessage {
                    uuid: raw_message.uuid,
                    parent_uuid: raw_message.parent_uuid,
                    session_id: raw_message.session_id,
                    timestamp: raw_message.timestamp,
                    message_type: raw_message.message_type,
                    content: raw_message.message.map(|m| m.content),
                    tool_use: raw_message.tool_use,
                    tool_use_result: raw_message.tool_use_result,
                    is_sidechain: raw_message.is_sidechain,
                };
                messages.push(claude_message);
            },
            Err(e) => {
                eprintln!("Failed to parse message: {}", e);
                continue;
            }
        }
    }

    Ok(messages)
}

#[tauri::command]
pub async fn search_messages(
    claude_path: String,
    query: String,
    _filters: serde_json::Value
) -> Result<Vec<ClaudeMessage>, String> {
    let projects_path = PathBuf::from(&claude_path).join("projects");
    let mut all_messages = Vec::new();

    if !projects_path.exists() {
        return Ok(vec![]);
    }

    for entry in WalkDir::new(&projects_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        if let Ok(content) = fs::read_to_string(entry.path()) {
            for line in content.lines() {
                if let Ok(raw_message) = serde_json::from_str::<RawClaudeMessage>(line) {
                    let claude_message = ClaudeMessage {
                        uuid: raw_message.uuid.clone(),
                        parent_uuid: raw_message.parent_uuid.clone(),
                        session_id: raw_message.session_id.clone(),
                        timestamp: raw_message.timestamp.clone(),
                        message_type: raw_message.message_type.clone(),
                        content: raw_message.message.as_ref().map(|m| m.content.clone()),
                        tool_use: raw_message.tool_use.clone(),
                        tool_use_result: raw_message.tool_use_result.clone(),
                        is_sidechain: raw_message.is_sidechain,
                    };
                    
                    let content_str = claude_message.content
                        .as_ref()
                        .and_then(|c| c.as_str())
                        .unwrap_or("");

                    if content_str.to_lowercase().contains(&query.to_lowercase()) {
                        all_messages.push(claude_message);
                    }
                }
            }
        }
    }

    Ok(all_messages)
}