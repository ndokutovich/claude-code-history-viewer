// ============================================================================
// OPENCODE ADAPTER (v1.9.0)
// ============================================================================
// Converts OpenCode normalized JSON directory structure to UniversalMessage.
//
// OpenCode supports TWO coexisting storage backends:
//   1. JSON directory tree under $OPENCODE_HOME/storage/
//        project/{id}.json          -> project definitions
//        session/{project-id}/{id}.json  -> sessions
//        message/{session-id}/{id}.json  -> messages
//        part/{message-id}/{name}.json   -> message content parts
//   2. SQLite database at $OPENCODE_HOME/opencode.db (newer OpenCode versions)
//        tables: project, session, message(data JSON), part(data JSON)
//        The `data` columns hold the SAME JSON payloads as the file backend,
//        so both paths funnel through `opencode_message_to_universal`.
//
// Selection: SQLite is read first (authoritative for projects/sessions it
// contains); JSON supplements anything the DB does not cover. A `storageType`
// ("sqlite" | "json") marker is attached to project/session/message metadata.
//
// PATTERN REFERENCE: Cursor adapter (commands/cursor.rs) for read-only SQLite.
// CLEAN CODE: Explicit types, standardized errors, camelCase metadata keys

use crate::models::universal::*;
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// RAW OPENCODE DATA STRUCTURES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeProject {
    pub id: String,
    pub worktree: String,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeSession {
    pub id: String,
    pub title: Option<String>,
    pub time: OpenCodeTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeTime {
    pub created: i64,  // epoch milliseconds
    #[serde(default)]
    pub updated: Option<i64>,  // epoch milliseconds (absent in newer OpenCode versions)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeMessage {
    // In the JSON file backend `id` is always present; in the SQLite backend the
    // id is a table column and absent from the `data` payload, so default it.
    #[serde(default)]
    pub id: String,
    pub role: String,
    #[serde(rename = "modelID")]
    pub model_id: Option<String>,
    #[serde(rename = "parentID")]
    pub parent_id: Option<String>,
    pub time: OpenCodeTime,
    pub tokens: Option<OpenCodeTokens>,
    pub cost: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodeTokens {
    pub input: u64,
    pub output: u64,
}

// ============================================================================
// PART TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenCodePart {
    #[serde(rename = "type")]
    pub part_type: String,

    // text part
    pub text: Option<String>,

    // reasoning part
    pub reasoning: Option<String>,

    // compaction part
    pub summary: Option<String>,

    // tool part
    pub tool: Option<String>,
    #[serde(rename = "callID")]
    pub call_id: Option<String>,
    pub state: Option<Value>,

    // step-finish part
    pub cost: Option<f64>,

    // file part
    pub file: Option<Value>,

    // patch part
    pub patch: Option<Value>,
}

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Get the OpenCode base path using the standard detection order:
/// 1. $OPENCODE_HOME env var
/// 2. $XDG_DATA_HOME/opencode
/// 3. ~/.local/share/opencode
/// 4. Windows: %APPDATA%/opencode or %LOCALAPPDATA%/opencode
pub fn get_opencode_base_path() -> Option<PathBuf> {
    // Priority 1: $OPENCODE_HOME env var
    if let Ok(opencode_home) = std::env::var("OPENCODE_HOME") {
        let path = PathBuf::from(opencode_home);
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 2: $XDG_DATA_HOME/opencode (Linux/macOS XDG standard)
    if let Ok(xdg_data_home) = std::env::var("XDG_DATA_HOME") {
        let path = PathBuf::from(xdg_data_home).join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 3: ~/.local/share/opencode (Linux/macOS default)
    if let Some(home) = dirs::home_dir() {
        let path = home.join(".local").join("share").join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 4: Windows %APPDATA%/opencode
    if let Ok(appdata) = std::env::var("APPDATA") {
        let path = PathBuf::from(appdata).join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    // Priority 5: Windows %LOCALAPPDATA%/opencode
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        let path = PathBuf::from(localappdata).join("opencode");
        if path.exists() {
            return Some(path);
        }
    }

    None
}

// ============================================================================
// SQLITE BACKEND (opencode.db)
// ============================================================================

/// Resolve the SQLite database path for an OpenCode base directory.
pub fn opencode_db_path(base_path: &Path) -> PathBuf {
    base_path.join("opencode.db")
}

/// Open `opencode.db` read-only (lock-safe flags, mirrors cursor.rs).
/// Returns `None` when the file is absent, is not a regular file, or cannot be opened.
fn open_opencode_db(base_path: &Path) -> Option<Connection> {
    let db_path = opencode_db_path(base_path);
    let meta = fs::symlink_metadata(&db_path).ok()?;
    if !meta.file_type().is_file() {
        return None;
    }
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    let conn = Connection::open_with_flags(&db_path, flags).ok()?;
    let _ = conn.busy_timeout(std::time::Duration::from_secs(1));
    Some(conn)
}

/// Build a map of project_id -> set of session ids present in the SQLite DB.
/// Used to exclude DB-backed sessions when supplementing counts from JSON.
fn build_db_session_map(base_path: &Path) -> Option<HashMap<String, HashSet<String>>> {
    let conn = open_opencode_db(base_path)?;
    let mut stmt = conn.prepare("SELECT project_id, id FROM session").ok()?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .ok()?;

    let mut map: HashMap<String, HashSet<String>> = HashMap::new();
    for row in rows.flatten() {
        map.entry(row.0).or_default().insert(row.1);
    }
    Some(map)
}

/// Scan OpenCode projects from the SQLite `project` table.
/// Returns `None` when there is no DB or it contains no projects.
fn scan_projects_from_db(base_path: &Path, source_id: &str) -> Option<Vec<UniversalProject>> {
    let conn = open_opencode_db(base_path)?;
    let db_path_str = opencode_db_path(base_path).to_string_lossy().to_string();

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.worktree, p.name, p.time_created, p.time_updated, \
                    (SELECT COUNT(*) FROM session s WHERE s.project_id = p.id) AS session_count \
             FROM project p",
        )
        .ok()?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,         // id
                row.get::<_, String>(1)?,         // worktree
                row.get::<_, Option<String>>(2)?, // name
                row.get::<_, i64>(3)?,            // time_created (epoch ms)
                row.get::<_, i64>(4)?,            // time_updated (epoch ms)
                row.get::<_, i64>(5)?,            // session_count
            ))
        })
        .ok()?;

    let mut projects: Vec<UniversalProject> = Vec::new();

    for row in rows.flatten() {
        let (id, worktree, name, time_created, time_updated, session_count) = row;

        let display_name = name.filter(|n| !n.is_empty()).unwrap_or_else(|| {
            PathBuf::from(&worktree)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&id)
                .to_string()
        });

        let mut metadata: HashMap<String, Value> = HashMap::new();
        metadata.insert("projectWorktree".to_string(), json!(worktree));
        metadata.insert("storageType".to_string(), json!("sqlite"));
        metadata.insert("storageDbPath".to_string(), json!(db_path_str));

        projects.push(UniversalProject {
            id: id.clone(),
            source_id: source_id.to_string(),
            provider_id: "opencode".to_string(),
            name: display_name,
            path: format!("opencode://{}", id),
            session_count: session_count.max(0) as usize,
            total_messages: 0,
            first_activity_at: Some(epoch_ms_to_rfc3339(time_created)),
            last_activity_at: Some(epoch_ms_to_rfc3339(time_updated.max(time_created))),
            metadata,
        });
    }

    if projects.is_empty() {
        None
    } else {
        Some(projects)
    }
}

