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
    let end = offset.saturating_add(limit).min(total);
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
// NEW STORE LAYOUT (2026-10+, desktop AND antigravity-cli)
// ============================================================================
// Current Antigravity builds keep one conversation layout across the desktop
// root (`~/.gemini/antigravity`) and the CLI root (`~/.gemini/antigravity-cli`):
//
//   <root>/
//     conversation_summaries.db              SQLite index: conversation_id →
//                                           title/preview, workspace_uris,
//                                           step_count, last_modified_time
//     history.jsonl                          (CLI) prompt index: display,
//                                           timestamp, workspace, conversationId
//     brain/<conversation-uuid>/
//       .system_generated/logs/transcript_full.jsonl
//                                           step records: {"step_index",
//                                           "source" (USER_EXPLICIT|MODEL|…),
//                                           "type" (USER_INPUT|PLANNER_RESPONSE|
//                                           GENERIC|CONVERSATION_HISTORY|…),
//                                           "status", "content"?, "tool_calls"?,
//                                           token counters?, "created_at"?}
//
// `conversations/*.db|*.pb` are encrypted (entropy 8.00/8.00 — upstream #564
// measured the same) and are NOT parsed; the `.pb` byte-scan of the legacy
// path is dead weight against current builds. The transcript JSONL carries
// the real conversation, so sessions render with actual content, tools and
// token usage. Reverse-engineered format: parsing stays tolerant, malformed
// lines and unknown enum values are skipped, never errors.
// ============================================================================

/// One conversation discovered in a brain-transcript store.
struct BrainSession {
    conversation_id: String,
    workspace: Option<String>,
    title: Option<String>,
    step_count: Option<u64>,
    last_modified: Option<String>,
    messages: Vec<UniversalMessage>,
}

/// `file:///w%3A/_proj/x` / `file:///W:/_proj/x` → `w:/_proj/x`.
/// Only `file://` URIs are accepted; history.jsonl workspaces are raw paths.
fn decode_workspace_uri(uri: &str) -> Option<String> {
    let path = uri.strip_prefix("file://")?;
    let decoded = percent_decode(path);
    if decoded.is_empty() {
        return None;
    }
    // `/w:/…` → `w:/…` (drive-letter path); POSIX absolute paths keep the `/`.
    let bytes = decoded.as_bytes();
    if bytes.len() >= 3 && bytes[0] == b'/' && bytes[1].is_ascii_alphabetic() && bytes[2] == b':' {
        return Some(decoded[1..].to_string());
    }
    Some(decoded)
}

/// Minimal percent-decoder (`%XX` → byte, invalid escapes pass through).
fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            // Only decode when both following bytes are ASCII hex digits; a
            // `%` before a multibyte UTF-8 char must stay literal instead of
            // slicing mid-codepoint (upstream #398).
            if let (Some(hi), Some(lo)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push((hi * 16 + lo) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

/// Percent-encode a workspace path for the `|ws:<encoded>` scheme segment.
fn percent_encode_workspace(workspace: &str) -> String {
    let mut out = String::with_capacity(workspace.len());
    for byte in workspace.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b'~') {
            out.push(byte as char);
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

pub fn decode_workspace_tail(tail: &str) -> Option<String> {
    let encoded = tail.strip_prefix("ws:")?;
    let decoded = percent_decode(encoded);
    if decoded.is_empty() {
        None
    } else {
        Some(decoded)
    }
}

/// Conversation index from `conversation_summaries.db` (SQLite, read-only).
struct SummaryRow {
    title: Option<String>,
    workspace: Option<String>,
    step_count: Option<u64>,
    last_modified: Option<String>,
}

fn read_summaries(root: &Path) -> HashMap<String, SummaryRow> {
    let db = root.join("conversation_summaries.db");
    if !db.is_file() {
        return HashMap::new();
    }
    let Ok(conn) = rusqlite::Connection::open_with_flags(
        &db,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    ) else {
        return HashMap::new();
    };
    let mut stmt = match conn.prepare(
        "SELECT conversation_id, title, preview, workspace_uris, step_count, last_modified_time
         FROM conversation_summaries",
    ) {
        Ok(stmt) => stmt,
        Err(_) => return HashMap::new(),
    };
    let rows = stmt.query_map([], |row| {
        let conversation_id: String = row.get(0)?;
        let title: Option<String> = row.get(1)?;
        let preview: Option<String> = row.get(2)?;
        let workspace_uris: Option<String> = row.get(3)?;
        let step_count: Option<i64> = row.get(4)?;
        let last_modified: Option<String> = row.get(5)?;
        Ok((
            conversation_id,
            title,
            preview,
            workspace_uris,
            step_count,
            last_modified,
        ))
    });
    let mut index = HashMap::new();
    if let Ok(rows) = rows {
        for row in rows.flatten() {
            let (conversation_id, title, preview, workspace_uris, step_count, last_modified) = row;
            let title = title
                .map(|t| t.trim().to_string())
                .filter(|t| !t.is_empty())
                .or_else(|| {
                    preview
                        .map(|p| p.trim().to_string())
                        .filter(|p| !p.is_empty())
                });
            let workspace = workspace_uris
                .and_then(|uris| serde_json::from_str::<Value>(&uris).ok())
                .and_then(|v| v.as_array().cloned())
                .and_then(|arr| {
                    arr.iter()
                        .find_map(|u| u.as_str())
                        .and_then(decode_workspace_uri)
                });
            index.insert(
                conversation_id,
                SummaryRow {
                    title,
                    workspace,
                    step_count: step_count.map(|s| s.max(0) as u64),
                    last_modified: last_modified
                        .and_then(|raw| normalize_sqlite_timestamp(&raw)),
                },
            );
        }
    }
    index
}

/// `2026-04-10 01:16:59.0175007+00:00` → RFC3339.
fn normalize_sqlite_timestamp(raw: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|dt| dt.to_rfc3339())
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S%.f")
                .ok()
                .map(|dt| dt.and_utc().to_rfc3339())
        })
        .or_else(|| {
            chrono::DateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S%.f%:z")
                .ok()
                .map(|dt| dt.to_rfc3339())
        })
}

