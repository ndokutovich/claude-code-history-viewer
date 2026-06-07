// ============================================================================
// AIDER ADAPTER (v1.9.x)
// ============================================================================
// Converts Aider (`aider`) conversation history into UniversalMessage.
//
// Aider stores its chat log as a single Markdown file per project directory:
//   <project_dir>/.aider.chat.history.md
//
// The Markdown log uses three conventions:
//   "# aider chat started at <ts>"  -> session boundary marker
//   "#### <text>"                   -> user prompt line
//   "> <text>"                      -> tool / command output line
//   <other prose>                   -> assistant reply
//
// SINGLE-SESSION-PER-FILE MODEL: to match our multi_provider routing, each
// `.aider.chat.history.md` file is treated as ONE session (the whole file),
// rather than splitting on each "# aider chat started at" header. The header
// timestamps are still used to date individual message turns and to compute
// the session's first/last activity bounds.
//
// PATH SCHEME:
//   Project: aider://<project_dir>
//   Session: aider://<history_file_path>
//
// PATTERN REFERENCE: Cline adapter (commands/adapters/cline.rs)
// CLEAN CODE: emits OUR Universal types, reuses opencode helpers.

use crate::models::universal::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// CONSTANTS
// ============================================================================

/// The Aider chat history file name.
const HISTORY_FILE: &str = ".aider.chat.history.md";

/// Line prefix marking the start of an Aider chat session.
const SESSION_HEADER_PREFIX: &str = "# aider chat started at ";

/// Line prefix marking a user prompt.
const USER_PREFIX: &str = "#### ";

/// Line prefix marking tool / command output.
const TOOL_PREFIX: &str = "> ";

/// URI scheme prefix used for project and session paths.
const SCHEME: &str = "aider://";

/// Maximum recursion depth when searching for history files.
const MAX_SCAN_DEPTH: usize = 4;

/// Maximum number of history files collected per search root.
const MAX_HISTORY_FILES: usize = 100;

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Collect candidate search directories under the user's home directory.
///
/// Mirrors the upstream Aider locator: common project-holding subdirectories
/// plus the home directory itself. Uses `dirs::home_dir()` so it resolves
/// correctly on Windows, macOS, and Linux.
pub fn get_aider_search_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(home) = dirs::home_dir() {
        for subdir in ["client", "projects", "code", "src", "dev", "work", "repos"] {
            let d = home.join(subdir);
            if d.is_dir() {
                dirs.push(d);
            }
        }
        // Also check the home directory itself.
        dirs.push(home);
    }
    dirs
}

/// Return the first available search directory that contains Aider history,
/// used by the single-source detection flow (`get_aider_path`).
///
/// Returns the first search root that actually contains Aider history (so the
/// reported base reflects where data lives). Falls back to the first existing
/// root only when none of the roots contain history.
pub fn get_aider_base_path() -> Option<PathBuf> {
    let dirs = get_aider_search_dirs();
    if let Some(with_history) = dirs
        .iter()
        .find(|d| aider_available_in(std::slice::from_ref(*d)))
    {
        return Some(with_history.clone());
    }
    dirs.into_iter().next()
}

/// Shallow availability check (depth 1) to avoid slow recursive scans at startup.
fn aider_available_in(dirs: &[PathBuf]) -> bool {
    dirs.iter().any(|d| {
        if d.join(HISTORY_FILE).is_file() {
            return true;
        }
        fs::read_dir(d)
            .into_iter()
            .flatten()
            .flatten()
            .any(|entry| entry.path().join(HISTORY_FILE).is_file())
    })
}

/// Whether Aider is available anywhere under the standard search roots.
pub fn aider_available() -> bool {
    aider_available_in(&get_aider_search_dirs())
}

/// Check whether a path is a symlink without following it.
fn is_symlinked(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
}

