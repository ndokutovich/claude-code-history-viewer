// ============================================================================
// FORGECODE COMMANDS (v1.9.x)
// ============================================================================
// Tauri commands for detecting, validating, and loading ForgeCode conversation
// history. The frontend ForgeCodeAdapter invokes these.
//
// PATTERN REFERENCE: src-tauri/src/commands/cline.rs
//
// Unlike Cline, the ForgeCode scheme path (forgecode://<workspace>/<conversation>)
// does NOT embed the base directory, so the session/message commands resolve the
// base via `get_forgecode_base_path()` (mirroring the OpenCode pattern).

use crate::commands::adapters::forgecode::{
    get_forgecode_base_path, load_forgecode_messages as adapter_load_messages,
    load_forgecode_sessions as adapter_load_sessions, parse_project_path, parse_session_path,
    scan_forgecode_projects as adapter_scan_projects,
};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use std::path::PathBuf;

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Return the resolved ForgeCode base directory ($FORGE_CONFIG or ~/.forge).
#[tauri::command]
pub async fn get_forgecode_path() -> Result<String, String> {
    match get_forgecode_base_path() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err(
            "FORGECODE_FOLDER_NOT_FOUND: No ForgeCode installation found ($FORGE_CONFIG or ~/.forge)."
                .to_string(),
        ),
    }
}

/// Validate that a path is a ForgeCode base directory.
///
/// All data loading is backed by `.forge.db`, so a directory is only valid when
/// that database exists. Relative paths and `..` traversal are rejected, and the
/// path is canonicalized before filesystem access.
#[tauri::command]
pub async fn validate_forgecode_folder(path: String) -> Result<bool, String> {
    let base = PathBuf::from(&path);
    if !base.is_absolute() || base.components().any(|c| c == std::path::Component::ParentDir) {
        return Ok(false);
    }
    let base = match std::fs::canonicalize(&base) {
        Ok(p) => p,
        Err(_) => return Ok(false),
    };
    if !base.is_dir() {
        return Ok(false);
    }

    Ok(base.join(".forge.db").is_file())
}

// ============================================================================
// PROJECT / SESSION / MESSAGE COMMANDS
// ============================================================================

/// Scan ForgeCode projects for a given base directory.
#[tauri::command]
pub async fn scan_forgecode_projects(
    forgecode_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    let base = PathBuf::from(&forgecode_path);
    if !base.exists() {
        return Err(format!(
            "FORGECODE_PATH_ERROR: Path does not exist: {}",
            forgecode_path
        ));
    }
    adapter_scan_projects(&base, &source_id)
}

/// Load sessions for one ForgeCode project.
///
/// `project_path` is the `forgecode://<workspace_id>` scheme path from the scan.
#[tauri::command]
pub async fn load_forgecode_sessions(
    project_path: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    let base = get_forgecode_base_path()
        .ok_or_else(|| "FORGECODE_FOLDER_NOT_FOUND: ForgeCode base path not found".to_string())?;
    let workspace_id = parse_project_path(&project_path)?;
    adapter_load_sessions(&base, &workspace_id, &source_id)
}

/// Load messages for one ForgeCode session with pagination.
///
/// `session_path` is the `forgecode://<workspace_id>/<conversation_id>` path.
#[tauri::command]
pub async fn load_forgecode_messages(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let base = get_forgecode_base_path()
        .ok_or_else(|| "FORGECODE_FOLDER_NOT_FOUND: ForgeCode base path not found".to_string())?;
    let (workspace_id, conversation_id) = parse_session_path(&session_path)?;
    let project_path = format!("forgecode://{}", workspace_id);
    let source_id = format!("forgecode:{}", base.display());
    adapter_load_messages(
        &base,
        &workspace_id,
        &conversation_id,
        &session_path,
        &project_path,
        &source_id,
        offset,
        limit,
    )
}
