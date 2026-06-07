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
    let mut seen_canonical = std::collections::HashSet::new();

    let mut entries: Vec<_> = WalkDir::new(&projects_path)
        .min_depth(1)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            // Accept real directories and symlinks that resolve to directories.
            // Symlinks are only followed at depth 1 (project level), never deeper,
            // so there is no risk of traversing outside the projects/ tree.
            e.file_type().is_dir() || (e.file_type().is_symlink() && e.path().is_dir())
        })
        .collect();
    // Prefer real directories over symlinks so canonical-path dedup picks a
    // stable winner instead of relying on WalkDir iteration order (which varies
    // by FS/OS and could otherwise make a project's displayed name flip across
    // scans when an alias symlink coexists with its real target).
    entries.sort_by_key(|e| e.file_type().is_symlink());

    for entry in entries {
        // Deduplicate when a symlink and a real directory under projects/ resolve
        // to the same target. Fall back to the raw path if canonicalize fails so
        // transient I/O errors don't drop the entry.
        let canonical = entry
            .path()
            .canonicalize()
            .unwrap_or_else(|_| entry.path().to_path_buf());
        if !seen_canonical.insert(canonical) {
            continue;
        }

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

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_jsonl_file(dir: &std::path::Path, name: &str, contents: &str) {
        let mut file = fs::File::create(dir.join(name)).unwrap();
        file.write_all(contents.as_bytes()).unwrap();
    }

    #[tokio::test]
    async fn test_scan_projects_follows_symlinked_project_dir() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let claude_dir = temp_dir.path().join(".claude");
        let projects_dir = claude_dir.join("projects");
        fs::create_dir_all(&projects_dir).unwrap();

        // Real project directory lives outside projects/ (shared-session pattern).
        let shared_dir = temp_dir.path().join("shared").join("shared-project");
        fs::create_dir_all(&shared_dir).unwrap();
        create_test_jsonl_file(&shared_dir, "session.jsonl", "{}");

        // Symlink it in at project depth.
        let link_path = projects_dir.join("shared-project");
        symlink(&shared_dir, &link_path).unwrap();

        let result = scan_projects(claude_dir.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let projects = result.unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "shared-project");
        assert_eq!(projects[0].session_count, 1);
    }

    #[tokio::test]
    async fn test_scan_projects_skips_dangling_symlink() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let claude_dir = temp_dir.path().join(".claude");
        let projects_dir = claude_dir.join("projects");
        fs::create_dir_all(&projects_dir).unwrap();

        // One real project so the scan has something to return.
        let real_dir = projects_dir.join("real-project");
        fs::create_dir_all(&real_dir).unwrap();
        create_test_jsonl_file(&real_dir, "session.jsonl", "{}");

        // Dangling symlink pointing at a non-existent target.
        let dangling_target = temp_dir.path().join("does-not-exist");
        let dangling_link = projects_dir.join("dangling-project");
        symlink(&dangling_target, &dangling_link).unwrap();

        let result = scan_projects(claude_dir.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let projects = result.unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "real-project");
    }

    #[tokio::test]
    async fn test_scan_projects_deduplicates_symlink_and_real_dir() {
        use std::os::unix::fs::symlink;

        let temp_dir = TempDir::new().unwrap();
        let claude_dir = temp_dir.path().join(".claude");
        let projects_dir = claude_dir.join("projects");
        fs::create_dir_all(&projects_dir).unwrap();

        // Real project directory inside projects/.
        let real_dir = projects_dir.join("my-project");
        fs::create_dir_all(&real_dir).unwrap();
        create_test_jsonl_file(&real_dir, "session.jsonl", "{}");

        // Alias symlink in the same projects/ that resolves to the real dir.
        let alias_link = projects_dir.join("my-project-alias");
        symlink(&real_dir, &alias_link).unwrap();

        let result = scan_projects(claude_dir.to_string_lossy().to_string()).await;
        assert!(result.is_ok());

        let projects = result.unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].session_count, 1);
        // Real directories win the tie over symlink aliases so the displayed
        // project name stays stable across scans regardless of iteration order.
        assert_eq!(projects[0].name, "my-project");
    }
}