/// Recursively collect `.aider.chat.history.md` files under `dir`.
fn find_history_files(dir: &Path) -> Vec<PathBuf> {
    let mut results: Vec<PathBuf> = Vec::new();
    find_history_recursive(dir, &mut results, 0);
    results
}

fn find_history_recursive(dir: &Path, results: &mut Vec<PathBuf>, depth: usize) {
    if depth > MAX_SCAN_DEPTH || results.len() >= MAX_HISTORY_FILES || is_symlinked(dir) {
        return;
    }

    let history = dir.join(HISTORY_FILE);
    if history.is_file() && !is_symlinked(&history) {
        results.push(history);
    }

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if results.len() >= MAX_HISTORY_FILES {
                return;
            }
            let path = entry.path();
            if path.is_dir() && !is_symlinked(&path) {
                let name = path.file_name().unwrap_or_default().to_string_lossy();
                if !name.starts_with('.')
                    && name != "node_modules"
                    && name != "target"
                    && name != "dist"
                    && name != "build"
                {
                    find_history_recursive(&path, results, depth + 1);
                }
            }
        }
    }
}

// ============================================================================
// PROJECT SCANNING
// ============================================================================

/// Scan all Aider projects across the standard search directories.
/// Each directory containing a `.aider.chat.history.md` file is one project,
/// modeled as a single session (the whole file).
pub fn scan_aider_projects(source_id: &str) -> Result<Vec<UniversalProject>, String> {
    let mut projects: Vec<UniversalProject> = Vec::new();
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

    for search_dir in get_aider_search_dirs() {
        for history_path in find_history_files(&search_dir) {
            // Deduplicate across overlapping search roots.
            let canonical = history_path
                .canonicalize()
                .unwrap_or_else(|_| history_path.clone());
            if !seen.insert(canonical) {
                continue;
            }

            let project_dir = match history_path.parent() {
                Some(p) => p,
                None => continue,
            };

            let content = match fs::read_to_string(&history_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let message_count = count_messages(&content);
            if message_count == 0 {
                continue;
            }
            let (first_ts, last_ts) = session_time_bounds(&content);

            let project_name = project_dir
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| project_dir.to_string_lossy().to_string());

            let project_path = format!("{}{}", SCHEME, project_dir.to_string_lossy());

            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert(
                "historyFile".to_string(),
                json!(history_path.to_string_lossy()),
            );
            metadata.insert("storageType".to_string(), json!("markdown"));

            projects.push(UniversalProject {
                id: project_path.clone(),
                source_id: source_id.to_string(),
                provider_id: "aider".to_string(),
                name: project_name,
                path: project_path,
                session_count: 1,
                total_messages: message_count,
                first_activity_at: first_ts,
                last_activity_at: last_ts,
                metadata,
            });
        }
    }

    projects.sort_by(|a, b| b.last_activity_at.cmp(&a.last_activity_at));
    Ok(projects)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

/// Load the single session for an Aider project directory.
/// `project_dir` is the resolved directory (parsed from `aider://<dir>`).
pub fn load_aider_sessions(
    project_dir: &Path,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    let history_path = project_dir.join(HISTORY_FILE);
    if !history_path.is_file() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&history_path)
        .map_err(|e| format!("AIDER_READ_ERROR: Failed to read history: {}", e))?;

    let message_count = count_messages(&content);
    let tool_call_count = count_tool_blocks(&content);
    let (first_ts, last_ts) = session_time_bounds(&content);
    let summary = first_user_message(&content).map(|s| truncate_chars(&s, 100));

    let project_name = project_dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let project_path = format!("{}{}", SCHEME, project_dir.to_string_lossy());
    let session_path = format!("{}{}", SCHEME, history_path.to_string_lossy());

    let first = first_ts.clone().unwrap_or_default();
    let last = last_ts.clone().unwrap_or_else(|| first.clone());

    let mut metadata: HashMap<String, Value> = HashMap::new();
    metadata.insert(
        "filePath".to_string(),
        json!(history_path.to_string_lossy()),
    );
    metadata.insert("storageType".to_string(), json!("markdown"));
    if let Some(ref s) = summary {
        metadata.insert("summary".to_string(), json!(s));
    }

    let session = UniversalSession {
        id: session_path.clone(),
        project_id: project_path,
        source_id: source_id.to_string(),
        provider_id: "aider".to_string(),
        title: summary.clone().unwrap_or_else(|| project_name.clone()),
        description: summary,
        message_count,
        first_message_at: first,
        last_message_at: last,
        duration: 0,
        total_tokens: None,
        tool_call_count,
        error_count: 0,
        entrypoint: None,
        metadata,
        checksum: session_path,
    };

    Ok(vec![session])
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

/// Load messages for a single Aider session (whole history file) with pagination.
/// `history_path` is the resolved file path (parsed from `aider://<file>`).
pub fn load_aider_messages(
    history_path: &Path,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    if history_path.file_name().and_then(|n| n.to_str()) != Some(HISTORY_FILE) {
        return Err(format!(
            "AIDER_PATH_ERROR: Not an Aider history file: {}",
            history_path.display()
        ));
    }
    if !history_path.is_file() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(history_path)
        .map_err(|e| format!("AIDER_READ_ERROR: Failed to read history: {}", e))?;

    let converted = parse_history_to_messages(&content, session_id, project_id, source_id);

    let total = converted.len();
    let start = offset.min(total);
    let end = offset.saturating_add(limit).min(total);
    Ok(converted[start..end].to_vec())
}

// ============================================================================
// MARKDOWN -> UNIVERSAL CONVERSION
// ============================================================================

/// Parse a full Aider history file into a flat list of UniversalMessages.
/// Groups consecutive lines into user / assistant / tool turns and dates each
/// turn with the most recent "# aider chat started at" header timestamp.
fn parse_history_to_messages(
    content: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
) -> Vec<UniversalMessage> {
    let mut messages: Vec<UniversalMessage> = Vec::new();
    let mut current_role: Option<Role> = None;
    let mut current_text = String::new();
    let mut current_ts = String::new();
    let mut seq: i32 = 0;

    for line in content.lines() {
        if let Some(ts_str) = line.strip_prefix(SESSION_HEADER_PREFIX) {
            flush_turn(
                current_role.take(),
                &current_text,
                &current_ts,
                session_id,
                project_id,
                source_id,
                &mut seq,
                &mut messages,
            );
            current_text.clear();
            current_ts = parse_aider_timestamp(ts_str);
        } else if let Some(user_text) = line.strip_prefix(USER_PREFIX) {
            flush_turn(
                current_role.take(),
                &current_text,
                &current_ts,
                session_id,
                project_id,
                source_id,
                &mut seq,
                &mut messages,
            );
            current_role = Some(Role::User);
            current_text = user_text.to_string();
        } else if let Some(tool_text) = line.strip_prefix(TOOL_PREFIX) {
            if current_role == Some(Role::Tool) {
                current_text.push('\n');
                current_text.push_str(tool_text);
            } else {
                flush_turn(
                    current_role.take(),
                    &current_text,
                    &current_ts,
                    session_id,
                    project_id,
                    source_id,
                    &mut seq,
                    &mut messages,
                );
                current_role = Some(Role::Tool);
                current_text = tool_text.to_string();
            }
        } else {
            // Assistant prose (may include blank lines for formatting).
            if current_role == Some(Role::Assistant) {
                current_text.push('\n');
                current_text.push_str(line);
            } else {
                flush_turn(
                    current_role.take(),
                    &current_text,
                    &current_ts,
                    session_id,
                    project_id,
                    source_id,
                    &mut seq,
                    &mut messages,
                );
                current_role = Some(Role::Assistant);
                current_text = line.to_string();
            }
        }
    }

    // Flush the final turn.
    flush_turn(
        current_role.take(),
        &current_text,
        &current_ts,
        session_id,
        project_id,
        source_id,
        &mut seq,
        &mut messages,
    );

    messages
}

/// Internal turn role used while parsing.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Role {
    User,
    Assistant,
    Tool,
}

