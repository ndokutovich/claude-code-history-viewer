use std::path::PathBuf;
use std::fs;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageContent {
    pub role: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawClaudeMessage {
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "type")]
    pub message_type: Option<String>,
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
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePage {
    pub messages: Vec<ClaudeMessage>,
    pub total_count: usize,
    pub has_more: bool,
    pub next_offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub cache_creation_input_tokens: Option<u32>,
    pub cache_read_input_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTokenStats {
    pub session_id: String,
    pub project_name: String,
    pub total_input_tokens: u32,
    pub total_output_tokens: u32,
    pub total_cache_creation_tokens: u32,
    pub total_cache_read_tokens: u32,
    pub total_tokens: u32,
    pub message_count: usize,
    pub first_message_time: String,
    pub last_message_time: String,
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
        // rust log
        println!("entry: {:?}", entry);
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

    // Sort projects by last_modified in descending order (newest first)
    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

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
                // First try to parse as RawClaudeMessage
                if let Ok(raw_message) = serde_json::from_str::<RawClaudeMessage>(line) {
                    // Skip messages that don't have essential fields
                    if raw_message.session_id.is_none() && raw_message.timestamp.is_none() {
                        continue;
                    }

                    let claude_message = ClaudeMessage {
                        uuid: raw_message.uuid.unwrap_or_else(|| Uuid::new_v4().to_string()),
                        parent_uuid: raw_message.parent_uuid,
                        session_id: raw_message.session_id.unwrap_or_else(|| "unknown-session".to_string()),
                        timestamp: raw_message.timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                        message_type: raw_message.message_type.unwrap_or_else(|| "unknown".to_string()),
                        content: raw_message.message.map(|m| m.content),
                        tool_use: raw_message.tool_use,
                        tool_use_result: raw_message.tool_use_result,
                        is_sidechain: raw_message.is_sidechain,
                    };
                    messages.push(claude_message);
                } else if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
                    // Check if it's a summary message
                    if let Some(msg_type) = json_value.get("type").and_then(|v| v.as_str()) {
                        if msg_type == "summary" {
                            if let Some(summary_text) = json_value.get("summary").and_then(|v| v.as_str()) {
                                // Create a special message for summary
                                let claude_message = ClaudeMessage {
                                    uuid: json_value.get("uuid").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    parent_uuid: None,
                                    session_id: json_value.get("sessionId").and_then(|v| v.as_str()).unwrap_or("unknown-session").to_string(),
                                    timestamp: json_value.get("timestamp").and_then(|v| v.as_str()).unwrap_or(&chrono::Utc::now().to_rfc3339()).to_string(),
                                    message_type: "summary".to_string(),
                                    content: Some(serde_json::Value::String(summary_text.to_string())),
                                    tool_use: None,
                                    tool_use_result: None,
                                    is_sidechain: None,
                                };
                                messages.push(claude_message);
                            }
                        }
                    }
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

                // Find summary from messages
                let summary = messages.iter()
                    .find(|m| m.message_type == "summary")
                    .and_then(|m| {
                        // Extract summary from content - it's stored as a string
                        m.content.as_ref()?.as_str().map(|s| s.to_string())
                    });

                sessions.push(ClaudeSession {
                    session_id,
                    project_name,
                    message_count,
                    first_message_time,
                    last_message_time,
                    has_tool_use,
                    has_errors,
                    summary,
                });
            }
        }
    }

    // Sort sessions by last_message_time in descending order (newest first)
    sessions.sort_by(|a, b| b.last_message_time.cmp(&a.last_message_time));

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

        // First try to parse as RawClaudeMessage
        if let Ok(raw_message) = serde_json::from_str::<RawClaudeMessage>(line) {
            // Skip messages that don't have essential fields
            if raw_message.session_id.is_none() && raw_message.timestamp.is_none() {
                continue;
            }

            let claude_message = ClaudeMessage {
                uuid: raw_message.uuid.unwrap_or_else(|| Uuid::new_v4().to_string()),
                parent_uuid: raw_message.parent_uuid,
                session_id: raw_message.session_id.unwrap_or_else(|| "unknown-session".to_string()),
                timestamp: raw_message.timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                message_type: raw_message.message_type.unwrap_or_else(|| "unknown".to_string()),
                content: raw_message.message.map(|m| m.content),
                tool_use: raw_message.tool_use,
                tool_use_result: raw_message.tool_use_result,
                is_sidechain: raw_message.is_sidechain,
            };
            messages.push(claude_message);
        } else if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
            // Check if it's a summary message
            if let Some(msg_type) = json_value.get("type").and_then(|v| v.as_str()) {
                if msg_type == "summary" {
                    if let Some(summary_text) = json_value.get("summary").and_then(|v| v.as_str()) {
                        // Create a special message for summary
                        let claude_message = ClaudeMessage {
                            uuid: json_value.get("leafUuid").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            parent_uuid: None,
                            session_id: "summary".to_string(),
                            timestamp: chrono::Utc::now().to_rfc3339(),
                            message_type: "summary".to_string(),
                            content: Some(serde_json::Value::String(summary_text.to_string())),
                            tool_use: None,
                            tool_use_result: None,
                            is_sidechain: None,
                        };
                        messages.push(claude_message);
                    }
                }
            }
        }
    }

    Ok(messages)
}