/// Load sessions for a project from the SQLite `session` table.
fn load_sessions_from_db(
    base_path: &Path,
    project_id: &str,
    source_id: &str,
) -> Option<Vec<UniversalSession>> {
    let conn = open_opencode_db(base_path)?;
    let db_path_str = opencode_db_path(base_path).to_string_lossy().to_string();

    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.title, s.time_created, s.time_updated, \
                    (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) AS message_count \
             FROM session s WHERE s.project_id = ?1",
        )
        .ok()?;

    let rows = stmt
        .query_map([project_id], |row| {
            Ok((
                row.get::<_, String>(0)?,         // id
                row.get::<_, Option<String>>(1)?, // title
                row.get::<_, i64>(2)?,            // time_created
                row.get::<_, i64>(3)?,            // time_updated
                row.get::<_, i64>(4)?,            // message_count
            ))
        })
        .ok()?;

    let mut sessions: Vec<UniversalSession> = Vec::new();

    for row in rows.flatten() {
        let (id, title, time_created, time_updated, message_count) = row;

        let display_title = title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| {
                let truncated: String = id.chars().take(8).collect();
                format!("Session {}", truncated)
            });

        let first_message_at = epoch_ms_to_rfc3339(time_created);
        let last_message_at = epoch_ms_to_rfc3339(time_updated);
        let duration = time_updated.saturating_sub(time_created);
        let checksum = format!("{:x}", id.len() ^ (time_updated as usize));

        let mut metadata: HashMap<String, Value> = HashMap::new();
        metadata.insert(
            "filePath".to_string(),
            Value::String(format!("opencode://{}", id)),
        );
        metadata.insert("storageType".to_string(), json!("sqlite"));
        metadata.insert("storageDbPath".to_string(), json!(db_path_str));

        sessions.push(UniversalSession {
            id: id.clone(),
            project_id: project_id.to_string(),
            source_id: source_id.to_string(),
            provider_id: "opencode".to_string(),
            title: display_title,
            description: title.filter(|t| !t.is_empty()),
            message_count: message_count.max(0) as usize,
            first_message_at,
            last_message_at,
            duration,
            total_tokens: None,
            tool_call_count: 0,
            error_count: 0,
            entrypoint: None,
            metadata,
            checksum,
        });
    }

    if sessions.is_empty() {
        None
    } else {
        Some(sessions)
    }
}

