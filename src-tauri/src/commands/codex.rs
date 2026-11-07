// ============================================================================
// CODEX CLI COMMANDS
// ============================================================================
// Tauri commands for detecting, validating, and loading Codex CLI sessions
//
// CLEAN CODE: Explicit types, standardized error prefixes, provider abstraction

use crate::commands::adapters::codex::*;
use crate::models::universal::*;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// PATH DETECTION COMMANDS
// ============================================================================

/// Get default Codex CLI installation path
/// Returns: ~/.codex/agent-sessions
/// CLEAN CODE: Explicit return type, standardized error messages
#[tauri::command]
pub async fn get_codex_path() -> Result<String, String> {
    let home_dir: PathBuf = dirs::home_dir()
        .ok_or("HOME_DIRECTORY_NOT_FOUND: Could not determine home directory")?;

    // Codex CLI stores sessions at ~/.codex/sessions (with YYYY/MM/DD subdirectories)
    let codex_path: PathBuf = home_dir.join(".codex").join("sessions");

    if !codex_path.exists() {
        return Err(format!(
            "CODEX_FOLDER_NOT_FOUND: Codex folder not found at {}",
            codex_path.display()
        ));
    }

    if fs::read_dir(&codex_path).is_err() {
        return Err(
            "CODEX_PERMISSION_DENIED: Cannot access Codex folder. Please check permissions."
                .to_string(),
        );
    }

    Ok(codex_path.to_string_lossy().to_string())
}

/// Validate Codex folder structure
/// Checks for rollout-*.jsonl files (recursively in YYYY/MM/DD subdirectories)
/// CLEAN CODE: Explicit return type, clear validation logic
#[tauri::command]
pub async fn validate_codex_folder(path: String) -> Result<bool, String> {
    let path_buf: PathBuf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    // Recursively check for rollout-*.jsonl files
    fn has_rollout_files(dir: &Path) -> std::io::Result<bool> {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                // Recurse into subdirectories
                if has_rollout_files(&path)? {
                    return Ok(true);
                }
            } else if path.is_file() {
                if crate::commands::adapters::codex::is_rollout_jsonl(&path) {
                    return Ok(true); // Found at least one valid rollout file
                }
            }
        }
        Ok(false)
    }

    match has_rollout_files(&path_buf) {
        Ok(found) => Ok(found),
        Err(_) => Ok(false),
    }
}

// ============================================================================
// PROJECT AND SESSION COMMANDS
// ============================================================================

/// Scan for Codex projects (rollout files grouped by session ID)
/// CLEAN CODE: Explicit return type, proper error handling
#[tauri::command]
pub async fn scan_codex_projects(
    codex_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    println!("🔍 Scanning Codex projects at: {}", codex_path);

    let path: &Path = Path::new(&codex_path);

    if !path.exists() {
        return Err(format!(
            "CODEX_PATH_ERROR: Path does not exist: {}",
            codex_path
        ));
    }

    // Recursively find all rollout files (handles YYYY/MM/DD subdirectories)
    fn find_rollout_files(dir: &Path, files: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();

                if path.is_dir() {
                    // Recurse into subdirectories
                    find_rollout_files(&path, files)?;
                } else if path.is_file() {
                    // Discoverable rollout: plain or zst, skipping a
                    // compressed twin whose plain file exists (upstream
                    // #74bdee28).
                    if crate::commands::adapters::codex::is_discoverable_rollout(&path) {
                        files.push(path);
                    }
                }
            }
        }
        Ok(())
    }

    let mut rollout_files: Vec<PathBuf> = Vec::new();
    find_rollout_files(path, &mut rollout_files)
        .map_err(|e| format!("CODEX_READ_ERROR: Failed to scan directory: {}", e))?;

    println!("📁 Found {} rollout file(s)", rollout_files.len());

    // Projects are WORKING DIRECTORIES, not sessions (upstream model): one
    // project per cwd, sessions inside are the rollout files recorded in
    // that directory. A cwd-less rollout falls into the "unknown" bucket.
    let mut by_cwd: HashMap<Option<String>, Vec<CodexFileMeta>> = HashMap::new();

    for file_path in rollout_files {
        if let Some(meta) = codex_file_meta(&file_path) {
            by_cwd.entry(meta.cwd.clone()).or_default().push(meta);
        }
    }

    let mut projects: Vec<UniversalProject> = Vec::new();

    for (cwd, sessions) in by_cwd {
        let cwd_str = cwd.clone().unwrap_or_else(|| "unknown".to_string());
        let display_name = Path::new(&cwd_str)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| "Codex".to_string());

        let first_activity_at = sessions
            .iter()
            .filter_map(|m| m.first_ts.clone())
            .min();
        let last_activity_at = sessions
            .iter()
            .filter_map(|m| m.last_ts.clone())
            .max();

        let mut metadata: HashMap<String, serde_json::Value> = HashMap::new();
        metadata.insert("cwd".to_string(), serde_json::json!(cwd_str)); // camelCase key style matches adapter
        metadata.insert("sessionCount".to_string(), serde_json::json!(sessions.len()));

        projects.push(UniversalProject {
            id: codex_project_id_for(cwd.as_deref()),
            source_id: source_id.clone(),
            provider_id: "codex".to_string(),
            name: display_name,
            path: cwd_str,
            session_count: sessions.len(),
            total_messages: sessions.iter().map(|m| m.message_count).sum(),
            first_activity_at,
            last_activity_at,
            metadata,
        });
    }

    // Most recently active first
    projects.sort_by(|a, b| b.last_activity_at.cmp(&a.last_activity_at));

    println!("✓ Found {} Codex projects", projects.len());
    Ok(projects)
}