#[allow(clippy::too_many_arguments)]
fn flush_turn(
    role: Option<Role>,
    text: &str,
    timestamp: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    seq: &mut i32,
    messages: &mut Vec<UniversalMessage>,
) {
    let role = match role {
        Some(r) => r,
        None => return,
    };
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return;
    }

    let (msg_role, msg_type) = match role {
        Role::User => (MessageRole::User, MessageType::Message),
        Role::Assistant => (MessageRole::Assistant, MessageType::Message),
        Role::Tool => (MessageRole::System, MessageType::Message),
    };

    let id = format!("aider-{}-{}", session_id, seq);
    let content = vec![text_content(trimmed)];

    messages.push(UniversalMessage {
        id,
        session_id: session_id.to_string(),
        project_id: project_id.to_string(),
        source_id: source_id.to_string(),
        provider_id: "aider".to_string(),
        timestamp: timestamp.to_string(),
        sequence_number: *seq,
        role: msg_role,
        message_type: msg_type,
        content,
        parent_id: None,
        depth: None,
        branch_id: None,
        model: None,
        tokens: None,
        tool_calls: None,
        thinking: None,
        attachments: None,
        errors: None,
        original_format: "aider_chat_history".to_string(),
        provider_metadata: HashMap::new(),
    });

    *seq += 1;
}

