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

// ============================================================================
// WINDOWS EXTENDED-LENGTH PREFIX
// ============================================================================

/// Remove the extended-length prefix that Windows may add to canonical paths
/// (`\?\C:\…` → `C:\…`, `\?\UNC\server\share` → `\server\share`).
///
/// `canonicalize()` returns the prefixed form on Windows; the desktop watcher
/// watches the canonicalized directory, so every event path carries the
/// prefix while the frontend compares strictly against `home_dir()`-based
/// paths — the open session and project list then never auto-refresh
/// (upstream #604). Cross-platform so the rule is unit-testable anywhere.
pub fn strip_windows_extended_prefix(path: &std::path::Path) -> std::path::PathBuf {
    let raw = path.to_string_lossy();
    if let Some(rest) = raw.strip_prefix(r"\?\UNC\") {
        return std::path::PathBuf::from(format!(r"\{rest}"));
    }
    if let Some(rest) = raw.strip_prefix(r"\?\") {
        return std::path::PathBuf::from(rest);
    }
    path.to_path_buf()
}

#[cfg(test)]
mod extended_prefix_tests {
    use super::strip_windows_extended_prefix;
    use std::path::Path;

    #[test]
    fn strips_drive_prefix() {
        let stripped = strip_windows_extended_prefix(Path::new(
            r"\?\C:\Users\xxx\.claude\projects\demo\a.jsonl",
        ));
        assert_eq!(
            stripped,
            Path::new(r"C:\Users\xxx\.claude\projects\demo\a.jsonl")
        );
    }

    #[test]
    fn strips_unc_prefix() {
        let stripped = strip_windows_extended_prefix(Path::new(
            r"\?\UNC\server\share\proj\a.jsonl",
        ));
        assert_eq!(stripped, Path::new(r"\server\share\proj\a.jsonl"));
    }

    #[test]
    fn passes_plain_paths_through() {
        for raw in ["/home/x/.claude/projects/p/a.jsonl", r"C:\Users\x\a.jsonl"] {
            assert_eq!(
                strip_windows_extended_prefix(Path::new(raw)),
                Path::new(raw)
            );
        }
    }
}

// ============================================================================
// PROJECT FOLDER NAME DECODING (upstream #548/#549 final state)
// ============================================================================
// Claude stores sessions under ~/.claude/projects/ with the project path
// encoded (`-Users-jack-app` on Unix, `D--OneDrive-Work` on Windows: every
// separator and the drive colon become `-`). Decoding walks the filesystem,
// checking each candidate split so names containing hyphens resolve right.

/// Decode a Claude session storage path to the actual project path.
///
/// 1. `sessions-index.json` `originalPath` (most reliable)
/// 2. Filesystem-verified decode of the encoded folder name
/// 3. Lossy Unix-only heuristic as a last resort
pub fn decode_project_path(session_storage_path: &str) -> String {
    let index_path = std::path::Path::new(session_storage_path).join("sessions-index.json");
    if let Ok(content) = std::fs::read_to_string(&index_path) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(original) = parsed.get("originalPath").and_then(|v| v.as_str()) {
                if !original.is_empty() && std::path::Path::new(original).is_absolute() {
                    return original.to_string();
                }
            }
        }
    }

    if let Some(encoded) = encoded_folder_name(session_storage_path) {
        if let Some(path) = decode_with_filesystem_check(encoded) {
            return path;
        }

        // Lossy heuristic: builds a `/`-rooted path, so it only applies to a
        // Unix-shaped name (leading dash). A drive-lettered `D--OneDrive-…`
        // is excluded by that test — fabricating `/D--OneDrive/…` on Windows
        // would be worse than the storage path (#548).
        if encoded.starts_with('-') {
            let parts: Vec<&str> = encoded.splitn(4, '-').collect();
            if parts.len() >= 4 {
                return format!("/{}/{}/{}", parts[1], parts[2], parts[3]);
            } else if parts.len() == 3 {
                return format!("/{}/{}", parts[1], parts[2]);
            } else if parts.len() == 2 {
                return format!("/{}", parts[1]);
            }
        }
    }
    session_storage_path.to_string()
}