#[tauri::command]
pub async fn load_session_messages_paginated(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<MessagePage, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let lines: Vec<&str> = content.lines().collect();
    let _total_count = lines.len();

    // 빈 라인들 제거
    let valid_lines: Vec<&str> = lines.into_iter()
        .filter(|line| !line.trim().is_empty())
        .collect();

    let actual_total = valid_lines.len();

    // 페이지네이션 적용
    let start = offset;
    let end = std::cmp::min(start + limit, actual_total);
    let has_more = end < actual_total;
    let next_offset = if has_more { end } else { actual_total };

    let mut messages = Vec::new();

    for line in valid_lines.iter().skip(start).take(limit) {
        // First try to parse as RawClaudeMessage
        if let Ok(raw_message) = serde_json::from_str::<RawClaudeMessage>(line) {
            // Skip messages that don't have essential fields
            if raw_message.session_id.is_none() && raw_message.timestamp.is_none() {
                continue;
            }

            let claude_message = ClaudeMessage {
                uuid: raw_message.uuid.unwrap_or_else(|| Uuid::new_v4().to_string()),
                parent_uuid: raw_message.parent_uuid,
                session_id: raw_message.session_id.unwrap_or_else(|| "unknown-session".to_string()),
                timestamp: raw_message.timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                message_type: raw_message.message_type.unwrap_or_else(|| "unknown".to_string()),
                content: raw_message.message.map(|m| m.content),
                tool_use: raw_message.tool_use,
                tool_use_result: raw_message.tool_use_result,
                is_sidechain: raw_message.is_sidechain,
            };
            messages.push(claude_message);
        } else if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(line) {
            // Check if it's a summary message
            if let Some(msg_type) = json_value.get("type").and_then(|v| v.as_str()) {
                if msg_type == "summary" {
                    if let Some(summary_text) = json_value.get("summary").and_then(|v| v.as_str()) {
                        // Create a special message for summary
                        let claude_message = ClaudeMessage {
                            uuid: json_value.get("leafUuid").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            parent_uuid: None,
                            session_id: "summary".to_string(),
                            timestamp: chrono::Utc::now().to_rfc3339(),
                            message_type: "summary".to_string(),
                            content: Some(serde_json::Value::String(summary_text.to_string())),
                            tool_use: None,
                            tool_use_result: None,
                            is_sidechain: None,
                        };
                        messages.push(claude_message);
                    }
                }
            }
        }
    }

    Ok(MessagePage {
        messages,
        total_count: actual_total,
        has_more,
        next_offset,
    })
}

