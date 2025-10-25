// ============================================================================
// FILE ACTIVITY EXTRACTION
// ============================================================================
// Extracts file operations from conversation history across all providers
// Supports: Claude Code, Cursor IDE, and future providers via UniversalMessage

use crate::models::*;
use crate::models::universal::*;
use crate::commands::session::load_project_sessions;
use crate::commands::project::scan_projects;
use crate::commands::adapters::claude_code::{claude_message_to_universal, extract_project_id};
use crate::commands::cursor::{load_cursor_messages, load_cursor_sessions};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use std::path::Path;

/// Extract file activities from a single project or all projects
/// If project_path is empty or "*", loads from all available projects
#[tauri::command]
pub async fn get_file_activities(
    project_path: String,
    source_path: Option<String>,
    filters: FileActivityFilters,
) -> Result<Vec<FileActivity>, String> {
    // Enforce absolute paths if provided
    if !project_path.is_empty() && project_path != "*" && !std::path::Path::new(&project_path).is_absolute() {
        return Err("FILES_INVALID_ARGUMENT: project_path must be absolute".to_string());
    }
    if let Some(ref sp) = source_path {
        if !std::path::Path::new(sp).is_absolute() {
            return Err("FILES_INVALID_ARGUMENT: source_path must be absolute".to_string());
        }
    }

    let mut activities = Vec::new();

    // Determine if we should load all projects or just one
    let is_all_projects = project_path.is_empty() || project_path == "*";

    if is_all_projects {
        // Load from ALL projects across all sources
        // Use provided source_path or extract from project_path
        let claude_path = source_path.ok_or_else(|| {
            "FILES_INVALID_ARGUMENT: Source path required for loading all projects".to_string()
        })?;
        let projects = scan_projects(claude_path).await?;

        for project in projects {
            let sessions = load_project_sessions(project.path.clone(), Some(true)).await?;

            for session in sessions {
                let messages = load_session_messages_for_files(&session.file_path).await?;

                for msg in messages {
                    if let Some(tool_calls) = &msg.tool_calls {
                        for tool_call in tool_calls {
                            if let Some(activity) = extract_file_activity_from_tool(
                                &tool_call,
                                &msg,
                                &session.project_name,
                            ) {
                                if should_include_activity(&activity, &filters) {
                                    activities.push(activity);
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        // Load from a specific project
        // Detect if this is a Cursor workspace by checking path components
        // More robust than string.contains() - checks actual path components
        let path = Path::new(&project_path);
        let components: Vec<_> = path.components()
            .filter_map(|c| c.as_os_str().to_str())
            .collect();

        let has_cursor = components.iter().any(|c| c.eq_ignore_ascii_case("cursor"));
        let has_workspace_storage = components.iter().any(|c| c.eq_ignore_ascii_case("workspaceStorage"));
        let is_cursor_workspace = has_cursor && has_workspace_storage;

        if is_cursor_workspace {
            // Extract Cursor base path from workspace path
            // Format: C:\Users\xxx\AppData\Roaming\Cursor\User\workspaceStorage\{workspace-id}
            let cursor_base = path.parent()  // workspaceStorage
                .and_then(|p| p.parent())    // User
                .and_then(|p| p.parent())    // Cursor
                .ok_or_else(|| "FILES_CURSOR_INVALID_WORKSPACE_PATH: Invalid Cursor workspace path".to_string())?;

            println!("📂 Loading Cursor files from workspace: {}", project_path);

            // Load Cursor sessions for this workspace
            let sessions = load_cursor_sessions(
                cursor_base.to_string_lossy().to_string(),
                Some(project_path.clone())
            ).await?;

            println!("  Found {} Cursor sessions", sessions.len());

            for session in sessions {
                println!("  Loading messages for session: {}", session.id);

                // Build session DB path: {db_path}#session={id}#timestamp={last_modified}
                let session_db_path = format!(
                    "{}#session={}#timestamp={}",
                    session.db_path,
                    session.id,
                    session.last_modified
                );

                // Load messages with tool_calls populated
                let messages = load_cursor_messages(
                    cursor_base.to_string_lossy().to_string(),
                    session_db_path
                ).await?;

                println!("    Loaded {} messages", messages.len());

                let mut session_files = 0;
                for msg in messages {
                    if let Some(tool_calls) = &msg.tool_calls {
                        for tool_call in tool_calls {
                            if let Some(activity) = extract_file_activity_from_tool(
                                &tool_call,
                                &msg,
                                &session.project_name,
                            ) {
                                if should_include_activity(&activity, &filters) {
                                    activities.push(activity);
                                    session_files += 1;
                                }
                            }
                        }
                    }
                }

                println!("    Extracted {} file activities", session_files);
            }
        } else {
            // Claude Code project
            let sessions = load_project_sessions(project_path.clone(), Some(true)).await?;

            for session in sessions {
                let messages = load_session_messages_for_files(&session.file_path).await?;

                for msg in messages {
                    if let Some(tool_calls) = &msg.tool_calls {
                        for tool_call in tool_calls {
                            if let Some(activity) = extract_file_activity_from_tool(
                                &tool_call,
                                &msg,
                                &session.project_name,
                            ) {
                                if should_include_activity(&activity, &filters) {
                                    activities.push(activity);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp (newest first)
    activities.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(activities)
}

/// Load messages from a session file (lightweight version for file extraction)
async fn load_session_messages_for_files(
    session_path: &str,
) -> Result<Vec<UniversalMessage>, String> {
    use std::io::{BufRead, BufReader};
    use std::fs::File;

    // Clone path for move into spawn_blocking
    let session_path = session_path.to_string();

    // Wrap blocking I/O in spawn_blocking to avoid blocking the async runtime
    let messages = tokio::task::spawn_blocking(move || -> Result<Vec<UniversalMessage>, String> {
        let file = File::open(&session_path)
            .map_err(|e| format!("Failed to open session file: {}", e))?;
        let reader = BufReader::new(file);

        let mut messages = Vec::new();

        for (line_num, line_result) in reader.lines().enumerate() {
            let line = line_result.map_err(|e| format!("Failed to read line: {}", e))?;

        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<RawLogEntry>(&line) {
            Ok(log_entry) => {
                if log_entry.message_type == "summary" {
                    continue;
                }

                let (role, message_id, model, stop_reason, usage) = if let Some(ref msg) =
                    log_entry.message
                {
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
                    uuid: log_entry
                        .uuid
                        .unwrap_or_else(|| format!("{}-line-{}", Uuid::new_v4(), line_num + 1)),
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
                };

                let project_id = extract_project_id(&None, &session_path);
                let source_id = session_path.clone();

                let universal_msg =
                    claude_message_to_universal(&claude_message, project_id, source_id, 0);

                messages.push(universal_msg);
            }
            Err(e) => {
                eprintln!(
                    "Failed to parse line {} in {}: {}",
                    line_num + 1,
                    session_path,
                    e
                );
            }
        }
    }

        Ok(messages)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(messages)
}

/// Extract file activity from a tool call
fn extract_file_activity_from_tool(
    tool_call: &ToolCall,
    message: &UniversalMessage,
    project_name: &str,
) -> Option<FileActivity> {
    let tool_name = tool_call.name.as_str();

    match tool_name {
        "Read" => extract_read_activity(tool_call, message, project_name),
        "Write" => extract_write_activity(tool_call, message, project_name),
        "Edit" => extract_edit_activity(tool_call, message, project_name),
        "Glob" => extract_glob_activity(tool_call, message, project_name),
        "MultiEdit" => extract_multiedit_activity(tool_call, message, project_name),
        _ => None,
    }
}

/// Extract Read tool activity
fn extract_read_activity(
    tool_call: &ToolCall,
    message: &UniversalMessage,
    project_name: &str,
) -> Option<FileActivity> {
    let file_path = tool_call.input.get("file_path")?.as_str()?.to_string();

    // Try to get content from tool output
    let content = if let Some(ref output) = tool_call.output {
        output.get("file")
            .and_then(|f| f.get("content"))
            .and_then(|c| c.as_str())
            .map(String::from)
    } else {
        None
    };

    let size = content.as_ref().map(|c| c.len());

    Some(FileActivity {
        file_path,
        operation: FileOperation::Read,
        timestamp: message.timestamp.clone(),
        session_id: message.session_id.clone(),
        project_id: project_name.to_string(),
        message_id: message.id.clone(),
        tool_name: "Read".to_string(),
        content_before: None,
        content_after: content,
        size_before: None,
        size_after: size,
        changes: None,
        lines_added: None,
        lines_removed: None,
    })
}

/// Extract Write tool activity
fn extract_write_activity(
    tool_call: &ToolCall,
    message: &UniversalMessage,
    project_name: &str,
) -> Option<FileActivity> {
    let file_path = tool_call.input.get("file_path")?.as_str()?.to_string();
    let content = tool_call.input.get("content")?.as_str().map(String::from);

    let size = content.as_ref().map(|c| c.len());

    Some(FileActivity {
        file_path,
        operation: FileOperation::Write,
        timestamp: message.timestamp.clone(),
        session_id: message.session_id.clone(),
        project_id: project_name.to_string(),
        message_id: message.id.clone(),
        tool_name: "Write".to_string(),
        content_before: None,
        content_after: content,
        size_before: None,
        size_after: size,
        changes: None,
        lines_added: None,
        lines_removed: None,
    })
}

/// Extract Edit tool activity
fn extract_edit_activity(
    tool_call: &ToolCall,
    message: &UniversalMessage,
    project_name: &str,
) -> Option<FileActivity> {
    let file_path = tool_call.input.get("file_path")?.as_str()?.to_string();
    let old_string = tool_call.input.get("old_string")?.as_str()?.to_string();
    let new_string = tool_call.input.get("new_string")?.as_str()?.to_string();

    // Try to get original file content from output
    let content_before = if let Some(ref output) = tool_call.output {
        output.get("originalFile")
            .and_then(|f| f.as_str())
            .map(String::from)
    } else {
        None
    };

    // Calculate line changes
    let old_lines = old_string.lines().count();
    let new_lines = new_string.lines().count();
    let (lines_added, lines_removed) = if new_lines > old_lines {
        (Some(new_lines - old_lines), None)
    } else if old_lines > new_lines {
        (None, Some(old_lines - new_lines))
    } else {
        (None, None)
    };

    let changes = vec![FileChange {
        old_string,
        new_string,
        line_start: None,
        line_end: None,
    }];

    Some(FileActivity {
        file_path,
        operation: FileOperation::Edit,
        timestamp: message.timestamp.clone(),
        session_id: message.session_id.clone(),
        project_id: project_name.to_string(),
        message_id: message.id.clone(),
        tool_name: "Edit".to_string(),
        content_before,
        content_after: None,
        size_before: None,
        size_after: None,
        changes: Some(changes),
        lines_added,
        lines_removed,
    })
}

/// Extract Glob tool activity (returns multiple file activities)
fn extract_glob_activity(
    tool_call: &ToolCall,
    message: &UniversalMessage,
    project_name: &str,
) -> Option<FileActivity> {
    // Glob returns multiple files, we'll create a single activity representing the search
    let pattern = tool_call.input.get("pattern")?.as_str()?.to_string();

    // Count files from output
    let file_count = if let Some(ref output) = tool_call.output {
        output.get("filenames")
            .and_then(|f| f.as_array())
            .map(|arr| arr.len())
            .unwrap_or(0)
    } else {
        0
    };

    Some(FileActivity {
        file_path: pattern,
        operation: FileOperation::Glob,
        timestamp: message.timestamp.clone(),
        session_id: message.session_id.clone(),
        project_id: project_name.to_string(),
        message_id: message.id.clone(),
        tool_name: "Glob".to_string(),
        content_before: None,
        content_after: Some(format!("Found {} files", file_count)),
        size_before: None,
        size_after: Some(file_count),
        changes: None,
        lines_added: None,
        lines_removed: None,
    })
}

/// Extract MultiEdit tool activity
fn extract_multiedit_activity(
    tool_call: &ToolCall,
    message: &UniversalMessage,
    project_name: &str,
) -> Option<FileActivity> {
    let file_path = tool_call.input.get("file_path")?.as_str()?.to_string();
    let edits = tool_call.input.get("edits")?.as_array()?;

    let mut changes = Vec::new();
    let mut total_lines_added = 0;
    let mut total_lines_removed = 0;

    for edit in edits {
        if let (Some(old_str), Some(new_str)) = (
            edit.get("old_string").and_then(|v| v.as_str()),
            edit.get("new_string").and_then(|v| v.as_str()),
        ) {
            let old_lines = old_str.lines().count();
            let new_lines = new_str.lines().count();

            if new_lines > old_lines {
                total_lines_added += new_lines - old_lines;
            } else if old_lines > new_lines {
                total_lines_removed += old_lines - new_lines;
            }

            changes.push(FileChange {
                old_string: old_str.to_string(),
                new_string: new_str.to_string(),
                line_start: None,
                line_end: None,
            });
        }
    }

    Some(FileActivity {
        file_path,
        operation: FileOperation::MultiEdit,
        timestamp: message.timestamp.clone(),
        session_id: message.session_id.clone(),
        project_id: project_name.to_string(),
        message_id: message.id.clone(),
        tool_name: "MultiEdit".to_string(),
        content_before: None,
        content_after: None,
        size_before: None,
        size_after: None,
        changes: Some(changes),
        lines_added: if total_lines_added > 0 {
            Some(total_lines_added)
        } else {
            None
        },
        lines_removed: if total_lines_removed > 0 {
            Some(total_lines_removed)
        } else {
            None
        },
    })
}

/// Check if activity should be included based on filters
fn should_include_activity(activity: &FileActivity, filters: &FileActivityFilters) -> bool {
    // Filter by date range
    if let Some(ref date_range) = filters.date_range {
        if date_range.len() == 2 {
            if let (Ok(start), Ok(end)) = (
                DateTime::parse_from_rfc3339(&date_range[0]),
                DateTime::parse_from_rfc3339(&date_range[1]),
            ) {
                if let Ok(activity_time) = DateTime::parse_from_rfc3339(&activity.timestamp) {
                    if activity_time < start || activity_time > end {
                        return false;
                    }
                }
            }
        }
    }

    // Filter by operations
    if let Some(ref operations) = filters.operations {
        let op_str = format!("{:?}", activity.operation).to_lowercase();
        if !operations.iter().any(|o| o.to_lowercase() == op_str) {
            return false;
        }
    }

    // Filter by file extensions
    if let Some(ref extensions) = filters.file_extensions {
        let file_ext = activity.file_path
            .split('.')
            .last()
            .unwrap_or("")
            .to_lowercase();
        if !extensions.iter().any(|e| e.to_lowercase() == file_ext) {
            return false;
        }
    }

    // Filter by search query
    if let Some(ref query) = filters.search_query {
        let query_lower = query.to_lowercase();
        if !activity.file_path.to_lowercase().contains(&query_lower) {
            return false;
        }
    }

    // Filter by session ID
    if let Some(ref session_id) = filters.session_id {
        if &activity.session_id != session_id {
            return false;
        }
    }

    // Filter by projects
    if let Some(ref projects) = filters.projects {
        if !projects.is_empty() && !projects.iter().any(|p| p == &activity.project_id) {
            return false;
        }
    }

    true
}