fn text_content(text: &str) -> UniversalContent {
    UniversalContent {
        content_type: ContentType::Text,
        data: json!({ "text": text }),
        encoding: None,
        mime_type: Some("text/plain".to_string()),
        size: Some(text.len()),
        hash: None,
    }
}

// ============================================================================
// MARKDOWN PARSING HELPERS
// ============================================================================

/// Count displayable message turns in a history file (cheap, no allocation per turn).
fn count_messages(content: &str) -> usize {
    let mut count = 0usize;
    let mut current_role: Option<Role> = None;
    let mut has_text = false;

    let close = |role: &mut Option<Role>, has_text: &mut bool, count: &mut usize| {
        if role.is_some() && *has_text {
            *count += 1;
        }
        *role = None;
        *has_text = false;
    };

    for line in content.lines() {
        if line.starts_with(SESSION_HEADER_PREFIX) {
            close(&mut current_role, &mut has_text, &mut count);
        } else if let Some(rest) = line.strip_prefix(USER_PREFIX) {
            close(&mut current_role, &mut has_text, &mut count);
            current_role = Some(Role::User);
            has_text = !rest.trim().is_empty();
        } else if let Some(rest) = line.strip_prefix(TOOL_PREFIX) {
            if current_role == Some(Role::Tool) {
                if !rest.trim().is_empty() {
                    has_text = true;
                }
            } else {
                close(&mut current_role, &mut has_text, &mut count);
                current_role = Some(Role::Tool);
                has_text = !rest.trim().is_empty();
            }
        } else if current_role == Some(Role::Assistant) {
            if !line.trim().is_empty() {
                has_text = true;
            }
        } else {
            close(&mut current_role, &mut has_text, &mut count);
            current_role = Some(Role::Assistant);
            has_text = !line.trim().is_empty();
        }
    }
    close(&mut current_role, &mut has_text, &mut count);
    count
}

/// Count tool-output blocks (consecutive `> ` runs).
fn count_tool_blocks(content: &str) -> usize {
    let mut count = 0usize;
    let mut in_tool = false;
    for line in content.lines() {
        if line.starts_with(TOOL_PREFIX) {
            if !in_tool {
                count += 1;
                in_tool = true;
            }
        } else {
            in_tool = false;
        }
    }
    count
}