/// Load all messages for a session from the SQLite `message`/`part` tables.
/// Each `data` column is parsed with the same structs as the JSON backend and
/// converted via `opencode_message_to_universal`, so output is identical.
fn load_messages_from_db(
    base_path: &Path,
    session_id: &str,
    project_id: &str,
    source_id: &str,
) -> Option<Vec<UniversalMessage>> {
    let conn = open_opencode_db(base_path)?;

    let mut msg_stmt = conn
        .prepare("SELECT id, data FROM message WHERE session_id = ?1 ORDER BY time_created, id")
        .ok()?;
    let mut part_stmt = conn
        .prepare("SELECT data FROM part WHERE message_id = ?1 ORDER BY id")
        .ok()?;

    let msg_rows = msg_stmt
        .query_map([session_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .ok()?;

    let mut messages: Vec<UniversalMessage> = Vec::new();

    for (idx, msg_row) in msg_rows.flatten().enumerate() {
        let (msg_id, data_json) = msg_row;

        let mut raw_msg: OpenCodeMessage = match serde_json::from_str(&data_json) {
            Ok(m) => m,
            Err(_) => continue,
        };
        // The table column is the authoritative message id.
        raw_msg.id = msg_id.clone();

        let parts: Vec<OpenCodePart> = part_stmt
            .query_map([&msg_id], |row| row.get::<_, String>(0))
            .map(|rows| {
                rows.flatten()
                    .filter_map(|d| serde_json::from_str::<OpenCodePart>(&d).ok())
                    .collect()
            })
            .unwrap_or_default();

        let mut universal = opencode_message_to_universal(
            &raw_msg,
            parts,
            session_id,
            project_id,
            source_id,
            idx as i32,
        );
        universal
            .provider_metadata
            .insert("storageType".to_string(), json!("sqlite"));

        messages.push(universal);
    }

    if messages.is_empty() {
        None
    } else {
        Some(messages)
    }
}

/// Count JSON session files for a project, optionally excluding ids already
/// covered by the SQLite backend.
fn count_json_sessions_excluding(
    base_path: &Path,
    project_id: &str,
    exclude_ids: Option<&HashSet<String>>,
) -> usize {
    if !is_safe_storage_id(project_id) {
        return 0;
    }
    let session_dir = base_path.join("storage").join("session").join(project_id);
    if !session_dir.exists() {
        return 0;
    }
    fs::read_dir(&session_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    if !(p.is_file()
                        && p.extension().and_then(|x| x.to_str()) == Some("json"))
                    {
                        return false;
                    }
                    match exclude_ids {
                        Some(ids) => {
                            let stem = p
                                .file_stem()
                                .and_then(|s| s.to_str())
                                .unwrap_or_default()
                                .to_string();
                            !ids.contains(&stem)
                        }
                        None => true,
                    }
                })
                .count()
        })
        .unwrap_or(0)
}

// ============================================================================
// PROJECT SCANNING
// ============================================================================

/// Scan all OpenCode projects from storage/project/{id}.json files
pub fn scan_opencode_projects_impl(
    base_path: &Path,
    source_id: &str,
) -> Result<Vec<UniversalProject>, String> {
    let mut projects: Vec<UniversalProject> = Vec::new();
    let mut db_ids: HashSet<String> = HashSet::new();

    // 1. SQLite backend first (authoritative, newer source).
    if let Some(db_projects) = scan_projects_from_db(base_path, source_id) {
        for p in db_projects {
            db_ids.insert(p.id.clone());
            projects.push(p);
        }

        // Supplement DB project session counts with JSON-only sessions.
        if let Some(map) = build_db_session_map(base_path) {
            for p in projects.iter_mut() {
                let db_set = map.get(&p.id);
                p.session_count += count_json_sessions_excluding(base_path, &p.id, db_set);
            }
        }
    }

    // 2. JSON backend (fallback / merge), skipping ids already seen in the DB.
    let project_dir = base_path.join("storage").join("project");
    if !project_dir.exists() {
        projects.sort_by(|a, b| a.id.cmp(&b.id));
        return Ok(projects);
    }

    let entries = fs::read_dir(&project_dir)
        .map_err(|e| format!("OPENCODE_READ_ERROR: Cannot read project directory: {}", e))?;

    for entry_result in entries {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Skipping directory entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        // Only process .json files
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        // Extract ID from filename (strip .json extension)
        let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        if !is_safe_storage_id(&file_stem) {
            eprintln!("OPENCODE_WARN: Skipping unsafe project ID: {}", file_stem);
            continue;
        }

        // Parse JSON
        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot read {}: {}", path.display(), e);
                continue;
            }
        };

        let project: OpenCodeProject = match serde_json::from_str(&content) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot parse {}: {}", path.display(), e);
                continue;
            }
        };

        // Skip projects already loaded from the SQLite backend.
        if db_ids.contains(&project.id) {
            continue;
        }

        // Count sessions for this project
        let session_count = count_sessions_for_project(base_path, &project.id);

        // Determine display name: title or basename of worktree path
        let display_name = project.title.clone().unwrap_or_else(|| {
            PathBuf::from(&project.worktree)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&project.id)
                .to_string()
        });

        let mut metadata: HashMap<String, Value> = HashMap::new();
        metadata.insert("projectWorktree".to_string(), json!(project.worktree));
        metadata.insert("storageType".to_string(), json!("json"));

        projects.push(UniversalProject {
            id: project.id.clone(),
            source_id: source_id.to_string(),
            provider_id: "opencode".to_string(),
            name: display_name,
            // Virtual path - OpenCode projects are identified by ID, not filesystem path
            path: format!("opencode://{}", project.id),
            session_count,
            total_messages: 0,
            first_activity_at: None,
            last_activity_at: None,
            metadata,
        });
    }

    // Sort by project ID (stable ordering)
    projects.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(projects)
}

