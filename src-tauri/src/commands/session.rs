use crate::models::*;
use crate::utils::extract_project_name;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;
use chrono::{DateTime, Utc};
use uuid::Uuid;

#[tauri::command]
pub async fn load_project_sessions(
    project_path: String,
    exclude_sidechain: Option<bool>,
) -> Result<Vec<ClaudeSession>, String> {
    let mut sessions = Vec::new();

    for entry in WalkDir::new(&project_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        let file_path = entry.path().to_string_lossy().to_string();
        
        let last_modified = if let Ok(metadata) = entry.metadata() {
            if let Ok(modified) = metadata.modified() {
                let dt: DateTime<Utc> = modified.into();
                dt.to_rfc3339()
            } else {
                Utc::now().to_rfc3339()
            }
        } else {
            Utc::now().to_rfc3339()
        };
        
        if let Ok(content) = fs::read_to_string(entry.path()) {
            let mut messages: Vec<ClaudeMessage> = Vec::new();
            let mut session_summary: Option<String> = None;

            for (line_num, line) in content.lines().enumerate() {
                if line.trim().is_empty() { continue; }

                match serde_json::from_str::<RawLogEntry>(line) {
                    Ok(log_entry) => {
                        if log_entry.message_type == "summary" {
                            if session_summary.is_none() { 
                                session_summary = log_entry.summary;
                            }
                        } else {
                            if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
                                continue;
                            }

                            let uuid = log_entry.uuid.unwrap_or_else(|| {
                                let new_uuid = Uuid::new_v4().to_string();
                                eprintln!("Warning: Missing UUID in line {} of {}, generated: {}", line_num + 1, file_path, new_uuid);
                                new_uuid
                            });
                            
                            let (role, message_id, model, stop_reason, usage) = if let Some(ref msg) = log_entry.message {
                                (
                                    Some(msg.role.clone()),
                                    msg.id.clone(),
                                    msg.model.clone(),
                                    msg.stop_reason.clone(),
                                    msg.usage.clone()
                                )
                            } else {
                                (None, None, None, None, None)
                            };
                            
                            let claude_message = ClaudeMessage {
                                uuid,
                                parent_uuid: log_entry.parent_uuid,
                                session_id: log_entry.session_id.unwrap_or_else(|| {
                                    eprintln!("Warning: Missing session_id in line {} of {}", line_num + 1, file_path);
                                    "unknown-session".to_string()
                                }),
                                timestamp: log_entry.timestamp.unwrap_or_else(|| {
                                    let now = Utc::now().to_rfc3339();
                                    eprintln!("Warning: Missing timestamp in line {} of {}, using current time: {}", line_num + 1, file_path, now);
                                    now
                                }),
                                message_type: log_entry.message_type,
                                content: log_entry.message.map(|m| m.content),
                                tool_use: log_entry.tool_use,
                                tool_use_result: log_entry.tool_use_result,
                                is_sidechain: log_entry.is_sidechain,
                                usage,
                                role,
                                message_id,
                                model,
                                stop_reason,
                            };
                            messages.push(claude_message);
                        }
                    },
                    Err(e) => {
                        eprintln!("Error: Failed to parse JSONL at line {} in {}", line_num + 1, file_path);
                        eprintln!("  Parse error: {}", e);
                        if line.len() > 200 {
                            eprintln!("  Line content (truncated): {}...", &line[..200]);
                        } else {
                            eprintln!("  Line content: {}", line);
                        }
                    }
                }
            }

            if !messages.is_empty() {
                // Extract actual session ID from messages
                let actual_session_id = messages.iter()
                    .find_map(|m| {
                        if m.session_id != "unknown-session" {
                            Some(m.session_id.clone())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(|| "unknown-session".to_string());
                
                // Create unique session ID based on file path
                let session_id = file_path.clone();
                
                let raw_project_name = entry.path()
                    .parent()
                    .and_then(|p| p.file_name())
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string();

                let project_name = extract_project_name(&raw_project_name);

                let filtered_messages: Vec<&ClaudeMessage> = if exclude_sidechain.unwrap_or(false) {
                    messages.iter().filter(|m| !m.is_sidechain.unwrap_or(false)).collect()
                } else {
                    messages.iter().collect()
                };

                let message_count = filtered_messages.len();
                let first_message_time = messages[0].timestamp.clone();
                let last_message_time = messages.last().unwrap().timestamp.clone();

                let has_tool_use = messages.iter().any(|m| {
                    if m.message_type == "assistant" {
                        if let Some(content) = &m.content {
                            if let Some(content_array) = content.as_array() {
                                for item in content_array {
                                    if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                                        if item_type == "tool_use" {
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    m.tool_use.is_some() || m.tool_use_result.is_some()
                });
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
                    actual_session_id,
                    file_path,
                    project_name,
                    message_count,
                    first_message_time,
                    last_message_time,
                    last_modified: last_modified.clone(),
                    has_tool_use,
                    has_errors,
                    summary: session_summary,
                });
            }
        }
    }

    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(sessions)
}

#[tauri::command]
pub async fn load_session_messages(session_path: String) -> Result<Vec<ClaudeMessage>, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let mut messages = Vec::new();

    for (line_num, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<RawLogEntry>(line) {
            Ok(log_entry) => {
                if log_entry.message_type == "summary" {
                    if let Some(summary_text) = log_entry.summary {
                        let uuid = log_entry.uuid.unwrap_or_else(|| {
                            let new_uuid = Uuid::new_v4().to_string();
                            eprintln!("Warning: Missing UUID for summary in line {} of {}, generated: {}", line_num + 1, session_path, new_uuid);
                            new_uuid
                        });
                        
                        let summary_message = ClaudeMessage {
                            uuid,
                            parent_uuid: None,
                            session_id: log_entry.session_id.unwrap_or_else(|| {
                                eprintln!("Warning: Missing session_id for summary in line {} of {}", line_num + 1, session_path);
                                "unknown-session".to_string()
                            }),
                            timestamp: log_entry.timestamp.unwrap_or_else(|| {
                                let now = Utc::now().to_rfc3339();
                                eprintln!("Warning: Missing timestamp for summary in line {} of {}, using current time: {}", line_num + 1, session_path, now);
                                now
                            }),
                            message_type: "summary".to_string(),
                            content: Some(serde_json::Value::String(summary_text)),
                            tool_use: None,
                            tool_use_result: None,
                            is_sidechain: None,
                            usage: None,
                            role: None,
                            message_id: None,
                            model: None,
                            stop_reason: None,
                        };
                        messages.push(summary_message);
                    }
                } else {
                    if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
                        continue;
                    }

                    let uuid = log_entry.uuid.unwrap_or_else(|| {
                        let new_uuid = Uuid::new_v4().to_string();
                        eprintln!("Warning: Missing UUID in line {} of {}, generated: {}", line_num + 1, session_path, new_uuid);
                        new_uuid
                    });
                    
                    let (role, message_id, model, stop_reason, usage) = if let Some(ref msg) = log_entry.message {
                        (
                            Some(msg.role.clone()),
                            msg.id.clone(),
                            msg.model.clone(),
                            msg.stop_reason.clone(),
                            msg.usage.clone()
                        )
                    } else {
                        (None, None, None, None, None)
                    };
                    
                    let claude_message = ClaudeMessage {
                        uuid,
                        parent_uuid: log_entry.parent_uuid,
                        session_id: log_entry.session_id.unwrap_or_else(|| {
                            eprintln!("Warning: Missing session_id in line {} of {}", line_num + 1, session_path);
                            "unknown-session".to_string()
                        }),
                        timestamp: log_entry.timestamp.unwrap_or_else(|| {
                            let now = Utc::now().to_rfc3339();
                            eprintln!("Warning: Missing timestamp in line {} of {}, using current time: {}", line_num + 1, session_path, now);
                            now
                        }),
                        message_type: log_entry.message_type.clone(),
                        content: log_entry.message.map(|m| m.content),
                        tool_use: log_entry.tool_use,
                        tool_use_result: log_entry.tool_use_result,
                        is_sidechain: log_entry.is_sidechain,
                        usage,
                        role,
                        message_id,
                        model,
                        stop_reason,
                    };
                    messages.push(claude_message);
                }
            },
            Err(e) => {
                eprintln!("Failed to parse line {} in {}: {}. Line: {}", line_num + 1, session_path, e, line);
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
    exclude_sidechain: Option<bool>,
) -> Result<MessagePage, String> {
    use std::io::{BufRead, BufReader};
    use std::fs::File;
    
    let file = File::open(&session_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;
    let reader = BufReader::new(file);
    
    let mut messages: Vec<ClaudeMessage> = Vec::new();
    let mut total_count = 0;
    let mut current_index = 0;
    
    for (line_num, line_result) in reader.lines().enumerate() {
        let line = line_result.map_err(|e| format!("Failed to read line: {}", e))?;
        
        if line.trim().is_empty() {
            continue;
        }
        
        match serde_json::from_str::<RawLogEntry>(&line) {
            Ok(log_entry) => {
                if log_entry.message_type != "summary" {
                    if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
                        continue;
                    }
                    
                    if exclude_sidechain.unwrap_or(false) && log_entry.is_sidechain.unwrap_or(false) {
                        continue;
                    }
                    
                    if current_index >= offset && messages.len() < limit {
                        let (role, message_id, model, stop_reason, usage) = if let Some(ref msg) = log_entry.message {
                            (
                                Some(msg.role.clone()),
                                msg.id.clone(),
                                msg.model.clone(),
                                msg.stop_reason.clone(),
                                msg.usage.clone()
                            )
                        } else {
                            (None, None, None, None, None)
                        };
                        
                        let claude_message = ClaudeMessage {
                            uuid: log_entry.uuid.unwrap_or_else(|| Uuid::new_v4().to_string()),
                            parent_uuid: log_entry.parent_uuid,
                            session_id: log_entry.session_id.unwrap_or_else(|| "unknown-session".to_string()),
                            timestamp: log_entry.timestamp.unwrap_or_else(|| Utc::now().to_rfc3339()),
                            message_type: log_entry.message_type.clone(),
                            content: log_entry.message.map(|m| m.content),
                            tool_use: log_entry.tool_use,
                            tool_use_result: log_entry.tool_use_result,
                            is_sidechain: log_entry.is_sidechain,
                            usage,
                            role,
                            message_id,
                            model,
                            stop_reason,
                        };
                        messages.push(claude_message);
                    }
                    
                    current_index += 1;
                    total_count += 1;
                }
            },
            Err(e) => {
                eprintln!("Failed to parse line {} in {}: {}. Line: {}", line_num + 1, session_path, e, line);
            }
        }
    }
    
    let has_more = offset + limit < total_count;
    let next_offset = if has_more { offset + limit } else { total_count };
    
    Ok(MessagePage {
        messages,
        total_count,
        has_more,
        next_offset,
    })
}

#[tauri::command]
pub async fn get_session_message_count(
    session_path: String,
    exclude_sidechain: Option<bool>,
) -> Result<usize, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let mut count = 0;
    
    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        
        if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(line) {
            if log_entry.message_type != "summary" {
                if exclude_sidechain.unwrap_or(false) && log_entry.is_sidechain.unwrap_or(false) {
                    continue;
                }
                count += 1;
            }
        }
    }

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
                if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(line) {
                    if log_entry.message_type == "user" || log_entry.message_type == "assistant" {
                        if let Some(message_content) = &log_entry.message {
                            let content_str = match &message_content.content {
                                serde_json::Value::String(s) => s.clone(),
                                serde_json::Value::Array(arr) => serde_json::to_string(arr).unwrap_or_default(),
                                _ => "".to_string(),
                            };

                            if content_str.to_lowercase().contains(&query.to_lowercase()) {
                                let claude_message = ClaudeMessage {
                                    uuid: log_entry.uuid.unwrap_or_else(|| Uuid::new_v4().to_string()),
                                    parent_uuid: log_entry.parent_uuid,
                                    session_id: log_entry.session_id.unwrap_or_else(|| "unknown-session".to_string()),
                                    timestamp: log_entry.timestamp.unwrap_or_else(|| Utc::now().to_rfc3339()),
                                    message_type: log_entry.message_type,
                                    content: Some(message_content.content.clone()),
                                    tool_use: log_entry.tool_use,
                                    tool_use_result: log_entry.tool_use_result,
                                    is_sidechain: log_entry.is_sidechain,
                                    usage: message_content.usage.clone(),
                                    role: Some(message_content.role.clone()),
                                    message_id: message_content.id.clone(),
                                    model: message_content.model.clone(),
                                    stop_reason: message_content.stop_reason.clone(),
                                };
                                all_messages.push(claude_message);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(all_messages)
}
