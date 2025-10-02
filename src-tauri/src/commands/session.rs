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
    let start_time = std::time::Instant::now();
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
        
        // 파일을 스트리밍으로 읽어서 메모리 사용량 줄이기
        if let Ok(file) = std::fs::File::open(entry.path()) {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(file);
            let mut messages: Vec<ClaudeMessage> = Vec::new();
            let mut session_summary: Option<String> = None;

            for (line_num, line_result) in reader.lines().enumerate() {
                if let Ok(line) = line_result {
                    if line.trim().is_empty() { continue; }

                    match serde_json::from_str::<RawLogEntry>(&line) {
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
                                let new_uuid = format!("{}-line-{}", Uuid::new_v4().to_string(), line_num + 1);
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
                                project_path: None,
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

                // summary가 없을 때만 첫 번째 사용자 메시지에서 텍스트 추출
                let final_summary = if session_summary.is_none() {
                    messages.iter()
                        .find(|m| m.message_type == "user")
                        .and_then(|m| {
                            if let Some(content) = &m.content {
                                match content {
                                    // 단순 문자열인 경우
                                    serde_json::Value::String(text) => {
                                        if text.trim().is_empty() {
                                            None
                                        } else if text.chars().count() > 100 {
                                            let truncated: String = text.chars().take(100).collect();
                                            Some(format!("{}...", truncated))
                                        } else {
                                            Some(text.clone())
                                        }
                                    },
                                    // 배열인 경우 type="text" 찾기
                                    serde_json::Value::Array(arr) => {
                                        for item in arr {
                                            if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                                                if item_type == "text" {
                                                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                                                        if !text.trim().is_empty() {
                                                            return if text.chars().count() > 100 {
                                                                let truncated: String = text.chars().take(100).collect();
                                                                Some(format!("{}...", truncated))
                                                            } else {
                                                                Some(text.to_string())
                                                            };
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        None
                                    },
                                    _ => None
                                }
                            } else {
                                None
                            }
                        })
                } else {
                    session_summary
                };

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
                    summary: final_summary,
                });
            }
        }
    }

    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    // Summary propagation logic:
    // Multiple JSONL files can share the same actual_session_id (from the messages inside),
    // but only some files contain a summary message. This two-pass approach ensures all
    // sessions with the same actual_session_id display consistent summaries:
    // 1. First pass: Collect all existing summaries mapped by actual_session_id
    // 2. Second pass: Apply collected summaries to any session that's missing one
    // This provides a better user experience by showing the same summary for related sessions.
    
    // Create a map of actual_session_id to summary
    let mut summary_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    
    // First pass: collect all summaries
    for session in &sessions {
        if let Some(ref summary) = session.summary {
            if !summary.is_empty() {
                summary_map.insert(session.actual_session_id.clone(), summary.clone());
            }
        }
    }
    
    // Second pass: apply summaries to sessions that don't have them
    for session in &mut sessions {
        if session.summary.is_none() || session.summary.as_ref().map(|s| s.is_empty()).unwrap_or(false) {
            if let Some(summary) = summary_map.get(&session.actual_session_id) {
                session.summary = Some(summary.clone());
            }
        }
    }

    let _elapsed = start_time.elapsed();
    #[cfg(debug_assertions)]
    println!("📊 load_project_sessions 성능: {}개 세션, {}ms 소요",
             sessions.len(), _elapsed.as_millis());

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
                            project_path: None,
                        };
                        messages.push(summary_message);
                    }
                } else {
                    if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
                        continue;
                    }

                    let uuid = log_entry.uuid.unwrap_or_else(|| {
                        let new_uuid = format!("{}-line-{}", Uuid::new_v4().to_string(), line_num + 1);
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
                        project_path: None,
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
    let start_time = std::time::Instant::now();
    use std::io::{BufRead, BufReader};
    use std::fs::File;
    
    let file = File::open(&session_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;
    let reader = BufReader::new(file);
    
    // First pass: collect all messages to get total count and support reverse ordering
    let mut all_messages: Vec<ClaudeMessage> = Vec::new();
    
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
                        uuid: log_entry.uuid.unwrap_or_else(|| format!("{}-line-{}", Uuid::new_v4().to_string(), line_num + 1)),
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
                        project_path: None,
                    };
                    all_messages.push(claude_message);
                }
            },
            Err(e) => {
                eprintln!("Failed to parse line {} in {}: {}. Line: {}", line_num + 1, session_path, e, line);
            }
        }
    }
    
    let total_count = all_messages.len();
    
    #[cfg(debug_assertions)]
    eprintln!("Pagination Debug - Total: {}, Offset: {}, Limit: {}", total_count, offset, limit);
    
    // Chat-style pagination: offset=0 means we want the newest messages (at the end)
    // offset=100 means we want messages starting 100 from the newest
    if total_count == 0 {
        #[cfg(debug_assertions)]
        eprintln!("No messages found");
        return Ok(MessagePage {
            messages: vec![],
            total_count: 0,
            has_more: false,
            next_offset: 0,
        });
    }
    
    // Calculate how many messages are already loaded (from newest)
    let already_loaded = offset;
    
    // Calculate remaining messages that can be loaded
    let remaining_messages = if total_count > already_loaded {
        total_count - already_loaded
    } else {
        0
    };
    
    // Actual messages to load: minimum of limit and remaining messages
    let messages_to_load = std::cmp::min(limit, remaining_messages);
    
    #[cfg(debug_assertions)]
    eprintln!("Load calculation: total={}, already_loaded={}, remaining={}, will_load={}", 
              total_count, already_loaded, remaining_messages, messages_to_load);
    
    let (start_idx, end_idx) = if remaining_messages == 0 {
        // No more messages to load
        #[cfg(debug_assertions)]
        eprintln!("No more messages available");
        (0, 0)
    } else {
        // Load from (total_count - already_loaded - messages_to_load) to (total_count - already_loaded)
        let start = total_count - already_loaded - messages_to_load;
        let end = total_count - already_loaded;
        #[cfg(debug_assertions)]
        eprintln!("Loading messages: start={}, end={} (will load {} messages)", start, end, messages_to_load);
        (start, end)
    };
    
    // Get the slice of messages we need
    let messages: Vec<ClaudeMessage> = all_messages
        .into_iter()
        .skip(start_idx)
        .take(end_idx - start_idx)
        .collect();
    
    // has_more is true if there are still older messages to load
    let has_more = start_idx > 0;
    let next_offset = offset + messages.len();

    let _elapsed = start_time.elapsed();
    #[cfg(debug_assertions)]
    eprintln!("📊 load_session_messages_paginated 성능: {}개 메시지, {}ms 소요", messages.len(), _elapsed.as_millis());
    #[cfg(debug_assertions)]
    eprintln!("Result: {} messages returned, has_more={}, next_offset={}", messages.len(), has_more, next_offset);
    
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

