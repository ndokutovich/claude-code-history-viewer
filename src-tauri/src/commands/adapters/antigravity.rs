// ============================================================================
// ANTIGRAVITY ADAPTER (v1.9.x)
// ============================================================================
// Converts Antigravity conversation history into UniversalMessage.
//
// Antigravity stores per-session data under an antigravity root directory:
//   <root>/
//     conversations/<session_id>/<session_id>.pb   -> protobuf transcript body
//     conversations/<session_id>/manifest.json     -> step count / metadata
//     conversations/<session_id>/usage.jsonl        -> token usage records
//   <data_dir>/Antigravity/logs/<id>/ls-main.log    -> browser tool names
//
// Flat layouts (`conversations/<session_id>.pb` with no per-session directory)
// are also supported and surface as metadata-only sessions.
//
// ---------------------------------------------------------------------------
// PROTOBUF DECODING POLICY (HONEST):
// The `.pb` transcript bodies are NOT decoded. There is no public `.proto`
// schema for Antigravity conversation files, and decoding them reliably is not
// feasible within this task. Upstream takes the same stance. We therefore:
//   1. Build session metadata from manifest.json + usage.jsonl.
//   2. Emit a clear SYSTEM notice message explaining bodies are not decoded.
//   3. Emit one message per usage.jsonl record with REAL token metadata
//      (model + token counts) — never invented conversation text.
//   4. Best-effort extract browser tool NAMES from ls-main.log / .pb bytes
//      using low-false-positive phrase heuristics, and attach them as
//      tool_calls on the last message.
// ---------------------------------------------------------------------------
//
// PATTERN REFERENCE: Cline adapter (commands/adapters/cline.rs)
// CLEAN CODE: emits OUR Universal types, reuses opencode epoch helper.

use crate::commands::adapters::opencode::epoch_ms_to_rfc3339;
use crate::models::universal::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Separator inside the `antigravity://` scheme path. `|` is illegal in
/// Windows paths and effectively absent on macOS/Linux, so it cleanly
/// disambiguates the root path (which may contain `:` drive letters) from the
/// session id.
const SCHEME_SEP: char = '|';

/// Low-false-positive browser tool phrases, mapped to canonical tool names.
/// Used for both `ls-main.log` overlay parsing and `.pb` byte-scanning.
const TOOL_PATTERNS: &[(&str, &str)] = &[
    ("opening url", "BrowserOpenUrl"),
    ("getting dom", "BrowserGetDom"),
    ("getting console logs", "BrowserGetConsoleLogs"),
    ("clicking", "BrowserClick"),
    ("taking screenshot", "BrowserScreenshot"),
    ("scrolling mouse wheel", "BrowserScrollMouseWheel"),
];

// ============================================================================
// ROOT DETECTION
// ============================================================================

/// Default Antigravity root: `~/.gemini/antigravity`.
fn default_antigravity_root() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".gemini").join("antigravity"))
}

/// True if `dir` looks like an Antigravity root (carries a known marker).
fn is_antigravity_root(dir: &Path) -> bool {
    dir.is_dir()
        && (dir.join("brain").is_dir()
            || dir.join("conversations").is_dir()
            || dir.join("monitor-state.json").is_file())
}

/// Return the first available Antigravity root directory, if any.
pub fn get_antigravity_base_path() -> Option<PathBuf> {
    if let Some(root) = default_antigravity_root() {
        if is_antigravity_root(&root) {
            return Some(root);
        }
    }
    None
}

/// Antigravity logs root: `<data_dir>/Antigravity/logs`.
fn antigravity_logs_root() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join("Antigravity").join("logs"))
}

// ============================================================================
// MANIFEST / USAGE PARSING
// ============================================================================