/// Count how many sessions exist for a given project ID
fn count_sessions_for_project(base_path: &Path, project_id: &str) -> usize {
    let session_dir = base_path
        .join("storage")
        .join("session")
        .join(project_id);

    if !session_dir.exists() {
        return 0;
    }

    fs::read_dir(&session_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json")
                })
                .count()
        })
        .unwrap_or(0)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

/// Load sessions for one OpenCode project from storage/session/{project-id}/{id}.json
pub fn load_opencode_sessions_impl(
    base_path: &Path,
    project_id: &str,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    if !is_safe_storage_id(project_id) {
        return Err(format!(
            "OPENCODE_SECURITY_ERROR: Unsafe project ID: {}",
            project_id
        ));
    }

    let mut sessions: Vec<UniversalSession> = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    // 1. SQLite backend first.
    if let Some(db_sessions) = load_sessions_from_db(base_path, project_id, source_id) {
        for s in db_sessions {
            seen_ids.insert(s.id.clone());
            sessions.push(s);
        }
    }

    // 2. JSON backend, skipping sessions already covered by the DB.
    let session_dir = base_path
        .join("storage")
        .join("session")
        .join(project_id);

    if !session_dir.exists() {
        sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
        return Ok(sessions);
    }

    let entries = fs::read_dir(&session_dir)
        .map_err(|e| format!("OPENCODE_READ_ERROR: Cannot read session directory: {}", e))?;

    for entry_result in entries {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Skipping session entry: {}", e);
                continue;
            }
        };

        let path = entry.path();

        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        if !is_safe_storage_id(&file_stem) {
            eprintln!("OPENCODE_WARN: Skipping unsafe session ID: {}", file_stem);
            continue;
        }

        // Skip sessions already loaded from the SQLite backend.
        if seen_ids.contains(&file_stem) {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot read {}: {}", path.display(), e);
                continue;
            }
        };

        let session: OpenCodeSession = match serde_json::from_str(&content) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot parse {}: {}", path.display(), e);
                continue;
            }
        };

        // Count messages for this session
        let message_count = count_messages_for_session(base_path, &session.id);

        let title = session
            .title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| {
                let truncated: String = session.id.chars().take(8).collect();
                format!("Session {}", truncated)
            });

        let first_message_at = epoch_ms_to_rfc3339(session.time.created);
        let updated = session.time.updated.unwrap_or(session.time.created);
        let last_message_at = epoch_ms_to_rfc3339(updated);

        let duration = updated.saturating_sub(session.time.created);

        let checksum = format!("{:x}", session.id.len() ^ (updated as usize));

        sessions.push(UniversalSession {
            id: session.id.clone(),
            project_id: project_id.to_string(),
            source_id: source_id.to_string(),
            provider_id: "opencode".to_string(),
            title,
            description: session.title.clone(),
            message_count,
            first_message_at,
            last_message_at,
            duration,
            total_tokens: None,
            tool_call_count: 0,
            error_count: 0,
            entrypoint: None,
            metadata: {
                let mut metadata = HashMap::new();
                metadata.insert("filePath".to_string(), serde_json::Value::String(
                    format!("opencode://{}", session.id)
                ));
                metadata.insert("storageType".to_string(), json!("json"));
                metadata
            },
            checksum,
        });
    }

    // Sort by updated time descending (most recent first)
    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));

    Ok(sessions)
}

/// Count messages for a session
fn count_messages_for_session(base_path: &Path, session_id: &str) -> usize {
    let message_dir = base_path
        .join("storage")
        .join("message")
        .join(session_id);

    if !message_dir.exists() {
        return 0;
    }

    fs::read_dir(&message_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let p = e.path();
                    p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json")
                })
                .count()
        })
        .unwrap_or(0)
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

/// Load messages for one OpenCode session with pagination
pub fn load_opencode_messages_impl(
    base_path: &Path,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    if !is_safe_storage_id(session_id) {
        return Err(format!(
            "OPENCODE_SECURITY_ERROR: Unsafe session ID: {}",
            session_id
        ));
    }

    // 1. SQLite backend first. When the session lives in the DB, paginate over
    //    the in-memory result (DB rows are loaded fully, then sliced).
    if let Some(all) = load_messages_from_db(base_path, session_id, project_id, source_id) {
        let total = all.len();
        let start = offset.min(total);
        let end = (offset + limit).min(total);
        return Ok(all[start..end].to_vec());
    }

    // 2. JSON backend fallback.
    let message_dir = base_path
        .join("storage")
        .join("message")
        .join(session_id);

    if !message_dir.exists() {
        return Ok(Vec::new());
    }

    // Collect all message JSON files
    let entries = fs::read_dir(&message_dir)
        .map_err(|e| format!("OPENCODE_READ_ERROR: Cannot read message directory: {}", e))?;

    let mut message_files: Vec<PathBuf> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json"))
        .collect();

    // Sort files by name for stable ordering
    message_files.sort();

    // Apply pagination
    let total = message_files.len();
    let start = offset.min(total);
    let end = (offset + limit).min(total);
    let page_files = &message_files[start..end];

    let mut messages: Vec<UniversalMessage> = Vec::new();

    for (idx, path) in page_files.iter().enumerate() {
        let file_stem = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        if !is_safe_storage_id(&file_stem) {
            continue;
        }

        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot read {}: {}", path.display(), e);
                continue;
            }
        };

        let raw_msg: OpenCodeMessage = match serde_json::from_str(&content) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("OPENCODE_WARN: Cannot parse {}: {}", path.display(), e);
                continue;
            }
        };

        // Load parts for this message
        let parts = load_parts_for_message(base_path, &raw_msg.id);

        // Convert to UniversalMessage
        let mut universal = opencode_message_to_universal(
            &raw_msg,
            parts,
            session_id,
            project_id,
            source_id,
            (start + idx) as i32,
        );
        universal
            .provider_metadata
            .insert("storageType".to_string(), json!("json"));

        messages.push(universal);
    }

    Ok(messages)
}