/// First entry per conversation from the CLI `history.jsonl` prompt index.
fn read_history_index(root: &Path) -> HashMap<String, (Option<String>, Option<u64>, Option<String>)>
{
    let path = root.join("history.jsonl");
    let Ok(content) = fs::read_to_string(path) else {
        return HashMap::new();
    };
    let mut index = HashMap::new();
    for line in content.lines().filter(|l| !l.trim().is_empty()) {
        let Ok(rec) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let Some(conversation_id) = rec.get("conversationId").and_then(Value::as_str) else {
            continue;
        };
        let display = rec
            .get("display")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned);
        let timestamp = rec.get("timestamp").and_then(Value::as_u64);
        let workspace = rec
            .get("workspace")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(ToOwned::to_owned);
        index
            .entry(conversation_id.to_string())
            .or_insert((display, timestamp, workspace));
    }
    index
}

fn brain_transcript_path(session_dir: &Path) -> PathBuf {
    session_dir
        .join(".system_generated")
        .join("logs")
        .join("transcript_full.jsonl")
}

fn is_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|m| !m.file_type().is_symlink() && m.is_file())
        .unwrap_or(false)
}

/// `brain/<uuid>` directories carrying a readable full transcript.
/// Symlinked entries are skipped (store-escape guard).
fn list_brain_sessions(root: &Path) -> Vec<(String, PathBuf)> {
    let brain = root.join("brain");
    let Ok(entries) = fs::read_dir(&brain) else {
        return Vec::new();
    };
    let mut sessions = Vec::new();
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() || !file_type.is_dir() {
            continue;
        }
        let dir = entry.path();
        if !is_regular_file(&brain_transcript_path(&dir)) {
            continue;
        }
        sessions.push((entry.file_name().to_string_lossy().to_string(), dir));
    }
    sessions.sort_by(|a, b| a.0.cmp(&b.0));
    sessions
}

pub fn has_brain_transcripts(root: &Path) -> bool {
    !list_brain_sessions(root).is_empty()
}

/// Default antigravity-cli store root (`~/.gemini/antigravity-cli`).
pub fn get_antigravity_cli_base_path() -> Option<PathBuf> {
    let root = default_antigravity_root()?
        .parent()?
        .join("antigravity-cli");
    if is_antigravity_root(&root) {
        Some(root)
    } else {
        None
    }
}

/// Every available Antigravity store root: desktop first, then CLI. Both
/// layouts may coexist on one machine.
pub fn get_antigravity_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(root) = get_antigravity_base_path() {
        roots.push(root);
    }
    if let Some(cli) = get_antigravity_cli_base_path() {
        if !roots.contains(&cli) {
            roots.push(cli);
        }
    }
    roots
}

