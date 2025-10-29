// ============================================================================
// RESUME SESSION COMMANDS
// ============================================================================
// Open a session in the terminal for resumption
// Supports different providers (Claude Code, Codex, etc.)

use crate::commands::adapters::provider_capabilities::ProviderCapabilities;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command;
use serde_json::Value;

#[cfg(target_os = "windows")]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

#[tauri::command]
pub async fn resume_session(
    session_id: String,
    cwd: Option<String>,
    provider_id: String,
) -> Result<(), String> {
    let working_directory = cwd.ok_or("No working directory found for this session")?;

    println!("DEBUG: Resume session {} in directory: {}", session_id, working_directory);
    println!("DEBUG: Provider: {}", provider_id);

    // Extract UUID from filename if session_id is a full path
    // e.g., "C:\...\22d84a97-2a19-47b8-a4d0-d83643076649.jsonl" -> "22d84a97-2a19-47b8-a4d0-d83643076649"
    let session_uuid = if session_id.ends_with(".jsonl") {
        Path::new(&session_id)
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Failed to extract session UUID from filename")?
            .to_string()
    } else {
        session_id.clone()
    };

    println!("DEBUG: Extracted session UUID: {}", session_uuid);

    // Get provider capabilities
    let capabilities = ProviderCapabilities::for_provider(&provider_id);

    // Check if provider supports resume
    if !capabilities.supports_resume {
        return Err(format!(
            "Resume not supported for provider: {} (Provider does not have CLI resume capability)",
            provider_id
        ));
    }

    // Build resume command from provider capabilities
    let resume_command = capabilities
        .build_resume_command(&session_uuid)
        .ok_or_else(|| format!("Failed to build resume command for provider: {}", provider_id))?;

    println!("DEBUG: Executing command: {}", resume_command);
    open_terminal_with_command(&working_directory, &resume_command)?;
    println!("DEBUG: Terminal launched successfully");

    Ok(())
}

#[tauri::command]
pub async fn get_resume_command(
    session_id: String,
    cwd: Option<String>,
    provider_id: String,
) -> Result<String, String> {
    let working_directory = cwd.unwrap_or_else(|| ".".to_string());

    // Extract UUID from filename if session_id is a full path
    let session_uuid = if session_id.ends_with(".jsonl") {
        Path::new(&session_id)
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Failed to extract session UUID from filename")?
            .to_string()
    } else {
        session_id.clone()
    };

    // Get provider capabilities
    let capabilities = ProviderCapabilities::for_provider(&provider_id);

    // Check if provider supports resume
    if !capabilities.supports_resume {
        return Err(format!(
            "Resume not supported for provider: {}",
            provider_id
        ));
    }

    // For interactive providers (like Gemini), return the interactive command
    if let Some(interactive_cmd) = capabilities.get_interactive_command(&session_uuid) {
        // Return just the interactive command to paste in the CLI
        return Ok(interactive_cmd);
    }

    // For direct flag providers, build full command with cd
    let resume_command = capabilities
        .build_resume_command(&session_uuid)
        .ok_or_else(|| format!("Failed to build resume command for provider: {}", provider_id))?;

    Ok(format!(
        "cd {} && {}",
        working_directory, resume_command
    ))
}

/// Check if a provider supports resume functionality
#[tauri::command]
pub async fn provider_supports_resume(provider_id: String) -> Result<bool, String> {
    let capabilities = ProviderCapabilities::for_provider(&provider_id);
    Ok(capabilities.supports_resume)
}

/// Extract CWD from a session file
/// Reads the first message to find the working directory
#[tauri::command]
pub async fn get_session_cwd(
    session_file_path: String,
    provider_id: String,
) -> Result<String, String> {
    println!("DEBUG: get_session_cwd called - provider_id: {}, session_file_path: {}", provider_id, &session_file_path[..session_file_path.len().min(100)]);

    // Handle Cursor separately - it uses SQLite DB, not JSONL files
    if provider_id == "cursor" {
        println!("DEBUG: Calling get_cursor_session_cwd for Cursor provider");
        return get_cursor_session_cwd(&session_file_path);
    }

    // For JSONL-based providers (Claude Code, Codex, Gemini)
    let file = fs::File::open(&session_file_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let reader = BufReader::new(file);

    // Read lines and look for CWD in first few messages
    for line in reader.lines().take(20) {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;

        if line.trim().is_empty() {
            continue;
        }

        if let Ok(json) = serde_json::from_str::<Value>(&line) {
            // Check for cwd field (Claude Code format)
            if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                return Ok(cwd.to_string());
            }

            // Check in message.metadata (alternative location)
            if let Some(msg) = json.get("message") {
                if let Some(cwd) = msg.get("cwd").and_then(|v| v.as_str()) {
                    return Ok(cwd.to_string());
                }
            }

            // Check in metadata object
            if let Some(metadata) = json.get("metadata") {
                if let Some(cwd) = metadata.get("cwd").and_then(|v| v.as_str()) {
                    return Ok(cwd.to_string());
                }
            }

            // Check Codex format: payload.cwd (session_meta or turn_context events)
            if let Some(payload) = json.get("payload") {
                if let Some(cwd) = payload.get("cwd").and_then(|v| v.as_str()) {
                    return Ok(cwd.to_string());
                }
            }
        }
    }

    Err("Could not find working directory in session file".to_string())
}