/// Load all parts for a message from storage/part/{message-id}/{name}.json
fn load_parts_for_message(base_path: &Path, message_id: &str) -> Vec<OpenCodePart> {
    if !is_safe_storage_id(message_id) {
        return Vec::new();
    }

    let part_dir = base_path
        .join("storage")
        .join("part")
        .join(message_id);

    if !part_dir.exists() {
        return Vec::new();
    }

    let mut part_files: Vec<PathBuf> = fs::read_dir(&part_dir)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_file() && p.extension().and_then(|x| x.to_str()) == Some("json"))
                .collect()
        })
        .unwrap_or_default();

    // Sort part files by name for stable ordering
    part_files.sort();

    let mut parts: Vec<OpenCodePart> = Vec::new();

    for path in &part_files {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let part: OpenCodePart = match serde_json::from_str(&content) {
            Ok(p) => p,
            Err(_) => continue,
        };

        parts.push(part);
    }

    parts
}

// ============================================================================
// CONVERSION TO UNIVERSAL FORMAT
// ============================================================================

/// Convert an OpenCode message + its parts to UniversalMessage
fn opencode_message_to_universal(
    msg: &OpenCodeMessage,
    parts: Vec<OpenCodePart>,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    sequence_number: i32,
) -> UniversalMessage {
    let role = match msg.role.as_str() {
        "user" => MessageRole::User,
        "assistant" => MessageRole::Assistant,
        "system" => MessageRole::System,
        _ => MessageRole::Assistant,
    };

    // Convert parts to UniversalContent items
    let content = convert_parts_to_content(&parts);

    // Extract tokens if available
    let tokens = msg.tokens.as_ref().map(|t| TokenUsage {
        input_tokens: t.input.try_into().unwrap_or(i32::MAX),
        output_tokens: t.output.try_into().unwrap_or(i32::MAX),
        total_tokens: (t.input.saturating_add(t.output)).try_into().unwrap_or(i32::MAX),
        cache_creation_tokens: None,
        cache_read_tokens: None,
        service_tier: None,
    });

    // Collect tool calls from tool parts
    let tool_calls = extract_tool_calls(&parts);
    let tool_calls_opt = if tool_calls.is_empty() {
        None
    } else {
        Some(tool_calls)
    };

    // Extract thinking from reasoning parts
    let thinking = extract_thinking(&parts);

    let mut metadata: HashMap<String, Value> = HashMap::new();
    if let Some(ref cost) = msg.cost {
        metadata.insert("cost".to_string(), json!(cost));
    }

    UniversalMessage {
        id: msg.id.clone(),
        session_id: session_id.to_string(),
        project_id: project_id.to_string(),
        source_id: source_id.to_string(),
        provider_id: "opencode".to_string(),
        timestamp: epoch_ms_to_rfc3339(msg.time.created),
        sequence_number,
        role,
        message_type: MessageType::Message,
        content,
        parent_id: msg.parent_id.clone(),
        depth: None,
        branch_id: None,
        model: msg.model_id.clone(),
        tokens,
        tool_calls: tool_calls_opt,
        thinking,
        attachments: None,
        errors: None,
        original_format: "opencode_json".to_string(),
        provider_metadata: metadata,
    }
}