/// All sessions of a root across workspaces (search entry point).
pub fn load_all_antigravity_sessions(
    root: &Path,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    if has_brain_transcripts(root) {
        // Deduplicate case-insensitively: the same workspace arrives as
        // w:/... and W:/..., and the case-folded filter would load its
        // sessions once per spelling.
        let mut seen_keys: std::collections::HashSet<Option<String>> =
            std::collections::HashSet::new();
        let mut seen_workspaces: Vec<Option<String>> = Vec::new();
        for session in collect_brain_sessions(root, source_id) {
            let key = session.workspace.as_ref().map(|w| w.to_lowercase());
            if seen_keys.insert(key) {
                seen_workspaces.push(session.workspace);
            }
        }
        let mut all = Vec::new();
        for workspace in seen_workspaces {
            all.extend(load_antigravity_store_sessions(
                root,
                workspace.as_deref(),
                source_id,
            )?);
        }
        Ok(all)
    } else {
        load_antigravity_sessions(root, source_id)
    }
}

/// Route message loading: brain transcript layout when present, otherwise the
/// legacy `conversations/` usage.jsonl flow.
pub fn load_antigravity_messages_auto(
    root: &Path,
    session_id: &str,
    session_scheme: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let transcript = brain_transcript_path(&root.join("brain").join(session_id));
    if is_safe_session_id(session_id) && is_regular_file(&transcript) {
        load_antigravity_transcript_messages(
            root,
            session_id,
            session_scheme,
            project_id,
            source_id,
            offset,
            limit,
        )
    } else {
        load_antigravity_messages(
            root,
            session_id,
            session_scheme,
            project_id,
            source_id,
            offset,
            limit,
        )
    }
}

/// Join on-disk brain sessions with both indexes; zero-message transcripts
/// are dropped.
fn collect_brain_sessions(root: &Path, source_id: &str) -> Vec<BrainSession> {
    let summaries = read_summaries(root);
    let history = read_history_index(root);

    list_brain_sessions(root)
        .into_iter()
        .filter_map(|(conversation_id, dir)| {
            let summary = summaries.get(&conversation_id);
            let hist = history.get(&conversation_id);
            let transcript = brain_transcript_path(&dir);
            let fallback_ts = hist
                .and_then(|(_, ts, _)| *ts)
                .map(|ms| epoch_ms_to_rfc3339(ms as i64))
                .or_else(|| {
                    fs::metadata(&transcript)
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .map(|t| {
                            let dt: chrono::DateTime<chrono::Utc> = t.into();
                            dt.to_rfc3339()
                        })
                })
                .unwrap_or_default();

            let messages =
                parse_brain_transcript(&transcript, &conversation_id, source_id, &fallback_ts);
            if messages.is_empty() {
                return None;
            }

            let title = summary
                .and_then(|s| s.title.clone())
                .or_else(|| hist.and_then(|(display, _, _)| display.clone()))
                .or_else(|| first_user_text(&messages));
            let workspace = summary
                .and_then(|s| s.workspace.clone())
                .or_else(|| hist.and_then(|(_, _, ws)| ws.clone()));

            Some(BrainSession {
                conversation_id,
                workspace,
                title,
                step_count: summary.and_then(|s| s.step_count),
                last_modified: summary.and_then(|s| s.last_modified.clone()),
                messages,
            })
        })
        .collect()
}