/// Return (first_session_ts, last_session_ts) parsed from header lines.
fn session_time_bounds(content: &str) -> (Option<String>, Option<String>) {
    let mut first: Option<String> = None;
    let mut last: Option<String> = None;
    for line in content.lines() {
        if let Some(ts_str) = line.strip_prefix(SESSION_HEADER_PREFIX) {
            let ts = parse_aider_timestamp(ts_str);
            if first.is_none() {
                first = Some(ts.clone());
            }
            last = Some(ts);
        }
    }
    (first, last)
}

/// Return the first user message text in the file (for the session summary).
fn first_user_message(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        line.strip_prefix(USER_PREFIX)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
    })
}

/// Parse Aider's "YYYY-MM-DD HH:MM:SS" header timestamp into RFC3339-ish form.
fn parse_aider_timestamp(ts_str: &str) -> String {
    let ts = ts_str.trim();
    if ts.len() >= 19 && ts.is_char_boundary(10) && ts.is_char_boundary(19) {
        format!("{}T{}Z", &ts[..10], &ts[11..19])
    } else {
        ts.to_string()
    }
}

/// Truncate a string to at most `max` characters (char-boundary safe),
/// appending an ellipsis when truncation occurs.
fn truncate_chars(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    let truncated: String = s.chars().take(max).collect();
    format!("{}...", truncated)
}

// ============================================================================
// PATH SCHEME PARSING
// ============================================================================