/// Resolve a session storage folder to a real on-disk project path, returning
/// `None` unless the result can be verified against the filesystem. Complements
/// `cwd`-from-JSONL resolution (#369): the folder is authoritative when the
/// embedded `cwd` is stale.
pub fn decode_project_path_verified(session_storage_path: &str) -> Option<String> {
    let index_path = std::path::Path::new(session_storage_path).join("sessions-index.json");
    if let Ok(content) = std::fs::read_to_string(&index_path) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(original) = parsed.get("originalPath").and_then(|v| v.as_str()) {
                let original = original.trim();
                let candidate = std::path::Path::new(original);
                // symlink_metadata so a symlinked directory is rejected here too.
                let is_real_dir = std::fs::symlink_metadata(candidate)
                    .map(|m| m.file_type().is_dir())
                    .unwrap_or(false);
                if candidate.is_absolute() && is_real_dir {
                    return Some(original.to_string());
                }
            }
        }
    }
    decode_with_filesystem_check(encoded_folder_name(session_storage_path)?)
}

/// The encoded folder name inside a session storage path. Matches either
/// separator — a literal `".claude/projects/"` can never be found in a
/// Windows path with backslashes (#548).
fn encoded_folder_name(session_storage_path: &str) -> Option<&str> {
    const MARKERS: [&str; 2] = [".claude/projects/", r".claude\projects\"];
    MARKERS.iter().find_map(|marker| {
        session_storage_path
            .find(marker)
            .map(|pos| &session_storage_path[pos + marker.len()..])
    })
}

/// Split an encoded name into its filesystem root and the rest to decode.
/// Unix `-Users-jack-app` → (`/`, `Users-jack-app`); Windows `D--OneDrive-Work`
/// → (`D:\`, `OneDrive-Work`).
#[allow(clippy::unnecessary_wraps)]
fn split_encoded_root(encoded: &str) -> Option<(std::path::PathBuf, &str)> {
    #[cfg(windows)]
    {
        let drive = encoded.as_bytes().first()?;
        if drive.is_ascii_alphabetic() && encoded.get(1..3) == Some("--") {
            return Some((
                std::path::PathBuf::from(format!("{}:\\", &encoded[..1])),
                &encoded[3..],
            ));
        }
        None
    }

    #[cfg(not(windows))]
    Some((
        std::path::PathBuf::from("/"),
        encoded.strip_prefix('-').unwrap_or(encoded),
    ))
}

/// Decode by checking filesystem existence at each possible split point.
pub fn decode_with_filesystem_check(encoded: &str) -> Option<String> {
    let (root, rest) = split_encoded_root(encoded)?;
    decode_recursive_inner(rest, &root, 0).map(|p| p.to_string_lossy().into_owned())
}

/// Recursively decode hyphen-separated segments by checking the filesystem,
/// so names like `claude-code-history-viewer-src` split at real directories.
fn decode_recursive_inner(encoded: &str, base_path: &std::path::Path, depth: usize) -> Option<std::path::PathBuf> {
    if depth > 20 {
        return None;
    }
    if encoded.is_empty() {
        if base_path.exists() {
            return Some(base_path.to_path_buf());
        }
        return None;
    }

    let hyphen_positions: Vec<usize> = encoded
        .char_indices()
        .filter(|(_, c)| *c == '-')
        .map(|(i, _)| i)
        .collect();

    for &pos in &hyphen_positions {
        let segment = &encoded[..pos];
        if segment.is_empty() {
            continue;
        }
        let candidate = base_path.join(segment);
        let is_real_dir = std::fs::symlink_metadata(&candidate)
            .map(|m| m.file_type().is_dir())
            .unwrap_or(false);
        if is_real_dir {
            let remaining = &encoded[pos + 1..];
            if remaining.is_empty() {
                return Some(candidate);
            }
            // First try: remaining as a single leaf.
            let full_path = candidate.join(remaining);
            let full_path_is_real = std::fs::symlink_metadata(&full_path)
                .map(|m| !m.file_type().is_symlink())
                .unwrap_or(false);
            if full_path_is_real {
                return Some(full_path);
            }
            // Recurse: remaining may itself contain separator hyphens.
            if let result @ Some(_) = decode_recursive_inner(remaining, &candidate, depth + 1) {
                return result;
            }
        }
    }

    let full_path = base_path.join(encoded);
    if full_path.exists() {
        return Some(full_path);
    }
    None
}
