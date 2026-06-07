// ============================================================================
// CLINE / ROO CODE COMMANDS (v1.9.x)
// ============================================================================
// Tauri commands for detecting, validating, and loading Cline / Roo Code
// conversation history. The frontend ClineAdapter invokes these.
//
// PATTERN REFERENCE: src-tauri/src/commands/opencode.rs

use crate::commands::adapters::cline::{
    get_cline_base_path, load_cline_messages as adapter_load_messages,
    load_cline_sessions as adapter_load_sessions, parse_scheme_path,
    scan_cline_projects as adapter_scan_projects,
};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use std::path::PathBuf;

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Return the first available Cline/Roo extension base directory.
#[tauri::command]
pub async fn get_cline_path() -> Result<String, String> {
    match get_cline_base_path() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err(
            "CLINE_FOLDER_NOT_FOUND: No Cline or Roo Code installation found in any supported editor."
                .to_string(),
        ),
    }
}

/// Validate that a path is a Cline/Roo extension base directory.
/// Accepts dirs containing `state/taskHistory.json`, `tasks/_index.json`,
/// or a `tasks/` directory.
#[tauri::command]
pub async fn validate_cline_folder(path: String) -> Result<bool, String> {
    let base = PathBuf::from(&path);
    if !base.is_dir() {
        return Ok(false);
    }

    let has_cline_history = base.join("state").join("taskHistory.json").is_file();
    let has_roo_index = base.join("tasks").join("_index.json").is_file();
    let has_tasks_dir = base.join("tasks").is_dir();

    Ok(has_cline_history || has_roo_index || has_tasks_dir)
}

// ============================================================================
// PROJECT / SESSION / MESSAGE COMMANDS
// ============================================================================

/// Scan Cline/Roo projects for a given base directory.
#[tauri::command]
pub async fn scan_cline_projects(
    cline_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    let base = PathBuf::from(&cline_path);
    if !base.exists() {
        return Err(format!("CLINE_PATH_ERROR: Path does not exist: {}", cline_path));
    }
    adapter_scan_projects(&base, &source_id)
}

/// Load sessions for one Cline/Roo project.
///
/// `project_path` is the `cline://<base>|<cwd>` scheme path produced by the scan.
#[tauri::command]
pub async fn load_cline_sessions(
    project_path: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    let (base, cwd) = parse_scheme_path(&project_path)?;
    adapter_load_sessions(&base, &cwd, &source_id)
}

/// Load messages for one Cline/Roo session with pagination.
///
/// `session_path` is the `cline://<base>|<task_id>` scheme path.
#[tauri::command]
pub async fn load_cline_messages(
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let (base, task_id) = parse_scheme_path(&session_path)?;
    let source_id = format!("cline:{}", base.display());
    adapter_load_messages(
        &base,
        &task_id,
        &session_path,
        "",
        &source_id,
        offset,
        limit,
    )
}