/// Parse an `aider://<path>` scheme into a filesystem path.
/// Guards against path traversal (`..`) and empty bodies.
pub fn parse_scheme_path(scheme_path: &str) -> Result<PathBuf, String> {
    let body = scheme_path.strip_prefix(SCHEME).unwrap_or(scheme_path);
    if body.is_empty() {
        return Err(format!("AIDER_PATH_ERROR: Empty path in: {}", scheme_path));
    }
    if body.contains("..") {
        return Err(format!(
            "AIDER_SECURITY_ERROR: Path traversal blocked in: {}",
            scheme_path
        ));
    }
    Ok(PathBuf::from(body))
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_HISTORY: &str = "# aider chat started at 2025-03-26 14:32:01\n\
\n\
#### What does this function do?\n\
\n\
This function calculates the Fibonacci sequence using memoization.\n\
\n\
> Tokens: 1,234 sent, 567 received.\n\
\n\
#### Fix the bug in line 42\n\
\n\
I'll fix that bug. Here's the corrected code.\n\
\n\
> Applied edit to src/main.py\n\
\n\
# aider chat started at 2025-03-26 15:10:00\n\
\n\
#### New session message\n\
\n\
Done.\n";

    fn first_text(msg: &UniversalMessage) -> String {
        msg.content[0]
            .data
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    }

    #[test]
    fn test_turn_role_mapping() {
        let msgs = parse_history_to_messages(SAMPLE_HISTORY, "sess", "proj", "src");

        // user, assistant, tool, user, assistant, tool, user, assistant
        assert_eq!(msgs.len(), 8, "expected 8 turns, got {}", msgs.len());

        assert_eq!(msgs[0].role, MessageRole::User);
        assert_eq!(first_text(&msgs[0]), "What does this function do?");

        assert_eq!(msgs[1].role, MessageRole::Assistant);
        assert!(first_text(&msgs[1]).contains("Fibonacci"));

        assert_eq!(msgs[2].role, MessageRole::System); // tool output
        assert!(first_text(&msgs[2]).contains("Tokens"));

        assert_eq!(msgs[3].role, MessageRole::User);
        assert_eq!(first_text(&msgs[3]), "Fix the bug in line 42");

        assert_eq!(msgs[6].role, MessageRole::User);
        assert_eq!(first_text(&msgs[6]), "New session message");

        // All messages carry the aider provider + format.
        assert!(msgs.iter().all(|m| m.provider_id == "aider"));
        assert!(msgs
            .iter()
            .all(|m| m.original_format == "aider_chat_history"));
    }

    #[test]
    fn test_timestamps_track_session_headers() {
        let msgs = parse_history_to_messages(SAMPLE_HISTORY, "s", "p", "src");
        // First six turns belong to the first session header.
        assert_eq!(msgs[0].timestamp, "2025-03-26T14:32:01Z");
        assert_eq!(msgs[5].timestamp, "2025-03-26T14:32:01Z");
        // Last turns belong to the second session header.
        assert_eq!(msgs[6].timestamp, "2025-03-26T15:10:00Z");
        assert_eq!(msgs[7].timestamp, "2025-03-26T15:10:00Z");
    }

    #[test]
    fn test_sequence_numbers_are_contiguous() {
        let msgs = parse_history_to_messages(SAMPLE_HISTORY, "s", "p", "src");
        for (i, m) in msgs.iter().enumerate() {
            assert_eq!(m.sequence_number, i as i32);
        }
    }

    #[test]
    fn test_tool_output_grouping() {
        let content = "> Line 1\n> Line 2\n> Line 3";
        let msgs = parse_history_to_messages(content, "s", "p", "src");
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].role, MessageRole::System);
        let text = first_text(&msgs[0]);
        assert!(text.contains("Line 1"));
        assert!(text.contains("Line 3"));
    }

    #[test]
    fn test_empty_content() {
        let msgs = parse_history_to_messages("", "s", "p", "src");
        assert!(msgs.is_empty());
    }

    #[test]
    fn test_count_messages_matches_parse() {
        let parsed = parse_history_to_messages(SAMPLE_HISTORY, "s", "p", "src").len();
        assert_eq!(count_messages(SAMPLE_HISTORY), parsed);
    }

    #[test]
    fn test_session_time_bounds() {
        let (first, last) = session_time_bounds(SAMPLE_HISTORY);
        assert_eq!(first, Some("2025-03-26T14:32:01Z".to_string()));
        assert_eq!(last, Some("2025-03-26T15:10:00Z".to_string()));
    }

    #[test]
    fn test_first_user_message() {
        assert_eq!(
            first_user_message(SAMPLE_HISTORY),
            Some("What does this function do?".to_string())
        );
    }

    #[test]
    fn test_parse_scheme_path_ok() {
        let p = parse_scheme_path("aider:///home/me/proj/.aider.chat.history.md").unwrap();
        assert_eq!(
            p,
            PathBuf::from("/home/me/proj/.aider.chat.history.md")
        );
    }

    #[test]
    fn test_parse_scheme_path_windows() {
        let p = parse_scheme_path("aider://C:\\Users\\me\\proj").unwrap();
        assert_eq!(p, PathBuf::from("C:\\Users\\me\\proj"));
    }

    #[test]
    fn test_parse_scheme_path_blocks_traversal() {
        assert!(parse_scheme_path("aider:///home/../etc/passwd").is_err());
        assert!(parse_scheme_path("aider://").is_err());
    }

    #[test]
    fn test_parse_aider_timestamp() {
        assert_eq!(parse_aider_timestamp("2025-03-26 14:32:01"), "2025-03-26T14:32:01Z");
        assert_eq!(parse_aider_timestamp("short"), "short");
    }

    #[test]
    fn test_truncate_chars() {
        assert_eq!(truncate_chars("short", 100), "short");
        let long = "x".repeat(150);
        let t = truncate_chars(&long, 100);
        assert_eq!(t.chars().count(), 103);
        assert!(t.ends_with("..."));
    }

    #[test]
    fn test_load_messages_huge_offset_limit_no_overflow() {
        let dir = tempfile::tempdir().unwrap();
        let history_path = dir.path().join(HISTORY_FILE);
        fs::write(&history_path, SAMPLE_HISTORY).unwrap();
        // offset + limit would overflow usize without saturating arithmetic.
        let msgs = load_aider_messages(
            &history_path,
            "sess",
            "proj",
            "src",
            usize::MAX,
            usize::MAX,
        )
        .unwrap();
        assert!(msgs.is_empty(), "huge offset returns empty, not a panic");
    }
}
