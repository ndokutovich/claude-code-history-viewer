// ============================================================================
// CLINE / ROO CODE COMMANDS (v1.9.x)
// ============================================================================
// Tauri commands for detecting, validating, and loading Cline / Roo Code
// conversation history. The frontend ClineAdapter invokes these.
//
// PATTERN REFERENCE: src-tauri/src/commands/opencode.rs

use crate::commands::adapters::cline::{
    cwd_for_task, get_cline_base_path, load_cline_messages as adapter_load_messages,
    load_cline_sessions as adapter_load_sessions, load_task_history, parse_scheme_path,
    scan_cline_projects as adapter_scan_projects,
};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use std::path::{Component, Path, PathBuf};

/// Reject relative paths and `..` traversal, then canonicalize before any
/// filesystem access. Mirrors `harden_antigravity_path`.
pub(crate) fn harden_cline_path(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err(format!(
            "CLINE_SECURITY_ERROR: Path must be absolute: {}",
            path.display()
        ));
    }
    if path.components().any(|c| c == Component::ParentDir) {
        return Err(format!(
            "CLINE_SECURITY_ERROR: Path traversal blocked: {}",
            path.display()
        ));
    }
    std::fs::canonicalize(path).map_err(|e| {
        format!("CLINE_PATH_ERROR: Cannot canonicalize {}: {}", path.display(), e)
    })
}

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
    let raw = PathBuf::from(&path);
    // Reject relative paths and `..` traversal before touching the filesystem.
    if !raw.is_absolute() || raw.components().any(|c| c == Component::ParentDir) {
        return Ok(false);
    }
    let base = match std::fs::canonicalize(&raw) {
        Ok(c) => c,
        Err(_) => return Ok(false),
    };
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
    let base = harden_cline_path(&base)?;
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
    let base = harden_cline_path(&base)?;
    let source_id = format!("cline:{}", base.display());
    let project_id = derive_project_id(&base, &task_id, &session_path);
    adapter_load_messages(
        &base,
        &task_id,
        &session_path,
        &project_id,
        &source_id,
        offset,
        limit,
    )
}

/// Derive the session's `project_id` (`cline://<base>|<cwd>`) by looking up the
/// task's initialization cwd in the task history. Falls back to the session
/// scheme path (`cline://<base>|<task_id>`) when no cwd is found.
fn derive_project_id(base: &Path, task_id: &str, session_path: &str) -> String {
    let history = load_task_history(base);
    match cwd_for_task(&history, task_id) {
        Some(cwd) => format!("cline://{}|{}", base.to_string_lossy(), cwd),
        None => session_path.to_string(),
    }
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_harden_cline_path_rejects_relative() {
        let err = harden_cline_path(Path::new("relative/path")).unwrap_err();
        assert!(err.contains("CLINE_SECURITY_ERROR"));
        assert!(err.contains("absolute"));
    }

    #[test]
    fn test_harden_cline_path_rejects_parent_dir() {
        // Absolute path containing `..` must be rejected before canonicalize.
        #[cfg(windows)]
        let p = Path::new("C:\\Users\\me\\..\\evil");
        #[cfg(not(windows))]
        let p = Path::new("/home/me/../evil");

        let err = harden_cline_path(p).unwrap_err();
        assert!(err.contains("CLINE_SECURITY_ERROR"));
        assert!(err.contains("traversal"));
    }

    #[test]
    fn test_derive_project_id_falls_back_to_session_path() {
        // Non-existent base → empty history → fallback to the session scheme path.
        #[cfg(windows)]
        let base = Path::new("C:\\does\\not\\exist\\globalStorage");
        #[cfg(not(windows))]
        let base = Path::new("/does/not/exist/globalStorage");

        let session_path = "cline://base|task-123";
        let pid = derive_project_id(base, "task-123", session_path);
        assert_eq!(pid, session_path);
    }
}