/// Parse search query to extract quoted phrases and individual words
/// Example: `askmeevery "pricing update"` -> [(false, "askmeevery"), (true, "pricing update")]
fn parse_search_query(query: &str) -> Vec<(bool, String)> {
    let mut terms = Vec::new();
    let mut current_term = String::new();
    let mut in_quotes = false;
    let mut chars = query.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                if in_quotes {
                    // End of quoted phrase
                    if !current_term.is_empty() {
                        terms.push((true, current_term.clone())); // true = quoted
                        current_term.clear();
                    }
                    in_quotes = false;
                } else {
                    // Start of quoted phrase
                    // Save any accumulated unquoted term first
                    if !current_term.is_empty() {
                        terms.push((false, current_term.trim().to_string()));
                        current_term.clear();
                    }
                    in_quotes = true;
                }
            }
            ' ' if !in_quotes => {
                // Space outside quotes - word boundary
                if !current_term.is_empty() {
                    terms.push((false, current_term.trim().to_string()));
                    current_term.clear();
                }
            }
            _ => {
                current_term.push(ch);
            }
        }
    }

    // Add any remaining term
    if !current_term.is_empty() {
        terms.push((in_quotes, current_term.trim().to_string()));
    }

    // Filter out empty strings
    terms.into_iter().filter(|(_, s)| !s.is_empty()).collect()
}

/// Check if content matches all search terms
/// Quoted terms must match exactly, unquoted terms must all appear somewhere
fn matches_search_terms(content: &str, terms: &[(bool, String)]) -> bool {
    let content_lower = content.to_lowercase();

    for (is_quoted, term) in terms {
        let term_lower = term.to_lowercase();

        if *is_quoted {
            // Quoted term: must match exactly as substring
            if !content_lower.contains(&term_lower) {
                return false;
            }
        } else {
            // Unquoted term: split by spaces and all words must appear
            let words: Vec<&str> = term_lower.split_whitespace().collect();
            for word in words {
                if !content_lower.contains(word) {
                    return false;
                }
            }
        }
    }

    true
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

    // Parse the search query into terms
    let search_terms = parse_search_query(&query);
    if search_terms.is_empty() {
        return Ok(vec![]);
    }

    for entry in WalkDir::new(&projects_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        // Extract project path from file path
        // Path format: ~/.claude/projects/[project_name]/[session].jsonl
        let project_path = entry.path()
            .parent() // Get parent directory (project folder)
            .map(|p| p.to_string_lossy().to_string());

        if let Ok(content) = fs::read_to_string(entry.path()) {
            for (line_num, line) in content.lines().enumerate() {
                if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(line) {
                    if log_entry.message_type == "user" || log_entry.message_type == "assistant" {
                        if let Some(message_content) = &log_entry.message {
                            let content_str = match &message_content.content {
                                serde_json::Value::String(s) => s.clone(),
                                serde_json::Value::Array(arr) => {
                                    // Extract text from array content items
                                    arr.iter()
                                        .filter_map(|item| {
                                            if let Some(text) = item.get("text") {
                                                text.as_str().map(|s| s.to_string())
                                            } else {
                                                None
                                            }
                                        })
                                        .collect::<Vec<String>>()
                                        .join(" ")
                                }
                                _ => "".to_string(),
                            };

                            if matches_search_terms(&content_str, &search_terms) {
                                let claude_message = ClaudeMessage {
                                    uuid: log_entry.uuid.unwrap_or_else(|| format!("{}-line-{}", Uuid::new_v4().to_string(), line_num + 1)),
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
                                    project_path: project_path.clone(),
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
