use crate::models::*;
use crate::models::universal::UniversalMessage;
use crate::commands::session::load_session_messages;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use walkdir::WalkDir;
use chrono::{DateTime, Datelike, Timelike, Utc};

fn extract_token_usage(message: &ClaudeMessage) -> TokenUsage {
    if let Some(usage) = &message.usage {
        return usage.clone();
    }
    
    let mut usage = TokenUsage {
        input_tokens: None,
        output_tokens: None,
        cache_creation_input_tokens: None,
        cache_read_input_tokens: None,
        service_tier: None,
    };

    if let Some(content) = &message.content {
        let usage_obj = if content.is_object() && content.get("usage").is_some() {
            content.get("usage")
        } else {
            None
        };
        
        if let Some(usage_obj) = usage_obj {
            if let Some(input) = usage_obj.get("input_tokens").and_then(|v| v.as_u64()) {
                usage.input_tokens = Some(input as u32);
            }
            if let Some(output) = usage_obj.get("output_tokens").and_then(|v| v.as_u64()) {
                usage.output_tokens = Some(output as u32);
            }
            if let Some(tier) = usage_obj.get("service_tier").and_then(|v| v.as_str()) {
                usage.service_tier = Some(tier.to_string());
            }
            if let Some(cache_creation) = usage_obj.get("cache_creation_input_tokens").and_then(|v| v.as_u64()) {
                usage.cache_creation_input_tokens = Some(cache_creation as u32);
            }
            if let Some(cache_read) = usage_obj.get("cache_read_input_tokens").and_then(|v| v.as_u64()) {
                usage.cache_read_input_tokens = Some(cache_read as u32);
            }
        }
    }

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

        if let Some(total_tokens) = tool_result.get("totalTokens").and_then(|v| v.as_u64()) {
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

// ============================================================================
// UNIVERSAL ANALYTICS (for both Claude Code and Cursor)
// ============================================================================

/// Extract token usage from UniversalMessage
fn extract_universal_token_usage(message: &UniversalMessage) -> (u32, u32, u32, u32) {
    if let Some(tokens) = &message.tokens {
        let input = if tokens.input_tokens >= 0 { tokens.input_tokens as u32 } else { 0 };
        let output = if tokens.output_tokens >= 0 { tokens.output_tokens as u32 } else { 0 };
        let cache_creation = tokens.cache_creation_tokens.unwrap_or(0).max(0) as u32;
        let cache_read = tokens.cache_read_tokens.unwrap_or(0).max(0) as u32;
        (input, output, cache_creation, cache_read)
    } else {
        (0, 0, 0, 0)
    }
}

/// Load UniversalMessages for a session based on provider
async fn load_universal_session_messages(
    provider_id: &str,
    source_path: &str,
    session_id: &str,
) -> Result<Vec<UniversalMessage>, String> {
    match provider_id {
        "claude-code" => {
            // For Claude Code, source_path is the JSONL file path
            // load_session_messages now returns UniversalMessage ✅
            use crate::commands::session::load_session_messages;
            load_session_messages(source_path.to_string()).await
        }
        "cursor" => {
            // For Cursor, we need to construct the encoded path format that load_cursor_messages expects
            // Format: <full_db_path>#session=<session_id>#timestamp=<timestamp>
            // source_path is the Cursor base path, we need to append the global DB path
            use crate::commands::cursor::load_cursor_messages;
            use std::path::PathBuf;

            // Build the full path to the global database
            let cursor_base = PathBuf::from(source_path);
            let global_db = cursor_base.join("User").join("globalStorage").join("state.vscdb");

            // Build the encoded path with session ID
            // We'll use a placeholder timestamp since load_cursor_messages extracts from the global DB anyway
            let encoded_path = format!("{}#session={}#timestamp=unknown", global_db.to_string_lossy(), session_id);

            load_cursor_messages(source_path.to_string(), encoded_path).await
        }
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}

/// Get all session IDs for a project based on provider
async fn get_project_session_ids(
    provider_id: &str,
    source_path: &str,
    project_id: &str,
) -> Result<Vec<String>, String> {
    match provider_id {
        "claude-code" => {
            // For Claude Code, scan JSONL files in project directory
            // Not implemented yet
            Err("Claude Code universal analytics not yet implemented".to_string())
        }
        "cursor" => {
            // For Cursor, load sessions from workspace
            use crate::commands::cursor::load_cursor_sessions;
            let sessions = load_cursor_sessions(source_path.to_string(), Some(project_id.to_string())).await?;
            Ok(sessions.into_iter().map(|s| s.id).collect())
        }
        _ => Err(format!("Unknown provider: {}", provider_id)),
    }
}

#[tauri::command]
pub async fn get_session_token_stats(session_path: String) -> Result<SessionTokenStats, String> {
    let messages = load_session_messages(session_path.clone()).await?;

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
        let (input, output, cache_creation, cache_read) = extract_universal_token_usage(message);

        total_input_tokens += input;
        total_output_tokens += output;
        total_cache_creation_tokens += cache_creation;
        total_cache_read_tokens += cache_read;

        if first_time.is_none() || message.timestamp < first_time.as_ref().unwrap().clone() {
            first_time = Some(message.timestamp.clone());
        }
        if last_time.is_none() || message.timestamp > last_time.as_ref().unwrap().clone() {
            last_time = Some(message.timestamp.clone());
        }
    }

    let total_tokens = total_input_tokens + total_output_tokens + total_cache_creation_tokens + total_cache_read_tokens;

    println!("  📈 Token stats summary: {} total tokens from {} messages",
             total_tokens, messages.len());

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
            Err(_) => continue, 
        }
    }

    session_stats.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    Ok(session_stats)
}

