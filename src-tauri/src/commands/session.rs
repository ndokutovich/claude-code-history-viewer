use crate::commands::adapters::claude_code::claude_message_to_universal;
use crate::models::universal::UniversalMessage;
use crate::models::*;
use crate::utils::{
    extract_git_info, extract_project_name, filter_preamble_from_title, find_line_ranges,
};
use chrono::{DateTime, Utc};
use memmap2::Mmap;
use rayon::prelude::*;
use serde::Deserialize;
use serde_json::json;
use std::fs;
use uuid::Uuid;
use walkdir::WalkDir;

/// Ultra-lightweight struct for pagination pass 1 — only parses fields needed
/// to decide whether a line is a valid, displayable message.
#[derive(Deserialize)]
struct PaginationScanEntry {
    #[serde(rename = "type")]
    message_type: String,
    #[serde(rename = "sessionId")]
    session_id: Option<Box<serde_json::value::RawValue>>,
    timestamp: Option<Box<serde_json::value::RawValue>>,
    #[serde(rename = "isSidechain")]
    is_sidechain: Option<bool>,
}

/// Build system metadata JSON from a RawLogEntry's system-specific fields.
/// Returns None for non-system messages or if no system fields are present.
fn build_system_metadata(entry: &RawLogEntry) -> Option<serde_json::Value> {
    if entry.message_type != "system" {
        return None;
    }
    let mut meta = serde_json::Map::new();
    if let Some(ref level) = entry.level {
        meta.insert("level".to_string(), json!(level));
    }
    if let Some(ref cm) = entry.compact_metadata {
        meta.insert("compactMetadata".to_string(), cm.clone());
    }
    if let Some(ref mcm) = entry.microcompact_metadata {
        meta.insert("microcompactMetadata".to_string(), mcm.clone());
    }
    if let Some(ms) = entry.duration_ms {
        meta.insert("durationMs".to_string(), json!(ms));
    }
    if let Some(count) = entry.hook_count {
        meta.insert("hookCount".to_string(), json!(count));
    }
    if let Some(ref infos) = entry.hook_infos {
        meta.insert("hookInfos".to_string(), infos.clone());
    }
    if let Some(ref reason) = entry.stop_reason_system {
        meta.insert("stopReasonSystem".to_string(), json!(reason));
    }
    if let Some(prevented) = entry.prevented_continuation {
        meta.insert("preventedContinuation".to_string(), json!(prevented));
    }
    if meta.is_empty() {
        None
    } else {
        Some(serde_json::Value::Object(meta))
    }
}

/// Check if a message type is non-conversation noise (progress, snapshots, queue ops).
/// These are internal operational messages that should not be displayed as conversation content.
fn is_noise_message_type(message_type: &str) -> bool {
    matches!(
        message_type,
        "progress" | "queue-operation" | "file-history-snapshot"
    )
}

/// Normalizes Windows extended-length paths by stripping the \\?\ prefix
/// This ensures consistent path formatting across all commands
///
/// Example:
/// - Extended length: \\?\C:\Users\xxx\.claude\projects\my-project → C:\Users\xxx\.claude\projects\my-project
/// - Extended UNC:    \\?\UNC\server\share\folder → \\server\share\folder
#[cfg(target_os = "windows")]
fn normalize_windows_path(path: &str) -> String {
    if path.starts_with(r"\\?\UNC\") {
        // Extended UNC: \\?\UNC\server\share → \\server\share
        format!(r"\\{}", &path[8..])
    } else if path.starts_with(r"\\?\") {
        // Extended length: \\?\C:\path → C:\path
        path[4..].to_string()
    } else {
        path.to_string()
    }
}

#[cfg(not(target_os = "windows"))]
fn normalize_windows_path(path: &str) -> String {
    path.to_string()
}