/// Step count extracted from a session's `manifest.json`.
fn read_manifest_step_count(session_dir: &Path) -> usize {
    let path = session_dir.join("manifest.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<Value>(&content).ok())
        .and_then(|v| v.get("stepCount").and_then(Value::as_u64))
        .unwrap_or(0) as usize
}

/// A single token-usage record parsed from `usage.jsonl`.
#[derive(Debug, Clone)]
struct UsageRecord {
    sequence: u64,
    model: String,
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_write_tokens: u64,
    /// Unix ms, parsed from raw.chatModel.chatStartMetadata.createdAt (0 if absent).
    created_at_ms: u64,
}

/// Parse all `recordType:"usage"` rows from a session's `usage.jsonl`.
fn read_usage_records(session_dir: &Path) -> Vec<UsageRecord> {
    let path = session_dir.join("usage.jsonl");
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    parse_usage_jsonl(&content)
}

/// Parse usage.jsonl content into records. Split out for unit testing.
fn parse_usage_jsonl(content: &str) -> Vec<UsageRecord> {
    let mut records = Vec::new();
    for line in content.lines() {
        let Ok(rec) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if rec.get("recordType").and_then(Value::as_str) != Some("usage") {
            continue;
        }
        let created_at_ms = rec["raw"]["chatModel"]["chatStartMetadata"]["createdAt"]
            .as_str()
            .and_then(parse_rfc3339_to_ms)
            .unwrap_or(0);
        records.push(UsageRecord {
            sequence: rec.get("sequence").and_then(Value::as_u64).unwrap_or(0),
            model: rec
                .get("model")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .to_string(),
            input_tokens: rec.get("inputTokens").and_then(Value::as_u64).unwrap_or(0),
            output_tokens: rec.get("outputTokens").and_then(Value::as_u64).unwrap_or(0),
            cache_read_tokens: rec
                .get("cacheReadTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0),
            cache_write_tokens: rec
                .get("cacheWriteTokens")
                .and_then(Value::as_u64)
                .unwrap_or(0),
            created_at_ms,
        });
    }
    records
}

/// Aggregated usage summary for a session.
#[derive(Debug, Default, Clone)]
struct UsageSummary {
    call_count: usize,
    first_ts_ms: u64,
    last_ts_ms: u64,
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_write_tokens: u64,
}

fn summarize_usage(records: &[UsageRecord]) -> UsageSummary {
    let mut summary = UsageSummary {
        first_ts_ms: u64::MAX,
        ..Default::default()
    };
    for r in records {
        summary.call_count += 1;
        summary.input_tokens += r.input_tokens;
        summary.output_tokens += r.output_tokens;
        summary.cache_read_tokens += r.cache_read_tokens;
        summary.cache_write_tokens += r.cache_write_tokens;
        if r.created_at_ms > 0 {
            summary.first_ts_ms = summary.first_ts_ms.min(r.created_at_ms);
            summary.last_ts_ms = summary.last_ts_ms.max(r.created_at_ms);
        }
    }
    if summary.first_ts_ms == u64::MAX {
        summary.first_ts_ms = 0;
    }
    summary
}

/// Parse an RFC3339 timestamp string to Unix milliseconds.
fn parse_rfc3339_to_ms(raw: &str) -> Option<u64> {
    let ms = chrono::DateTime::parse_from_rfc3339(raw)
        .ok()?
        .timestamp_millis();
    u64::try_from(ms).ok()
}

/// Format a token count as a human-readable string (e.g. `1.2k`, `3.5M`).
fn fmt_tokens(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}k", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}

// ============================================================================
// SESSION DISCOVERY
// ============================================================================

/// A discovered Antigravity session: id + the directory that holds its
/// metadata files (manifest.json / usage.jsonl). `has_dir` is false for flat
/// `conversations/<id>.pb` files that have no per-session directory.
struct SessionEntry {
    id: String,
    dir: PathBuf,
    has_dir: bool,
}

/// Enumerate sessions under `<root>/conversations`. Prefers per-session
/// directories; falls back to flat `<id>.pb` files for ids not already seen.
fn discover_sessions(root: &Path) -> Vec<SessionEntry> {
    let conversations = root.join("conversations");
    let Ok(entries) = fs::read_dir(&conversations) else {
        return Vec::new();
    };

    let mut by_id: HashMap<String, SessionEntry> = HashMap::new();

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        // SECURITY: never follow symlinks out of the root.
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if file_type.is_dir() {
            if !is_safe_session_id(&name) {
                continue;
            }
            by_id.insert(
                name.clone(),
                SessionEntry {
                    id: name,
                    dir: path,
                    has_dir: true,
                },
            );
        } else if file_type.is_file() {
            // Flat `<id>.pb` file.
            if path.extension().and_then(|e| e.to_str()) != Some("pb") {
                continue;
            }
            if let Some(stem) = path.file_stem().map(|s| s.to_string_lossy().to_string()) {
                if !is_safe_session_id(&stem) {
                    continue;
                }
                by_id.entry(stem.clone()).or_insert(SessionEntry {
                    id: stem,
                    dir: conversations.clone(),
                    has_dir: false,
                });
            }
        }
    }

    by_id.into_values().collect()
}

// ============================================================================
// PROJECT SCANNING
// ============================================================================

/// Scan Antigravity projects. Antigravity is modelled as a single project
/// aggregating all sessions (mirrors upstream).
pub fn scan_antigravity_projects(
    root: &Path,
    source_id: &str,
) -> Result<Vec<UniversalProject>, String> {
    if !is_antigravity_root(root) {
        return Ok(Vec::new());
    }

    let sessions = discover_sessions(root);
    if sessions.is_empty() {
        return Ok(Vec::new());
    }

    let root_str = root.to_string_lossy().to_string();

    let mut total_messages = 0usize;
    let mut last_ms = 0u64;
    let mut first_ms = u64::MAX;

    for s in &sessions {
        let records = if s.has_dir {
            read_usage_records(&s.dir.clone())
        } else {
            Vec::new()
        };
        let summary = summarize_usage(&records);
        total_messages += summary.call_count;
        if summary.last_ts_ms > 0 {
            last_ms = last_ms.max(summary.last_ts_ms);
        }
        if summary.first_ts_ms > 0 {
            first_ms = first_ms.min(summary.first_ts_ms);
        }
    }

    let scheme_path = format!("antigravity://{}", root_str);

    let mut metadata: HashMap<String, Value> = HashMap::new();
    metadata.insert("antigravityRoot".to_string(), json!(root_str));

    let projects = vec![UniversalProject {
        id: scheme_path.clone(),
        source_id: source_id.to_string(),
        provider_id: "antigravity".to_string(),
        name: "Antigravity".to_string(),
        path: scheme_path,
        session_count: sessions.len(),
        total_messages,
        first_activity_at: if first_ms != u64::MAX && first_ms > 0 {
            Some(epoch_ms_to_rfc3339(first_ms as i64))
        } else {
            None
        },
        last_activity_at: if last_ms > 0 {
            Some(epoch_ms_to_rfc3339(last_ms as i64))
        } else {
            None
        },
        metadata,
    }];

    Ok(projects)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

/// Load sessions for the Antigravity project.
pub fn load_antigravity_sessions(
    root: &Path,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    let root_str = root.to_string_lossy().to_string();
    let project_scheme = format!("antigravity://{}", root_str);

    let mut sessions: Vec<UniversalSession> = discover_sessions(root)
        .into_iter()
        .map(|entry| build_session(&entry, root, &project_scheme, source_id))
        .collect();

    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    Ok(sessions)
}

fn build_session(
    entry: &SessionEntry,
    root: &Path,
    project_scheme: &str,
    source_id: &str,
) -> UniversalSession {
    let records = if entry.has_dir {
        read_usage_records(&entry.dir)
    } else {
        Vec::new()
    };
    let summary = summarize_usage(&records);
    let step_count = if entry.has_dir {
        read_manifest_step_count(&entry.dir)
    } else {
        0
    };

    let first_ts = epoch_ms_to_rfc3339(summary.first_ts_ms as i64);
    let last_ts = epoch_ms_to_rfc3339(summary.last_ts_ms as i64);

    let total_in = summary.input_tokens;
    let total_out = summary.output_tokens;
    let total = total_in
        .saturating_add(total_out)
        .saturating_add(summary.cache_read_tokens)
        .saturating_add(summary.cache_write_tokens);

    let total_tokens = if total > 0 {
        Some(TokenUsage {
            input_tokens: saturating_i32(total_in),
            output_tokens: saturating_i32(total_out),
            total_tokens: saturating_i32(total),
            cache_creation_tokens: Some(saturating_i32(summary.cache_write_tokens)),
            cache_read_tokens: Some(saturating_i32(summary.cache_read_tokens)),
            service_tier: None,
        })
    } else {
        None
    };

    let short_id: String = entry.id.chars().take(8).collect();
    let description = format!(
        "{} calls · {} steps · in={} out={} total={}",
        summary.call_count,
        step_count,
        fmt_tokens(total_in),
        fmt_tokens(total_out),
        fmt_tokens(total),
    );

    let session_scheme = format!("antigravity://{}{}{}", root.to_string_lossy(), SCHEME_SEP, entry.id);

    let mut metadata: HashMap<String, Value> = HashMap::new();
    metadata.insert("filePath".to_string(), json!(session_scheme));
    metadata.insert("antigravityRoot".to_string(), json!(root.to_string_lossy()));
    metadata.insert("sessionId".to_string(), json!(entry.id));
    metadata.insert("stepCount".to_string(), json!(step_count));
    metadata.insert("transcriptDecoded".to_string(), json!(false));

    UniversalSession {
        id: session_scheme,
        project_id: project_scheme.to_string(),
        source_id: source_id.to_string(),
        provider_id: "antigravity".to_string(),
        title: short_id,
        description: Some(description),
        message_count: summary.call_count,
        first_message_at: first_ts.clone(),
        last_message_at: last_ts,
        duration: 0,
        total_tokens,
        tool_call_count: 0,
        error_count: 0,
        entrypoint: None,
        metadata,
        checksum: format!("{}:{}", entry.id, summary.call_count),
    }
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

/// Load messages for a single Antigravity session with pagination.
///
/// Message bodies are NOT decoded (see module-level protobuf policy). A SYSTEM
/// notice is emitted first, followed by one message per usage.jsonl record
/// carrying real token metadata. Tool names discovered in logs/.pb are attached
/// to the last message.
pub fn load_antigravity_messages(
    root: &Path,
    session_id: &str,
    session_scheme: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    if !is_safe_session_id(session_id) {
        return Err(format!(
            "ANTIGRAVITY_SECURITY_ERROR: Unsafe session id: {}",
            session_id
        ));
    }

    let conversations = root.join("conversations");
    // Per-session dir holds usage.jsonl; flat layout has none.
    let session_dir = conversations.join(session_id);
    let metadata_dir = if session_dir.is_dir() {
        session_dir.clone()
    } else {
        conversations.clone()
    };
    let records = read_usage_records(&metadata_dir);

    let mut messages: Vec<UniversalMessage> = Vec::with_capacity(records.len() + 1);
    let mut sequence: i32 = 0;

    // 1. SYSTEM notice — honest disclosure that bodies are not decoded.
    let notice = "Antigravity stores conversation transcripts in protobuf (.pb) format. \
        No public schema is available to decode the message bodies, so the transcript text \
        cannot be displayed. The entries below are token-usage records parsed from usage.jsonl \
        (real metadata, not reconstructed conversation).";
    let notice_ts = records
        .first()
        .filter(|r| r.created_at_ms > 0)
        .map(|r| epoch_ms_to_rfc3339(r.created_at_ms as i64))
        .unwrap_or_else(|| epoch_ms_to_rfc3339(0));
    messages.push(build_message(
        &format!("antigravity-{}-notice", session_id),
        session_scheme,
        project_id,
        source_id,
        &notice_ts,
        MessageRole::System,
        MessageType::Message,
        vec![text_content(notice)],
        sequence,
        None,
        None,
    ));
    sequence += 1;

    // 2. One assistant message per usage record (real token metadata).
    for r in &records {
        let ts = epoch_ms_to_rfc3339(r.created_at_ms as i64);
        let text = format!(
            "Usage record #{} · model={} · input={} output={} cacheRead={} cacheWrite={}",
            r.sequence,
            r.model,
            r.input_tokens,
            r.output_tokens,
            r.cache_read_tokens,
            r.cache_write_tokens,
        );
        let total = r
            .input_tokens
            .saturating_add(r.output_tokens)
            .saturating_add(r.cache_read_tokens)
            .saturating_add(r.cache_write_tokens);
        let tokens = Some(TokenUsage {
            input_tokens: saturating_i32(r.input_tokens),
            output_tokens: saturating_i32(r.output_tokens),
            total_tokens: saturating_i32(total),
            cache_creation_tokens: Some(saturating_i32(r.cache_write_tokens)),
            cache_read_tokens: Some(saturating_i32(r.cache_read_tokens)),
            service_tier: None,
        });
        messages.push(build_message(
            &format!("antigravity-{}-{}", session_id, sequence),
            session_scheme,
            project_id,
            source_id,
            &ts,
            MessageRole::Assistant,
            MessageType::Message,
            vec![text_content(&text)],
            sequence,
            Some(r.model.clone()),
            tokens,
        ));
        sequence += 1;
    }

    // 3. Best-effort tool names from logs + .pb bytes → attach to last message.
    let tool_names = load_tool_names(root, session_id);
    if !tool_names.is_empty() {
        if let Some(last) = messages.last_mut() {
            let calls: Vec<ToolCall> = tool_names
                .iter()
                .enumerate()
                .map(|(i, name)| ToolCall {
                    id: format!("antigravity-{}-tool-{}", session_id, i),
                    name: name.clone(),
                    input: HashMap::new(),
                    output: None,
                    error: None,
                    status: ToolCallStatus::Success,
                })
                .collect();
            last.tool_calls = Some(calls);
        }
    }

    let total = messages.len();
    let start = offset.min(total);
    let end = (offset + limit).min(total);
    Ok(messages[start..end].to_vec())
}

// ============================================================================
// TOOL NAME EXTRACTION (best-effort, low false positive)
// ============================================================================

/// Extract browser tool names for a session from logs and the `.pb` file.
fn load_tool_names(root: &Path, session_id: &str) -> Vec<String> {
    let mut names = Vec::new();

    // .pb byte-scan (heuristic; no schema).
    let pb_candidates = [
        root.join("conversations")
            .join(session_id)
            .join(format!("{}.pb", session_id)),
        root.join("conversations").join(format!("{}.pb", session_id)),
    ];
    for pb in pb_candidates {
        if pb.is_file() {
            names.extend(extract_pb_tool_names(&pb));
            break;
        }
    }

    // ls-main.log overlay parsing.
    if let Some(logs_root) = antigravity_logs_root() {
        if let Ok(entries) = fs::read_dir(&logs_root) {
            for entry in entries.flatten() {
                let Ok(ft) = entry.file_type() else { continue };
                if ft.is_symlink() || !ft.is_dir() {
                    continue;
                }
                let log_path = entry.path().join("ls-main.log");
                if log_path.is_file() {
                    names.extend(extract_log_tool_names(&log_path, session_id));
                }
            }
        }
    }

    names
}

/// Scan `.pb` bytes for low-false-positive tool phrases.
fn extract_pb_tool_names(pb_path: &Path) -> Vec<String> {
    let Ok(bytes) = fs::read(pb_path) else {
        return Vec::new();
    };
    let cleaned: Vec<u8> = bytes
        .into_iter()
        .map(|b| {
            if (32..=126).contains(&b) || matches!(b, b'\n' | b'\r' | b'\t') {
                b
            } else {
                b' '
            }
        })
        .collect();
    let text = String::from_utf8_lossy(&cleaned).to_lowercase();
    let mut names = Vec::new();
    for (pattern, tool) in TOOL_PATTERNS {
        for _ in 0..text.match_indices(pattern).count() {
            names.push((*tool).to_string());
        }
    }
    names
}

/// Parse `window.updateActuationOverlay(...)` calls in a log file for a session.
fn extract_log_tool_names(log_path: &Path, session_id: &str) -> Vec<String> {
    let Ok(content) = fs::read_to_string(log_path) else {
        return Vec::new();
    };
    let needle = format!("\"cascadeId\":\"{}\"", session_id);
    let mut names = Vec::new();
    for line in content.lines() {
        if !line.contains(&needle) || !line.contains("window.updateActuationOverlay(") {
            continue;
        }
        let Some(start) = line.find('{') else { continue };
        let Some(end) = line.rfind("})") else { continue };
        if end <= start {
            continue;
        }
        let payload = &line[start..=end];
        let Ok(value) = serde_json::from_str::<Value>(payload) else {
            continue;
        };
        if let Some(display) = value.get("displayString").and_then(Value::as_str) {
            if let Some(tool) = tool_name_from_overlay_display(display) {
                names.push(tool.to_string());
            }
        }
    }
    names
}

/// Map an overlay display string to a canonical tool name.
fn tool_name_from_overlay_display(display: &str) -> Option<&'static str> {
    let lower = display.to_lowercase();
    TOOL_PATTERNS
        .iter()
        .find(|(pattern, _)| lower.contains(pattern))
        .map(|(_, tool)| *tool)
}

// ============================================================================
// MESSAGE-BUILDER HELPERS
// ============================================================================

#[allow(clippy::too_many_arguments)]
fn build_message(
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    role: MessageRole,
    message_type: MessageType,
    content: Vec<UniversalContent>,
    sequence_number: i32,
    model: Option<String>,
    tokens: Option<TokenUsage>,
) -> UniversalMessage {
    UniversalMessage {
        id: id.to_string(),
        session_id: session_id.to_string(),
        project_id: project_id.to_string(),
        source_id: source_id.to_string(),
        provider_id: "antigravity".to_string(),
        timestamp: timestamp.to_string(),
        sequence_number,
        role,
        message_type,
        content,
        parent_id: None,
        depth: None,
        branch_id: None,
        model,
        tokens,
        tool_calls: None,
        thinking: None,
        attachments: None,
        errors: None,
        original_format: "antigravity_usage_jsonl".to_string(),
        provider_metadata: HashMap::new(),
    }
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

fn saturating_i32(v: u64) -> i32 {
    v.try_into().unwrap_or(i32::MAX)
}

// ============================================================================
// PATH SCHEME PARSING
// ============================================================================

/// Parse an `antigravity://<root>` or `antigravity://<root>|<session_id>`
/// scheme path into (root, session_id). `session_id` is empty for the
/// project-level path.
pub fn parse_scheme_path(scheme_path: &str) -> Result<(PathBuf, String), String> {
    let body = scheme_path
        .strip_prefix("antigravity://")
        .unwrap_or(scheme_path);
    match body.split_once(SCHEME_SEP) {
        Some((root, tail)) => {
            if root.is_empty() {
                return Err(format!(
                    "ANTIGRAVITY_PATH_ERROR: Empty root in: {}",
                    scheme_path
                ));
            }
            Ok((PathBuf::from(root), tail.to_string()))
        }
        None => {
            if body.is_empty() {
                return Err(format!(
                    "ANTIGRAVITY_PATH_ERROR: Empty path: {}",
                    scheme_path
                ));
            }
            Ok((PathBuf::from(body), String::new()))
        }
    }
}

/// Validate a session id, rejecting path-traversal and unsafe characters.
fn is_safe_session_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 256
        && !id.contains("..")
        && !id.contains('/')
        && !id.contains('\\')
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut f = fs::File::create(path).unwrap();
        f.write_all(contents.as_bytes()).unwrap();
    }

    /// Build a temp antigravity root with one session directory containing
    /// manifest.json + usage.jsonl + a .pb file.
    fn make_root() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let session = root.join("conversations").join("sess-abc123");
        write_file(&session.join("manifest.json"), r#"{ "stepCount": 7 }"#);
        write_file(
            &session.join("usage.jsonl"),
            concat!(
                r#"{"recordType":"usage","sequence":0,"model":"gemini-3-pro","inputTokens":100,"outputTokens":50,"cacheReadTokens":10,"cacheWriteTokens":5,"raw":{"chatModel":{"chatStartMetadata":{"createdAt":"2024-01-01T00:00:00Z"}}}}"#,
                "\n",
                r#"{"recordType":"step","sequence":1}"#,
                "\n",
                r#"{"recordType":"usage","sequence":2,"model":"gemini-3-pro","inputTokens":200,"outputTokens":80,"cacheReadTokens":0,"cacheWriteTokens":0,"raw":{"chatModel":{"chatStartMetadata":{"createdAt":"2024-01-01T01:00:00Z"}}}}"#,
                "\n",
            ),
        );
        write_file(&session.join("sess-abc123.pb"), "opening url binary-ish");
        dir
    }

    #[test]
    fn test_parse_usage_jsonl_filters_non_usage() {
        let content = concat!(
            r#"{"recordType":"usage","sequence":0,"model":"m","inputTokens":1,"outputTokens":2}"#,
            "\n",
            r#"{"recordType":"step","sequence":1}"#,
            "\n",
            "not json at all",
            "\n",
            r#"{"recordType":"usage","sequence":2,"model":"m","inputTokens":3,"outputTokens":4}"#,
        );
        let records = parse_usage_jsonl(content);
        assert_eq!(records.len(), 2, "only usage rows are parsed");
        assert_eq!(records[0].input_tokens, 1);
        assert_eq!(records[1].output_tokens, 4);
    }

    #[test]
    fn test_summarize_usage_aggregates_tokens_and_timestamps() {
        let records = read_usage_records(&make_root().path().join("conversations").join("sess-abc123"));
        let summary = summarize_usage(&records);
        assert_eq!(summary.call_count, 2);
        assert_eq!(summary.input_tokens, 300);
        assert_eq!(summary.output_tokens, 130);
        assert_eq!(summary.cache_read_tokens, 10);
        assert!(summary.first_ts_ms > 0);
        assert!(summary.last_ts_ms > summary.first_ts_ms);
    }

    #[test]
    fn test_read_manifest_step_count() {
        let dir = make_root();
        let session = dir.path().join("conversations").join("sess-abc123");
        assert_eq!(read_manifest_step_count(&session), 7);
        // Missing manifest → 0
        assert_eq!(read_manifest_step_count(dir.path()), 0);
    }

    #[test]
    fn test_scan_projects_single_aggregated_project() {
        let dir = make_root();
        let projects = scan_antigravity_projects(dir.path(), "src").unwrap();
        assert_eq!(projects.len(), 1);
        let p = &projects[0];
        assert_eq!(p.name, "Antigravity");
        assert_eq!(p.provider_id, "antigravity");
        assert_eq!(p.session_count, 1);
        assert_eq!(p.total_messages, 2);
        assert!(p.last_activity_at.is_some());
    }

    #[test]
    fn test_load_sessions_metadata_from_manifest_and_usage() {
        let dir = make_root();
        let sessions = load_antigravity_sessions(dir.path(), "src").unwrap();
        assert_eq!(sessions.len(), 1);
        let s = &sessions[0];
        assert_eq!(s.provider_id, "antigravity");
        assert_eq!(s.message_count, 2);
        let tokens = s.total_tokens.as_ref().expect("tokens present");
        assert_eq!(tokens.input_tokens, 300);
        assert_eq!(tokens.output_tokens, 130);
        // description carries step count from manifest.json
        assert!(s.description.as_ref().unwrap().contains("7 steps"));
        assert_eq!(
            s.metadata.get("transcriptDecoded").and_then(Value::as_bool),
            Some(false)
        );
    }

    #[test]
    fn test_load_messages_emits_notice_and_usage_records() {
        let dir = make_root();
        let session_scheme = format!(
            "antigravity://{}|sess-abc123",
            dir.path().to_string_lossy()
        );
        let msgs = load_antigravity_messages(
            dir.path(),
            "sess-abc123",
            &session_scheme,
            "proj",
            "src",
            0,
            100,
        )
        .unwrap();

        // notice + 2 usage records
        assert_eq!(msgs.len(), 3);
        assert_eq!(msgs[0].role, MessageRole::System);
        assert!(msgs[0].content[0]
            .data
            .get("text")
            .and_then(Value::as_str)
            .unwrap()
            .contains("protobuf"));

        assert_eq!(msgs[1].role, MessageRole::Assistant);
        assert_eq!(msgs[1].model.as_deref(), Some("gemini-3-pro"));
        assert!(msgs[1].tokens.is_some());

        // .pb contains "opening url" → BrowserOpenUrl attached to last message
        let last = msgs.last().unwrap();
        let calls = last.tool_calls.as_ref().expect("tool calls extracted");
        assert!(calls.iter().any(|c| c.name == "BrowserOpenUrl"));
    }

    #[test]
    fn test_load_messages_rejects_unsafe_session_id() {
        let dir = make_root();
        let err = load_antigravity_messages(
            dir.path(),
            "../escape",
            "antigravity://x|../escape",
            "proj",
            "src",
            0,
            10,
        );
        assert!(err.is_err());
    }

    #[test]
    fn test_parse_scheme_path_with_session() {
        let p = "antigravity://C:\\Users\\me\\.gemini\\antigravity|sess-1";
        let (root, id) = parse_scheme_path(p).unwrap();
        assert_eq!(root, PathBuf::from("C:\\Users\\me\\.gemini\\antigravity"));
        assert_eq!(id, "sess-1");
    }

    #[test]
    fn test_parse_scheme_path_project_only() {
        let p = "antigravity:///home/me/.gemini/antigravity";
        let (root, id) = parse_scheme_path(p).unwrap();
        assert_eq!(root, PathBuf::from("/home/me/.gemini/antigravity"));
        assert_eq!(id, "");
    }

    #[test]
    fn test_is_safe_session_id() {
        assert!(is_safe_session_id("sess-abc_123.v2"));
        assert!(!is_safe_session_id(""));
        assert!(!is_safe_session_id("../escape"));
        assert!(!is_safe_session_id("a/b"));
        assert!(!is_safe_session_id("a\\b"));
        assert!(!is_safe_session_id("has space"));
    }

    #[test]
    fn test_flat_pb_session_metadata_only() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        // create marker + flat pb (no per-session dir / metadata)
        fs::create_dir_all(root.join("conversations")).unwrap();
        write_file(&root.join("conversations").join("flatsess.pb"), "clicking");
        let sessions = load_antigravity_sessions(root, "src").unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].message_count, 0);
        assert!(sessions[0].total_tokens.is_none());
    }
}