/// Per-file metadata cache: parsing 576 rollouts (most zst-compressed) on
/// every project open is too slow, so scan results are cached keyed by
/// len+mtime. Upstream caches the same way (their #458/#591 perf wave).
struct CodexFileMeta {
    session_id: String,
    cwd: Option<String>,
    message_count: usize,
    first_ts: Option<String>,
    last_ts: Option<String>,
    /// First user message text — the session title. Cached so opening a
    /// project does not re-decompress every rollout.
    summary: Option<String>,
}

static CODEX_META_CACHE: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashMap<PathBuf, (u64, Option<std::time::SystemTime>, CodexFileMeta)>>,
> = std::sync::OnceLock::new();

fn codex_file_meta(path: &Path) -> Option<CodexFileMeta> {
    let meta_fs = fs::metadata(path).ok()?;
    let (len, mtime) = (meta_fs.len(), meta_fs.modified().ok());
    let cache = CODEX_META_CACHE.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()));
    if let Ok(guard) = cache.lock() {
        if let Some((c_len, c_mtime, cached)) = guard.get(path) {
            if *c_len == len && *c_mtime == mtime {
                return Some(CodexFileMeta {
                    session_id: cached.session_id.clone(),
                    cwd: cached.cwd.clone(),
                    message_count: cached.message_count,
                    first_ts: cached.first_ts.clone(),
                    last_ts: cached.last_ts.clone(),
                    summary: cached.summary.clone(),
                });
            }
        }
    }

    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
    let (_, uuid) = parse_rollout_filename(&filename)?;
    let events = parse_codex_jsonl(path).ok()?;
    let entry = CodexFileMeta {
        session_id: session_id_from_events(&events, &uuid),
        cwd: cwd_from_events(&events),
        message_count: events.len(),
        first_ts: events.first().and_then(|e| e.timestamp.clone()),
        last_ts: events.last().and_then(|e| e.timestamp.clone()),
        summary: summary_from_events(&events),
    };
    if let Ok(mut guard) = cache.lock() {
        guard.insert(path.to_path_buf(), (len, mtime, CodexFileMeta {
            session_id: entry.session_id.clone(),
            cwd: entry.cwd.clone(),
            message_count: entry.message_count,
            first_ts: entry.first_ts.clone(),
            summary: entry.summary.clone(),
            last_ts: entry.last_ts.clone(),
        }));
    }
    Some(entry)
}

/// Longest session-title preview taken from the first user message.
const SUMMARY_MAX_CHARS: usize = 100;