/// Process a single JSONL file into a `ClaudeSession` using lightweight `SessionScanEntry`.
/// Returns `None` if the file has no valid messages.
fn process_session_file(
    entry: &walkdir::DirEntry,
    exclude_sidechain: bool,
    include_noise: bool,
) -> Option<ClaudeSession> {
    let file_path = entry.path().to_string_lossy().to_string();

    let last_modified = entry
        .metadata()
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| {
            let dt: DateTime<Utc> = t.into();
            dt.to_rfc3339()
        })
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    let file = std::fs::File::open(entry.path()).ok()?;
    use std::io::{BufRead, BufReader};
    let reader = BufReader::new(file);

    // Lightweight scan state — no ClaudeMessage allocation
    let mut session_summary: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut git_commit: Option<String> = None;
    let mut actual_session_id: Option<String> = None;
    let mut message_count: usize = 0;
    let mut first_message_time: Option<String> = None;
    let mut last_message_time: Option<String> = None;
    let mut has_tool_use = false;
    let mut has_errors = false;

    // Track the last non-sidechain entry for is_problematic check
    let mut last_non_sidechain_type: Option<String> = None;
    let mut last_non_sidechain_role: Option<String> = None;
    let mut last_non_sidechain_content_raw: Option<String> = None;

    // Track first user message content for summary fallback
    let mut first_user_content_raw: Option<String> = None;

    // Track tool_use_result raw strings for git info fallback (capped to prevent OOM)
    let mut tool_result_raws: Vec<String> = Vec::new();
    let mut git_info_found = false;

    for (_line_num, line_result) in reader.lines().enumerate() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }

        let scan_entry: SessionScanEntry = match serde_json::from_str(&line) {
            Ok(e) => e,
            Err(_e) => {
                #[cfg(debug_assertions)]
                eprintln!(
                    "Error: Failed to parse JSONL at line {} in {}: {}",
                    _line_num + 1,
                    file_path,
                    _e
                );
                continue;
            }
        };

        // Extract git info from first message that has it
        if git_branch.is_none() {
            if let Some(ref branch) = scan_entry.git_branch {
                git_branch = Some(branch.clone());
            }
        }
        if git_commit.is_none() {
            if let Some(ref commit) = scan_entry.git_commit {
                git_commit = Some(commit.clone());
            }
        }

        if scan_entry.message_type == "summary" {
            if session_summary.is_none() {
                session_summary =
                    scan_entry.summary.map(|s| filter_preamble_from_title(&s));
            }
            continue;
        }

        if !include_noise && is_noise_message_type(&scan_entry.message_type) {
            continue;
        }

        if scan_entry.session_id.is_none() && scan_entry.timestamp.is_none() {
            continue;
        }

        let is_sidechain = scan_entry.is_sidechain.unwrap_or(false);
        if exclude_sidechain && is_sidechain {
            // Still count for has_tool_use/has_errors even if filtered from display count
        } else {
            message_count += 1;
            if let Some(ref ts) = scan_entry.timestamp {
                if first_message_time.is_none() {
                    first_message_time = Some(ts.clone());
                }
                last_message_time = Some(ts.clone());
            }
        }

        // Track actual session ID
        if actual_session_id.is_none() {
            if let Some(ref sid) = scan_entry.session_id {
                actual_session_id = Some(sid.clone());
            }
        }

        // --- has_tool_use check (lightweight, using RawValue strings) ---
        if !has_tool_use {
            // Check top-level tool_use/tool_use_result presence
            if scan_entry.tool_use.is_some() {
                has_tool_use = true;
            }
            // Check content array for "type":"tool_use" via raw string scan
            if !has_tool_use && scan_entry.message_type == "assistant" {
                if let Some(ref msg) = scan_entry.message {
                    if let Some(ref content_raw) = msg.content {
                        if content_raw.get().contains("\"type\":\"tool_use\"") {
                            has_tool_use = true;
                        }
                    }
                }
            }
        }

        // --- has_errors check (lazy parse only tool_use_result with stderr) ---
        if !has_errors {
            if let Some(ref raw) = scan_entry.tool_use_result {
                let raw_str = raw.get();
                // Quick string check before attempting parse
                if raw_str.contains("\"stderr\"") {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(raw_str) {
                        if let Some(stderr) = val.get("stderr") {
                            if !stderr.as_str().unwrap_or("").is_empty() {
                                has_errors = true;
                            }
                        }
                    }
                }
            }
        }

        // --- Track last non-sidechain for is_problematic ---
        if !is_sidechain {
            last_non_sidechain_type = Some(scan_entry.message_type.clone());
            last_non_sidechain_role = scan_entry.message.as_ref().map(|m| m.role.clone());
            last_non_sidechain_content_raw = scan_entry
                .message
                .as_ref()
                .and_then(|m| m.content.as_ref())
                .map(|c| c.get().to_string());
        }

        // --- Track first user message content for summary fallback ---
        if first_user_content_raw.is_none() && scan_entry.message_type == "user" {
            if let Some(ref msg) = scan_entry.message {
                if let Some(ref content_raw) = msg.content {
                    first_user_content_raw = Some(content_raw.get().to_string());
                }
            }
        }

        // --- Collect tool_use_result raws for git info fallback (stop once found) ---
        if !git_info_found {
            if let Some(ref raw) = scan_entry.tool_use_result {
                let raw_str = raw.get();
                if raw_str.contains("stdout") || raw_str.len() < 1000 {
                    tool_result_raws.push(raw_str.to_string());
                }
                // Stop collecting after 50 results — git info is always early
                if tool_result_raws.len() >= 50 {
                    git_info_found = true;
                }
            }
        }
    }

    if message_count == 0 {
        return None;
    }

    // --- is_problematic detection ---
    let is_problematic = if let Some(ref msg_type) = last_non_sidechain_type {
        if msg_type != "assistant" {
            true
        } else if let Some(ref role) = last_non_sidechain_role {
            if role != "assistant" {
                true
            } else if let Some(ref content_str) = last_non_sidechain_content_raw {
                content_str.contains("[Request interrupted")
                    || content_str.contains("is_error\":true")
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    // --- Summary from first user message (only if no summary message found) ---
    let final_summary = if session_summary.is_some() {
        session_summary
    } else {
        extract_summary_from_raw_content(first_user_content_raw.as_deref())
    };

    // --- Git info fallback from tool outputs ---
    let tool_outputs: Vec<String> = tool_result_raws
        .iter()
        .filter_map(|raw_str| {
            // Quick parse to extract stdout
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(raw_str) {
                if let Some(stdout) = val.get("stdout").and_then(|v| v.as_str()) {
                    return Some(stdout.to_string());
                }
                if let Some(text) = val.as_str() {
                    return Some(text.to_string());
                }
            }
            None
        })
        .collect();

    let (fallback_branch, fallback_commit) = extract_git_info(&None, &tool_outputs);
    let final_git_branch = git_branch.or(fallback_branch);
    let final_git_commit = git_commit.or(fallback_commit);

    let session_id = file_path.clone();
    let raw_project_name = entry
        .path()
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    let project_name = extract_project_name(&raw_project_name);

    Some(ClaudeSession {
        session_id,
        actual_session_id: actual_session_id.unwrap_or_else(|| "unknown-session".to_string()),
        file_path,
        project_name,
        message_count,
        first_message_time: first_message_time.unwrap_or_default(),
        last_message_time: last_message_time.unwrap_or_default(),
        last_modified,
        has_tool_use,
        has_errors,
        is_problematic,
        summary: final_summary,
        git_branch: final_git_branch,
        git_commit: final_git_commit,
    })
}

/// Extract a summary string from raw JSON content of the first user message.
/// The content may be a JSON string or an array with `{"type":"text","text":"..."}` items.
fn extract_summary_from_raw_content(raw_content: Option<&str>) -> Option<String> {
    let raw = raw_content?;
    // Try parsing as serde_json::Value to handle both string and array forms
    let val: serde_json::Value = serde_json::from_str(raw).ok()?;
    match val {
        serde_json::Value::String(text) => {
            if text.trim().is_empty() {
                None
            } else {
                let filtered = filter_preamble_from_title(&text);
                Some(truncate_summary(&filtered))
            }
        }
        serde_json::Value::Array(arr) => {
            for item in &arr {
                if item.get("type").and_then(|v| v.as_str()) == Some("text") {
                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                        if !text.trim().is_empty() {
                            let filtered = filter_preamble_from_title(text);
                            return Some(truncate_summary(&filtered));
                        }
                    }
                }
            }
            None
        }
        _ => None,
    }
}

/// Truncate a summary string to 100 characters with ellipsis.
fn truncate_summary(s: &str) -> String {
    if s.chars().count() > 100 {
        let truncated: String = s.chars().take(100).collect();
        format!("{}...", truncated)
    } else {
        s.to_string()
    }
}

#[tauri::command]
pub async fn load_project_sessions(
    project_path: String,
    exclude_sidechain: Option<bool>,
    include_noise: Option<bool>,
) -> Result<Vec<ClaudeSession>, String> {
    let start_time = std::time::Instant::now();
    let exclude = exclude_sidechain.unwrap_or(false);
    let noise = include_noise.unwrap_or(false);

    // Collect file entries first for parallel processing
    let file_entries: Vec<_> = WalkDir::new(&project_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        .collect();

    // Process files in parallel using rayon
    let mut sessions: Vec<ClaudeSession> = file_entries
        .par_iter()
        .filter_map(|entry| process_session_file(entry, exclude, noise))
        .collect();

    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    // Summary propagation logic:
    // Multiple JSONL files can share the same actual_session_id (from the messages inside),
    // but only some files contain a summary message. This two-pass approach ensures all
    // sessions with the same actual_session_id display consistent summaries:
    // 1. First pass: Collect all existing summaries mapped by actual_session_id
    // 2. Second pass: Apply collected summaries to any session that's missing one
    // This provides a better user experience by showing the same summary for related sessions.

    // Create a map of actual_session_id to summary
    let mut summary_map: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

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
        if session.summary.is_none()
            || session
                .summary
                .as_ref()
                .map(|s| s.is_empty())
                .unwrap_or(false)
        {
            if let Some(summary) = summary_map.get(&session.actual_session_id) {
                session.summary = Some(summary.clone());
            }
        }
    }

    let _elapsed = start_time.elapsed();
    #[cfg(debug_assertions)]
    println!(
        "load_project_sessions performance: {} sessions loaded in {}ms",
        sessions.len(),
        _elapsed.as_millis()
    );

    Ok(sessions)
}

#[tauri::command]
pub async fn load_session_messages(session_path: String, include_noise: Option<bool>) -> Result<Vec<UniversalMessage>, String> {
    // Use memory-mapped I/O for zero-copy file access (faster than read_to_string for large files)
    let file = fs::File::open(&session_path)
        .map_err(|e| format!("SESSION_READ_ERROR: Failed to open session file: {}", e))?;

    let metadata = file
        .metadata()
        .map_err(|e| format!("SESSION_READ_ERROR: Failed to read file metadata: {}", e))?;

    // For empty files, return empty vec immediately
    if metadata.len() == 0 {
        return Ok(Vec::new());
    }

    // SAFETY: The file is opened read-only. We hold the File handle for the duration
    // of processing. The file content is treated as immutable bytes.
    let mmap = unsafe {
        Mmap::map(&file)
            .map_err(|e| format!("SESSION_READ_ERROR: Failed to memory-map session file: {}", e))?
    };

    // Use SIMD-accelerated line splitting
    let line_ranges = find_line_ranges(&mmap);
    let mut messages = Vec::new();

    for (line_num, &(start, end)) in line_ranges.iter().enumerate() {
        let line = std::str::from_utf8(&mmap[start..end]).unwrap_or_default();
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<RawLogEntry>(line) {
            Ok(log_entry) => {
                if log_entry.message_type == "summary" {
                    if let Some(summary_text) = log_entry.summary {
                        let uuid = log_entry.uuid.unwrap_or_else(|| {
                            let new_uuid = Uuid::new_v4().to_string();
                            eprintln!(
                                "Warning: Missing UUID for summary in line {} of {}, generated: {}",
                                line_num + 1,
                                session_path,
                                new_uuid
                            );
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
                            subtype: None,
                            system_metadata: None,
                        };
                        messages.push(summary_message);
                    }
                } else if !include_noise.unwrap_or(false) && is_noise_message_type(&log_entry.message_type) {
                    // Skip progress, file-history-snapshot, queue-operation (unless include_noise)
                    continue;
                } else {
                    if log_entry.session_id.is_none() && log_entry.timestamp.is_none() {
                        continue;
                    }

                    let subtype = log_entry.subtype.clone();
                    let system_metadata = build_system_metadata(&log_entry);

                    let uuid = log_entry.uuid.unwrap_or_else(|| {
                        let new_uuid =
                            format!("{}-line-{}", Uuid::new_v4().to_string(), line_num + 1);
                        eprintln!(
                            "Warning: Missing UUID in line {} of {}, generated: {}",
                            line_num + 1,
                            session_path,
                            new_uuid
                        );
                        new_uuid
                    });

                    let (role, message_id, model, stop_reason, usage) =
                        if let Some(ref msg) = log_entry.message {
                            (
                                Some(msg.role.clone()),
                                msg.id.clone(),
                                msg.model.clone(),
                                msg.stop_reason.clone(),
                                msg.usage.clone(),
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
                        subtype,
                        system_metadata,
                    };
                    messages.push(claude_message);
                }
            }
            Err(e) => {
                eprintln!(
                    "Failed to parse line {} in {}: {}. Line: {}",
                    line_num + 1,
                    session_path,
                    e,
                    line
                );
            }
        }
    }

    // Convert ClaudeMessages to UniversalMessages
    // Extract full project path from session path for consistency with search_messages
    // E.g., "/path/to/.claude/projects/my-project/session.jsonl" -> "/path/to/.claude/projects/my-project"
    let project_id = if let Some(projects_idx) = session_path.find("projects") {
        let after_projects = &session_path[projects_idx + "projects".len()..];
        let parts: Vec<&str> = after_projects
            .split(|c| c == '/' || c == '\\')
            .filter(|s| !s.is_empty())
            .collect();
        if !parts.is_empty() {
            // Reconstruct full path up to project directory
            let up_to_projects = &session_path[..projects_idx + "projects".len()];
            normalize_windows_path(&format!("{}/{}", up_to_projects, parts[0]))
        } else {
            "unknown".to_string()
        }
    } else {
        "unknown".to_string()
    };

    let source_id = session_path
        .split("projects")
        .next()
        .unwrap_or("")
        .trim_end_matches('/')
        .to_string();

    let universal_messages: Vec<UniversalMessage> = messages
        .iter()
        .enumerate()
        .map(|(i, msg)| {
            claude_message_to_universal(msg, project_id.clone(), source_id.clone(), i as i32)
        })
        .collect();

    Ok(universal_messages)
}

#[tauri::command]
pub async fn load_session_messages_paginated(
    session_path: String,
    offset: usize,
    limit: usize,
    exclude_sidechain: Option<bool>,
    include_noise: Option<bool>,
) -> Result<MessagePage, String> {
    let start_time = std::time::Instant::now();

    let file = fs::File::open(&session_path)
        .map_err(|e| format!("SESSION_FILE_ERROR: Failed to open session file: {}", e))?;

    let metadata = file
        .metadata()
        .map_err(|e| format!("SESSION_READ_ERROR: Failed to read file metadata: {}", e))?;

    // For empty files, return empty page immediately
    if metadata.len() == 0 {
        return Ok(MessagePage {
            messages: Vec::new(),
            total_count: 0,
            next_offset: offset,
            has_more: false,
        });
    }

    // Use memory-mapped I/O for zero-copy access
    let mmap = unsafe {
        Mmap::map(&file)
            .map_err(|e| format!("SESSION_READ_ERROR: Failed to memory-map session file: {}", e))?
    };

    // Use SIMD-accelerated line splitting
    let line_ranges = find_line_ranges(&mmap);

    let exclude = exclude_sidechain.unwrap_or(false);
    let noise = include_noise.unwrap_or(false);

    // === PASS 1: Lightweight scan for pagination ===
    // Only parse 4 fields per line to determine which lines are valid displayable messages.
    let mut valid_line_indices: Vec<usize> = Vec::with_capacity(line_ranges.len());

    for (line_idx, &(start, end)) in line_ranges.iter().enumerate() {
        let line = std::str::from_utf8(&mmap[start..end]).unwrap_or_default();
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<PaginationScanEntry>(line) {
            Ok(entry) => {
                if entry.message_type == "summary" {
                    continue;
                }
                if !noise && is_noise_message_type(&entry.message_type) {
                    continue;
                }
                if exclude && entry.is_sidechain.unwrap_or(false) {
                    continue;
                }
                if entry.session_id.is_none() && entry.timestamp.is_none() {
                    continue;
                }
                valid_line_indices.push(line_idx);
            }
            Err(_e) => {
                #[cfg(debug_assertions)]
                eprintln!(
                    "Failed to parse line {} in {}: {}",
                    line_idx + 1,
                    session_path,
                    _e
                );
            }
        }
    }

    let total_count = valid_line_indices.len();

    #[cfg(debug_assertions)]
    eprintln!(
        "Pagination Debug - Total: {}, Offset: {}, Limit: {}",
        total_count, offset, limit
    );

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
    eprintln!(
        "Load calculation: total={}, already_loaded={}, remaining={}, will_load={}",
        total_count, already_loaded, remaining_messages, messages_to_load
    );

    let (start_idx, end_idx) = if remaining_messages == 0 {
        #[cfg(debug_assertions)]
        eprintln!("No more messages available");
        (0, 0)
    } else {
        let start = total_count - already_loaded - messages_to_load;
        let end = total_count - already_loaded;
        #[cfg(debug_assertions)]
        eprintln!(
            "Loading messages: start={}, end={} (will load {} messages)",
            start, end, messages_to_load
        );
        (start, end)
    };

    // === PASS 2: Full parse only the messages in the requested page ===
    // Extract project_id and source_id from session path (same logic as before)
    let project_id = if let Some(projects_idx) = session_path.find("projects") {
        let after_projects = &session_path[projects_idx + "projects".len()..];
        let parts: Vec<&str> = after_projects
            .split(|c| c == '/' || c == '\\')
            .filter(|s| !s.is_empty())
            .collect();
        if !parts.is_empty() {
            let up_to_projects = &session_path[..projects_idx + "projects".len()];
            normalize_windows_path(&format!("{}/{}", up_to_projects, parts[0]))
        } else {
            "unknown".to_string()
        }
    } else {
        "unknown".to_string()
    };

    let source_id = session_path
        .split("projects")
        .next()
        .unwrap_or("")
        .trim_end_matches('/')
        .to_string();

    let page_indices = &valid_line_indices[start_idx..end_idx];
    let mut messages: Vec<UniversalMessage> = Vec::with_capacity(page_indices.len());

    for (i, &line_idx) in page_indices.iter().enumerate() {
        let (start, end) = line_ranges[line_idx];
        let line = std::str::from_utf8(&mmap[start..end]).unwrap_or_default();

        match serde_json::from_str::<RawLogEntry>(line) {
            Ok(log_entry) => {
                let (role, message_id, model, stop_reason, usage) =
                    if let Some(ref msg) = log_entry.message {
                        (
                            Some(msg.role.clone()),
                            msg.id.clone(),
                            msg.model.clone(),
                            msg.stop_reason.clone(),
                            msg.usage.clone(),
                        )
                    } else {
                        (None, None, None, None, None)
                    };

                let subtype = log_entry.subtype.clone();
                let system_metadata = build_system_metadata(&log_entry);
                let claude_message = ClaudeMessage {
                    uuid: log_entry.uuid.unwrap_or_else(|| {
                        format!("{}-line-{}", Uuid::new_v4().to_string(), line_idx + 1)
                    }),
                    parent_uuid: log_entry.parent_uuid,
                    session_id: log_entry
                        .session_id
                        .unwrap_or_else(|| "unknown-session".to_string()),
                    timestamp: log_entry
                        .timestamp
                        .unwrap_or_else(|| Utc::now().to_rfc3339()),
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
                    subtype,
                    system_metadata,
                };

                // sequence_number reflects global position, not local index
                let seq = (start_idx + i) as i32;
                let universal = claude_message_to_universal(
                    &claude_message,
                    project_id.clone(),
                    source_id.clone(),
                    seq,
                );
                messages.push(universal);
            }
            Err(_e) => {
                #[cfg(debug_assertions)]
                eprintln!(
                    "Failed to full-parse line {} in {}: {}",
                    line_idx + 1,
                    session_path,
                    _e
                );
            }
        }
    }

    // has_more is true if there are still older messages to load
    let has_more = start_idx > 0;
    let next_offset = offset + messages.len();

    let _elapsed = start_time.elapsed();
    #[cfg(debug_assertions)]
    eprintln!(
        "load_session_messages_paginated performance: {} messages loaded (of {} total) in {}ms",
        messages.len(),
        total_count,
        _elapsed.as_millis()
    );

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
    include_noise: Option<bool>,
) -> Result<usize, String> {
    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("SESSION_READ_ERROR: Failed to read session file: {}", e))?;

    let mut count = 0;

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(line) {
            if log_entry.message_type != "summary"
                && (include_noise.unwrap_or(false) || !is_noise_message_type(&log_entry.message_type))
            {
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
            // Handle both regular quotes and smart quotes (curly quotes)
            '"' | '“' | '”' | '\'' | '‘' | '’' => {
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

/// Normalize quotes in text - converts all smart quotes to regular quotes
fn normalize_quotes(text: &str) -> String {
    text.chars()
        .map(|ch| match ch {
            '“' | '”' => '"',
            '‘' | '’' => '\'',
            _ => ch,
        })
        .collect()
}

/// Check if content matches all search terms
/// Quoted terms must match exactly, unquoted terms must all appear somewhere
fn matches_search_terms(content: &str, terms: &[(bool, String)]) -> bool {
    // Normalize quotes in content so smart quotes match regular quotes
    let normalized_content = normalize_quotes(content);
    let content_lower = normalized_content.to_lowercase();

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
    filters: SearchFilters,
) -> Result<Vec<UniversalMessage>, String> {
    // Validate and canonicalize the path for better error handling.
    // Note: Path traversal is not a security concern for desktop apps where the user
    // already has full filesystem access. This validation catches programming errors
    // and provides clearer error messages when the path doesn't exist.
    let canonical_claude_path = std::fs::canonicalize(&claude_path)
        .map_err(|e| format!("SEARCH_INVALID_PATH: Failed to resolve claude path: {}", e))?;

    let projects_path = canonical_claude_path.join("projects");
    let mut all_messages = Vec::new();

    if !projects_path.exists() {
        return Ok(vec![]);
    }

    // Parse the search query into terms
    let search_terms = parse_search_query(&query);
    if search_terms.is_empty() {
        return Ok(vec![]);
    }

    // Parse date range if provided
    let date_range = if let Some(ref dates) = filters.date_range {
        if dates.len() == 2 {
            let start = DateTime::parse_from_rfc3339(&dates[0]).ok();
            let end = DateTime::parse_from_rfc3339(&dates[1]).ok();
            start.zip(end)
        } else {
            None
        }
    } else {
        None
    };

    for entry in WalkDir::new(&projects_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
    {
        // Extract project path from file path
        // Path format: ~/.claude/projects/[project_name]/[session].jsonl
        let project_path = entry
            .path()
            .parent() // Get parent directory (project folder)
            .map(|p| normalize_windows_path(&p.to_string_lossy().to_string()));

        // Filter by project if specified
        if let Some(ref project_filters) = filters.projects {
            if let Some(ref path) = project_path {
                // Check if this project path is in the allowed list
                if !project_filters.iter().any(|p| path.contains(p)) {
                    continue;
                }
            } else {
                continue;
            }
        }

        // Filter by session if specified
        if let Some(ref session_filter) = filters.session_id {
            let file_path = entry.path().to_string_lossy().to_string();
            if !file_path.contains(session_filter) {
                continue;
            }
        }

        if let Ok(content) = fs::read_to_string(entry.path()) {
            for (line_num, line) in content.lines().enumerate() {
                if let Ok(log_entry) = serde_json::from_str::<RawLogEntry>(line) {
                    // Filter by message type
                    if let Some(ref msg_type_filter) = filters.message_type {
                        if msg_type_filter != "all" && log_entry.message_type != *msg_type_filter {
                            continue;
                        }
                    }

                    if log_entry.message_type == "user" || log_entry.message_type == "assistant" {
                        if let Some(message_content) = &log_entry.message {
                            // Filter by date range
                            if let (Some((start, end)), Some(ref timestamp)) =
                                (date_range, &log_entry.timestamp)
                            {
                                if let Ok(msg_time) = DateTime::parse_from_rfc3339(timestamp) {
                                    if msg_time < start || msg_time > end {
                                        continue;
                                    }
                                } else {
                                    continue;
                                }
                            }

                            // Filter by tool calls
                            if let Some(has_tool_calls_filter) = filters.has_tool_calls {
                                let has_tool_calls = log_entry.tool_use.is_some()
                                    || log_entry.tool_use_result.is_some()
                                    || (if let serde_json::Value::Array(arr) =
                                        &message_content.content
                                    {
                                        arr.iter().any(|item| {
                                            item.get("type").and_then(|v| v.as_str())
                                                == Some("tool_use")
                                        })
                                    } else {
                                        false
                                    });

                                if has_tool_calls != has_tool_calls_filter {
                                    continue;
                                }
                            }

                            // Filter by errors
                            if let Some(has_errors_filter) = filters.has_errors {
                                let has_errors = if let Some(ref result) = log_entry.tool_use_result
                                {
                                    result
                                        .get("stderr")
                                        .and_then(|s| s.as_str())
                                        .map(|s| !s.is_empty())
                                        .unwrap_or(false)
                                        || result
                                            .get("is_error")
                                            .and_then(|e| e.as_bool())
                                            .unwrap_or(false)
                                } else {
                                    false
                                };

                                if has_errors != has_errors_filter {
                                    continue;
                                }
                            }

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
                                let subtype = log_entry.subtype.clone();
                                let system_metadata = build_system_metadata(&log_entry);
                                let claude_message = ClaudeMessage {
                                    uuid: log_entry.uuid.unwrap_or_else(|| {
                                        format!(
                                            "{}-line-{}",
                                            Uuid::new_v4().to_string(),
                                            line_num + 1
                                        )
                                    }),
                                    parent_uuid: log_entry.parent_uuid,
                                    session_id: log_entry
                                        .session_id
                                        .unwrap_or_else(|| "unknown-session".to_string()),
                                    timestamp: log_entry
                                        .timestamp
                                        .unwrap_or_else(|| Utc::now().to_rfc3339()),
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
                                    subtype,
                                    system_metadata,
                                };
                                all_messages.push(claude_message);
                            }
                        }
                    }
                }
            }
        }
    }

    // Convert ClaudeMessages to UniversalMessages
    let source_id = claude_path.clone();
    let universal_messages: Vec<UniversalMessage> = all_messages
        .iter()
        .enumerate()
        .map(|(i, msg)| {
            // Use the full project path, not just the last component
            // This ensures the frontend can match it against project.path
            let project_id = msg
                .project_path
                .as_ref()
                .map(|path| path.to_string())
                .unwrap_or_else(|| "unknown".to_string());

            claude_message_to_universal(msg, project_id, source_id.clone(), i as i32)
        })
        .collect();

    Ok(universal_messages)
}

/// Fixes a problematic session by removing interrupted messages
/// Creates a backup first, then removes lines after the last clean assistant message
#[tauri::command]
pub async fn fix_session(session_file_path: String) -> Result<String, String> {
    use std::io::{BufRead, BufReader, Write};
    use std::path::Path;

    let path = Path::new(&session_file_path);

    // Validate file exists
    if !path.exists() {
        return Err(format!("Session file not found: {}", session_file_path));
    }

    // Read all lines and find last clean assistant message
    let file = fs::File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    let lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();

    if lines.is_empty() {
        return Err("Session file is empty".to_string());
    }

    // Find the last clean assistant message (non-sidechain)
    let mut last_clean_line: Option<usize> = None;

    for (index, line) in lines.iter().enumerate() {
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(entry) = serde_json::from_str::<RawLogEntry>(line) {
            // Skip sidechain messages
            if entry.is_sidechain.unwrap_or(false) {
                continue;
            }

            // Check if this is a clean assistant message
            if entry.message_type == "assistant" {
                if let Some(ref msg) = entry.message {
                    if msg.role == "assistant" {
                        // Check content doesn't contain interruption markers
                        let content_str = serde_json::to_string(&msg.content).unwrap_or_default();
                        if !content_str.contains("[Request interrupted")
                            && !content_str.contains("is_error\":true") {
                            last_clean_line = Some(index);
                        }
                    }
                }
            }
        }
    }

    let last_clean_line = match last_clean_line {
        Some(line) => line,
        None => return Err("No clean assistant message found in session".to_string()),
    };

    // Create backup with .backup extension
    let backup_path = format!("{}.backup", session_file_path);
    fs::copy(&session_file_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    // Write only up to last clean line
    let mut output_file = fs::File::create(&session_file_path)
        .map_err(|e| format!("Failed to create output file: {}", e))?;

    for (index, line) in lines.iter().enumerate() {
        if index <= last_clean_line {
            writeln!(output_file, "{}", line)
                .map_err(|e| format!("Failed to write line: {}", e))?;
        } else {
            break;
        }
    }

    let removed_count = lines.len() - last_clean_line - 1;
    Ok(format!(
        "Session fixed successfully. Removed {} problematic message(s). Backup saved to: {}",
        removed_count,
        backup_path
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "windows")]
    fn test_normalize_windows_path_with_extended_length_prefix() {
        // Test stripping \\?\ prefix
        let input = r"\\?\C:\Users\xxx\.claude\projects\my-project";
        let expected = r"C:\Users\xxx\.claude\projects\my-project";
        assert_eq!(normalize_windows_path(input), expected);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_normalize_windows_path_without_prefix() {
        // Test path without prefix (should return as-is)
        let input = r"C:\Users\xxx\.claude\projects\my-project";
        let expected = r"C:\Users\xxx\.claude\projects\my-project";
        assert_eq!(normalize_windows_path(input), expected);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_normalize_windows_path_unc_path() {
        // Test UNC path (network path, should return as-is)
        let input = r"\\server\share\folder";
        let expected = r"\\server\share\folder";
        assert_eq!(normalize_windows_path(input), expected);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_normalize_windows_path_extended_unc() {
        // Test extended UNC path (\\?\UNC\server\share → \\server\share)
        let input = r"\\?\UNC\server\share\folder";
        let expected = r"\\server\share\folder";
        assert_eq!(normalize_windows_path(input), expected);
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_normalize_windows_path_empty() {
        // Test empty string
        let input = "";
        let expected = "";
        assert_eq!(normalize_windows_path(input), expected);
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_normalize_windows_path_unix_no_op() {
        // On Unix systems, function should be a no-op
        let input = "/home/user/.claude/projects/my-project";
        let expected = "/home/user/.claude/projects/my-project";
        assert_eq!(normalize_windows_path(input), expected);
    }

    #[test]
    #[cfg(not(target_os = "windows"))]
    fn test_normalize_windows_path_unix_preserves_weird_paths() {
        // Even if Unix path has Windows-like prefix, it should be preserved
        // (unlikely but theoretically possible as a valid Unix filename)
        let input = r"/tmp/\\?\weird_filename";
        let expected = r"/tmp/\\?\weird_filename";
        assert_eq!(normalize_windows_path(input), expected);
    }
}
