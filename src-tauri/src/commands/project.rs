use crate::models::*;
use crate::utils::{estimate_message_count_from_size, extract_project_name};
use chrono::{DateTime, Utc};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use walkdir::WalkDir;

#[tauri::command]
pub async fn get_git_log(actual_path: String, limit: usize) -> Result<Vec<GitCommit>, String> {
    let path_buf = PathBuf::from(&actual_path);
    if !path_buf.is_absolute() {
        return Err("Path must be absolute".to_string());
    }
    if !path_buf.exists() || !path_buf.is_dir() {
        return Err("Path does not exist or is not a directory".to_string());
    }

    let safe_path = path_buf
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let output = Command::new("git")
        .args(["log", "-n"])
        .arg(limit.to_string())
        .args(["--pretty=format:%H|%an|%at|%s"])
        .current_dir(&safe_path)
        .output()
        .map_err(|e| format!("Failed to execute git log: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.splitn(4, '|').collect();
        if parts.len() == 4 {
            let timestamp = parts[2].parse::<i64>().unwrap_or(0);
            let date = DateTime::<Utc>::from_timestamp(timestamp, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| "unknown".to_string());

            commits.push(GitCommit {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                timestamp,
                date,
                message: parts[3].to_string(),
            });
        }
    }

    Ok(commits)
}

#[tauri::command]
pub async fn get_claude_folder_path() -> Result<String, String> {
    // A valid CLAUDE_CONFIG_DIR override takes precedence over the default
    // ~/.claude location. When the variable is unset or invalid we fall back
    // to the default, keeping existing behavior unchanged.
    if let Some(config_dir) = crate::utils::resolve_claude_config_dir() {
        return Ok(config_dir);
    }

    let home_dir =
        dirs::home_dir().ok_or("HOME_DIRECTORY_NOT_FOUND: Could not determine home directory")?;
    let claude_path = home_dir.join(".claude");

    if !claude_path.exists() {
        return Err(format!(
            "CLAUDE_FOLDER_NOT_FOUND: Claude folder not found at {}",
            claude_path.display()
        ));
    }

    if fs::read_dir(&claude_path).is_err() {
        return Err(
            "PERMISSION_DENIED: Cannot access Claude folder. Please check permissions.".to_string(),
        );
    }

    Ok(claude_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn validate_claude_folder(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Ok(false);
    }

    if path_buf.file_name().and_then(|n| n.to_str()) == Some(".claude") {
        let projects_path = path_buf.join("projects");
        return Ok(projects_path.exists() && projects_path.is_dir());
    }

    let claude_path = path_buf.join(".claude");
    if claude_path.exists() && claude_path.is_dir() {
        let projects_path = claude_path.join("projects");
        return Ok(projects_path.exists() && projects_path.is_dir());
    }

    // Accept any directory that directly contains a `projects/` subfolder. This
    // covers custom Claude configuration directories (e.g. CLAUDE_CONFIG_DIR)
    // that are not literally named `.claude`.
    let direct_projects = path_buf.join("projects");
    if direct_projects.exists() && direct_projects.is_dir() {
        return Ok(true);
    }

    Ok(false)
}

/// Validate a custom (user-added) Claude configuration directory.
///
/// Unlike [`validate_claude_folder`], the path is treated as the Claude config
/// root itself (it must directly contain a `projects/` subfolder) and symlink
/// safety checks are applied. Returns `Ok(true)` when valid, `Ok(false)`
/// otherwise so the frontend can skip invalid entries gracefully.
#[tauri::command]
pub async fn validate_custom_claude_dir(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);
    Ok(crate::utils::validate_custom_claude_path(&path_buf).is_ok())
}

/// Resolve the Claude configuration directory from the `CLAUDE_CONFIG_DIR`
/// environment variable.
///
/// Returns `Some(path)` when the variable is set and points to a valid Claude
/// configuration directory; `None` otherwise. Lets the frontend include the
/// override as an additional scannable source on startup.
#[tauri::command]
pub async fn detect_claude_config_dir() -> Result<Option<String>, String> {
    Ok(crate::utils::resolve_claude_config_dir())
}

#[tauri::command]
pub async fn scan_projects(claude_path: String) -> Result<Vec<ClaudeProject>, String> {
    let start_time = std::time::Instant::now();
    let projects_path = PathBuf::from(&claude_path).join("projects");

    if !projects_path.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();

    for entry in WalkDir::new(&projects_path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_dir())
    {
        let raw_project_name = entry.file_name().to_string_lossy().to_string();
        let project_path = entry.path().to_string_lossy().to_string();
        let project_name = extract_project_name(&raw_project_name);

        let mut session_count = 0;
        let mut message_count = 0;
        let mut last_modified = None;

        for jsonl_entry in WalkDir::new(entry.path())
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("jsonl"))
        {
            session_count += 1;

            if let Ok(metadata) = jsonl_entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if last_modified.is_none() || modified > last_modified.unwrap() {
                        last_modified = Some(modified);
                    }
                } else {
                    #[cfg(debug_assertions)]
                    eprintln!(
                        "⚠️ Failed to get modified time for: {:?}",
                        jsonl_entry.path()
                    );
                }

                // Estimate message count from file size - much faster
                let estimated_messages = estimate_message_count_from_size(metadata.len());
                message_count += estimated_messages;
            } else {
                #[cfg(debug_assertions)]
                eprintln!("⚠️ Failed to get metadata for: {:?}", jsonl_entry.path());
            }
        }

        let last_modified_str = last_modified
            .map(|lm| {
                let dt: DateTime<Utc> = lm.into();
                let timestamp = dt.to_rfc3339();
                #[cfg(debug_assertions)]
                println!("✅ Claude Code Project '{}': last_modified = {}", project_name, timestamp);
                timestamp
            })
            .unwrap_or_else(|| {
                let fallback = Utc::now().to_rfc3339();
                #[cfg(debug_assertions)]
                println!("⚠️ Claude Code Project '{}': Using fallback timestamp (no JSONL files had metadata)", project_name);
                fallback
            });

        projects.push(ClaudeProject {
            name: project_name,
            path: project_path,
            session_count,
            message_count,
            last_modified: last_modified_str,
        });
    }

    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    let _elapsed = start_time.elapsed();
    #[cfg(debug_assertions)]
    println!(
        "📊 scan_projects performance: {} projects scanned in {}ms",
        projects.len(),
        _elapsed.as_millis()
    );

    Ok(projects)
}