/// First user message, trimmed to a title-sized preview.
fn summary_from_events(events: &[CodexEvent]) -> Option<String> {
    events
        .iter()
        .find(|e| matches!(determine_role(e), MessageRole::User))
        .and_then(|e| e.payload.as_ref())
        .and_then(|p| p.get("content"))
        .and_then(|c| c.as_str())
        .map(|text| {
            if text.chars().count() > SUMMARY_MAX_CHARS {
                format!(
                    "{}...",
                    text.chars().take(SUMMARY_MAX_CHARS).collect::<String>()
                )
            } else {
                text.to_string()
            }
        })
}

/// Project scheme id for a cwd: `codex://<cwd>`; cwd-less sessions share
/// `codex://unknown`.
fn codex_project_id_for(cwd: Option<&str>) -> String {
    format!("codex://{}", cwd.unwrap_or("unknown"))
}

/// Load sessions for a Codex project
/// For Codex, each rollout file is a session
/// CLEAN CODE: Explicit return type, proper pagination
#[tauri::command]
pub async fn load_codex_sessions(
    _codex_path: String,
    project_path: String,
    project_id: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    println!("🔍 Loading Codex sessions for project: {}", project_id);

    // Project mode: project_path is a working directory (or the
    // `codex://unknown` bucket) — return every rollout recorded in it.
    // Legacy mode: project_path is a rollout FILE (pre-cwd-project UI
    // state) — that single file is the session.
    let file_path: PathBuf = PathBuf::from(&project_path);
    let is_file = file_path.is_file();

    if !is_file && project_path != "codex://unknown" {
        // cwd project (or legacy dead path) — enumerate matching rollouts
        let cwd_filter: Option<String> = if project_path == "codex://unknown" {
            None
        } else {
            Some(project_path.trim_start_matches("codex://").to_string())
        };

        let base = std::env::var("CODEX_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
                home.join(".codex").join("sessions")
            });

        let mut rollout_files: Vec<PathBuf> = Vec::new();
        fn find_rollout_files(dir: &Path, files: &mut Vec<PathBuf>) -> std::io::Result<()> {
            if dir.is_dir() {
                for entry in fs::read_dir(dir)? {
                    let entry = entry?;
                    let path = entry.path();
                    if path.is_dir() {
                        find_rollout_files(&path, files)?;
                    } else if crate::commands::adapters::codex::is_discoverable_rollout(&path) {
                        files.push(path);
                    }
                }
            }
            Ok(())
        }
        find_rollout_files(&base, &mut rollout_files)
            .map_err(|e| format!("CODEX_READ_ERROR: Failed to scan directory: {}", e))?;

        let mut sessions: Vec<UniversalSession> = Vec::new();
        for p in &rollout_files {
            let Some(meta) = codex_file_meta(p) else { continue };
            let matches = match (&meta.cwd, &cwd_filter) {
                (Some(c), Some(f)) => c == f,
                (None, None) => true,
                _ => false,
            };
            if matches {
                if let Ok(mut s) = build_codex_session(p, &source_id) {
                    s.project_id = project_id.clone();
                    sessions.push(s);
                }
            }
        }
        sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
        return Ok(sessions);
    }

    // Legacy single-file mode: project_path is a rollout file.
    if !file_path.exists() {
        return Err(format!(
            "CODEX_FILE_ERROR: Session file not found: {}",
            project_path
        ));
    }

    let mut session = build_codex_session(&file_path, &source_id)?;
    session.project_id = project_id;
    return Ok(vec![session]);
}

/// Build one UniversalSession from a rollout file (plain or zst).
///
/// Uses the len+mtime metadata cache: a project with hundreds of rollouts
/// must not re-decompress every archive just to list its sessions.
fn build_codex_session(file_path: &Path, source_id: &str) -> Result<UniversalSession, String> {
    let meta = codex_file_meta(file_path)
        .ok_or_else(|| format!("CODEX_FILE_ERROR: Cannot read rollout {}", file_path.display()))?;
    build_codex_session_from_meta(file_path, &meta, source_id)
}