#[tauri::command]
pub async fn get_session_message_count(session_path: String) -> Result<usize, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let count = content.lines()
        .filter(|line| !line.trim().is_empty())
        .count();

    Ok(count)
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
                    // Skip messages that don't have essential fields
                    if raw_message.session_id.is_none() && raw_message.timestamp.is_none() {
                        continue;
                    }

                    let claude_message = ClaudeMessage {
                        uuid: raw_message.uuid.clone().unwrap_or_else(|| Uuid::new_v4().to_string()),
                        parent_uuid: raw_message.parent_uuid.clone(),
                        session_id: raw_message.session_id.clone().unwrap_or_else(|| "unknown-session".to_string()),
                        timestamp: raw_message.timestamp.clone().unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                        message_type: raw_message.message_type.clone().unwrap_or_else(|| "unknown".to_string()),
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

// Helper function to extract token usage from a message
fn extract_token_usage(message: &ClaudeMessage) -> TokenUsage {
    let mut usage = TokenUsage {
        input_tokens: None,
        output_tokens: None,
        cache_creation_input_tokens: None,
        cache_read_input_tokens: None,
    };

    // Check content field for usage information
    if let Some(content) = &message.content {
        if let Some(usage_obj) = content.get("usage") {
            if let Some(input) = usage_obj.get("input_tokens").and_then(|v| v.as_u64()) {
                usage.input_tokens = Some(input as u32);
            }
            if let Some(output) = usage_obj.get("output_tokens").and_then(|v| v.as_u64()) {
                usage.output_tokens = Some(output as u32);
            }
            if let Some(cache_creation) = usage_obj.get("cache_creation_input_tokens").and_then(|v| v.as_u64()) {
                usage.cache_creation_input_tokens = Some(cache_creation as u32);
            }
            if let Some(cache_read) = usage_obj.get("cache_read_input_tokens").and_then(|v| v.as_u64()) {
                usage.cache_read_input_tokens = Some(cache_read as u32);
            }
        }
    }

    // Check tool_use_result field for usage information
    if let Some(tool_result) = &message.tool_use_result {
        if let Some(usage_obj) = tool_result.get("usage") {
            if let Some(input) = usage_obj.get("input_tokens").and_then(|v| v.as_u64()) {
                usage.input_tokens = Some(input as u32);
            }
            if let Some(output) = usage_obj.get("output_tokens").and_then(|v| v.as_u64()) {
                usage.output_tokens = Some(output as u32);
            }
            if let Some(cache_creation) = usage_obj.get("cache_creation_input_tokens").and_then(|v| v.as_u64()) {
                usage.cache_creation_input_tokens = Some(cache_creation as u32);
            }
            if let Some(cache_read) = usage_obj.get("cache_read_input_tokens").and_then(|v| v.as_u64()) {
                usage.cache_read_input_tokens = Some(cache_read as u32);
            }
        }

        // Also check for totalTokens field in tool results
        if let Some(total_tokens) = tool_result.get("totalTokens").and_then(|v| v.as_u64()) {
            // If we don't have specific input/output breakdown, estimate based on message type
            if usage.input_tokens.is_none() && usage.output_tokens.is_none() {
                if message.message_type == "assistant" {
                    usage.output_tokens = Some(total_tokens as u32);
                } else {
                    usage.input_tokens = Some(total_tokens as u32);
                }
            }
        }
    }

    usage
}

#[tauri::command]
pub async fn get_session_token_stats(session_path: String) -> Result<SessionTokenStats, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let mut messages: Vec<ClaudeMessage> = Vec::new();

    for line in content.lines() {
        if let Ok(raw_message) = serde_json::from_str::<RawClaudeMessage>(line) {
            if raw_message.session_id.is_none() && raw_message.timestamp.is_none() {
                continue;
            }

            let claude_message = ClaudeMessage {
                uuid: raw_message.uuid.unwrap_or_else(|| Uuid::new_v4().to_string()),
                parent_uuid: raw_message.parent_uuid,
                session_id: raw_message.session_id.unwrap_or_else(|| "unknown-session".to_string()),
                timestamp: raw_message.timestamp.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
                message_type: raw_message.message_type.unwrap_or_else(|| "unknown".to_string()),
                content: raw_message.message.map(|m| m.content),
                tool_use: raw_message.tool_use,
                tool_use_result: raw_message.tool_use_result,
                is_sidechain: raw_message.is_sidechain,
            };
            messages.push(claude_message);
        }
    }

    if messages.is_empty() {
        return Err("No valid messages found in session".to_string());
    }

    let session_id = messages[0].session_id.clone();
    let project_name = PathBuf::from(&session_path)
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let mut total_input_tokens = 0u32;
    let mut total_output_tokens = 0u32;
    let mut total_cache_creation_tokens = 0u32;
    let mut total_cache_read_tokens = 0u32;

    let mut first_time: Option<String> = None;
    let mut last_time: Option<String> = None;

    for message in &messages {
        let usage = extract_token_usage(message);

        total_input_tokens += usage.input_tokens.unwrap_or(0);
        total_output_tokens += usage.output_tokens.unwrap_or(0);
        total_cache_creation_tokens += usage.cache_creation_input_tokens.unwrap_or(0);
        total_cache_read_tokens += usage.cache_read_input_tokens.unwrap_or(0);

        if first_time.is_none() || message.timestamp < first_time.as_ref().unwrap().clone() {
            first_time = Some(message.timestamp.clone());
        }
        if last_time.is_none() || message.timestamp > last_time.as_ref().unwrap().clone() {
            last_time = Some(message.timestamp.clone());
        }
    }

    let total_tokens = total_input_tokens + total_output_tokens + total_cache_creation_tokens + total_cache_read_tokens;

    Ok(SessionTokenStats {
        session_id,
        project_name,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_tokens,
        message_count: messages.len(),
        first_message_time: first_time.unwrap_or_else(|| "unknown".to_string()),
        last_message_time: last_time.unwrap_or_else(|| "unknown".to_string()),
    })
}

#[tauri::command]
pub async fn get_project_token_stats(project_path: String) -> Result<Vec<SessionTokenStats>, String> {
    let mut session_stats = Vec::new();

    for entry in WalkDir::new(&project_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        let session_path = entry.path().to_string_lossy().to_string();

        match get_session_token_stats(session_path).await {
            Ok(stats) => session_stats.push(stats),
            Err(_) => continue, // Skip sessions with errors
        }
    }

    // Sort by total tokens in descending order
    session_stats.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    Ok(session_stats)
}