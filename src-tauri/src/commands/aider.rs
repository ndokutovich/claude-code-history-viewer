// ============================================================================
// AIDER COMMANDS (v1.9.x)
// ============================================================================
// Tauri commands for detecting, validating, and loading Aider conversation
// history. The frontend AiderAdapter invokes these.
//
// PATTERN REFERENCE: src-tauri/src/commands/cline.rs

use crate::commands::adapters::aider::{
    get_aider_base_path, load_aider_messages as adapter_load_messages,
    load_aider_sessions as adapter_load_sessions, parse_scheme_path,
    scan_aider_projects as adapter_scan_projects,
};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use std::path::PathBuf;

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Return the first available Aider search directory containing chat history.
#[tauri::command]
pub async fn get_aider_path() -> Result<String, String> {
    match get_aider_base_path() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err(
            "AIDER_FOLDER_NOT_FOUND: No Aider chat history (.aider.chat.history.md) found."
                .to_string(),
        ),
    }
}

/// Validate that a path is an Aider project directory or history file.
/// Accepts a directory containing `.aider.chat.history.md`, or the file itself.
#[tauri::command]
pub async fn validate_aider_folder(path: String) -> Result<bool, String> {
    let p = PathBuf::from(&path);
    if p.is_file() {
        return Ok(p
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| n == ".aider.chat.history.md")
            .unwrap_or(false));
    }
    if p.is_dir() {
        return Ok(p.join(".aider.chat.history.md").is_file());
    }
    Ok(false)
}

// ============================================================================
// PROJECT / SESSION / MESSAGE COMMANDS
// ============================================================================

/// Scan Aider projects across the standard search directories.
/// `aider_path` is accepted for interface parity but discovery is automatic.
#[tauri::command]
pub async fn scan_aider_projects(
    aider_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    let _ = aider_path; // discovery is auto across home search dirs
    adapter_scan_projects(&source_id)
}

/// Load the session for one Aider project.
///
/// `project_path` is the `aider://<project_dir>` scheme path produced by scan.
#[tauri::command]
pub async fn load_aider_sessions(
    project_path: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    let dir = parse_scheme_path(&project_path)?;
    adapter_load_sessions(&dir, &source_id)
}

/// Load messages for one Aider session with pagination.
///
/// `session_path` is the `aider://<history_file>` scheme path.
#[tauri::command]
pub async fn load_aider_messages(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let history_path = parse_scheme_path(&session_path)?;
    let project_id = history_path
        .parent()
        .map(|p| format!("aider://{}", p.to_string_lossy()))
        .unwrap_or_default();
    let source_id = format!("aider:{}", history_path.display());
    adapter_load_messages(
        &history_path,
        &session_path,
        &project_id,
        &source_id,
        offset,
        limit,
    )
}