fn build_codex_session_from_meta(
    file_path: &Path,
    meta: &CodexFileMeta,
    source_id: &str,
) -> Result<UniversalSession, String> {
    let message_count: usize = meta.message_count;

    // Extract session ID from first event or filename
    let filename: String = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let (timestamp_str, uuid) = parse_rollout_filename(&filename)
        .ok_or("CODEX_PARSE_ERROR: Invalid rollout filename format")?;

    let session_id: String = meta.session_id.clone();
    let _ = &uuid;

    // CWD comes from the cached metadata (same fork-aware extraction).
    let cwd: Option<String> = meta.cwd.clone();

    // Metadata with camelCase keys
    let mut metadata: HashMap<String, serde_json::Value> = HashMap::new();
    metadata.insert("filePath".to_string(), serde_json::json!(file_path.to_string_lossy().to_string())); // camelCase!
    metadata.insert("rolloutFile".to_string(), serde_json::json!(filename)); // camelCase!

    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), serde_json::json!(cwd_path));
    }

    let summary: Option<String> = meta.summary.clone();

    // Timestamps from the cached metadata.
    let first_timestamp = meta
        .first_ts
        .clone()
        .unwrap_or_else(|| timestamp_str.replace('-', ":"));
    let last_timestamp = meta
        .last_ts
        .clone()
        .unwrap_or_else(|| first_timestamp.clone());

    // Calculate duration (placeholder - we don't have precise timing data)
    let duration: i64 = 0;

    // Title for the session
    let title = summary.clone().unwrap_or_else(|| format!("Codex Session {}", session_id.chars().take(8).collect::<String>()));

    let session: UniversalSession = UniversalSession {
        id: session_id.clone(),
        project_id: String::new(),
        source_id: source_id.to_string(),
        provider_id: "codex".to_string(),
        title,
        description: summary,
        message_count,
        first_message_at: first_timestamp,
        last_message_at: last_timestamp,
        duration,
        total_tokens: None,
        tool_call_count: 0,
        error_count: 0,
        entrypoint: None,
        metadata,
        checksum: format!("{:x}", session_id.len()), // Simple checksum placeholder
    };

    Ok(session)
}

/// Load messages for a Codex session (paginated)
/// CLEAN CODE: Explicit types, proper pagination, camelCase metadata
#[tauri::command]
pub async fn load_codex_messages(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    println!(
        "📄 Loading Codex messages: offset={}, limit={}",
        offset, limit
    );

    let file_path: PathBuf = PathBuf::from(&session_path);

    // Parse JSONL file
    let events: Vec<CodexEvent> = parse_codex_jsonl(&file_path)?;

    // Extract session ID from filename
    let filename: String = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let (_, uuid) = parse_rollout_filename(&filename)
        .ok_or("CODEX_PARSE_ERROR: Invalid rollout filename format")?;

    // Filter and convert events to UniversalMessages
    // Only process events that are actual messages (response_item with type: message)
    let mut messages: Vec<UniversalMessage> = events
        .iter()
        .enumerate()
        .filter(|(_, event)| {
            // Include response_item events with payload.type == "message"
            if event.event_type == "response_item" {
                if let Some(ref payload) = event.payload {
                    if let Some(msg_type) = payload.get("type").and_then(|t| t.as_str()) {
                        // reasoning items render as thinking blocks (upstream #610)
                        return msg_type == "message" || msg_type == "reasoning";
                    }
                }
            }
            // Also include event_msg events (backup)
            event.event_type == "event_msg"
        })
        .map(|(idx, event)| {
            // One id for the whole file: a fork's replayed source events
            // must not re-tag messages with the source session id.
            let session_id: String = session_id_from_events(&events, &uuid);
            let mut msg: UniversalMessage = codex_event_to_universal(
                event,
                "codex".to_string(), // project_id
                session_path.clone(), // source_id
                idx as i32,
                &session_path,
            );
            msg.session_id = session_id;
            msg
        })
        .collect();

    // Apply pagination
    let total: usize = messages.len();
    let start: usize = offset.min(total);
    let end: usize = (offset + limit).min(total);

    messages = messages[start..end].to_vec();

    println!("✓ Loaded {} messages ({}..{} of {})", messages.len(), start, end, total);
    Ok(messages)
}

// ============================================================================
// HELPER FUNCTION (re-exported from adapter for use in commands)
// ============================================================================

