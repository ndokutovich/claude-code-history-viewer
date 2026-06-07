// ============================================================================
// ANTIGRAVITY COMMANDS (v1.9.x)
// ============================================================================
// Tauri commands for detecting, validating, and loading Antigravity
// conversation history. The frontend AntigravityAdapter invokes these.
//
// NOTE: Antigravity `.pb` transcript bodies are NOT decoded (no public schema).
// Sessions/metadata come from manifest.json + usage.jsonl; message bodies are
// surfaced as a clear notice + token-usage metadata. See the adapter module.
//
// PATTERN REFERENCE: src-tauri/src/commands/cline.rs

use crate::commands::adapters::antigravity::{
    get_antigravity_base_path, load_antigravity_messages as adapter_load_messages,
    load_antigravity_sessions as adapter_load_sessions, parse_scheme_path,
    scan_antigravity_projects as adapter_scan_projects,
};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use std::path::PathBuf;

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Return the first available Antigravity root directory.
#[tauri::command]
pub async fn get_antigravity_path() -> Result<String, String> {
    match get_antigravity_base_path() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err(
            "ANTIGRAVITY_FOLDER_NOT_FOUND: No Antigravity installation found.".to_string(),
        ),
    }
}

/// Validate that a path is an Antigravity root directory.
/// Accepts dirs containing `brain/`, `conversations/`, or `monitor-state.json`.
#[tauri::command]
pub async fn validate_antigravity_folder(path: String) -> Result<bool, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Ok(false);
    }
    let has_brain = root.join("brain").is_dir();
    let has_conversations = root.join("conversations").is_dir();
    let has_monitor_state = root.join("monitor-state.json").is_file();
    Ok(has_brain || has_conversations || has_monitor_state)
}

// ============================================================================
// PROJECT / SESSION / MESSAGE COMMANDS
// ============================================================================

/// Scan Antigravity projects for a given root directory.
#[tauri::command]
pub async fn scan_antigravity_projects(
    antigravity_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    let root = PathBuf::from(&antigravity_path);
    if !root.exists() {
        return Err(format!(
            "ANTIGRAVITY_PATH_ERROR: Path does not exist: {}",
            antigravity_path
        ));
    }
    adapter_scan_projects(&root, &source_id)
}

/// Load sessions for the Antigravity project.
///
/// `project_path` is the `antigravity://<root>` scheme path produced by the scan.
#[tauri::command]
pub async fn load_antigravity_sessions(
    project_path: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    let (root, _) = parse_scheme_path(&project_path)?;
    adapter_load_sessions(&root, &source_id)
}

/// Load messages for one Antigravity session with pagination.
///
/// `session_path` is the `antigravity://<root>|<session_id>` scheme path.
#[tauri::command]
pub async fn load_antigravity_messages(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let (root, session_id) = parse_scheme_path(&session_path)?;
    let source_id = format!("antigravity:{}", root.display());
    adapter_load_messages(
        &root,
        &session_id,
        &session_path,
        "",
        &source_id,
        offset,
        limit,
    )
}