fn first_user_text(messages: &[UniversalMessage]) -> Option<String> {
    messages
        .iter()
        .find(|m| m.role == MessageRole::User)
        .and_then(|m| m.content.first())
        .and_then(|c| c.data.get("text"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(ToOwned::to_owned)
}

fn fallback_project_name(root: &Path) -> String {
    if root
        .file_name()
        .map(|n| n == "antigravity-cli")
        .unwrap_or(false)
    {
        "Antigravity CLI".to_string()
    } else {
        "Antigravity".to_string()
    }
}

fn workspace_project_name(workspace: &str) -> String {
    Path::new(workspace)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| workspace.to_string())
}

/// Scan a store root. Uses the brain-transcript layout when present, and
/// falls back to the legacy `conversations/` usage.jsonl flow otherwise
/// (pre-2026-10 desktop installs).
pub fn scan_antigravity_store(
    root: &Path,
    source_id: &str,
) -> Result<Vec<UniversalProject>, String> {
    if !is_antigravity_root(root) {
        return Ok(Vec::new());
    }
    if !has_brain_transcripts(root) {
        return scan_antigravity_projects(root, source_id);
    }

    let sessions = collect_brain_sessions(root, source_id);
    if sessions.is_empty() {
        return Ok(Vec::new());
    }

    #[derive(Default)]
    struct Acc {
        session_count: usize,
        total_messages: usize,
        first: Option<String>,
        last: Option<String>,
    }

    // Windows workspaces arrive in mixed case (file:///w:/ vs file:///W:/);
    // group case-insensitively so one project does not split in two
    // (upstream's UNC-spelling review applied to drive roots).
    fn workspace_key(ws: &Option<String>) -> Option<String> {
        ws.as_ref().map(|w| w.to_lowercase())
    }
    let mut by_workspace: HashMap<Option<String>, Acc> = HashMap::new();
    for session in &sessions {
        let first = session.messages.first().map(|m| m.timestamp.clone());
        let last = session
            .last_modified
            .clone()
            .or_else(|| session.messages.last().map(|m| m.timestamp.clone()));
        let acc = by_workspace.entry(workspace_key(&session.workspace)).or_default();
        acc.session_count += 1;
        acc.total_messages += session.messages.len();
        if let Some(first) = &first {
            if acc.first.as_deref().map_or(true, |cur| first.as_str() < cur) {
                acc.first = Some(first.clone());
            }
        }
        if let Some(last) = &last {
            if acc.last.as_deref().map_or(true, |cur| last.as_str() > cur) {
                acc.last = Some(last.clone());
            }
        }
    }

    let root_str = root.to_string_lossy().to_string();
    let mut projects = Vec::new();
    for (workspace, acc) in by_workspace {
        let (name, scheme) = match &workspace {
            Some(ws) => (
                workspace_project_name(ws),
                format!(
                    "antigravity://{}{}ws:{}",
                    root_str,
                    SCHEME_SEP,
                    percent_encode_workspace(ws)
                ),
            ),
            None => (
                fallback_project_name(root),
                format!("antigravity://{}", root_str),
            ),
        };
        let mut metadata: HashMap<String, Value> = HashMap::new();
        metadata.insert("antigravityRoot".to_string(), json!(root_str));
        if let Some(ws) = &workspace {
            metadata.insert("workspace".to_string(), json!(ws));
        }
        projects.push(UniversalProject {
            id: scheme.clone(),
            source_id: source_id.to_string(),
            provider_id: "antigravity".to_string(),
            name,
            path: scheme,
            session_count: acc.session_count,
            total_messages: acc.total_messages,
            first_activity_at: acc.first,
            last_activity_at: acc.last,
            metadata,
        });
    }
    projects.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(projects)
}

/// Load sessions for one workspace of a store root. `workspace == None`
/// selects the unknown bucket (sessions no index could place).
pub fn load_antigravity_store_sessions(
    root: &Path,
    workspace: Option<&str>,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    if !has_brain_transcripts(root) {
        return load_antigravity_sessions(root, source_id);
    }
    let root_str = root.to_string_lossy().to_string();

    let mut sessions: Vec<UniversalSession> = collect_brain_sessions(root, source_id)
        .into_iter()
        .filter(|session| {
            let key = session.workspace.as_ref().map(|w| w.to_lowercase());
            match (&key, workspace) {
                (Some(a), Some(b)) => a == &b.to_lowercase(),
                (None, None) => true,
                _ => false,
            }
        })
        .map(|session| {
            let project_scheme = match &session.workspace {
                Some(ws) => format!(
                    "antigravity://{}{}ws:{}",
                    root_str,
                    SCHEME_SEP,
                    percent_encode_workspace(ws)
                ),
                None => format!("antigravity://{}", root_str),
            };
            let session_scheme =
                format!("antigravity://{}{}{}", root_str, SCHEME_SEP, session.conversation_id);

            let first_ts = session
                .messages
                .first()
                .map(|m| m.timestamp.clone())
                .unwrap_or_default();
            let last_ts = session
                .last_modified
                .clone()
                .or_else(|| session.messages.last().map(|m| m.timestamp.clone()))
                .unwrap_or_default();

            let (in_sum, out_sum, cache_sum) = session.messages.iter().fold(
                (0u64, 0u64, 0u64),
                |(i, o, c), m| {
                    let t = m.tokens.as_ref();
                    (
                        i + t.map(|t| t.input_tokens.max(0) as u64).unwrap_or(0),
                        o + t.map(|t| t.output_tokens.max(0) as u64).unwrap_or(0),
                        c + t
                            .and_then(|t| t.cache_read_tokens)
                            .map(|v| v.max(0) as u64)
                            .unwrap_or(0),
                    )
                },
            );
            let total = in_sum.saturating_add(out_sum).saturating_add(cache_sum);
            let total_tokens = if total > 0 {
                Some(TokenUsage {
                    input_tokens: saturating_i32(in_sum),
                    output_tokens: saturating_i32(out_sum),
                    total_tokens: saturating_i32(total),
                    cache_creation_tokens: None,
                    cache_read_tokens: Some(saturating_i32(cache_sum)),
                    service_tier: None,
                })
            } else {
                None
            };

            let tool_call_count: usize = session
                .messages
                .iter()
                .map(|m| m.tool_calls.as_ref().map_or(0, |c| c.len()))
                .sum();

            let title = session
                .title
                .clone()
                .unwrap_or_else(|| session.conversation_id.chars().take(8).collect());
            let step_note = session
                .step_count
                .map(|s| format!(" · {s} steps"))
                .unwrap_or_default();
            let description = if total > 0 {
                Some(format!(
                    "in={} out={} total={}{}",
                    fmt_tokens(in_sum),
                    fmt_tokens(out_sum),
                    fmt_tokens(total),
                    step_note
                ))
            } else {
                None
            };

            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert("filePath".to_string(), json!(session_scheme));
            metadata.insert("antigravityRoot".to_string(), json!(root_str));
            metadata.insert("sessionId".to_string(), json!(session.conversation_id));
            if let Some(ws) = &session.workspace {
                metadata.insert("workspace".to_string(), json!(ws));
            }
            metadata.insert("transcriptDecoded".to_string(), json!(true));

            UniversalSession {
                id: session_scheme,
                project_id: project_scheme,
                source_id: source_id.to_string(),
                provider_id: "antigravity".to_string(),
                title,
                description,
                message_count: session.messages.len(),
                first_message_at: first_ts,
                last_message_at: last_ts,
                duration: 0,
                total_tokens,
                tool_call_count,
                error_count: 0,
                entrypoint: None,
                metadata,
                checksum: format!(
                    "{}:{}",
                    session.conversation_id,
                    session.messages.len()
                ),
            }
        })
        .collect();

    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    Ok(sessions)
}

/// Load messages from a brain transcript with pagination.
pub fn load_antigravity_transcript_messages(
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
    let transcript = brain_transcript_path(&root.join("brain").join(session_id));
    if !is_regular_file(&transcript) {
        return Err(format!(
            "ANTIGRAVITY_TRANSCRIPT_NOT_FOUND: {}",
            transcript.display()
        ));
    }
    let history = read_history_index(root);
    let fallback_ts = history
        .get(session_id)
        .and_then(|(_, ts, _)| *ts)
        .map(|ms| epoch_ms_to_rfc3339(ms as i64))
        .unwrap_or_default();

    let messages = parse_brain_transcript(&transcript, session_id, source_id, &fallback_ts)
        .into_iter()
        .map(|mut m| {
            m.session_id = session_scheme.to_string();
            m.project_id = project_id.to_string();
            m
        })
        .collect::<Vec<_>>();

    let total = messages.len();
    let start = offset.min(total);
    let end = offset.saturating_add(limit).min(total);
    Ok(messages[start..end].to_vec())
}

/// Parse `transcript_full.jsonl` into Universal messages. Tolerant:
/// malformed lines and unmapped shapes are skipped, never errors.
fn parse_brain_transcript(
    path: &Path,
    conversation_id: &str,
    source_id: &str,
    fallback_ts: &str,
) -> Vec<UniversalMessage> {
    if !is_regular_file(path) {
        return Vec::new();
    }
    let Ok(content) = fs::read_to_string(path) else {
        return Vec::new();
    };

    let mut messages = Vec::new();
    let mut last_ts = fallback_ts.to_string();
    let mut sequence: i32 = 0;

    for (line_idx, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let Ok(rec) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        if let Some(ts) = rec.get("created_at").and_then(Value::as_str) {
            if let Some(normalized) = normalize_created_at(ts) {
                last_ts = normalized;
            }
        }
        let step_index = rec
            .get("step_index")
            .and_then(Value::as_u64)
            .unwrap_or(line_idx as u64);
        if let Some((role, content, tokens, tool_calls)) = convert_step(&rec) {
            let id = format!("antigravity-{}-step-{}", conversation_id, step_index);
            let mut message = build_message(
                &id,
                &format!("antigravity-{}", conversation_id),
                "",
                source_id,
                &last_ts.clone(),
                role,
                MessageType::Message,
                content,
                sequence,
                None,
                tokens,
            );
            message.tool_calls = tool_calls;
            message.original_format = "antigravity_transcript_jsonl".to_string();
            messages.push(message);
            sequence += 1;
        }
    }
    messages
}

fn normalize_created_at(raw: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(raw)
        .map(|dt| dt.to_rfc3339())
        .ok()
        .or_else(|| {
            chrono::NaiveDateTime::parse_from_str(raw, "%Y-%m-%dT%H:%M:%S%.f")
                .ok()
                .map(|dt| dt.and_utc().to_rfc3339())
        })
}

/// Map one step record to (role, content blocks, usage, tool_calls):
/// - `USER_EXPLICIT` / `USER_INPUT` with content → user text
/// - `MODEL` with content → assistant text (`PLANNER_RESPONSE`) or a
///   tool-marker + text for other step types (e.g. `GENERIC`, `SEARCH_WEB`)
/// - `MODEL` without content but with `tool_calls`/tokens → assistant
///   tool-call message carrying real usage
/// - `CONVERSATION_HISTORY` / `SYSTEM` → skip (replay, not a turn)
/// - unknown sources → skip, never error (format is reverse-engineered)
#[allow(clippy::type_complexity)]
fn convert_step(
    rec: &Value,
) -> Option<(MessageRole, Vec<UniversalContent>, Option<TokenUsage>, Option<Vec<ToolCall>>)> {
    let source = rec.get("source").and_then(Value::as_str).unwrap_or("");
    let step_type = rec.get("type").and_then(Value::as_str).unwrap_or("");

    if step_type == "CONVERSATION_HISTORY" || source == "SYSTEM" {
        return None;
    }
    let content_text = rec
        .get("content")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|c| !c.is_empty());

    if source == "USER_EXPLICIT" || step_type == "USER_INPUT" {
        return content_text.map(|text| (MessageRole::User, vec![text_content(text)], None, None));
    }

    if source == "MODEL" {
        let tokens = step_usage(rec);
        if let Some(text) = content_text {
            if step_type.is_empty() || step_type == "PLANNER_RESPONSE" {
                return Some((
                    MessageRole::Assistant,
                    vec![text_content(text)],
                    tokens,
                    None,
                ));
            }
            return Some((
                MessageRole::Assistant,
                vec![
                    UniversalContent {
                        content_type: ContentType::ToolUse,
                        data: json!({ "type": "tool_use", "name": step_type, "input": {} }),
                        encoding: None,
                        mime_type: None,
                        size: None,
                        hash: None,
                    },
                    text_content(text),
                ],
                tokens,
                None,
            ));
        }
        // Content-less planner step: real tool calls and/or token usage.
        let tool_calls = parse_tool_calls(rec);
        if tool_calls.is_none() && tokens.is_none() {
            return None;
        }
        return Some((
            MessageRole::Assistant,
            Vec::new(),
            tokens,
            tool_calls,
        ));
    }

    None
}

