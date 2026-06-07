/// Splits a byte slice into `(start, end)` byte offset pairs for each line.
///
/// Uses SIMD-accelerated `memchr` for fast newline detection (5-10x faster
/// than byte-by-byte iteration on large files). Designed for use with
/// memory-mapped files where random byte-offset access is O(1).
pub fn find_line_ranges(data: &[u8]) -> Vec<(usize, usize)> {
    use memchr::memchr_iter;

    if data.is_empty() {
        return Vec::new();
    }

    // Pre-allocate based on estimated average line length (~500 bytes for JSONL)
    let estimated_lines = data.len() / 500;
    let mut ranges = Vec::with_capacity(estimated_lines.max(16));
    let mut start = 0;

    for pos in memchr_iter(b'\n', data) {
        // Trim trailing \r for Windows-style line endings
        let end = if pos > start && data[pos - 1] == b'\r' {
            pos - 1
        } else {
            pos
        };
        if end > start {
            ranges.push((start, end));
        }
        start = pos + 1;
    }

    // Handle last line without trailing newline
    if start < data.len() {
        let end = if data[data.len() - 1] == b'\r' {
            data.len() - 1
        } else {
            data.len()
        };
        if end > start {
            ranges.push((start, end));
        }
    }

    ranges
}

pub fn extract_project_name(raw_project_name: &str) -> String {
    if raw_project_name.starts_with('-') {
        let parts: Vec<&str> = raw_project_name.splitn(4, '-').collect();
        if parts.len() == 4 {
            parts[3].to_string()
        } else {
            raw_project_name.to_string()
        }
    } else {
        raw_project_name.to_string()
    }
}

/// Estimate message count from file size (more accurate calculation)
pub fn estimate_message_count_from_size(file_size: u64) -> usize {
    // Average JSON message is 800-1200 bytes
    // Small files are treated as having at least 1 message
    ((file_size as f64 / 1000.0).ceil() as usize).max(1)
}

/// Extract clean session title by filtering out system preambles
/// Detects and removes common system instruction patterns
pub fn filter_preamble_from_title(text: &str) -> String {
    // Preamble detection patterns (case-insensitive)
    let preamble_markers = [
        "<user_instructions>",
        "<environment_context>",
        "<system_context>",
        "you are an expert",
        "you are a helpful",
        "you are tasked with",
        "as an ai assistant",
        "your role is to",
    ];

    let lower_text = text.to_lowercase();

    // Check if text starts with preamble markers
    for marker in &preamble_markers {
        if lower_text.starts_with(marker) {
            // Find where the preamble ends
            if let Some(end_tag_pos) = text.find('>') {
                // Skip past the closing tag
                let after_tag = &text[end_tag_pos + 1..].trim();
                if !after_tag.is_empty() {
                    return after_tag.to_string();
                }
            }
        }
    }

    // Check for XML-style system instructions
    if text.contains("<user_instructions>") {
        if let Some(end_pos) = text.find("</user_instructions>") {
            let after_instructions = text[end_pos + "</user_instructions>".len()..].trim();
            if !after_instructions.is_empty() {
                return after_instructions.to_string();
            }
        }
    }

    if text.contains("<environment_context>") {
        if let Some(end_pos) = text.find("</environment_context>") {
            let after_context = text[end_pos + "</environment_context>".len()..].trim();
            if !after_context.is_empty() {
                return after_context.to_string();
            }
        }
    }

    // If no preamble detected, return original text
    text.to_string()
}