/// Open terminal with command based on platform
fn open_terminal_with_command(cwd: &str, command: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Windows: Use 'start' command to properly launch interactive terminal app
        println!("DEBUG: Launching terminal in directory: {}", cwd);
        println!("DEBUG: Command to execute: {}", command);

        // On Windows, convert forward slashes to backslashes if needed
        let windows_path = cwd.replace("/", "\\");

        // Use 'start' command which properly launches new console with interactive support
        // start "title" /D "path" cmd /K command
        let start_args = vec![
            "/D".to_string(),
            windows_path.clone(),
            "cmd".to_string(),
            "/K".to_string(),
            command.to_string(),
        ];

        println!("DEBUG: start /D \"{}\" cmd /K {}", windows_path, command);

        Command::new("cmd.exe")
            .arg("/C")
            .arg("start")
            .arg("Claude Code Session") // Window title
            .args(&start_args)
            .spawn()
            .map_err(|e| format!("Failed to launch terminal: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: Open Terminal.app
        let script = format!(
            r#"tell application "Terminal"
                activate
                do script "cd '{}' && {}"
            end tell"#,
            cwd, command
        );

        Command::new("osascript")
            .args(&["-e", &script])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: Try common terminals in order
        let terminals = vec![
            ("gnome-terminal", vec!["--", "bash", "-c", &format!("cd '{}' && {}; exec bash", cwd, command)]),
            ("konsole", vec!["--workdir", cwd, "-e", "bash", "-c", &format!("{}; exec bash", command)]),
            ("xterm", vec!["-e", "bash", "-c", &format!("cd '{}' && {}; exec bash", cwd, command)]),
        ];

        let mut launched = false;
        for (terminal, args) in terminals {
            if let Ok(_) = Command::new(terminal).args(&args).spawn() {
                launched = true;
                break;
            }
        }

        if !launched {
            return Err("No supported terminal found. Please install gnome-terminal, konsole, or xterm.".to_string());
        }
    }

    Ok(())
}

/// Extract working directory for Cursor sessions
/// Cursor format: <db-path>#session=<session-id>#timestamp=<iso-timestamp>
/// We need to parse this and extract the workspace path from the workspace storage
fn get_cursor_session_cwd(composite_session_id: &str) -> Result<String, String> {
    use rusqlite::{params, Connection};
    use std::path::PathBuf;

    println!("DEBUG: get_cursor_session_cwd called with: {}", composite_session_id);

    // Parse the composite session ID
    // Format: C:\...\state.vscdb#session=<session-id>#workspace=<workspace-id>#timestamp=<iso-timestamp>
    let session_pos = composite_session_id
        .find("#session=")
        .ok_or("Invalid Cursor session format: missing #session=")?;

    let db_path_str = &composite_session_id[..session_pos];
    let after_session = &composite_session_id[session_pos + 9..]; // Skip "#session="

    // Extract workspace ID
    let workspace_pos = after_session
        .find("#workspace=")
        .ok_or("Invalid Cursor session format: missing #workspace=")?;
    let session_id = &after_session[..workspace_pos];
    let after_workspace = &after_session[workspace_pos + 11..]; // Skip "#workspace="

    // Extract workspace ID and timestamp
    let timestamp_pos = after_workspace
        .find("#timestamp=")
        .ok_or("Invalid Cursor session format: missing #timestamp=")?;
    let workspace_id = &after_workspace[..timestamp_pos];

    println!("DEBUG: Cursor session ID: {}", session_id);
    println!("DEBUG: Cursor workspace ID: {}", workspace_id);
    println!("DEBUG: Cursor DB path: {}", db_path_str);

    // The workspace ID corresponds to a workspace storage folder
    // We need to find the Cursor base path and look up the workspace
    let db_path = PathBuf::from(db_path_str);
    let cursor_base = db_path
        .parent() // Remove state.vscdb
        .and_then(|p| p.parent()) // Remove globalStorage
        .and_then(|p| p.parent()) // Remove User
        .ok_or("Failed to determine Cursor base path")?;

    println!("DEBUG: Cursor base: {}", cursor_base.display());

    // Try to open the workspace's state.vscdb to extract project root
    let workspace_db = cursor_base
        .join("User")
        .join("workspaceStorage")
        .join(workspace_id)
        .join("state.vscdb");

    println!("DEBUG: Workspace DB: {}", workspace_db.display());

    if !workspace_db.exists() {
        println!("DEBUG: Workspace DB does not exist! Falling back to home directory.");
        // Fallback: return home directory or current directory
        return dirs::home_dir()
            .map(|p| p.to_string_lossy().to_string())
            .ok_or("Could not determine workspace directory".to_string());
    }

    println!("DEBUG: Workspace DB exists, opening...");

    // Open workspace database and extract project root
    let conn = Connection::open(&workspace_db)
        .map_err(|e| format!("Failed to open workspace DB: {}", e))?;

    // Use the same approach as extract_project_info in cursor.rs
    // Query ItemTable for history.entries to find recently opened files
    let history_result: Result<String, _> = conn.query_row(
        "SELECT value FROM ItemTable WHERE key = 'history.entries'",
        params![],
        |row| row.get(0),
    );

    match history_result {
        Ok(ref history_json) => {
            println!("DEBUG: Found history.entries, parsing {} chars...", history_json.len());
        }
        Err(ref e) => {
            println!("DEBUG: Failed to read history.entries: {}", e);
        }
    }

    if let Ok(history_json) = history_result {
        if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(&history_json) {
            let mut file_paths = Vec::new();

            for entry in entries {
                if let Some(editor) = entry.get("editor") {
                    if let Some(resource) = editor.get("resource").and_then(|v| v.as_str()) {
                        if resource.starts_with("file:///") {
                            let file_path = resource.strip_prefix("file://").unwrap_or(resource);
                            file_paths.push(file_path.to_string());
                        }
                    }
                }
            }

            println!("DEBUG: Found {} file paths in history", file_paths.len());

            if !file_paths.is_empty() {
                // Find common prefix (project root)
                let common_prefix = find_common_file_prefix(&file_paths);
                let root_path = common_prefix.trim_end_matches('/');

                println!("DEBUG: Common prefix before conversion: {}", root_path);

                // Convert URI path to Windows path
                // URI format examples:
                //   /c:/Users/xxx/... -> C:\Users\xxx\...
                //   /c%3A/Users/xxx/... -> C:\Users\xxx\... (URL-encoded colon)
                let decoded_path = urlencoding::decode(root_path)
                    .unwrap_or(std::borrow::Cow::Borrowed(root_path));

                let windows_path = if decoded_path.starts_with("/") {
                    let without_slash = &decoded_path[1..];
                    if without_slash.len() > 2 && &without_slash[1..2] == ":" {
                        // /c:/foo -> C:\foo
                        without_slash.replace("/", "\\")
                    } else {
                        decoded_path.to_string()
                    }
                } else {
                    decoded_path.to_string()
                };

                println!("DEBUG: Extracted project root: {}", windows_path);
                return Ok(windows_path);
            } else {
                println!("DEBUG: File paths list is empty after parsing");
            }
        } else {
            println!("DEBUG: Failed to parse history.entries JSON");
        }
    }

    // Try workspace.folderUri as alternative
    println!("DEBUG: Trying workspace.folderUri...");
    let folder_uri_result: Result<String, _> = conn.query_row(
        "SELECT value FROM ItemTable WHERE key = 'workspace.folderUri'",
        params![],
        |row| row.get(0),
    );

    if let Ok(folder_uri_json) = folder_uri_result {
        println!("DEBUG: Found workspace.folderUri: {}", &folder_uri_json[..folder_uri_json.len().min(200)]);

        if let Ok(uri_obj) = serde_json::from_str::<serde_json::Value>(&folder_uri_json) {
            if let Some(path) = uri_obj.get("path").and_then(|v| v.as_str()) {
                // Convert URI path to Windows path
                let windows_path = if path.starts_with("/") {
                    let without_slash = &path[1..];
                    if without_slash.len() > 2 && &without_slash[1..2] == ":" {
                        without_slash.replace("/", "\\")
                    } else {
                        path.to_string()
                    }
                } else {
                    path.to_string()
                };

                println!("DEBUG: Extracted project root from workspace.folderUri: {}", windows_path);
                return Ok(windows_path);
            }
        }
    } else {
        println!("DEBUG: workspace.folderUri not found");
    }

    // Last resort: list all keys to help debug
    println!("DEBUG: Listing first 10 keys in workspace DB:");
    if let Ok(mut stmt) = conn.prepare("SELECT key FROM ItemTable LIMIT 10") {
        if let Ok(rows) = stmt.query_map(params![], |row| row.get::<_, String>(0)) {
            for (i, key_result) in rows.enumerate() {
                if let Ok(key) = key_result {
                    println!("  [{}] {}", i, key);
                }
            }
        }
    }

    // Fallback: return home directory
    println!("DEBUG: Falling back to home directory");
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or("Could not determine workspace directory".to_string())
}

/// Find common prefix among file paths to determine project root
fn find_common_file_prefix(paths: &[String]) -> String {
    if paths.is_empty() {
        return String::new();
    }

    if paths.len() == 1 {
        let path = &paths[0];
        return path[..path.rfind('/').unwrap_or(0)].to_string();
    }

    // Find common prefix character by character
    let first = &paths[0];
    let mut prefix_len = 0;

    'outer: for (i, ch) in first.chars().enumerate() {
        for path in &paths[1..] {
            if let Some(path_ch) = path.chars().nth(i) {
                if path_ch != ch {
                    break 'outer;
                }
            } else {
                break 'outer;
            }
        }
        prefix_len = i + 1;
    }

    let prefix = &first[..prefix_len];

    // Trim to last slash
    if let Some(last_slash) = prefix.rfind('/') {
        prefix[..last_slash].to_string()
    } else {
        String::new()
    }
}