fn step_usage(rec: &Value) -> Option<TokenUsage> {
    let get = |key: &str| rec.get(key).and_then(Value::as_u64).unwrap_or(0);
    let input = get("input_tokens");
    let output = get("output_tokens");
    let cache_read = get("cache_read_tokens");
    let cache_write = get("cache_write_tokens");
    let total = input
        .saturating_add(output)
        .saturating_add(cache_read)
        .saturating_add(cache_write);
    if total == 0 {
        return None;
    }
    Some(TokenUsage {
        input_tokens: saturating_i32(input),
        output_tokens: saturating_i32(output),
        total_tokens: saturating_i32(total),
        cache_creation_tokens: Some(saturating_i32(cache_write)),
        cache_read_tokens: Some(saturating_i32(cache_read)),
        service_tier: None,
    })
}

fn parse_tool_calls(rec: &Value) -> Option<Vec<ToolCall>> {
    let calls = rec.get("tool_calls")?.as_array()?;
    let parsed = calls
        .iter()
        .enumerate()
        .filter_map(|(i, call)| {
            let name = call.get("name").and_then(Value::as_str)?;
            let input = call
                .get("args")
                .and_then(Value::as_object)
                .map(|obj| {
                    obj.iter()
                        .map(|(k, v)| (k.clone(), v.clone()))
                        .collect::<HashMap<String, Value>>()
                })
                .unwrap_or_default();
            Some(ToolCall {
                id: format!("tool-{i}"),
                name: name.to_string(),
                input,
                output: None,
                error: None,
                status: ToolCallStatus::Success,
            })
        })
        .collect::<Vec<_>>();
    if parsed.is_empty() {
        None
    } else {
        Some(parsed)
    }
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
    fn test_load_messages_huge_offset_limit_no_overflow() {
        let dir = make_root();
        let session_scheme = format!(
            "antigravity://{}|sess-abc123",
            dir.path().to_string_lossy()
        );
        // offset + limit would overflow usize without saturating arithmetic.
        let msgs = load_antigravity_messages(
            dir.path(),
            "sess-abc123",
            &session_scheme,
            "proj",
            "src",
            usize::MAX,
            usize::MAX,
        )
        .unwrap();
        assert!(msgs.is_empty(), "huge offset returns empty, not a panic");
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

    // ========================================================================
    // New store layout (2026-10+): brain/<uuid>/.system_generated/logs/
    // transcript_full.jsonl + conversation_summaries.db index. Mirrors the
    // layout reverse-engineered from a real Antigravity desktop + CLI install.
    // ========================================================================

    fn write_brain_transcript(root: &Path, conv: &str, lines: &[&str]) {
        write_file(
            &root
                .join("brain")
                .join(conv)
                .join(".system_generated")
                .join("logs")
                .join("transcript_full.jsonl"),
            &lines.join("\n"),
        );
    }

    fn write_summaries_db(root: &Path, rows: &[( &str, &str, &str )]) {
        let conn = rusqlite::Connection::open(root.join("conversation_summaries.db")).unwrap();
        conn.execute_batch(
            "CREATE TABLE conversation_summaries (
                conversation_id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                preview TEXT NOT NULL DEFAULT '',
                workspace_uris TEXT NOT NULL DEFAULT '',
                last_modified_time TEXT NOT NULL DEFAULT '',
                step_count INTEGER NOT NULL DEFAULT 0
            );",
        )
        .unwrap();
        for (id, preview, ws_uris) in rows {
            conn.execute(
                "INSERT INTO conversation_summaries
                 (conversation_id, title, preview, workspace_uris, last_modified_time, step_count)
                 VALUES (?1, '', ?2, ?3, '2026-10-30 20:00:00.0000000+00:00', 4)",
                rusqlite::params![id, preview, ws_uris],
            )
            .unwrap();
        }
    }

    /// Real step shapes observed in a live transcript (2026-10-30).
    fn real_step_lines() -> Vec<&'static str> {
        vec![
            r#"{"step_index": 0, "source": "USER_EXPLICIT", "type": "USER_INPUT", "status": "DONE", "content": "Ты — строгий рецензент статьи", "created_at": "2026-10-30T19:59:39Z"}"#,
            r#"{"step_index": 1, "source": "MODEL", "type": "PLANNER_RESPONSE", "status": "DONE", "created_at": "2026-10-30T19:59:40Z", "input_tokens": 8028, "output_tokens": 83, "cache_read_tokens": 0, "tool_calls": [{"name": "read_file", "args": {"Path": "W:\\proj\\x.txt"}}]}"#,
            r#"{"step_index": 2, "source": "MODEL", "type": "GENERIC", "status": "DONE", "created_at": "2026-10-30T19:59:44Z", "content": "Completed At: 2026-10-30T22:59:44+03:00"}"#,
            r#"{"step_index": 3, "source": "SYSTEM", "type": "CONVERSATION_HISTORY", "status": "DONE", "content": "replayed context"}"#,
            "{ this line is not json",
        ]
    }

    #[test]
    fn test_decode_workspace_uri_both_spellings() {
        assert_eq!(
            decode_workspace_uri("file:///w%3A/_proj/_own/x").as_deref(),
            Some("w:/_proj/_own/x")
        );
        assert_eq!(
            decode_workspace_uri("file:///W:/_proj/y").as_deref(),
            Some("W:/_proj/y")
        );
        assert_eq!(decode_workspace_uri("not-a-uri"), None);
    }

    #[test]
    fn test_brain_scan_groups_by_workspace_and_titles_from_summaries_db() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write_brain_transcript(root, "conv-aaa", &real_step_lines());
        write_brain_transcript(
            root,
            "conv-bbb",
            &[
                r#"{"step_index": 0, "source": "USER_EXPLICIT", "type": "USER_INPUT", "status": "DONE", "content": "orphan prompt", "created_at": "2026-10-29T08:00:00Z"}"#,
            ],
        );
        write_summaries_db(
            root,
            &[
                ("conv-aaa", "UX And Flow Code Review", r#"["file:///w%3A/_proj/_own/ideator"]"#),
                // conv-bbb absent from the index → unknown workspace + first-user title.
            ],
        );

        let projects = scan_antigravity_store(root, "antigravity:test").unwrap();
        assert_eq!(projects.len(), 2, "workspace project + unknown bucket");

        let ws = projects.iter().find(|p| p.name == "ideator").expect("workspace project");
        assert_eq!(ws.session_count, 1);
        assert_eq!(ws.total_messages, 3, "user + tool-step + generic step");

        let sessions =
            load_antigravity_store_sessions(root, Some("w:/_proj/_own/ideator"), "antigravity:test")
                .unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].title, "UX And Flow Code Review");
        assert_eq!(sessions[0].message_count, 3);

        let unknown = load_antigravity_store_sessions(root, None, "antigravity:test").unwrap();
        assert_eq!(unknown.len(), 1);
        assert_eq!(unknown[0].title, "orphan prompt");
    }

    #[test]
    fn test_brain_scan_falls_back_to_history_jsonl_workspace() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        // No conversation_summaries.db at all — CLI store may lack it.
        write_file(
            &root.join("history.jsonl"),
            concat!(
                r#"{"display":"Fix the parser","timestamp":1750500000000,"workspace":"C:\\proj-a","conversationId":"conv-aaa"}"#,
                "\n",
            ),
        );
        write_brain_transcript(root, "conv-aaa", &real_step_lines());

        let projects = scan_antigravity_store(root, "antigravity:test").unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "proj-a");
        assert_eq!(projects[0].session_count, 1);

        let sessions =
            load_antigravity_store_sessions(root, Some("C:\\proj-a"), "antigravity:test").unwrap();
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].title, "Fix the parser");
    }

    #[test]
    fn test_load_transcript_messages_maps_real_step_shapes() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        write_brain_transcript(root, "conv-aaa", &real_step_lines());

        let messages = load_antigravity_transcript_messages(
            root,
            "conv-aaa",
            "antigravity://x|conv-aaa",
            "antigravity://x",
            "antigravity:test",
            0,
            100,
        )
        .unwrap();

        // step0 user, step1 tool-call planner, step2 generic model; step3 +
        // malformed skipped.
        assert_eq!(messages.len(), 3);

        assert_eq!(messages[0].role, MessageRole::User);
        assert_eq!(messages[0].content[0].data["text"], "Ты — строгий рецензент статьи");
        assert!(messages[0].timestamp.starts_with("2026-10-30T19:59:39"));

        // Content-less PLANNER_RESPONSE with tool_calls + tokens → a
        // tool-use message carrying real usage.
        assert_eq!(messages[1].role, MessageRole::Assistant);
        let calls = messages[1].tool_calls.as_ref().expect("tool_calls");
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "read_file");
        assert_eq!(calls[0].input.get("Path"), Some(&json!("W:\\proj\\x.txt")));
        let usage = messages[1].tokens.as_ref().expect("usage on tool step");
        assert_eq!(usage.input_tokens, 8028);
        assert_eq!(usage.output_tokens, 83);
        assert_eq!(usage.cache_read_tokens, Some(0));

        // GENERIC model step keeps the raw type visible as a tool marker.
        assert_eq!(messages[2].role, MessageRole::Assistant);
        assert_eq!(messages[2].content[0].data["type"], "tool_use");
        assert_eq!(messages[2].content[0].data["name"], "GENERIC");
        assert_eq!(messages[2].content[1].data["text"], "Completed At: 2026-10-30T22:59:44+03:00");
    }

    #[test]
    fn test_load_transcript_messages_rejects_unsafe_session_id() {
        let dir = tempfile::tempdir().unwrap();
        let err = load_antigravity_transcript_messages(
            dir.path(),
            "../evil",
            "s",
            "p",
            "src",
            0,
            10,
        );
        assert!(err.is_err());
    }

    #[test]
    fn test_legacy_root_without_brain_uses_old_flow() {
        // A pre-2026-10 desktop layout (conversations/<id>/usage.jsonl, no
        // brain transcripts) must keep working through the legacy path.
        let dir = make_root();
        assert!(!has_brain_transcripts(dir.path()));
        let projects = scan_antigravity_store(dir.path(), "antigravity:test").unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].name, "Antigravity");
        assert_eq!(projects[0].session_count, 1);
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;

    #[test]
    #[ignore = "runs against the real local Antigravity stores"]
    fn live_scan_real_stores() {
        for root in get_antigravity_roots() {
            let projects = scan_antigravity_store(&root, "live-test").unwrap();
            eprintln!(
                "ROOT {:?} -> {} projects, sessions: {:?}",
                root,
                projects.len(),
                projects.iter().map(|p| (p.name.clone(), p.session_count)).collect::<Vec<_>>()
            );
            assert!(!projects.is_empty(), "no projects from {:?}", root);
            let sessions = load_all_antigravity_sessions(&root, "live-test").unwrap();
            eprintln!("  total sessions: {}", sessions.len());
            let mut by_id: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
            for s in &sessions {
                *by_id.entry(s.id.as_str()).or_insert(0) += 1;
            }
            let dupes: Vec<_> = by_id.iter().filter(|(_, n)| **n > 1).take(5).collect();
            eprintln!("  distinct ids: {}, duplicated ids (sample): {:?}", by_id.len(), dupes);
            assert!(!sessions.is_empty());
        }
    }
}
