// ============================================================================
// CURSOR IDE SUPPORT (v2.0.0)
// ============================================================================
// Tauri commands for reading Cursor IDE conversation history from SQLite databases

use crate::models::universal::TokenUsage;
use crate::models::universal::*;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use walkdir::WalkDir;

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
    pub last_activity: Option<String>, // ISO 8601 timestamp of most recent composer
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
    bubble_type: Option<i32>, // 1 = user, 2 = assistant (Some entries might not have this)
    #[serde(default)]
    text: String,

    // Tool and context data
    #[serde(rename = "toolResults", default)]
    tool_results: Vec<serde_json::Value>,

    #[serde(rename = "relevantFiles", default)]
    relevant_files: Vec<serde_json::Value>,

    #[serde(rename = "attachedCodeChunks", default)]
    attached_code_chunks: Vec<serde_json::Value>,

    #[serde(rename = "assistantSuggestedDiffs", default)]
    assistant_suggested_diffs: Vec<serde_json::Value>,

    #[serde(rename = "gitDiffs", default)]
    git_diffs: Vec<serde_json::Value>,

    #[serde(rename = "interpreterResults", default)]
    interpreter_results: Vec<serde_json::Value>,

    #[serde(rename = "consoleLogs", default)]
    console_logs: Vec<serde_json::Value>,

    #[serde(rename = "allThinkingBlocks", default)]
    all_thinking_blocks: Vec<serde_json::Value>,

    #[serde(rename = "tokenCount", default)]
    token_count: Option<TokenCount>,

    #[serde(rename = "attachedFileCodeChunksMetadataOnly", default)]
    attached_file_metadata: Vec<serde_json::Value>,

    // New Cursor format: toolFormerData contains actual file operations
    #[serde(rename = "toolFormerData", default)]
    tool_former_data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TokenCount {
    #[serde(rename = "inputTokens")]
    input_tokens: i32,
    #[serde(rename = "outputTokens")]
    output_tokens: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct HistoryEntry {
    editor: Option<EditorInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
struct EditorInfo {
    resource: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceComposerData {
    #[serde(rename = "allComposers")]
    all_composers: Vec<ComposerMetadata>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ComposerMetadata {
    #[serde(rename = "composerId")]
    composer_id: String,
    #[serde(rename = "lastUpdatedAt")]
    last_updated_at: Option<i64>, // Unix timestamp in milliseconds
    #[serde(rename = "createdAt")]
    created_at: Option<i64>, // Unix timestamp in milliseconds
}

// ============================================================================
// CURSOR PATH DETECTION
// ============================================================================

#[tauri::command]
pub async fn get_cursor_path() -> Result<String, String> {
    let home_dir =
        dirs::home_dir().ok_or("HOME_DIRECTORY_NOT_FOUND:Could not determine home directory")?;

    // Try platform-specific paths
    #[cfg(target_os = "windows")]
    let cursor_path = home_dir.join("AppData").join("Roaming").join("Cursor");

    #[cfg(target_os = "macos")]
    let cursor_path = home_dir
        .join("Library")
        .join("Application Support")
        .join("Cursor");

    #[cfg(target_os = "linux")]
    let cursor_path = home_dir.join(".config").join("Cursor");

    if !cursor_path.exists() {
        return Err(format!(
            "CURSOR_FOLDER_NOT_FOUND: Cursor folder not found at {}",
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
    let _session_dbs = find_cursor_session_dbs(&cursor_base);

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

        // Count actual composers (sessions) that have messages for this workspace
        let (session_count, last_activity) =
            count_workspace_composers_with_messages(&cursor_base, &state_db).unwrap_or((0, None));

        #[cfg(debug_assertions)]
        println!(
            "  📊 Workspace {}: {} sessions with messages (last: {:?})",
            workspace_id,
            session_count,
            last_activity.as_ref().map(|s| &s[..19])
        );

        workspaces.push(CursorWorkspace {
            id: workspace_id.clone(),
            path: entry.path().to_string_lossy().to_string(),
            project_name: project_info.name,
            project_root: project_info.root_path,
            state_db_path: state_db.to_string_lossy().to_string(),
            session_count,
            last_activity,
        });
    }

    Ok(workspaces)
}

/// Count the number of composers (sessions) in a workspace that actually have messages
/// Returns (count, most_recent_timestamp)
fn count_workspace_composers_with_messages(
    cursor_base: &PathBuf,
    state_db: &PathBuf,
) -> Result<(usize, Option<String>), String> {
    // Open workspace database
    let conn = Connection::open(state_db)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open workspace DB: {}", e))?;

    // Try to read composer.composerData
    let composer_data_json: Result<String, _> = conn.query_row(
        "SELECT value FROM ItemTable WHERE key = 'composer.composerData'",
        params![],
        |row| row.get(0),
    );

    let composers: Vec<ComposerMetadata> = match composer_data_json {
        Ok(json_str) => {
            // Parse composers
            let workspace_composer_data: WorkspaceComposerData = serde_json::from_str(&json_str)
                .map_err(|e| format!("CURSOR_PARSE_ERROR: Failed to parse composer data: {}", e))?;

            workspace_composer_data.all_composers
        }
        Err(_) => {
            // No composer data found = 0 sessions
            return Ok((0, None));
        }
    };

    if composers.is_empty() {
        return Ok((0, None));
    }

    // Find global database
    let session_dbs = find_cursor_session_dbs(cursor_base);
    if session_dbs.is_empty() {
        return Ok((0, None));
    }

    // Open global database and check which composers have messages
    let global_db = &session_dbs[0];
    let global_conn = Connection::open(global_db)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open global DB: {}", e))?;

    // Build a query to check which session IDs have messages and track most recent
    let mut count = 0;
    let mut most_recent_timestamp: Option<i64> = None;

    for composer in composers {
        let has_messages: Result<i64, _> = global_conn.query_row(
            "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE ?",
            params![format!("bubbleId:{}:%", composer.composer_id)],
            |row| row.get(0),
        );

        if let Ok(message_count) = has_messages {
            if message_count > 0 {
                count += 1;

                // Track most recent timestamp
                if let Some(timestamp) = composer.last_updated_at {
                    most_recent_timestamp = match most_recent_timestamp {
                        Some(current) => Some(current.max(timestamp)),
                        None => Some(timestamp),
                    };
                }
            }
        }
    }

    // Convert timestamp to ISO 8601 string
    let last_activity = most_recent_timestamp.map(|ts| {
        // Convert milliseconds to seconds for chrono
        chrono::DateTime::<Utc>::from_timestamp(ts / 1000, ((ts % 1000) * 1_000_000) as u32)
            .unwrap_or_else(|| chrono::DateTime::<Utc>::from_timestamp(0, 0).unwrap())
            .to_rfc3339()
    });

    Ok((count, last_activity))
}

// ============================================================================
// SESSION LOADING
// ============================================================================

#[tauri::command]
pub async fn load_cursor_sessions(
    cursor_path: String,
    workspace_id: Option<String>,
) -> Result<Vec<CursorSession>, String> {
    println!("🔍 [Rust] load_cursor_sessions called:");
    println!("  cursor_path: {}", cursor_path);
    println!("  workspace_id: {:?}", workspace_id);

    let cursor_base = PathBuf::from(&cursor_path);

    // Get workspace storage path to read composer metadata
    let workspace_storage_path = if let Some(ref ws_id) = workspace_id {
        cursor_base
            .join("User")
            .join("workspaceStorage")
            .join(ws_id)
            .join("state.vscdb")
    } else {
        return Err("CURSOR_INVALID_ARGUMENT: workspace_id is required".to_string());
    };

    println!(
        "  📂 Reading workspace storage: {}",
        workspace_storage_path.display()
    );

    if !workspace_storage_path.exists() {
        println!("  ✗ Workspace storage not found");
        return Ok(vec![]);
    }

    // Open workspace database to get session list
    let workspace_conn = Connection::open(&workspace_storage_path)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open workspace database: {}", e))?;

    // Try to read composer.composerData from ItemTable (optional)
    let composer_data_json: Option<String> = workspace_conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'composer.composerData'",
            params![],
            |row| row.get(0),
        )
        .ok();

    let workspace_composers: Vec<ComposerMetadata> = if let Some(json_str) = composer_data_json {
        println!("  📋 Parsing composer data ({} chars)...", json_str.len());

        let workspace_composer_data: WorkspaceComposerData = serde_json::from_str(&json_str)
            .map_err(|e| {
                format!(
                    "CURSOR_PARSE_ERROR: Failed to parse composer.composerData JSON: {}",
                    e
                )
            })?;

        println!(
            "  ✓ Found {} composers from workspace metadata",
            workspace_composer_data.all_composers.len()
        );
        workspace_composer_data.all_composers
    } else {
        println!("  ⚠️  No workspace metadata found - will discover sessions from global DB");
        vec![]
    };

    let session_dbs = find_cursor_session_dbs(&cursor_base);

    if session_dbs.is_empty() {
        println!("  ✗ No session databases found");
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();

    // Open the global database
    for global_db in session_dbs {
        println!("  📂 Opening global database: {}", global_db.display());

        let conn = Connection::open(&global_db)
            .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open global database: {}", e))?;

        // Create a map of session_id -> message_count from global database
        let mut session_message_counts: HashMap<String, usize> = HashMap::new();

        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT \
                SUBSTR(key, 10, INSTR(SUBSTR(key, 10), ':') - 1) as session_id, \
                COUNT(*) as msg_count \
             FROM cursorDiskKV \
             WHERE key LIKE 'bubbleId:%' \
             GROUP BY session_id",
            )
            .map_err(|e| format!("CURSOR_DB_ERROR: Failed to prepare session query: {}", e))?;

        let session_rows = stmt
            .query_map(params![], |row| {
                Ok((
                    row.get::<_, String>(0)?, // session_id
                    row.get::<_, i64>(1)?,    // message count
                ))
            })
            .map_err(|e| format!("CURSOR_DB_ERROR: Failed to query sessions: {}", e))?;

        for row_result in session_rows {
            let (session_id, message_count) = row_result
                .map_err(|e| format!("CURSOR_DB_ERROR: Failed to read session row: {}", e))?;
            session_message_counts.insert(session_id, message_count as usize);
        }

        println!(
            "  📊 Found {} sessions in global DB:",
            session_message_counts.len()
        );
        for (sid, count) in session_message_counts.iter().take(5) {
            println!("      - {}: {} messages", sid, count);
        }
        if session_message_counts.len() > 5 {
            println!("      ... and {} more", session_message_counts.len() - 5);
        }

        // If we have workspace metadata, process only those sessions
        // Otherwise, process ALL sessions found in global DB
        if !workspace_composers.is_empty() {
            println!(
                "  📋 Processing {} workspace composers:",
                workspace_composers.len()
            );

            for composer in &workspace_composers {
                let session_id = &composer.composer_id;
                let message_count = session_message_counts.get(session_id).copied().unwrap_or(0);

                if message_count == 0 {
                    println!(
                        "    ✗ Session {} has no messages in global DB, skipping",
                        session_id
                    );
                    continue;
                }

                // Use real timestamps from workspace metadata
                let last_modified_timestamp =
                    if let Some(last_updated_ms) = composer.last_updated_at {
                        // Convert milliseconds to seconds
                        let dt = chrono::DateTime::from_timestamp(
                            last_updated_ms / 1000,
                            ((last_updated_ms % 1000) * 1_000_000) as u32,
                        )
                        .unwrap_or_else(|| Utc::now());
                        dt.to_rfc3339()
                    } else if let Some(created_ms) = composer.created_at {
                        let dt = chrono::DateTime::from_timestamp(
                            created_ms / 1000,
                            ((created_ms % 1000) * 1_000_000) as u32,
                        )
                        .unwrap_or_else(|| Utc::now());
                        dt.to_rfc3339()
                    } else {
                        Utc::now().to_rfc3339()
                    };

                println!(
                    "    ✓ Session: {} ({} messages, timestamp={})",
                    session_id, message_count, last_modified_timestamp
                );

                // Encode session ID and timestamp in db_path
                // Format: <db-path>#session=<session-id>#timestamp=<iso-timestamp>
                let db_path_with_session = format!(
                    "{}#session={}#timestamp={}",
                    global_db.to_string_lossy(),
                    session_id,
                    last_modified_timestamp
                );

                sessions.push(CursorSession {
                    id: session_id.clone(),
                    workspace_id: workspace_id
                        .clone()
                        .unwrap_or_else(|| "unknown".to_string()),
                    project_name: "Cursor Chat".to_string(),
                    db_path: db_path_with_session,
                    message_count,
                    last_modified: last_modified_timestamp,
                });
            }
        } else {
            // No workspace metadata - we can't determine which sessions belong to this workspace
            // Return empty list instead of returning ALL sessions (which belong to other workspaces)
            println!(
                "  ⚠️  No workspace metadata found - cannot determine sessions for this workspace"
            );
            println!(
                "  💡 This workspace might not have any Cursor sessions, or metadata is missing"
            );

            // Don't process any sessions - we can't know which ones belong here
            // The commented code below would return ALL global sessions incorrectly:
            /*
            println!("  📋 Processing {} sessions from global DB (no workspace metadata):", session_message_counts.len());

            for (session_id, message_count) in &session_message_counts {
                if *message_count == 0 {
                    continue;
                }

                // Use current time as fallback since we don't have metadata timestamps
                let last_modified_timestamp = Utc::now().to_rfc3339();

                println!("    ✓ Session: {} ({} messages, timestamp={})",
                         session_id,
                         message_count,
                         last_modified_timestamp);

                // Encode session ID and timestamp in db_path
                let db_path_with_session = format!(
                    "{}#session={}#timestamp={}",
                    global_db.to_string_lossy(),
                    session_id,
                    last_modified_timestamp
                );

                sessions.push(CursorSession {
                    id: session_id.clone(),
                    workspace_id: workspace_id.clone().unwrap_or_else(|| "unknown".to_string()),
                    project_name: "Cursor Chat".to_string(),
                    db_path: db_path_with_session,
                    message_count: *message_count,
                    last_modified: last_modified_timestamp,
                });
            }
            */
        }
    }

    println!("  ✅ Total sessions loaded: {}", sessions.len());

    // Sort by last_modified timestamp (newest first)
    // Sessions are already created with rowid-based timestamps, so this will sort correctly
    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(sessions)
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

#[tauri::command]
pub async fn load_cursor_messages(
    cursor_path: String,
    session_db_path: String,
) -> Result<Vec<UniversalMessage>, String> {
    println!("🔍 [Rust] load_cursor_messages called:");
    println!("  cursor_path: {}", cursor_path);
    println!("  session_db_path: {}", session_db_path);

    // Parse session ID and timestamp from db_path
    // Format: <db-path>#session=<session-id>#timestamp=<iso-timestamp>
    let (db_path_str, session_id, session_timestamp) = if let Some(session_pos) =
        session_db_path.find("#session=")
    {
        let db_path = &session_db_path[..session_pos];
        let after_session = &session_db_path[session_pos + 9..]; // Skip "#session="

        // Look for timestamp
        if let Some(timestamp_pos) = after_session.find("#timestamp=") {
            let session_id = &after_session[..timestamp_pos];
            let timestamp_str = &after_session[timestamp_pos + 11..]; // Skip "#timestamp="

            // Parse the ISO timestamp
            let session_time = chrono::DateTime::parse_from_rfc3339(timestamp_str)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            (db_path, session_id.to_string(), session_time)
        } else {
            // No timestamp encoded, use current time as fallback
            (db_path, after_session.to_string(), Utc::now())
        }
    } else {
        return Err("CURSOR_INVALID_ARGUMENT: Session ID not found in db_path. Expected format: <path>#session=<id>#timestamp=<timestamp>".to_string());
    };

    println!("  📂 Database: {}", db_path_str);
    println!("  🆔 Session ID: {}", session_id);
    println!(
        "  ⏰ Session timestamp: {}",
        session_timestamp.format("%Y-%m-%d %H:%M:%S")
    );

    let db_path = PathBuf::from(db_path_str);

    // Validate DB path: must be the Cursor global storage DB
    let allowed_db = PathBuf::from(&cursor_path)
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    let canon_db = db_path
        .canonicalize()
        .map_err(|e| format!("CURSOR_PATH_ERROR: Failed to canonicalize DB path: {}", e))?;
    let canon_allow = allowed_db.canonicalize().map_err(|e| {
        format!(
            "CURSOR_PATH_ERROR: Failed to resolve allowed DB path: {}",
            e
        )
    })?;

    if canon_db != canon_allow {
        return Err(format!(
            "CURSOR_FORBIDDEN_PATH: DB path {} is not within Cursor global storage",
            db_path.display()
        ));
    }

    if !db_path.exists() {
        return Err(format!(
            "CURSOR_DB_NOT_FOUND: Session database not found at {}",
            db_path_str
        ));
    }

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open database: {}", e))?;

    // Filter messages by session ID: bubbleId:<session-id>:<message-id>
    let query_pattern = format!("bubbleId:{}:%", session_id);
    println!("  🔎 Query pattern: {}", query_pattern);

    let mut stmt = conn
        .prepare("SELECT rowid, key, value FROM cursorDiskKV WHERE key LIKE ?1 ORDER BY rowid")
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to prepare query: {}", e))?;

    let mut messages = Vec::new();
    let rows = stmt
        .query_map(params![query_pattern], |row| {
            Ok((
                row.get::<_, i64>(0)?,    // rowid
                row.get::<_, String>(1)?, // key
                row.get::<_, String>(2)?, // value
            ))
        })
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to query messages: {}", e))?;

    // Collect rows first to get min/max rowid for timestamp calculation
    let row_vec: Vec<(i64, String, String)> = rows.filter_map(|r| r.ok()).collect();

    if row_vec.is_empty() {
        println!("  ✗ No messages found for session {}", session_id);
        return Ok(messages);
    }

    let min_rowid = row_vec.first().map(|(rid, _, _)| *rid).unwrap_or(0);
    let max_rowid = row_vec.last().map(|(rid, _, _)| *rid).unwrap_or(0);
    let rowid_range = max_rowid - min_rowid;

    println!(
        "  📨 Processing {} messages (rowid range: {} to {}):",
        row_vec.len(),
        min_rowid,
        max_rowid
    );

    // Calculate message timestamps: spread them backwards from session timestamp
    // Assume messages span a conversation (estimate based on length)
    // For each 10 messages, assume ~5 minutes average
    let estimated_duration_minutes = (row_vec.len() as i64) * 5 / 10;
    let base_time = session_timestamp; // Use session's actual timestamp as end time

    for (sequence_number, (rowid, key, value_str)) in row_vec.iter().enumerate() {
        // Parse bubble JSON
        let bubble: CursorBubble = match serde_json::from_str::<CursorBubble>(&value_str) {
            Ok(b) => b,
            Err(e) => {
                println!("    ⚠️  Skipping entry with key {}: {}", key, e);
                continue;
            }
        };

        // Skip entries without a bubble_type (likely metadata, not messages)
        let bubble_type = match bubble.bubble_type {
            Some(t) => t,
            None => {
                println!("    ⚠️  Skipping entry without type field: {}", key);
                continue;
            }
        };

        // Skip entries with empty text UNLESS they have toolFormerData
        if bubble.text.trim().is_empty() && bubble.tool_former_data.is_none() {
            continue;
        }

        // Determine role
        let role = if bubble_type == 1 {
            MessageRole::User
        } else {
            MessageRole::Assistant
        };

        // Calculate estimated timestamp for this message
        let message_timestamp = if rowid_range > 0 {
            let ratio = (*rowid - min_rowid) as f64 / rowid_range as f64;
            let minutes_offset = (ratio * estimated_duration_minutes as f64) as i64;
            base_time - chrono::Duration::minutes(estimated_duration_minutes - minutes_offset)
        } else {
            base_time
        };

        // Build content array with text + tool results + attachments
        let mut content_items = vec![UniversalContent {
            content_type: ContentType::Text,
            data: serde_json::json!({
                "text": bubble.text
            }),
            encoding: None,
            mime_type: Some("text/plain".to_string()),
            size: Some(bubble.text.len()),
            hash: None,
        }];

        // Add tool results if present
        for tool_result in &bubble.tool_results {
            content_items.push(UniversalContent {
                content_type: ContentType::ToolResult,
                data: tool_result.clone(),
                encoding: None,
                mime_type: Some("application/json".to_string()),
                size: None,
                hash: None,
            });
        }

        // Add console logs if present
        for console_log in &bubble.console_logs {
            content_items.push(UniversalContent {
                content_type: ContentType::Text,
                data: serde_json::json!({
                    "type": "console_log",
                    "content": console_log
                }),
                encoding: None,
                mime_type: Some("text/plain".to_string()),
                size: None,
                hash: None,
            });
        }

        // Extract tool calls from Cursor bubble data
        let tool_calls = convert_cursor_tool_calls(&bubble);

        // Count extracted tool calls for logging
        let extracted_tool_count = tool_calls.as_ref().map(|t| t.len()).unwrap_or(0);
        let has_tool_former = bubble.tool_former_data.is_some();

        println!(
            "    [{}] {:?}: {} chars @ {} (extracted_tools:{} has_toolFormerData:{})",
            sequence_number,
            role,
            bubble.text.len(),
            message_timestamp.format("%H:%M:%S"),
            extracted_tool_count,
            has_tool_former
        );

        // Create universal message
        let message = UniversalMessage {
            // CORE IDENTITY
            id: key.clone(),
            session_id: session_id.clone(),
            project_id: "".to_string(),
            source_id: "".to_string(),
            provider_id: "cursor".to_string(),

            // TEMPORAL
            timestamp: message_timestamp.to_rfc3339(),
            sequence_number: sequence_number as i32,

            // ROLE & TYPE
            role,
            message_type: MessageType::Message,

            // CONTENT
            content: content_items,

            // HIERARCHY
            parent_id: None,
            depth: None,
            branch_id: None,

            // METADATA
            model: None,
            tokens: bubble.token_count.as_ref().map(|tc| TokenUsage {
                input_tokens: tc.input_tokens,
                output_tokens: tc.output_tokens,
                total_tokens: tc.input_tokens + tc.output_tokens,
                cache_creation_tokens: None,
                cache_read_tokens: None,
                service_tier: None,
            }),
            tool_calls,        // Extracted from bubble data (diffs, files, git, etc.)
            thinking: None,    // Will be in provider_metadata
            attachments: None, // Will be in provider_metadata
            errors: None,

            // RAW PRESERVATION
            original_format: "cursor-sqlite".to_string(),
            provider_metadata: {
                let mut map = HashMap::new();
                map.insert("rowid".to_string(), serde_json::json!(rowid));
                map.insert("bubble_type".to_string(), serde_json::json!(bubble_type));
                map.insert(
                    "session_id".to_string(),
                    serde_json::json!(session_id.clone()),
                );

                // Add tool results
                if !bubble.tool_results.is_empty() {
                    map.insert(
                        "tool_results".to_string(),
                        serde_json::json!(bubble.tool_results),
                    );
                }

                // Add thinking blocks
                if !bubble.all_thinking_blocks.is_empty() {
                    map.insert(
                        "thinking_blocks".to_string(),
                        serde_json::json!(bubble.all_thinking_blocks),
                    );
                }

                // Add file attachments
                if !bubble.relevant_files.is_empty() {
                    map.insert(
                        "relevant_files".to_string(),
                        serde_json::json!(bubble.relevant_files),
                    );
                }
                if !bubble.attached_code_chunks.is_empty() {
                    map.insert(
                        "attached_code_chunks".to_string(),
                        serde_json::json!(bubble.attached_code_chunks),
                    );
                }
                if !bubble.attached_file_metadata.is_empty() {
                    map.insert(
                        "attached_file_metadata".to_string(),
                        serde_json::json!(bubble.attached_file_metadata),
                    );
                }

                // Add diffs
                if !bubble.assistant_suggested_diffs.is_empty() {
                    map.insert(
                        "suggested_diffs".to_string(),
                        serde_json::json!(bubble.assistant_suggested_diffs),
                    );
                }
                if !bubble.git_diffs.is_empty() {
                    map.insert("git_diffs".to_string(), serde_json::json!(bubble.git_diffs));
                }

                // Add execution results
                if !bubble.interpreter_results.is_empty() {
                    map.insert(
                        "interpreter_results".to_string(),
                        serde_json::json!(bubble.interpreter_results),
                    );
                }
                if !bubble.console_logs.is_empty() {
                    map.insert(
                        "console_logs".to_string(),
                        serde_json::json!(bubble.console_logs),
                    );
                }

                map
            },
        };

        messages.push(message);
    }

    println!(
        "  ✅ Loaded {} messages for session {}",
        messages.len(),
        session_id
    );

    Ok(messages)
}

// ============================================================================
// SEARCH
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchFilters {
    #[serde(rename = "dateRange")]
    pub date_range: Option<Vec<String>>,
    #[serde(rename = "messageType")]
    pub message_type: Option<String>,
    #[serde(rename = "hasToolCalls")]
    pub has_tool_calls: Option<bool>,
    #[serde(rename = "hasErrors")]
    pub has_errors: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub messages: Vec<UniversalMessage>,
    pub total: usize,
}

#[tauri::command]
pub async fn search_cursor_messages(
    cursor_path: String,
    query: String,
    filters: SearchFilters,
) -> Result<SearchResult, String> {
    let cursor_base = PathBuf::from(&cursor_path);
    let global_db = cursor_base
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    // Store cursor_path for use in message construction
    let cursor_path_str = cursor_path.clone();

    if !global_db.exists() {
        return Err(format!(
            "CURSOR_DB_NOT_FOUND: Cursor global database not found at {}",
            global_db.display()
        ));
    }

    let conn = Connection::open(&global_db)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open global database: {}", e))?;

    // Search pattern: case-insensitive search in bubble text
    let _search_pattern = format!("%{}%", query.to_lowercase());

    // Query all bubbles and filter by text content
    let mut stmt = conn.prepare(
        "SELECT rowid, key, value FROM cursorDiskKV WHERE key LIKE 'bubbleId:%' ORDER BY rowid DESC"
    ).map_err(|e| format!("CURSOR_DB_ERROR: Failed to prepare search query: {}", e))?;

    let rows = stmt
        .query_map(params![], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to execute search: {}", e))?;

    let mut matching_messages = Vec::new();
    let mut sequence = 0;

    for row_result in rows {
        let (rowid, key, value_str) =
            row_result.map_err(|e| format!("CURSOR_DB_ERROR: Row error: {}", e))?;

        // Parse bubble
        let bubble: Result<CursorBubble, _> = serde_json::from_str(&value_str);
        if bubble.is_err() {
            continue;
        }

        let bubble = bubble.unwrap();

        // Skip entries without a bubble_type (likely metadata, not messages)
        let bubble_type = match bubble.bubble_type {
            Some(t) => t,
            None => continue,
        };

        // Check if text matches search query (case-insensitive)
        if !bubble.text.to_lowercase().contains(&query.to_lowercase()) {
            continue;
        }

        // Extract session ID from key (format: bubbleId:<session-id>:<message-id>)
        let parts: Vec<&str> = key.split(':').collect();
        if parts.len() < 2 {
            continue;
        }
        let session_id = parts[1].to_string();

        // Try to extract workspace ID from session ID (it's typically the workspace ID)
        // Construct the workspace storage path
        let workspace_path = cursor_base
            .join("User")
            .join("workspaceStorage")
            .join(&session_id);
        let project_path = workspace_path.to_string_lossy().to_string();

        // Determine role
        let role = if bubble_type == 1 {
            MessageRole::User
        } else {
            MessageRole::Assistant
        };

        // Apply message type filter
        if let Some(ref message_type) = filters.message_type {
            let role_str = match role {
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                _ => "unknown",
            };
            // Filter: if messageType is "all", don't filter; otherwise match the specified type
            if message_type != "all" && message_type != role_str {
                continue;
            }
        }

        // Apply tool calls filter
        if let Some(has_tool_calls) = filters.has_tool_calls {
            let has_tools = !bubble.tool_results.is_empty() || bubble.tool_former_data.is_some();
            if has_tool_calls != has_tools {
                continue;
            }
        }

        // Apply errors filter
        if let Some(has_errors) = filters.has_errors {
            // Check if bubble has errors in console logs or tool results
            let bubble_has_errors = bubble
                .console_logs
                .iter()
                .any(|log| log.to_string().to_lowercase().contains("error"))
                || bubble.tool_results.iter().any(|result| {
                    result
                        .get("is_error")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false)
                });

            if has_errors != bubble_has_errors {
                continue;
            }
        }

        // Estimate timestamp (we don't have exact timestamps, use rowid as proxy)
        let estimated_time = Utc::now() - chrono::Duration::days((rowid / 100) as i64);

        // Apply date range filter
        if let Some(ref date_range) = filters.date_range {
            if date_range.len() >= 2 {
                if let (Ok(start), Ok(end)) = (
                    chrono::DateTime::parse_from_rfc3339(&date_range[0]),
                    chrono::DateTime::parse_from_rfc3339(&date_range[1]),
                ) {
                    if estimated_time < start.with_timezone(&Utc)
                        || estimated_time > end.with_timezone(&Utc)
                    {
                        continue;
                    }
                }
            }
        }

        // Build content
        let mut content_items = vec![UniversalContent {
            content_type: ContentType::Text,
            data: serde_json::json!({
                "text": bubble.text
            }),
            encoding: None,
            mime_type: Some("text/plain".to_string()),
            size: Some(bubble.text.len()),
            hash: None,
        }];

        // Add tool results
        for tool_result in &bubble.tool_results {
            content_items.push(UniversalContent {
                content_type: ContentType::ToolResult,
                data: tool_result.clone(),
                encoding: None,
                mime_type: Some("application/json".to_string()),
                size: None,
                hash: None,
            });
        }

        // Extract tool calls from Cursor bubble data
        let tool_calls = convert_cursor_tool_calls(&bubble);

        // Create message
        let message = UniversalMessage {
            id: key.clone(),
            session_id: session_id.clone(),
            project_id: project_path.clone(), // Use workspace-specific path
            source_id: cursor_path_str.clone(), // Use Cursor base path as source identifier
            provider_id: "cursor".to_string(),
            timestamp: estimated_time.to_rfc3339(),
            sequence_number: sequence,
            role,
            message_type: MessageType::Message,
            content: content_items,
            parent_id: None,
            depth: None,
            branch_id: None,
            model: None,
            tokens: bubble.token_count.as_ref().map(|tc| TokenUsage {
                input_tokens: tc.input_tokens,
                output_tokens: tc.output_tokens,
                total_tokens: tc.input_tokens + tc.output_tokens,
                cache_creation_tokens: None,
                cache_read_tokens: None,
                service_tier: None,
            }),
            tool_calls, // Extracted from bubble data
            thinking: None,
            attachments: None,
            errors: None,
            original_format: "cursor-sqlite".to_string(),
            provider_metadata: HashMap::new(),
        };

        matching_messages.push(message);
        sequence += 1;

        // Limit results to 100 for performance
        if matching_messages.len() >= 100 {
            break;
        }
    }

    Ok(SearchResult {
        total: matching_messages.len(),
        messages: matching_messages,
    })
}

// ============================================================================
// TOOL CALL CONVERSION
// ============================================================================

/// Convert Cursor tool data from toolFormerData into ToolCall structures
/// Modern Cursor stores file operations in toolFormerData with this structure:
/// {
///   "name": "read_file" | "write_file" | "edit_file" | "list_dir",
///   "params": "{\"targetFile\":\"...\",...}",
///   "result": "{\"contents\":\"...\"}"
/// }
fn convert_cursor_tool_calls(bubble: &CursorBubble) -> Option<Vec<ToolCall>> {
    let mut tool_calls = Vec::new();

    // Extract from toolFormerData (modern Cursor format)
    if let Some(tool_data) = &bubble.tool_former_data {
        if let Some(tool_name) = tool_data.get("name").and_then(|v| v.as_str()) {
            let params_str = tool_data
                .get("params")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");
            let result_str = tool_data
                .get("result")
                .and_then(|v| v.as_str())
                .unwrap_or("{}");

            // Parse params JSON
            let params: serde_json::Value =
                serde_json::from_str(params_str).unwrap_or(serde_json::json!({}));
            let result: serde_json::Value =
                serde_json::from_str(result_str).unwrap_or(serde_json::json!({}));

            match tool_name {
                "read_file" => {
                    if let Some(target_file) = params.get("targetFile").and_then(|v| v.as_str()) {
                        let mut input = HashMap::new();
                        input.insert("file_path".to_string(), serde_json::json!(target_file));

                        // Match Claude Code format: output has "file" object with "content"
                        let output = if let Some(contents) = result.get("contents") {
                            let mut file_obj = HashMap::new();
                            file_obj.insert("content".to_string(), contents.clone());

                            let mut output = HashMap::new();
                            output.insert("file".to_string(), serde_json::json!(file_obj));
                            Some(output)
                        } else {
                            None
                        };

                        tool_calls.push(ToolCall {
                            id: tool_data
                                .get("modelCallId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            name: "Read".to_string(),
                            input,
                            output,
                            error: None,
                            status: ToolCallStatus::Success,
                        });
                    }
                }
                "write_file" => {
                    if let Some(target_file) = params.get("targetFile").and_then(|v| v.as_str()) {
                        let mut input = HashMap::new();
                        input.insert("file_path".to_string(), serde_json::json!(target_file));

                        if let Some(content) = params.get("content") {
                            input.insert("content".to_string(), content.clone());
                        }

                        tool_calls.push(ToolCall {
                            id: tool_data
                                .get("modelCallId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            name: "Write".to_string(),
                            input,
                            output: None,
                            error: None,
                            status: ToolCallStatus::Success,
                        });
                    }
                }
                "edit_file" | "apply_diff" => {
                    if let Some(target_file) = params.get("targetFile").and_then(|v| v.as_str()) {
                        let mut input = HashMap::new();
                        input.insert("file_path".to_string(), serde_json::json!(target_file));

                        if let Some(old_str) = params.get("oldString") {
                            input.insert("old_string".to_string(), old_str.clone());
                        }
                        if let Some(new_str) = params.get("newString") {
                            input.insert("new_string".to_string(), new_str.clone());
                        }

                        tool_calls.push(ToolCall {
                            id: tool_data
                                .get("modelCallId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            name: "Edit".to_string(),
                            input,
                            output: None,
                            error: None,
                            status: ToolCallStatus::Success,
                        });
                    }
                }
                "list_dir" => {
                    if let Some(target_dir) = params.get("targetDirectory").and_then(|v| v.as_str())
                    {
                        let mut input = HashMap::new();
                        input.insert("pattern".to_string(), serde_json::json!(target_dir)); // Match expected "pattern" field

                        tool_calls.push(ToolCall {
                            id: tool_data
                                .get("modelCallId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("unknown")
                                .to_string(),
                            name: "Glob".to_string(),
                            input,
                            output: None,
                            error: None,
                            status: ToolCallStatus::Success,
                        });
                    }
                }
                _ => {
                    // Unknown tool, skip
                }
            }
        }
    }

    if tool_calls.is_empty() {
        None
    } else {
        Some(tool_calls)
    }
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

    // CORRECT APPROACH: Cursor stores ALL chat messages in global storage
    // User/globalStorage/state.vscdb contains ALL chat data shared across workspaces
    // Format: bubbleId:<session-id>:<message-id>
    let global_storage_db = cursor_base
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    println!(
        "  📂 Checking global storage: {}",
        global_storage_db.display()
    );

    if !global_storage_db.exists() {
        println!("    ✗ Global storage database doesn't exist");
        return session_dbs;
    }

    println!("    ✓ Global storage exists, checking for chat data...");

    // Check if this database contains chat data
    if let Ok(conn) = Connection::open(&global_storage_db) {
        // Verify cursorDiskKV table exists
        if let Ok(mut stmt) = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='cursorDiskKV'")
        {
            if let Ok(_table_exists) = stmt.query_row(params![], |row| row.get::<_, String>(0)) {
                println!("      ✓ cursorDiskKV table found");

                // Count bubble messages
                let bubble_count = conn
                    .prepare("SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
                    .and_then(|mut stmt| stmt.query_row(params![], |row| row.get::<_, i64>(0)))
                    .unwrap_or(0);

                println!("      📊 Total bubble messages: {}", bubble_count);

                if bubble_count > 0 {
                    println!("      ✓ Has chat messages!");
                    session_dbs.push(global_storage_db);
                } else {
                    println!("      ✗ No bubble messages found");
                }
            } else {
                println!("      ✗ cursorDiskKV table not found");
            }
        }
    } else {
        println!("      ✗ Failed to open global storage database");
    }

    println!("  📊 Total session databases: {}", session_dbs.len());
    session_dbs
}

fn extract_project_info(state_db: &PathBuf) -> Result<ProjectInfo, String> {
    let conn = Connection::open(state_db)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open workspace DB: {}", e))?;

    // Query ItemTable for history.entries
    let mut stmt = conn
        .prepare("SELECT value FROM ItemTable WHERE key = 'history.entries'")
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to prepare query: {}", e))?;

    let value_str: String = stmt
        .query_row(params![], |row| row.get(0))
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to get history.entries: {}", e))?;

    // Parse JSON
    let entries: Vec<HistoryEntry> = serde_json::from_str(&value_str)
        .map_err(|e| format!("CURSOR_PARSE_ERROR: Failed to parse history entries: {}", e))?;

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

// Helper function kept for potential future use
#[allow(dead_code)]
fn count_cursor_messages(session_db: &PathBuf) -> Result<usize, String> {
    let conn = Connection::open(session_db)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE 'bubbleId:%'")
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to prepare count query: {}", e))?;

    let count: i64 = stmt
        .query_row(params![], |row| row.get(0))
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to count messages: {}", e))?;

    Ok(count as usize)
}