/// Extract git branch from session metadata or tool outputs
/// Returns: (branch_name, commit_hash)
pub fn extract_git_info(
    metadata: &Option<serde_json::Value>,
    tool_outputs: &[String],
) -> (Option<String>, Option<String>) {
    let mut branch: Option<String> = None;
    let mut commit: Option<String> = None;

    // Priority 1: Check session metadata for git info
    if let Some(meta) = metadata {
        if let Some(git_obj) = meta.get("git") {
            branch = git_obj
                .get("branch")
                .and_then(|v| v.as_str())
                .map(String::from);

            commit = git_obj
                .get("commit_hash")
                .or(git_obj.get("commitHash"))
                .and_then(|v| v.as_str())
                .map(|s| s.chars().take(8).collect()); // Short hash
        }
    }

    // Priority 2: Parse from tool outputs (git status, git branch, etc.)
    if branch.is_none() {
        for output in tool_outputs {
            // Look for "On branch <name>" pattern
            if output.contains("On branch ") {
                if let Some(start) = output.find("On branch ") {
                    let after_marker = &output[start + "On branch ".len()..];
                    if let Some(newline) = after_marker.find('\n') {
                        branch = Some(after_marker[..newline].trim().to_string());
                    } else {
                        branch = Some(after_marker.trim().to_string());
                    }
                }
            }

            // Look for "* <branch>" pattern (git branch output)
            if branch.is_none() {
                for line in output.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("* ") {
                        branch = Some(trimmed[2..].trim().to_string());
                        break;
                    }
                }
            }
        }
    }

    (branch, commit)
}

// ============================================================================
// CUSTOM CLAUDE CONFIGURATION DIRECTORIES
// ============================================================================

/// Expand a leading `~` (or `~/`) in a path string to the user's home directory.
///
/// Only the exact `~` token or a `~/` prefix is expanded; embedded tildes are
/// left untouched. Returns the input unchanged when no home directory is found.
pub fn expand_home_prefix(raw: &str) -> String {
    if raw == "~" {
        if let Some(home) = dirs::home_dir() {
            return home.to_string_lossy().to_string();
        }
        return raw.to_string();
    }
    if let Some(rest) = raw.strip_prefix("~/").or_else(|| raw.strip_prefix("~\\")) {
        if let Some(home) = dirs::home_dir() {
            return home.join(rest).to_string_lossy().to_string();
        }
    }
    raw.to_string()
}

/// Validate that a custom Claude configuration directory is safe to scan.
///
/// A valid custom directory:
/// - is an absolute path,
/// - is not itself a symlink,
/// - contains a real (non-symlink) `projects/` subdirectory,
/// - whose canonical `projects/` path is contained within the canonical base.
///
/// Returns the canonical `projects/` path on success.
pub fn validate_custom_claude_path(
    base_path: &std::path::Path,
) -> Result<std::path::PathBuf, String> {
    if !base_path.is_absolute() {
        return Err(format!(
            "Custom path must be absolute: {}",
            base_path.display()
        ));
    }

    // Reject a symlinked base directory.
    let base_meta = std::fs::symlink_metadata(base_path)
        .map_err(|e| format!("Cannot read metadata for {}: {e}", base_path.display()))?;
    if base_meta.file_type().is_symlink() {
        return Err(format!(
            "Custom path must not be a symlink: {}",
            base_path.display()
        ));
    }

    let projects_path = base_path.join("projects");

    // Reject a symlinked projects/ directory.
    let projects_meta = std::fs::symlink_metadata(&projects_path)
        .map_err(|_| format!("No projects/ directory in {}", base_path.display()))?;
    if projects_meta.file_type().is_symlink() {
        return Err(format!(
            "projects/ must not be a symlink in {}",
            base_path.display()
        ));
    }
    if !projects_meta.is_dir() {
        return Err(format!(
            "projects/ is not a directory in {}",
            base_path.display()
        ));
    }

    // Canonicalize and verify containment to guard against escape tricks.
    let canonical_base = std::fs::canonicalize(base_path)
        .map_err(|e| format!("Failed to canonicalize {}: {e}", base_path.display()))?;
    let canonical_projects = std::fs::canonicalize(&projects_path)
        .map_err(|e| format!("Failed to canonicalize projects/: {e}"))?;

    if !canonical_projects.starts_with(&canonical_base) {
        return Err("projects/ path escapes the base directory".to_string());
    }

    Ok(canonical_projects)
}