#[tauri::command]
pub async fn get_project_stats_summary(project_path: String) -> Result<ProjectStatsSummary, String> {
    let project_name = PathBuf::from(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let mut summary = ProjectStatsSummary::default();
    summary.project_name = project_name;

    let mut session_durations: Vec<u32> = Vec::new();
    let mut tool_usage_map: HashMap<String, (u32, u32)> = HashMap::new();
    let mut daily_stats_map: HashMap<String, DailyStats> = HashMap::new();
    let mut activity_map: HashMap<(u8, u8), (u32, u32)> = HashMap::new();
    let mut session_dates: HashSet<String> = HashSet::new();

    for entry in WalkDir::new(&project_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        summary.total_sessions += 1;
        let session_path = entry.path();
        let file = fs::File::open(session_path).map_err(|e| e.to_string())?;
        let reader = BufReader::new(file);

        let mut session_start: Option<DateTime<Utc>> = None;
        let mut session_end: Option<DateTime<Utc>> = None;
        let mut session_has_messages = false;

        for line in reader.lines() {
            let line = line.map_err(|e| e.to_string())?;
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(&line) {
                if let Ok(message) = ClaudeMessage::try_from(log_entry) {
                    summary.total_messages += 1;
                    session_has_messages = true;

                    if let Ok(timestamp) = DateTime::parse_from_rfc3339(&message.timestamp) {
                        let timestamp = timestamp.with_timezone(&Utc);

                        if session_start.is_none() || timestamp < session_start.unwrap() {
                            session_start = Some(timestamp);
                        }
                        if session_end.is_none() || timestamp > session_end.unwrap() {
                            session_end = Some(timestamp);
                        }

                        let hour = timestamp.hour() as u8;
                        let day = timestamp.weekday().num_days_from_sunday() as u8;
                        let usage = extract_token_usage(&message);
                        let tokens = usage.input_tokens.unwrap_or(0)
                            + usage.output_tokens.unwrap_or(0)
                            + usage.cache_creation_input_tokens.unwrap_or(0)
                            + usage.cache_read_input_tokens.unwrap_or(0);

                        let activity_entry = activity_map.entry((hour, day)).or_insert((0, 0));
                        activity_entry.0 += 1;
                        activity_entry.1 += tokens;

                        let date = timestamp.format("%Y-%m-%d").to_string();
                        session_dates.insert(date.clone());

                        let daily_entry = daily_stats_map.entry(date.clone()).or_insert_with(|| DailyStats {
                            date, ..Default::default()
                        });

                        daily_entry.total_tokens += tokens;
                        daily_entry.input_tokens += usage.input_tokens.unwrap_or(0);
                        daily_entry.output_tokens += usage.output_tokens.unwrap_or(0);
                        daily_entry.message_count += 1;

                        summary.token_distribution.input += usage.input_tokens.unwrap_or(0);
                        summary.token_distribution.output += usage.output_tokens.unwrap_or(0);
                        summary.token_distribution.cache_creation += usage.cache_creation_input_tokens.unwrap_or(0);
                        summary.token_distribution.cache_read += usage.cache_read_input_tokens.unwrap_or(0);
                    }

                    if message.message_type == "assistant" {
                        if let Some(content) = &message.content {
                            if let Some(content_array) = content.as_array() {
                                for item in content_array {
                                    if let Some(item_type) = item.get("type").and_then(|v| v.as_str()) {
                                        if item_type == "tool_use" {
                                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                                let tool_entry = tool_usage_map.entry(name.to_string()).or_insert((0, 0));
                                                tool_entry.0 += 1;
                                                tool_entry.1 += 1;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if let Some(tool_use) = &message.tool_use {
                        if let Some(name) = tool_use.get("name").and_then(|v| v.as_str()) {
                            let tool_entry = tool_usage_map.entry(name.to_string()).or_insert((0, 0));
                            tool_entry.0 += 1;
                            if let Some(result) = &message.tool_use_result {
                                let is_error = result.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);
                                if !is_error {
                                    tool_entry.1 += 1;
                                }
                            }
                        }
                    }
                }
            }
        }

        if let (Some(start), Some(end)) = (session_start, session_end) {
            let duration = (end - start).num_minutes() as u32;
            session_durations.push(duration);
        }

        if session_has_messages {
            if let Some(start) = session_start {
                let date = start.format("%Y-%m-%d").to_string();
                session_dates.insert(date);
            }
        }
    }

    for (date, daily_stat) in daily_stats_map.iter_mut() {
        daily_stat.session_count = session_dates.iter().filter(|&d| d == date).count();
        daily_stat.active_hours = if daily_stat.message_count > 0 {
            std::cmp::min(24, std::cmp::max(1, daily_stat.message_count / 10))
        } else {
            0
        };
    }

    summary.most_used_tools = tool_usage_map
        .into_iter()
        .map(|(name, (usage, success))| ToolUsageStats {
            tool_name: name,
            usage_count: usage,
            success_rate: if usage > 0 { (success as f32 / usage as f32) * 100.0 } else { 0.0 },
            avg_execution_time: None,
        })
        .collect();
    summary.most_used_tools.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));

    summary.daily_stats = daily_stats_map.into_values().collect();
    summary.daily_stats.sort_by(|a, b| a.date.cmp(&b.date));

    summary.activity_heatmap = activity_map
        .into_iter()
        .map(|((hour, day), (count, tokens))| ActivityHeatmap {
            hour,
            day,
            activity_count: count,
            tokens_used: tokens,
        })
        .collect();

    summary.total_tokens = summary.token_distribution.input + summary.token_distribution.output + summary.token_distribution.cache_creation + summary.token_distribution.cache_read;
    summary.avg_tokens_per_session = if summary.total_sessions > 0 { summary.total_tokens / summary.total_sessions as u32 } else { 0 };
    summary.avg_session_duration = if !session_durations.is_empty() {
        session_durations.iter().sum::<u32>() / session_durations.len() as u32
    } else {
        0
    };

    summary.most_active_hour = summary.activity_heatmap
        .iter()
        .max_by_key(|a| a.activity_count)
        .map(|a| a.hour)
        .unwrap_or(0);

    Ok(summary)
}

#[tauri::command]
pub async fn get_session_comparison(
    session_id: String,
    project_path: String,
) -> Result<SessionComparison, String> {
    let all_sessions = get_project_token_stats(project_path).await?;
    
    let target_session = all_sessions
        .iter()
        .find(|s| s.session_id == session_id)
        .ok_or("Session not found in project")?;
    
    let total_project_tokens: u32 = all_sessions.iter().map(|s| s.total_tokens).sum();
    let total_project_messages: usize = all_sessions.iter().map(|s| s.message_count).sum();
    
    let percentage_of_project_tokens = if total_project_tokens > 0 {
        (target_session.total_tokens as f32 / total_project_tokens as f32) * 100.0
    } else {
        0.0
    };
    
    let percentage_of_project_messages = if total_project_messages > 0 {
        (target_session.message_count as f32 / total_project_messages as f32) * 100.0
    } else {
        0.0
    };
    
    let rank_by_tokens = all_sessions
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0) + 1;
    
    let mut sessions_by_duration = all_sessions.clone();
    sessions_by_duration.sort_by(|a, b| {
        let a_duration = chrono::DateTime::parse_from_rfc3339(&a.last_message_time)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(&a.first_message_time).ok())
            .map(|(end, start)| (end - start).num_seconds())
            .unwrap_or(0);
        let b_duration = chrono::DateTime::parse_from_rfc3339(&b.last_message_time)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(&b.first_message_time).ok())
            .map(|(end, start)| (end - start).num_seconds())
            .unwrap_or(0);
        b_duration.cmp(&a_duration)
    });
    
    let rank_by_duration = sessions_by_duration
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0) + 1;
    
    let avg_tokens = if !all_sessions.is_empty() {
        total_project_tokens / all_sessions.len() as u32
    } else {
        0
    };
    let is_above_average = target_session.total_tokens > avg_tokens;
    
    Ok(SessionComparison {
        session_id,
        percentage_of_project_tokens,
        percentage_of_project_messages,
        rank_by_tokens,
        rank_by_duration,
        is_above_average,
    })
}

