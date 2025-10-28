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
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.starts_with("rollout-") && filename.ends_with(".jsonl") {
                        return Ok(true); // Found at least one valid rollout file
                    }
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

    // Group rollout files by session ID
    let mut session_groups: HashMap<String, Vec<PathBuf>> = HashMap::new();

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
                    let filename = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");

                    // Check if it's a rollout file
                    if filename.starts_with("rollout-") && filename.ends_with(".jsonl") {
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

    for file_path in rollout_files {
        let filename: String = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        // Parse filename to extract UUID
        if let Some((_, uuid)) = parse_rollout_filename(&filename) {
            // Try to get actual session ID from file
            let session_id: String = match parse_codex_jsonl(&file_path) {
                Ok(events) => {
                    if let Some(first_event) = events.first() {
                        extract_session_id(first_event, &uuid)
                    } else {
                        uuid.clone()
                    }
                }
                Err(_) => uuid.clone(), // Fallback to UUID if parse fails
            };

            session_groups
                .entry(session_id)
                .or_insert_with(Vec::new)
                .push(file_path);
        }
    }

    // Convert session groups to UniversalProjects
    let mut projects: Vec<UniversalProject> = Vec::new();

    for (session_id, files) in session_groups {
        // Use first file to extract metadata
        let first_file: &PathBuf = files.first().ok_or("CODEX_ERROR: Empty file group")?;

        let display_name: String = format!("Codex Session {}", &session_id[..8]);

        let mut metadata: HashMap<String, serde_json::Value> = HashMap::new();
        metadata.insert("sessionId".to_string(), serde_json::json!(session_id)); // camelCase!
        metadata.insert("fileCount".to_string(), serde_json::json!(files.len())); // camelCase!

        projects.push(UniversalProject {
            id: session_id.clone(),
            source_id: source_id.clone(),
            provider_id: "codex".to_string(),
            name: display_name,
            path: first_file.to_string_lossy().to_string(),
            session_count: files.len(),
            total_messages: 0, // TODO: Count messages across all sessions
            first_activity_at: None,
            last_activity_at: None,
            metadata,
        });
    }

    // Sort by session ID (most recent first)
    projects.sort_by(|a, b| b.id.cmp(&a.id));

    println!("✓ Found {} Codex projects", projects.len());
    Ok(projects)
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

    // For Codex, the project_path points to a rollout file
    // We treat each rollout file as a session
    let file_path: PathBuf = PathBuf::from(&project_path);

    if !file_path.exists() {
        return Err(format!(
            "CODEX_FILE_ERROR: Session file not found: {}",
            project_path
        ));
    }

    // Parse JSONL to get message count and metadata
    let events: Vec<CodexEvent> = parse_codex_jsonl(&file_path)?;
    let message_count: usize = events.len();

    // Extract session ID from first event or filename
    let filename: String = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let (timestamp_str, uuid) = parse_rollout_filename(&filename)
        .ok_or("CODEX_PARSE_ERROR: Invalid rollout filename format")?;

    let session_id: String = if let Some(first_event) = events.first() {
        extract_session_id(first_event, &uuid)
    } else {
        uuid.clone()
    };

    // Extract CWD from first event
    let cwd: Option<String> = events
        .first()
        .and_then(|e| e.environment_context.as_ref())
        .and_then(|ctx| ctx.get("cwd"))
        .and_then(|v| v.as_str())
        .map(String::from);

    // Metadata with camelCase keys
    let mut metadata: HashMap<String, serde_json::Value> = HashMap::new();
    metadata.insert("filePath".to_string(), serde_json::json!(project_path)); // camelCase!
    metadata.insert("rolloutFile".to_string(), serde_json::json!(filename)); // camelCase!

    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), serde_json::json!(cwd_path));
    }

    // Create summary from first user event
    let summary: Option<String> = events
        .iter()
        .find(|e| matches!(determine_role(e), MessageRole::User))
        .and_then(|e| e.payload.as_ref())
        .and_then(|p| p.get("content"))
        .and_then(|c| c.as_str())
        .map(|text| {
            if text.len() > 100 {
                format!("{}...", &text[..100])
            } else {
                text.to_string()
            }
        });

    // Extract timestamps from events
    let first_timestamp = events.first()
        .and_then(|e| e.timestamp.clone())
        .unwrap_or_else(|| timestamp_str.replace('-', ":"));
    let last_timestamp = events.last()
        .and_then(|e| e.timestamp.clone())
        .unwrap_or_else(|| first_timestamp.clone());

    // Calculate duration (placeholder - we don't have precise timing data)
    let duration: i64 = 0;

    // Title for the session
    let title = summary.clone().unwrap_or_else(|| format!("Codex Session {}", &session_id[..8]));

    let session: UniversalSession = UniversalSession {
        id: session_id.clone(),
        project_id,
        source_id,
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
        metadata,
        checksum: format!("{:x}", session_id.len()), // Simple checksum placeholder
    };

    Ok(vec![session])
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
                        return msg_type == "message";
                    }
                }
            }
            // Also include event_msg events (backup)
            event.event_type == "event_msg"
        })
        .map(|(idx, event)| {
            let session_id: String = extract_session_id(event, &uuid);
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
