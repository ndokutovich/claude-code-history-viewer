// ============================================================================
// OPENCODE COMMANDS (v1.9.0)
// ============================================================================
// Tauri commands for detecting, validating, and loading OpenCode sessions.
//
// PATTERN REFERENCE: src-tauri/src/commands/codex.rs
// CLEAN CODE: Explicit types, standardized error prefixes

use crate::commands::adapters::opencode::*;
use crate::models::universal::*;
use std::fs;
use std::path::PathBuf;

// ============================================================================
// PATH DETECTION COMMANDS
// ============================================================================

/// Get the OpenCode base path using environment variable detection order.
/// Returns the path string or OPENCODE_FOLDER_NOT_FOUND error.
#[tauri::command]
pub async fn get_opencode_path() -> Result<String, String> {
    match get_opencode_base_path() {
        Some(path) => {
            // Verify we can read the directory
            if fs::read_dir(&path).is_err() {
                return Err(
                    "OPENCODE_PERMISSION_DENIED: Cannot access OpenCode folder. Please check permissions."
                        .to_string(),
                );
            }
            Ok(path.to_string_lossy().to_string())
        }
        None => Err(
            "OPENCODE_FOLDER_NOT_FOUND: OpenCode folder not found. Check $OPENCODE_HOME, \
             $XDG_DATA_HOME/opencode, ~/.local/share/opencode, or %APPDATA%/opencode"
                .to_string(),
        ),
    }
}

/// Validate an OpenCode folder path.
/// Returns true if the storage/ subdirectory exists and is accessible.
#[tauri::command]
pub async fn validate_opencode_folder(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    // OpenCode stores all data under storage/
    let storage_path = path_buf.join("storage");
    if !storage_path.exists() || !storage_path.is_dir() {
        return Ok(false);
    }

    // Verify we can read the storage directory
    if fs::read_dir(&storage_path).is_err() {
        return Ok(false);
    }

    Ok(true)
}

// ============================================================================
// PROJECT AND SESSION COMMANDS
// ============================================================================

/// Scan all OpenCode projects from storage/project/{id}.json files.
#[tauri::command]
pub async fn scan_opencode_projects(
    opencode_path: String,
    source_id: String,
) -> Result<Vec<UniversalProject>, String> {
    println!("Scanning OpenCode projects at: {}", opencode_path);

    let path_buf = PathBuf::from(&opencode_path);

    if !path_buf.exists() {
        return Err(format!(
            "OPENCODE_PATH_ERROR: Path does not exist: {}",
            opencode_path
        ));
    }

    let projects = scan_opencode_projects_impl(&path_buf, &source_id)?;

    println!("Found {} OpenCode project(s)", projects.len());
    Ok(projects)
}

/// Load sessions for one OpenCode project from storage/session/{project-id}/{id}.json.
#[tauri::command]
pub async fn load_opencode_sessions(
    opencode_path: String,
    project_id: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    println!(
        "Loading OpenCode sessions for project: {}",
        project_id
    );

    let path_buf = PathBuf::from(&opencode_path);

    if !path_buf.exists() {
        return Err(format!(
            "OPENCODE_PATH_ERROR: Path does not exist: {}",
            opencode_path
        ));
    }

    let sessions = load_opencode_sessions_impl(&path_buf, &project_id, &source_id)?;

    println!("Loaded {} OpenCode session(s)", sessions.len());
    Ok(sessions)
}

/// Load messages for one OpenCode session with pagination.
#[tauri::command]
pub async fn load_opencode_messages(
    opencode_path: String,
    session_id: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    println!(
        "Loading OpenCode messages: session={}, offset={}, limit={}",
        session_id, offset, limit
    );

    let path_buf = PathBuf::from(&opencode_path);

    if !path_buf.exists() {
        return Err(format!(
            "OPENCODE_PATH_ERROR: Path does not exist: {}",
            opencode_path
        ));
    }

    let messages = load_opencode_messages_impl(&path_buf, &session_id, offset, limit)?;

    println!("Loaded {} OpenCode message(s)", messages.len());
    Ok(messages)
}