// ============================================================================
// UNIVERSAL STATS COMMANDS
// ============================================================================

#[tauri::command]
pub async fn get_universal_session_token_stats(
    provider_id: String,
    source_path: String,
    session_id: String,
) -> Result<SessionTokenStats, String> {
    let messages = load_universal_session_messages(&provider_id, &source_path, &session_id).await?;

    if messages.is_empty() {
        return Err("No valid messages found in session".to_string());
    }

    // Extract project name from first message's project_id
    let project_name = messages.first()
        .map(|m| m.project_id.clone())
        .unwrap_or_else(|| "unknown".to_string());

    let mut total_input_tokens = 0u32;
    let mut total_output_tokens = 0u32;
    let mut total_cache_creation_tokens = 0u32;
    let mut total_cache_read_tokens = 0u32;

    let mut first_time: Option<String> = None;
    let mut last_time: Option<String> = None;

    println!("  📊 Aggregating token stats from {} messages:", messages.len());
    let mut _messages_with_tokens = 0;

    for message in &messages {
        let (input, output, cache_creation, cache_read) = extract_universal_token_usage(message);

        if input > 0 || output > 0 {
            _messages_with_tokens += 1;
            println!("    ✅ Message {} has tokens: input={}, output={}",
                     message.id, input, output);
        }

        total_input_tokens += input;
        total_output_tokens += output;
        total_cache_creation_tokens += cache_creation;
        total_cache_read_tokens += cache_read;

        if first_time.is_none() || message.timestamp < first_time.as_ref().unwrap().clone() {
            first_time = Some(message.timestamp.clone());
        }
        if last_time.is_none() || message.timestamp > last_time.as_ref().unwrap().clone() {
            last_time = Some(message.timestamp.clone());
        }
    }

    let total_tokens = total_input_tokens + total_output_tokens + total_cache_creation_tokens + total_cache_read_tokens;

    println!("  📈 Token stats summary: {} total tokens from {} messages",
             total_tokens, messages.len());

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
pub async fn get_universal_project_token_stats(
    provider_id: String,
    source_path: String,
    project_id: String,
) -> Result<Vec<SessionTokenStats>, String> {
    let session_ids = get_project_session_ids(&provider_id, &source_path, &project_id).await?;

    let mut session_stats = Vec::new();

    for session_id in session_ids {
        match get_universal_session_token_stats(
            provider_id.clone(),
            source_path.clone(),
            session_id,
        ).await {
            Ok(stats) => session_stats.push(stats),
            Err(e) => {
                // Log error but continue with other sessions
                eprintln!("Failed to get stats for session: {}", e);
                continue;
            }
        }
    }

    // Sort by total tokens (descending)
    session_stats.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    Ok(session_stats)
}

#[tauri::command]
pub async fn get_universal_project_stats_summary(
    provider_id: String,
    source_path: String,
    project_id: String,
) -> Result<ProjectStatsSummary, String> {
    let project_name = project_id.clone();

    let mut summary = ProjectStatsSummary::default();
    summary.project_name = project_name;

    let session_ids = get_project_session_ids(&provider_id, &source_path, &project_id).await?;
    summary.total_sessions = session_ids.len();

    let mut session_durations: Vec<u32> = Vec::new();
    let mut tool_usage_map: HashMap<String, (u32, u32)> = HashMap::new();
    let mut daily_stats_map: HashMap<String, DailyStats> = HashMap::new();
    let mut activity_map: HashMap<(u8, u8), (u32, u32)> = HashMap::new();
    let mut session_dates: HashSet<String> = HashSet::new();

    for session_id in session_ids {
        let messages = match load_universal_session_messages(&provider_id, &source_path, &session_id).await {
            Ok(msgs) => msgs,
            Err(_) => continue, // Skip sessions that fail to load
        };

        if messages.is_empty() {
            continue;
        }

        let mut session_start: Option<DateTime<Utc>> = None;
        let mut session_end: Option<DateTime<Utc>> = None;
        let mut session_has_messages = false;

        for message in &messages {
            summary.total_messages += 1;
            session_has_messages = true;

            if let Ok(timestamp) = DateTime::parse_from_rfc3339(&message.timestamp) {
                let timestamp = timestamp.with_timezone(&Utc);

                if session_start.is_none() || timestamp < session_start.unwrap() {
                    session_start = Some(timestamp);
                }
                if session_end.is_none() || timestamp > session_end.unwrap() {
                    session_end = Some(timestamp);
                }

                let hour = timestamp.hour() as u8;
                let day = timestamp.weekday().num_days_from_sunday() as u8;
                let (input, output, cache_creation, cache_read) = extract_universal_token_usage(message);
                let tokens = input + output + cache_creation + cache_read;

                let activity_entry = activity_map.entry((hour, day)).or_insert((0, 0));
                activity_entry.0 += 1;
                activity_entry.1 += tokens;

                let date = timestamp.format("%Y-%m-%d").to_string();
                session_dates.insert(date.clone());

                let daily_entry = daily_stats_map.entry(date.clone()).or_insert_with(|| DailyStats {
                    date, ..Default::default()
                });

                daily_entry.total_tokens += tokens;
                daily_entry.input_tokens += input;
                daily_entry.output_tokens += output;
                daily_entry.message_count += 1;

                summary.token_distribution.input += input;
                summary.token_distribution.output += output;
                summary.token_distribution.cache_creation += cache_creation;
                summary.token_distribution.cache_read += cache_read;
            }

            // Extract tool usage from UniversalMessage
            if let Some(ref tool_calls) = message.tool_calls {
                for tool_call in tool_calls {
                    let tool_entry = tool_usage_map.entry(tool_call.name.clone()).or_insert((0, 0));
                    tool_entry.0 += 1;
                    // For now, assume all tool calls succeed (we don't track success in UniversalMessage easily)
                    tool_entry.1 += 1;
                }
            }
        }

        if let (Some(start), Some(end)) = (session_start, session_end) {
            let duration = (end - start).num_minutes() as u32;
            session_durations.push(duration);
        }

        if session_has_messages {
            if let Some(start) = session_start {
                let date = start.format("%Y-%m-%d").to_string();
                session_dates.insert(date);
            }
        }
    }

    for (date, daily_stat) in daily_stats_map.iter_mut() {
        daily_stat.session_count = session_dates.iter().filter(|&d| d == date).count();
        daily_stat.active_hours = if daily_stat.message_count > 0 {
            std::cmp::min(24, std::cmp::max(1, daily_stat.message_count / 10))
        } else {
            0
        };
    }

    summary.most_used_tools = tool_usage_map
        .into_iter()
        .map(|(name, (usage, success))| ToolUsageStats {
            tool_name: name,
            usage_count: usage,
            success_rate: if usage > 0 { (success as f32 / usage as f32) * 100.0 } else { 0.0 },
            avg_execution_time: None,
        })
        .collect();
    summary.most_used_tools.sort_by(|a, b| b.usage_count.cmp(&a.usage_count));

    summary.daily_stats = daily_stats_map.into_values().collect();
    summary.daily_stats.sort_by(|a, b| a.date.cmp(&b.date));

    summary.activity_heatmap = activity_map
        .into_iter()
        .map(|((hour, day), (count, tokens))| ActivityHeatmap {
            hour,
            day,
            activity_count: count,
            tokens_used: tokens,
        })
        .collect();

    summary.total_tokens = summary.token_distribution.input + summary.token_distribution.output + summary.token_distribution.cache_creation + summary.token_distribution.cache_read;
    summary.avg_tokens_per_session = if summary.total_sessions > 0 { summary.total_tokens / summary.total_sessions as u32 } else { 0 };
    summary.avg_session_duration = if !session_durations.is_empty() {
        session_durations.iter().sum::<u32>() / session_durations.len() as u32
    } else {
        0
    };

    summary.most_active_hour = summary.activity_heatmap
        .iter()
        .max_by_key(|a| a.activity_count)
        .map(|a| a.hour)
        .unwrap_or(0);

    Ok(summary)
}

#[tauri::command]
pub async fn get_universal_session_comparison(
    provider_id: String,
    source_path: String,
    session_id: String,
    project_id: String,
) -> Result<SessionComparison, String> {
    let all_sessions = get_universal_project_token_stats(
        provider_id.clone(),
        source_path.clone(),
        project_id,
    ).await?;

    let target_session = all_sessions
        .iter()
        .find(|s| s.session_id == session_id)
        .ok_or("Session not found in project")?;

    let total_project_tokens: u32 = all_sessions.iter().map(|s| s.total_tokens).sum();
    let total_project_messages: usize = all_sessions.iter().map(|s| s.message_count).sum();

    let percentage_of_project_tokens = if total_project_tokens > 0 {
        (target_session.total_tokens as f32 / total_project_tokens as f32) * 100.0
    } else {
        0.0
    };

    let percentage_of_project_messages = if total_project_messages > 0 {
        (target_session.message_count as f32 / total_project_messages as f32) * 100.0
    } else {
        0.0
    };

    let rank_by_tokens = all_sessions
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0) + 1;

    let mut sessions_by_duration = all_sessions.clone();
    sessions_by_duration.sort_by(|a, b| {
        let a_duration = chrono::DateTime::parse_from_rfc3339(&a.last_message_time)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(&a.first_message_time).ok())
            .map(|(end, start)| (end - start).num_seconds())
            .unwrap_or(0);
        let b_duration = chrono::DateTime::parse_from_rfc3339(&b.last_message_time)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(&b.first_message_time).ok())
            .map(|(end, start)| (end - start).num_seconds())
            .unwrap_or(0);
        b_duration.cmp(&a_duration)
    });

    let rank_by_duration = sessions_by_duration
        .iter()
        .position(|s| s.session_id == session_id)
        .unwrap_or(0) + 1;

    let avg_tokens = if !all_sessions.is_empty() {
        total_project_tokens / all_sessions.len() as u32
    } else {
        0
    };
    let is_above_average = target_session.total_tokens > avg_tokens;

    Ok(SessionComparison {
        session_id,
        percentage_of_project_tokens,
        percentage_of_project_messages,
        rank_by_tokens,
        rank_by_duration,
        is_above_average,
    })
}

impl TryFrom<RawLogEntry> for ClaudeMessage {
    type Error = String;

    fn try_from(log_entry: RawLogEntry) -> Result<Self, Self::Error> {
        if log_entry.message_type == "summary" {
            return Err("Summary entries should be handled separately".to_string());
        }
        if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
            return Err("Missing session_id and timestamp".to_string());
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

        Ok(ClaudeMessage {
            uuid: log_entry.uuid.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
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
        })
    }
}
