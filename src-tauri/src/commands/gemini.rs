use crate::commands::adapters::gemini::*;
use crate::models::universal::*;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

// Global Gemini hash resolver (thread-safe)
pub struct GeminiResolverState(pub Mutex<GeminiHashResolver>);

// ============================================================================
// PATH DETECTION COMMANDS
// ============================================================================

#[tauri::command]
pub async fn get_gemini_path() -> Result<String, String> {
    let home_dir =
        dirs::home_dir().ok_or("HOME_DIRECTORY_NOT_FOUND: Could not determine home directory")?;

    // Gemini CLI stores sessions at ~/.gemini/tmp
    let gemini_path = home_dir.join(".gemini");

    if !gemini_path.exists() {
        return Err(format!(
            "GEMINI_FOLDER_NOT_FOUND: Gemini folder not found at {}",
            gemini_path.display()
        ));
    }

    if std::fs::read_dir(&gemini_path).is_err() {
        return Err(
            "PERMISSION_DENIED: Cannot access Gemini folder. Please check permissions.".to_string(),
        );
    }

    Ok(gemini_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn validate_gemini_folder(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    // Check for .gemini/tmp directory structure
    if path_buf.file_name().and_then(|n| n.to_str()) == Some(".gemini") {
        let tmp_path = path_buf.join("tmp");
        return Ok(tmp_path.exists() && tmp_path.is_dir());
    }

    // Also accept if the path contains .gemini as a subdirectory
    let gemini_path = path_buf.join(".gemini");
    if gemini_path.exists() && gemini_path.is_dir() {
        let tmp_path = gemini_path.join("tmp");
        return Ok(tmp_path.exists() && tmp_path.is_dir());
    }

    Ok(false)
}

// ============================================================================
// PROJECT AND SESSION COMMANDS
// ============================================================================

#[tauri::command]
pub async fn scan_gemini_projects(
    gemini_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    println!("🔍 Scanning Gemini projects at: {}", gemini_path);
    let path = Path::new(&gemini_path).join("tmp");
    gemini_sessions_to_projects(&path, source_id)
}

#[tauri::command]
pub async fn load_gemini_sessions(
    _gemini_path: String,
    project_path: String,
    project_id: String,
    source_id: String,
    resolver: State<'_, GeminiResolverState>,
) -> Result<Vec<UniversalSession>, String> {
    let resolver_guard = resolver
        .0
        .lock()
        .map_err(|e| format!("Failed to lock resolver: {}", e))?;

    // Find all session files in project directory
    let project_dir = Path::new(&project_path);

    // Use the find_gemini_sessions helper (need to make it public or recreate logic here)
    let mut sessions = Vec::new();

    // Recreate logic from find_gemini_sessions
    fn visit_dirs(dir: &Path, sessions: &mut Vec<std::path::PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, sessions)?;
                } else if let Some(name) = path.file_name() {
                    if let Some(name_str) = name.to_str() {
                        if name_str.starts_with("session-") && name_str.ends_with(".json") {
                            sessions.push(path);
                        }
                    }
                }
            }
        }
        Ok(())
    }

    let mut session_files = Vec::new();
    visit_dirs(project_dir, &mut session_files)
        .map_err(|e| format!("Failed to scan sessions: {}", e))?;

    for file in session_files {
        match gemini_file_to_session(
            &file,
            project_id.clone(),
            source_id.clone(),
            &resolver_guard,
        ) {
            Ok(session) => sessions.push(session),
            Err(e) => {
                eprintln!("Failed to parse Gemini session {}: {}", file.display(), e);
                // Continue with other sessions (graceful degradation)
            }
        }
    }

    Ok(sessions)
}

#[tauri::command]
pub async fn load_gemini_messages(
    session_path: String,
    session_id: String,
    project_id: String,
    source_id: String,
) -> Result<Vec<UniversalMessage>, String> {
    let path = Path::new(&session_path);

    // Read JSON file
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read Gemini session: {}", e))?;

    let session: GeminiSession = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse Gemini session: {}", e))?;

    // Extract messages
    let messages = session
        .messages
        .or(session.history)
        .unwrap_or_else(Vec::new);

    // Convert to UniversalMessage
    let mut universal_messages = Vec::new();
    for (i, msg_value) in messages.iter().enumerate() {
        match gemini_message_to_universal(
            msg_value,
            session_id.clone(),
            project_id.clone(),
            source_id.clone(),
            i as i32,
        ) {
            Ok(msg) => universal_messages.push(msg),
            Err(e) => {
                eprintln!("Failed to parse Gemini message {}: {}", i, e);
                // Continue with other messages
            }
        }
    }

    Ok(universal_messages)
}

#[tauri::command]
pub async fn seed_gemini_resolver(
    sessions: Vec<UniversalSession>,
    resolver: State<'_, GeminiResolverState>,
) -> Result<(), String> {
    let mut resolver_guard = resolver
        .0
        .lock()
        .map_err(|e| format!("Failed to lock resolver: {}", e))?;

    resolver_guard.seed_from_sessions(&sessions);

    Ok(())
}