/// Convert OpenCode parts to UniversalContent items
fn convert_parts_to_content(parts: &[OpenCodePart]) -> Vec<UniversalContent> {
    let mut content_items: Vec<UniversalContent> = Vec::new();

    for part in parts {
        match part.part_type.as_str() {
            "text" => {
                if let Some(ref text) = part.text {
                    content_items.push(UniversalContent {
                        content_type: ContentType::Text,
                        data: json!({"text": text}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(text.len()),
                        hash: None,
                    });
                }
            }

            "reasoning" => {
                if let Some(ref reasoning) = part.reasoning {
                    // Reasoning maps to Thinking content type
                    content_items.push(UniversalContent {
                        content_type: ContentType::Thinking,
                        data: json!({"thinking": reasoning}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(reasoning.len()),
                        hash: None,
                    });
                }
            }

            "tool" => {
                let tool_name = part
                    .tool
                    .as_deref()
                    .map(normalize_tool_name)
                    .unwrap_or_else(|| "Unknown".to_string());

                let call_id = part
                    .call_id
                    .clone()
                    .unwrap_or_else(|| format!("call-{}", tool_name.to_lowercase()));

                // Extract state fields
                let (input, status, output, error) = if let Some(ref state) = part.state {
                    let input = state.get("input").cloned().unwrap_or(Value::Null);
                    let normalized_input = normalize_tool_input(input);
                    let status = state
                        .get("status")
                        .and_then(|s| s.as_str())
                        .unwrap_or("pending")
                        .to_string();
                    let output = state.get("output").cloned();
                    let error = state.get("error").cloned();
                    (normalized_input, status, output, error)
                } else {
                    (Value::Object(serde_json::Map::new()), "pending".to_string(), None, None)
                };

                content_items.push(UniversalContent {
                    content_type: ContentType::ToolUse,
                    data: json!({
                        "id": call_id,
                        "name": tool_name,
                        "input": input,
                        "status": status,
                        "output": output,
                        "error": error,
                    }),
                    encoding: None,
                    mime_type: Some("application/json".to_string()),
                    size: None,
                    hash: None,
                });
            }

            "compaction" => {
                if let Some(ref summary) = part.summary {
                    content_items.push(UniversalContent {
                        content_type: ContentType::Text,
                        data: json!({"text": summary, "isCompactionSummary": true}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(summary.len()),
                        hash: None,
                    });
                }
            }

            "file" => {
                if let Some(ref file_val) = part.file {
                    let name = file_val
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let url = file_val
                        .get("url")
                        .and_then(|u| u.as_str())
                        .unwrap_or("")
                        .to_string();

                    content_items.push(UniversalContent {
                        content_type: ContentType::File,
                        data: json!({"name": name, "url": url}),
                        encoding: None,
                        mime_type: None,
                        size: None,
                        hash: None,
                    });
                }
            }

            // step-finish, patch, snapshot, agent, subtask, retry, step-start -> skip
            _ => {}
        }
    }

    content_items
}

/// Extract tool calls from tool parts
fn extract_tool_calls(parts: &[OpenCodePart]) -> Vec<ToolCall> {
    parts
        .iter()
        .filter(|p| p.part_type == "tool")
        .filter_map(|p| {
            let tool_name = p.tool.as_deref().map(normalize_tool_name)?;
            let call_id = p
                .call_id
                .clone()
                .unwrap_or_else(|| format!("call-{}", tool_name.to_lowercase()));

            let (input_map, status, output, error_str) = if let Some(ref state) = p.state {
                let raw_input = state.get("input").cloned().unwrap_or(Value::Null);
                let normalized = normalize_tool_input(raw_input);
                let input_map = if let Value::Object(map) = normalized {
                    map.into_iter()
                        .map(|(k, v)| (k, v))
                        .collect::<HashMap<String, Value>>()
                } else {
                    HashMap::new()
                };
                let status_str = state
                    .get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("pending")
                    .to_string();
                let output = state.get("output").and_then(|o| {
                    o.as_object().map(|obj| {
                        obj.iter()
                            .map(|(k, v)| (k.clone(), v.clone()))
                            .collect::<HashMap<String, Value>>()
                    })
                });
                let error_str = state
                    .get("error")
                    .and_then(|e| e.as_str())
                    .map(String::from);
                (input_map, status_str, output, error_str)
            } else {
                (HashMap::new(), "pending".to_string(), None, None)
            };

            let call_status = match status.as_str() {
                "complete" | "success" => ToolCallStatus::Success,
                "error" | "failed" => ToolCallStatus::Error,
                _ => ToolCallStatus::Pending,
            };

            Some(ToolCall {
                id: call_id,
                name: tool_name,
                input: input_map,
                output,
                error: error_str,
                status: call_status,
            })
        })
        .collect()
}

/// Extract thinking block from reasoning parts
fn extract_thinking(parts: &[OpenCodePart]) -> Option<ThinkingBlock> {
    let reasoning_texts: Vec<&str> = parts
        .iter()
        .filter(|p| p.part_type == "reasoning")
        .filter_map(|p| p.reasoning.as_deref())
        .collect();

    if reasoning_texts.is_empty() {
        return None;
    }

    Some(ThinkingBlock {
        content: reasoning_texts.join("\n"),
        signature: None,
        model: None,
    })
}

// ============================================================================
// TOOL NAME NORMALIZATION
// ============================================================================

/// Normalize OpenCode lowercase tool names to PascalCase display names
pub fn normalize_tool_name(raw: &str) -> String {
    let lower = raw.to_lowercase();
    match lower.as_str() {
        "read" => "Read".to_string(),
        "bash" => "Bash".to_string(),
        "glob" => "Glob".to_string(),
        "grep" => "Grep".to_string(),
        "write" => "Write".to_string(),
        "edit" => "Edit".to_string(),
        "todowrite" => "TodoWrite".to_string(),
        "webfetch" => "WebFetch".to_string(),
        "task" | "call_omo_agent" => "Task".to_string(),
        _ if lower.starts_with("websearch") => "WebSearch".to_string(),
        _ => {
            // Default: capitalize first letter
            let mut chars = raw.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            }
        }
    }
}

// ============================================================================
// TOOL INPUT KEY NORMALIZATION
// ============================================================================

/// Normalize camelCase tool input keys to snake_case for consistency
pub fn normalize_tool_input(input: Value) -> Value {
    match input {
        Value::Object(map) => {
            let normalized: serde_json::Map<String, Value> = map
                .into_iter()
                .map(|(k, v)| {
                    let new_key = match k.as_str() {
                        "filePath" => "file_path".to_string(),
                        "oldString" => "old_string".to_string(),
                        "newString" => "new_string".to_string(),
                        "replaceAll" => "replace_all".to_string(),
                        "runInBackground" => "run_in_background".to_string(),
                        "allowedDomains" => "allowed_domains".to_string(),
                        "blockedDomains" => "blocked_domains".to_string(),
                        _ => k,
                    };
                    (new_key, normalize_tool_input(v))
                })
                .collect();
            Value::Object(normalized)
        }
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(normalize_tool_input).collect())
        }
        other => other,
    }
}