fn determine_role(event: &CodexEvent) -> MessageRole {
    match event.event_type.as_str() {
        "user_message" | "user_input" | "user" => MessageRole::User,
        "assistant_message" | "assistant_response" | "assistant" => MessageRole::Assistant,
        "system_message" | "system" => MessageRole::System,
        _ => MessageRole::Assistant,
    }
}

#[cfg(test)]
mod cwd_project_tests {
    use super::*;

    fn write_rollout(dir: &Path, name: &str, cwd: Option<&str>) -> PathBuf {
        let n = name.chars().filter(|c| c.is_ascii_digit()).count() % 10;
        let ts = format!("2026-01-01T00:00:0{n}Z");
        let mut lines: Vec<String> = Vec::new();
        if let Some(cwd) = cwd {
            lines.push(format!(
                "{{\"type\":\"session_meta\",\"timestamp\":\"{ts}\",\"payload\":{{\"id\":\"sess-{name}\",\"cwd\":\"{cwd}\"}}}}"
            ));
        }
        lines.push(format!(
            "{{\"type\":\"user_message\",\"timestamp\":\"{ts}\",\"payload\":{{\"content\":\"hi {name}\"}}}}"
        ));
        let path = dir.join(name);
        std::fs::write(&path, lines.join("
") + "
").unwrap();
        path
    }

    #[tokio::test]
    async fn scan_groups_projects_by_cwd_not_by_session() {
        let tmp = tempfile::tempdir().unwrap();
        let sessions = tmp.path().join("sessions");
        std::fs::create_dir_all(&sessions).unwrap();

        write_rollout(&sessions, "rollout-2026-01-01T00-00-01-aaaaaaaa-0000-0000-0000-000000000001.jsonl", Some("w:/proj/alpha"));
        write_rollout(&sessions, "rollout-2026-01-01T00-00-02-aaaaaaaa-0000-0000-0000-000000000002.jsonl", Some("w:/proj/alpha"));
        write_rollout(&sessions, "rollout-2026-01-01T00-00-03-bbbbbbbb-0000-0000-0000-000000000003.jsonl", Some("w:/proj/beta"));
        // No cwd -> unknown bucket
        write_rollout(&sessions, "rollout-2026-01-01T00-00-04-cccccccc-0000-0000-0000-000000000004.jsonl", None);

        let projects = scan_codex_projects(
            sessions.to_string_lossy().to_string(),
            "src".to_string(),
        )
        .await
        .unwrap();

        assert_eq!(projects.len(), 3, "alpha + beta + unknown: {projects:?}");
        let alpha = projects.iter().find(|p| p.name == "alpha").unwrap();
        assert_eq!(alpha.session_count, 2);
        assert_eq!(alpha.id, "codex://w:/proj/alpha");
        assert_eq!(alpha.path, "w:/proj/alpha");

        let unknown = projects.iter().find(|p| p.id == "codex://unknown").unwrap();
        assert_eq!(unknown.session_count, 1);
    }
}

#[cfg(test)]
mod meta_cache_tests {
    use super::*;

    #[test]
    fn build_session_reads_cached_meta_without_reparsing() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join(
            "rollout-2026-01-01T00-00-00-dddddddd-0000-0000-0000-00000000000d.jsonl",
        );
        std::fs::write(
            &path,
            concat!(
                r#"{"type":"session_meta","timestamp":"2026-01-01T00:00:00Z","payload":{"id":"sess-x","cwd":"w:/proj/x"}}"#,
                "\n",
                r#"{"type":"user_message","timestamp":"2026-01-01T00:00:01Z","payload":{"content":"Refactor the parser"}}"#,
                "\n",
            ),
        )
        .unwrap();

        let meta = codex_file_meta(&path).expect("meta from file");
        assert_eq!(meta.session_id, "sess-x");
        assert_eq!(meta.cwd.as_deref(), Some("w:/proj/x"));
        assert_eq!(meta.summary.as_deref(), Some("Refactor the parser"));

        let session = build_codex_session_from_meta(&path, &meta, "src").unwrap();
        assert_eq!(session.id, "sess-x");
        assert_eq!(session.title, "Refactor the parser");
        assert_eq!(session.message_count, 2);
        assert_eq!(
            session.metadata.get("cwd").and_then(|v| v.as_str()),
            Some("w:/proj/x")
        );
    }
}
