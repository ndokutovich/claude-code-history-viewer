// ============================================================================
// OPENCODE COMMANDS (v1.9.0)
// ============================================================================
// Tauri commands for detecting, validating, and loading OpenCode sessions.
//
// PATTERN REFERENCE: src-tauri/src/commands/codex.rs
// CLEAN CODE: Explicit types, standardized error prefixes

use crate::commands::adapters::opencode::*;
use crate::commands::rename::NativeRenameResult;
use crate::models::universal::*;
use serde_json;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

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
    project_id: Option<String>,
    source_id: Option<String>,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    println!(
        "Loading OpenCode messages: path={}, session={}, offset={}, limit={}",
        opencode_path, session_id, offset, limit
    );

    let path_buf = PathBuf::from(&opencode_path);

    if !path_buf.exists() {
        return Err(format!(
            "OPENCODE_PATH_ERROR: Path does not exist: {}",
            opencode_path
        ));
    }

    let proj_id = project_id.as_deref().unwrap_or("");
    let src_id = source_id.as_deref().unwrap_or("");

    let messages =
        load_opencode_messages_impl(&path_buf, &session_id, proj_id, src_id, offset, limit)?;

    println!("Loaded {} OpenCode message(s)", messages.len());
    Ok(messages)
}

// ============================================================================
// SESSION RENAMING
// ============================================================================

/// Rename an OpenCode session by updating the `title` field in its JSON file.
///
/// OpenCode sessions are stored as individual JSON files:
///   `{base}/storage/session/{project_id}/{session_id}.json`
///
/// This command updates the `title` field atomically (temp file → rename).
///
/// # Arguments
/// * `file_path` - Absolute path to the session JSON file
/// * `new_title` - New title (empty string to clear the title)
#[tauri::command]
pub async fn rename_opencode_session_native(
    file_path: String,
    new_title: String,
) -> Result<NativeRenameResult, String> {
    let path_buf = PathBuf::from(&file_path);

    // 1. Validate path exists
    if !path_buf.exists() {
        return Err(format!("Session file not found: {}", file_path));
    }

    // 2. Must be a .json file
    if path_buf.extension().and_then(|e| e.to_str()) != Some("json") {
        return Err("Expected a .json session file".to_string());
    }

    // 3. Must be an absolute path
    if !path_buf.is_absolute() {
        return Err("File path must be absolute".to_string());
    }

    // 4. Block .. traversal components before canonicalizing
    {
        use std::path::Component;
        for component in path_buf.components() {
            if component == Component::ParentDir {
                return Err("Path traversal (..) is not allowed".to_string());
            }
        }
    }

    // 5. Canonicalize and verify the path contains "storage" then "session" components
    let canonical = fs::canonicalize(&path_buf)
        .map_err(|e| format!("Failed to canonicalize path: {}", e))?;

    {
        use std::path::Component;
        let components: Vec<_> = canonical.components().collect();
        let has_storage_then_session = components.windows(2).any(|w| {
            matches!(w[0], Component::Normal(s) if s == "storage")
                && matches!(w[1], Component::Normal(s) if s == "session")
        });
        if !has_storage_then_session {
            return Err(
                "File path must be within an OpenCode storage/session/ directory".to_string(),
            );
        }
    }

    // 6. Read and parse JSON
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON format: {}", e))?;

    // 7. Extract previous title
    let previous_title = json
        .get("title")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    // 8. Update title field
    let new_title_trimmed = new_title.trim();
    if new_title_trimmed.is_empty() {
        json["title"] = serde_json::Value::Null;
    } else {
        json["title"] = serde_json::Value::String(new_title_trimmed.to_string());
    }

    // 9. Serialize back (preserve formatting)
    let updated_content = serde_json::to_string_pretty(&json)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    // 10. Atomic write via temp file
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let temp_path = format!("{}.{}.tmp", file_path, nonce);

    fs::write(&temp_path, &updated_content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    // 11. Atomic rename (Windows: remove original first)
    #[cfg(target_os = "windows")]
    {
        if path_buf.exists() {
            fs::remove_file(&file_path)
                .map_err(|e| format!("Failed to remove original: {}", e))?;
        }
    }

    fs::rename(&temp_path, &file_path)
        .map_err(|e| format!("Failed to finalize rename: {}", e))?;

    Ok(NativeRenameResult {
        success: true,
        previous_title,
        new_title: new_title_trimmed.to_string(),
        file_path,
    })
}