// ============================================================================
// HELPERS
// ============================================================================

/// Convert epoch milliseconds to RFC3339 timestamp string
pub fn epoch_ms_to_rfc3339(ms: i64) -> String {
    use chrono::{TimeZone, Utc};
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    match Utc.timestamp_opt(secs, nanos) {
        chrono::LocalResult::Single(dt) => dt.to_rfc3339(),
        _ => {
            // Fallback to current time if conversion fails
            Utc::now().to_rfc3339()
        }
    }
}

/// Validate a storage ID to prevent path traversal attacks
/// Only allows alphanumeric characters, hyphens, and underscores
pub fn is_safe_storage_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 256 {
        return false;
    }
    id.chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_tool_name_known_tools() {
        assert_eq!(normalize_tool_name("read"), "Read");
        assert_eq!(normalize_tool_name("bash"), "Bash");
        assert_eq!(normalize_tool_name("glob"), "Glob");
        assert_eq!(normalize_tool_name("grep"), "Grep");
        assert_eq!(normalize_tool_name("write"), "Write");
        assert_eq!(normalize_tool_name("edit"), "Edit");
        assert_eq!(normalize_tool_name("todowrite"), "TodoWrite");
        assert_eq!(normalize_tool_name("webfetch"), "WebFetch");
        assert_eq!(normalize_tool_name("task"), "Task");
        assert_eq!(normalize_tool_name("call_omo_agent"), "Task");
    }

    #[test]
    fn test_normalize_tool_name_websearch_variants() {
        assert_eq!(normalize_tool_name("websearch"), "WebSearch");
        assert_eq!(normalize_tool_name("websearch_brave"), "WebSearch");
        assert_eq!(normalize_tool_name("WEBSEARCH"), "WebSearch");
    }

    #[test]
    fn test_normalize_tool_name_unknown_capitalizes() {
        assert_eq!(normalize_tool_name("unknown_tool"), "Unknown_tool");
        assert_eq!(normalize_tool_name("myTool"), "MyTool");
    }

    #[test]
    fn test_normalize_tool_input_key_mapping() {
        let input = json!({
            "filePath": "/some/path",
            "oldString": "old",
            "newString": "new",
            "replaceAll": true,
        });
        let result = normalize_tool_input(input);
        let obj = result.as_object().unwrap();
        assert!(obj.contains_key("file_path"), "Missing file_path");
        assert!(obj.contains_key("old_string"), "Missing old_string");
        assert!(obj.contains_key("new_string"), "Missing new_string");
        assert!(obj.contains_key("replace_all"), "Missing replace_all");
    }

    #[test]
    fn test_epoch_ms_to_rfc3339_unix_epoch() {
        let result = epoch_ms_to_rfc3339(0);
        assert!(result.starts_with("1970-01-01"));
    }

    #[test]
    fn test_epoch_ms_to_rfc3339_positive() {
        // 2024-01-01T00:00:00Z = 1704067200000 ms
        let result = epoch_ms_to_rfc3339(1_704_067_200_000);
        assert!(result.starts_with("2024-01-01"));
    }

    #[test]
    fn test_is_safe_storage_id_valid() {
        assert!(is_safe_storage_id("abc123"));
        assert!(is_safe_storage_id("my-session-id"));
        assert!(is_safe_storage_id("session_01abc"));
        assert!(is_safe_storage_id("abc-123-DEF"));
    }

    #[test]
    fn test_is_safe_storage_id_invalid() {
        assert!(!is_safe_storage_id(""));
        assert!(!is_safe_storage_id("../etc/passwd"));
        assert!(!is_safe_storage_id("path/with/slash"));
        assert!(!is_safe_storage_id("id with spaces"));
        assert!(!is_safe_storage_id("id.with.dots"));
    }

    #[test]
    fn test_is_safe_storage_id_too_long() {
        let long_id: String = "a".repeat(257);
        assert!(!is_safe_storage_id(&long_id));
    }

    // ------------------------------------------------------------------------
    // SQLITE BACKEND TESTS
    // ------------------------------------------------------------------------

    /// Create an `opencode.db` matching the real OpenCode SQLite schema and seed
    /// one project, one session, and two messages with parts. The `data` columns
    /// hold the same JSON payloads the file backend uses.
    fn create_seeded_db(dir: &Path) {
        let db_path = dir.join("opencode.db");
        let conn = Connection::open(&db_path).expect("create test db");
        conn.execute_batch(
            "CREATE TABLE project (
                id TEXT PRIMARY KEY, worktree TEXT NOT NULL, name TEXT,
                time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL
            );
            CREATE TABLE session (
                id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
                time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL
            );
            CREATE TABLE message (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
                time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL
            );
            CREATE TABLE part (
                id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
                time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL, data TEXT NOT NULL
            );",
        )
        .expect("create tables");

        conn.execute(
            "INSERT INTO project (id, worktree, name, time_created, time_updated) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params!["proj1", "/tmp/my-project", "my-project", 1_700_000_000_000_i64, 1_700_000_100_000_i64],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO session (id, project_id, title, time_created, time_updated) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params!["ses_001", "proj1", "Test session", 1_700_000_000_000_i64, 1_700_000_050_000_i64],
        )
        .unwrap();

        // User message: note `data` has NO id field (column is authoritative).
        conn.execute(
            "INSERT INTO message (id, session_id, time_created, time_updated, data) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                "msg_001", "ses_001", 1_700_000_010_000_i64, 1_700_000_010_000_i64,
                r#"{"role":"user","time":{"created":1700000010000}}"#
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO message (id, session_id, time_created, time_updated, data) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                "msg_002", "ses_001", 1_700_000_020_000_i64, 1_700_000_020_000_i64,
                r#"{"role":"assistant","time":{"created":1700000020000},"parentID":"msg_001","modelID":"test-model","tokens":{"input":100,"output":50},"cost":0.01}"#
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                "prt_001", "msg_001", "ses_001", 1_700_000_010_000_i64, 1_700_000_010_000_i64,
                r#"{"type":"text","text":"Hello from user"}"#
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO part (id, message_id, session_id, time_created, time_updated, data) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                "prt_002", "msg_002", "ses_001", 1_700_000_020_000_i64, 1_700_000_020_000_i64,
                r#"{"type":"text","text":"Hello from assistant"}"#
            ],
        )
        .unwrap();
    }

    fn storage_type_of(metadata: &HashMap<String, Value>) -> Option<&str> {
        metadata.get("storageType").and_then(|v| v.as_str())
    }

    #[test]
    fn sqlite_scan_projects_reads_from_db() {
        let tmp = tempfile::tempdir().unwrap();
        create_seeded_db(tmp.path());

        let projects = scan_opencode_projects_impl(tmp.path(), "src-1").unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, "proj1");
        assert_eq!(projects[0].name, "my-project");
        assert_eq!(projects[0].path, "opencode://proj1");
        assert_eq!(projects[0].session_count, 1);
        assert_eq!(storage_type_of(&projects[0].metadata), Some("sqlite"));
    }

    #[test]
    fn sqlite_load_sessions_reads_from_db() {
        let tmp = tempfile::tempdir().unwrap();
        create_seeded_db(tmp.path());

        let sessions = load_opencode_sessions_impl(tmp.path(), "proj1", "src-1").unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "ses_001");
        assert_eq!(sessions[0].title, "Test session");
        assert_eq!(sessions[0].message_count, 2);
        assert_eq!(storage_type_of(&sessions[0].metadata), Some("sqlite"));
    }

    #[test]
    fn sqlite_load_messages_reads_from_db() {
        let tmp = tempfile::tempdir().unwrap();
        create_seeded_db(tmp.path());

        let messages =
            load_opencode_messages_impl(tmp.path(), "ses_001", "proj1", "src-1", 0, 20).unwrap();
        assert_eq!(messages.len(), 2);

        // First message: user, id from the column, text from the part.
        assert_eq!(messages[0].id, "msg_001");
        assert_eq!(messages[0].role, MessageRole::User);
        assert_eq!(
            messages[0].provider_metadata.get("storageType").and_then(|v| v.as_str()),
            Some("sqlite")
        );
        let first_text = messages[0].content[0].data.get("text").and_then(|v| v.as_str());
        assert_eq!(first_text, Some("Hello from user"));

        // Second message: assistant with model, parent, and tokens.
        assert_eq!(messages[1].id, "msg_002");
        assert_eq!(messages[1].role, MessageRole::Assistant);
        assert_eq!(messages[1].model, Some("test-model".to_string()));
        assert_eq!(messages[1].parent_id, Some("msg_001".to_string()));
        let tokens = messages[1].tokens.as_ref().expect("tokens present");
        assert_eq!(tokens.input_tokens, 100);
        assert_eq!(tokens.output_tokens, 50);
    }

    #[test]
    fn sqlite_messages_paginate() {
        let tmp = tempfile::tempdir().unwrap();
        create_seeded_db(tmp.path());

        let page = load_opencode_messages_impl(tmp.path(), "ses_001", "proj1", "src-1", 1, 1).unwrap();
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].id, "msg_002");
    }

    #[test]
    fn sqlite_helpers_return_none_without_db() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(open_opencode_db(tmp.path()).is_none());
        assert!(scan_projects_from_db(tmp.path(), "src-1").is_none());
        assert!(load_sessions_from_db(tmp.path(), "proj1", "src-1").is_none());
        assert!(load_messages_from_db(tmp.path(), "ses_001", "proj1", "src-1").is_none());

        // Impls degrade gracefully to empty (no DB, no JSON dirs).
        assert!(scan_opencode_projects_impl(tmp.path(), "src-1").unwrap().is_empty());
        assert!(load_opencode_sessions_impl(tmp.path(), "proj1", "src-1").unwrap().is_empty());
        assert!(load_opencode_messages_impl(tmp.path(), "ses_001", "proj1", "src-1", 0, 20).unwrap().is_empty());
    }
}
