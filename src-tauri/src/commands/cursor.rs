// ============================================================================
// CURSOR IDE SUPPORT (v2.0.0)
// ============================================================================
// Tauri commands for reading Cursor IDE conversation history from SQLite databases

use crate::models::universal::*;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use walkdir::WalkDir;
use chrono::{DateTime, Utc};

// ============================================================================
// CURSOR-SPECIFIC TYPES
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CursorWorkspace {
    pub id: String,
    pub path: String,
    pub project_name: String,
    pub project_root: String,
    pub state_db_path: String,
    pub session_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CursorSession {
    pub id: String,
    pub workspace_id: String,
    pub project_name: String,
    pub db_path: String,
    pub message_count: usize,
    pub last_modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CursorBubble {
    #[serde(rename = "type")]
    bubble_type: i32, // 1 = user, other = assistant
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct HistoryEntry {
    editor: Option<EditorInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EditorInfo {
    resource: Option<String>,
}

// ============================================================================
// CURSOR PATH DETECTION
// ============================================================================

#[tauri::command]
pub async fn get_cursor_path() -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("HOME_DIRECTORY_NOT_FOUND:Could not determine home directory")?;

    // Try platform-specific paths
    #[cfg(target_os = "windows")]
    let cursor_path = home_dir.join("AppData").join("Roaming").join("Cursor");

    #[cfg(target_os = "macos")]
    let cursor_path = home_dir.join("Library").join("Application Support").join("Cursor");

    #[cfg(target_os = "linux")]
    let cursor_path = home_dir.join(".config").join("Cursor");

    if !cursor_path.exists() {
        return Err(format!(
            "CURSOR_FOLDER_NOT_FOUND:Cursor folder not found at {}",
            cursor_path.display()
        ));
    }

    Ok(cursor_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn validate_cursor_folder(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    // Check for User/workspaceStorage directory
    let workspace_storage = path_buf.join("User").join("workspaceStorage");
    if workspace_storage.exists() && workspace_storage.is_dir() {
        return Ok(true);
    }

    // Also accept if it's directly the Cursor folder
    if path_buf.file_name().and_then(|n| n.to_str()) == Some("Cursor") {
        let user_dir = path_buf.join("User");
        return Ok(user_dir.exists() && user_dir.is_dir());
    }

    Ok(false)
}

// ============================================================================
// WORKSPACE SCANNING
// ============================================================================

#[tauri::command]
pub async fn scan_cursor_workspaces(cursor_path: String) -> Result<Vec<CursorWorkspace>, String> {
    let cursor_base = PathBuf::from(&cursor_path);
    let workspace_storage = cursor_base.join("User").join("workspaceStorage");

    if !workspace_storage.exists() {
        return Ok(vec![]);
    }

    let mut workspaces = Vec::new();

    // Find all session databases first (shared across workspaces)
    let session_dbs = find_cursor_session_dbs(&cursor_base);

    // Scan each workspace directory
    for entry in WalkDir::new(&workspace_storage)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        let workspace_id = entry.file_name().to_string_lossy().to_string();
        let state_db = entry.path().join("state.vscdb");

        if !state_db.exists() {
            continue;
        }

        // Extract project info from workspace DB
        let project_info = extract_project_info(&state_db).unwrap_or_else(|_| ProjectInfo {
            name: "Unknown Project".to_string(),
            root_path: "/".to_string(),
        });

        workspaces.push(CursorWorkspace {
            id: workspace_id.clone(),
            path: entry.path().to_string_lossy().to_string(),
            project_name: project_info.name,
            project_root: project_info.root_path,
            state_db_path: state_db.to_string_lossy().to_string(),
            session_count: session_dbs.len(),
        });
    }

    Ok(workspaces)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

#[tauri::command]
pub async fn load_cursor_sessions(cursor_path: String, workspace_id: Option<String>) -> Result<Vec<CursorSession>, String> {
    println!("🔍 [Rust] load_cursor_sessions called:");
    println!("  cursor_path: {}", cursor_path);
    println!("  workspace_id: {:?}", workspace_id);

    let cursor_base = PathBuf::from(&cursor_path);
    let session_dbs = find_cursor_session_dbs(&cursor_base);

    println!("  📊 Found {} session database(s)", session_dbs.len());
    for (i, db) in session_dbs.iter().enumerate() {
        println!("    [{}] {}", i, db.display());
    }

    let mut sessions = Vec::new();

    for session_db in session_dbs {
        // Get file modification time
        let last_modified = if let Ok(metadata) = session_db.metadata() {
            if let Ok(modified) = metadata.modified() {
                let dt: DateTime<Utc> = modified.into();
                dt.to_rfc3339()
            } else {
                Utc::now().to_rfc3339()
            }
        } else {
            Utc::now().to_rfc3339()
        };

        // Count messages in this session
        let message_count = count_cursor_messages(&session_db).unwrap_or(0);

        if message_count == 0 {
            continue; // Skip empty sessions
        }

        let session_id = session_db
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        sessions.push(CursorSession {
            id: session_id.clone(),
            workspace_id: workspace_id.clone().unwrap_or_else(|| "unknown".to_string()),
            project_name: "Cursor Chat".to_string(), // Will be enriched later
            db_path: session_db.to_string_lossy().to_string(),
            message_count,
            last_modified,
        });
    }

    // Sort by last modified (newest first)
    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(sessions)
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

#[tauri::command]
pub async fn load_cursor_messages(session_db_path: String) -> Result<Vec<UniversalMessage>, String> {
    let db_path = PathBuf::from(&session_db_path);

    if !db_path.exists() {
        return Err(format!("Session database not found: {}", session_db_path));
    }

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn.prepare("SELECT rowid, key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut messages = Vec::new();
    let rows = stmt.query_map(params![], |row| {
        Ok((
            row.get::<_, i64>(0)?, // rowid
            row.get::<_, String>(1)?, // key
            row.get::<_, String>(2)?, // value
        ))
    }).map_err(|e| format!("Failed to query messages: {}", e))?;

    for (sequence_number, row_result) in rows.enumerate() {
        let (rowid, key, value_str) = row_result.map_err(|e| format!("Row error: {}", e))?;

        // Parse bubble JSON
        let bubble: CursorBubble = serde_json::from_str(&value_str)
            .map_err(|e| format!("Failed to parse bubble JSON: {}", e))?;

        if bubble.text.trim().is_empty() {
            continue;
        }

        // Determine role
        let role = if bubble.bubble_type == 1 {
            MessageRole::User
        } else {
            MessageRole::Assistant
        };

        // Create universal message
        let message = UniversalMessage {
            // CORE IDENTITY
            id: key.clone(), // Use bubbleId as message ID
            session_id: session_db_path.clone(),
            project_id: "".to_string(), // Will be filled by caller
            source_id: "".to_string(), // Will be filled by caller
            provider_id: "cursor".to_string(),

            // TEMPORAL
            timestamp: Utc::now().to_rfc3339(), // Cursor doesn't store timestamps per message
            sequence_number: sequence_number as i32,

            // ROLE & TYPE
            role,
            message_type: MessageType::Message,

            // CONTENT
            content: vec![UniversalContent {
                content_type: ContentType::Text,
                data: serde_json::json!({
                    "text": bubble.text
                }),
                encoding: None,
                mime_type: Some("text/plain".to_string()),
                size: Some(bubble.text.len()),
                hash: None,
            }],

            // HIERARCHY
            parent_id: None,
            depth: None,
            branch_id: None,

            // METADATA
            model: None,
            tokens: None,
            tool_calls: None,
            thinking: None,
            attachments: None,
            errors: None,

            // RAW PRESERVATION
            original_format: "cursor-sqlite".to_string(),
            provider_metadata: {
                let mut map = HashMap::new();
                map.insert("rowid".to_string(), serde_json::json!(rowid));
                map.insert("bubble_type".to_string(), serde_json::json!(bubble.bubble_type));
                map
            },
        };

        messages.push(message);
    }

    Ok(messages)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

struct ProjectInfo {
    name: String,
    root_path: String,
}

fn find_cursor_session_dbs(cursor_base: &PathBuf) -> Vec<PathBuf> {
    let mut session_dbs = Vec::new();

    println!("🔍 [Rust] Searching for session databases:");

    // NEW APPROACH: Cursor stores chat data in workspace state.vscdb files
    // Each workspace has its own state.vscdb that contains the chat history
    let workspace_storage = cursor_base.join("User").join("workspaceStorage");

    println!("  📂 Checking workspaceStorage: {}", workspace_storage.display());
    if !workspace_storage.exists() {
        println!("    ✗ workspaceStorage doesn't exist");
        return session_dbs;
    }

    println!("    ✓ workspaceStorage exists, scanning for state.vscdb files...");

    // Scan each workspace directory for state.vscdb
    for entry in WalkDir::new(&workspace_storage)
        .min_depth(2)
        .max_depth(2)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let path = entry.path();
        if path.file_name() == Some(std::ffi::OsStr::new("state.vscdb")) {
            println!("    📄 Checking: {}", path.display());

            // Check if this database contains chat data by looking for cursorDiskKV table
            if let Ok(conn) = Connection::open(&path) {
                // List all tables to debug
                if let Ok(mut stmt) = conn.prepare("SELECT name FROM sqlite_master WHERE type='table'") {
                    print!("      Tables: ");
                    if let Ok(tables) = stmt.query_map(params![], |row| row.get::<_, String>(0)) {
                        let table_names: Vec<String> = tables.filter_map(|r| r.ok()).collect();
                        println!("{}", table_names.join(", "));

                        // Check for cursorDiskKV table
                        if table_names.contains(&"cursorDiskKV".to_string()) {
                            // Try to query for bubble data
                            let has_chat_data = conn
                                .prepare("SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
                                .and_then(|mut stmt| stmt.query_row(params![], |row| row.get::<_, i64>(0)))
                                .unwrap_or(0);

                            println!("      cursorDiskKV found! Bubble count: {}", has_chat_data);

                            // DEBUG: Show what keys DO exist (first 5)
                            if has_chat_data == 0 {
                                if let Ok(mut stmt) = conn.prepare("SELECT key FROM cursorDiskKV LIMIT 5") {
                                    if let Ok(keys) = stmt.query_map(params![], |row| row.get::<_, String>(0)) {
                                        let sample_keys: Vec<String> = keys.filter_map(|r| r.ok()).collect();
                                        if !sample_keys.is_empty() {
                                            println!("      Sample keys: {}", sample_keys.join(", "));
                                        } else {
                                            println!("      ✗ Table is empty");
                                        }
                                    }
                                }
                            }

                            if has_chat_data > 0 {
                                println!("      ✓ Has chat messages!");
                                session_dbs.push(path.to_path_buf());
                            } else {
                                println!("      ✗ No bubble messages with pattern 'bubbleId:%'");
                            }
                        } else {
                            println!("      ✗ No cursorDiskKV table");
                        }
                    }
                } else {
                    println!("      ✗ Failed to query tables");
                }
            } else {
                println!("      ✗ Failed to open database");
            }
        }
    }

    println!("  📊 Total workspace databases with chat data: {}", session_dbs.len());
    session_dbs
}

fn extract_project_info(state_db: &PathBuf) -> Result<ProjectInfo, String> {
    let conn = Connection::open(state_db)
        .map_err(|e| format!("Failed to open workspace DB: {}", e))?;

    // Query ItemTable for history.entries
    let mut stmt = conn.prepare("SELECT value FROM ItemTable WHERE key = 'history.entries'")
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let value_str: String = stmt.query_row(params![], |row| row.get(0))
        .map_err(|e| format!("Failed to get history.entries: {}", e))?;

    // Parse JSON
    let entries: Vec<HistoryEntry> = serde_json::from_str(&value_str)
        .map_err(|e| format!("Failed to parse history entries: {}", e))?;

    // Extract file paths
    let mut file_paths = Vec::new();
    for entry in entries {
        if let Some(editor) = entry.editor {
            if let Some(resource) = editor.resource {
                if resource.starts_with("file:///") {
                    let file_path = resource.strip_prefix("file://").unwrap_or(&resource);
                    file_paths.push(file_path.to_string());
                }
            }
        }
    }

    if file_paths.is_empty() {
        return Ok(ProjectInfo {
            name: "Unknown Project".to_string(),
            root_path: "/".to_string(),
        });
    }

    // Find common prefix
    let common_prefix = find_common_prefix(&file_paths);
    let root_path = common_prefix.trim_end_matches('/').to_string();
    let project_name = root_path.split('/').last().unwrap_or("Unknown").to_string();

    Ok(ProjectInfo {
        name: project_name,
        root_path,
    })
}

fn find_common_prefix(paths: &[String]) -> String {
    if paths.is_empty() {
        return String::new();
    }

    if paths.len() == 1 {
        let path = &paths[0];
        return path[..path.rfind('/').unwrap_or(0)].to_string();
    }

    // Find common prefix character by character
    let first = &paths[0];
    let mut prefix_len = 0;

    'outer: for (i, ch) in first.chars().enumerate() {
        for path in &paths[1..] {
            if let Some(path_ch) = path.chars().nth(i) {
                if path_ch != ch {
                    break 'outer;
                }
            } else {
                break 'outer;
            }
        }
        prefix_len = i + 1;
    }

    let prefix = &first[..prefix_len];

    // Trim to last slash
    if let Some(last_slash) = prefix.rfind('/') {
        prefix[..last_slash].to_string()
    } else {
        String::new()
    }
}

fn count_cursor_messages(session_db: &PathBuf) -> Result<usize, String> {
    let conn = Connection::open(session_db)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let mut stmt = conn.prepare("SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
        .map_err(|e| format!("Failed to prepare count query: {}", e))?;

    let count: i64 = stmt.query_row(params![], |row| row.get(0))
        .map_err(|e| format!("Failed to count messages: {}", e))?;

    Ok(count as usize)
}