/// Resolve the Claude configuration directory from the `CLAUDE_CONFIG_DIR`
/// environment variable.
///
/// Returns `Some(path)` when the variable is set, non-empty, expands to an
/// absolute path, and points to a valid Claude configuration directory
/// (a directory containing a `projects/` subfolder). Returns `None` otherwise.
///
/// This never falls back to `~/.claude`; the default location is resolved
/// separately so callers can treat `CLAUDE_CONFIG_DIR` as an override.
pub fn resolve_claude_config_dir() -> Option<String> {
    resolve_claude_config_dir_from(std::env::var("CLAUDE_CONFIG_DIR").ok())
}

/// Testable core of [`resolve_claude_config_dir`] that takes the raw env value.
pub fn resolve_claude_config_dir_from(raw: Option<String>) -> Option<String> {
    let raw = raw?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let expanded = expand_home_prefix(trimmed);
    let path = std::path::PathBuf::from(&expanded);
    if !path.is_absolute() {
        return None;
    }

    match validate_custom_claude_path(&path) {
        // Return the normalized/canonical base path rather than the raw env
        // string so downstream consumers operate on a resolved path.
        Ok(_) => std::fs::canonicalize(&path)
            .ok()
            .map(|p| p.to_string_lossy().to_string())
            .or(Some(expanded)),
        Err(_) => None,
    }
}

#[cfg(test)]
mod custom_claude_dir_tests {
    use super::*;
    use std::fs;

    fn make_claude_dir(root: &std::path::Path, name: &str) -> std::path::PathBuf {
        let base = root.join(name);
        fs::create_dir_all(base.join("projects")).unwrap();
        base
    }

    #[test]
    fn validate_rejects_relative_path() {
        let rel = std::path::PathBuf::from("relative/.claude");
        assert!(validate_custom_claude_path(&rel).is_err());
    }

    #[test]
    fn validate_rejects_missing_projects() {
        let tmp = std::env::temp_dir().join(format!("cchv_test_noproj_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        assert!(validate_custom_claude_path(&tmp).is_err());
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn validate_accepts_valid_claude_dir() {
        let tmp = std::env::temp_dir().join(format!("cchv_test_ok_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let base = make_claude_dir(&tmp, ".claude");
        let projects = validate_custom_claude_path(&base).expect("should be valid");
        assert!(projects.ends_with("projects"));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn config_dir_none_when_unset_or_empty() {
        assert_eq!(resolve_claude_config_dir_from(None), None);
        assert_eq!(resolve_claude_config_dir_from(Some(String::new())), None);
        assert_eq!(resolve_claude_config_dir_from(Some("   ".to_string())), None);
    }

    #[test]
    fn config_dir_none_when_relative() {
        assert_eq!(
            resolve_claude_config_dir_from(Some("some/relative/path".to_string())),
            None
        );
    }

    #[test]
    fn config_dir_resolves_valid_override() {
        // Simulates CLAUDE_CONFIG_DIR pointing at a valid custom Claude dir.
        let tmp = std::env::temp_dir().join(format!("cchv_test_env_{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let base = make_claude_dir(&tmp, "custom-claude");
        let raw = base.to_string_lossy().to_string();

        let resolved = resolve_claude_config_dir_from(Some(raw.clone()))
            .expect("valid CLAUDE_CONFIG_DIR override should resolve");
        // The resolver returns the normalized/canonical path, not the raw input.
        let expected = fs::canonicalize(&base)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(raw);
        assert_eq!(resolved, expected);

        // An override that lacks projects/ resolves to None.
        let bad = tmp.join("not-claude");
        fs::create_dir_all(&bad).unwrap();
        assert_eq!(
            resolve_claude_config_dir_from(Some(bad.to_string_lossy().to_string())),
            None
        );

        let _ = fs::remove_dir_all(&tmp);
    }
}
