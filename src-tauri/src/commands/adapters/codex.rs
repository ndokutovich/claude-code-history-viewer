// ============================================================================
// CODEX CLI ADAPTER
// ============================================================================
// Converts Codex CLI JSONL event format to UniversalMessage
//
// PATTERN REFERENCE: Claude Code's JSONL streaming (session.rs:38-70)
// CLEAN CODE: Explicit types, standardized errors, DRY principles

use crate::models::universal::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::Path;

// ============================================================================
// RAW CODEX EVENT STRUCTURE (matches JSONL format exactly)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodexEvent {
    pub id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: Option<Value>,

    // Codex-specific nested fields
    pub internal: Option<Value>,
    pub environment_context: Option<Value>,
    pub execution_context: Option<Value>,
}

// ============================================================================
// FILENAME PARSING
// ============================================================================

/// Parse Codex rollout filename: rollout-YYYY-MM-DDThh-mm-ss-UUID.jsonl
/// Returns: (timestamp, uuid)
pub fn parse_rollout_filename(filename: &str) -> Option<(String, String)> {
    // Pattern: rollout-YYYY-MM-DDThh-mm-ss-UUID.jsonl
    let re = regex::Regex::new(
        r"^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-([a-f0-9-]+)\.jsonl(?:\.zst)?$"
    ).ok()?;

    let caps = re.captures(filename)?;
    let timestamp = caps.get(1)?.as_str().to_string();
    let uuid = caps.get(2)?.as_str().to_string();

    Some((timestamp, uuid))
}

/// Extract session ID with priority: internal.session.id > filename UUID
/// CLEAN CODE: Single source of truth for session ID resolution
pub fn extract_session_id(event: &CodexEvent, filename_uuid: &str) -> String {
    // Priority 1: internal.session.id field
    if let Some(id) = event
        .internal
        .as_ref()
        .and_then(|i| i.get("session"))
        .and_then(|s| s.get("id"))
        .and_then(|v| v.as_str())
    {
        return id.to_string();
    }

    // Priority 2: UUID from filename
    filename_uuid.to_string()
}

/// Session id for a rollout: the FIRST `session_meta` payload id wins —
/// `codex fork` replays the source rollout (including its session_meta) as
/// history, so a later meta must not re-tag the session (upstream #451).
/// Meta-less rollouts fall back to the filename UUID (upstream #38b9e583).
pub fn session_id_from_events(events: &[CodexEvent], filename_uuid: &str) -> String {
    for event in events {
        if event.event_type == "session_meta" {
            if let Some(payload) = event.payload.as_ref() {
                if let Some(id) = payload.get("id").and_then(Value::as_str) {
                    if !id.is_empty() {
                        return id.to_string();
                    }
                }
            }
        }
    }
    match events.first() {
        Some(first) => extract_session_id(first, filename_uuid),
        None => filename_uuid.to_string(),
    }
}

/// CWD for a rollout: first `session_meta` payload cwd, else the LAST
/// `turn_context` payload cwd (a fork replays the source's turn contexts
/// first, so the last one is where the session actually runs), else the
/// first event's environment_context cwd.
pub fn cwd_from_events(events: &[CodexEvent]) -> Option<String> {
    for event in events {
        if event.event_type == "session_meta" {
            if let Some(cwd) = event
                .payload
                .as_ref()
                .and_then(|p| p.get("cwd"))
                .and_then(Value::as_str)
            {
                if !cwd.is_empty() {
                    return Some(cwd.to_string());
                }
            }
        }
    }
    let mut turn_cwd = None;
    for event in events {
        if event.event_type == "turn_context" {
            if let Some(cwd) = event
                .payload
                .as_ref()
                .and_then(|p| p.get("cwd"))
                .and_then(Value::as_str)
            {
                if !cwd.is_empty() {
                    turn_cwd = Some(cwd.to_string());
                }
            }
        }
    }
    turn_cwd.or_else(|| {
        events
            .first()
            .and_then(|e| e.environment_context.as_ref())
            .and_then(|ctx| ctx.get("cwd"))
            .and_then(Value::as_str)
            .map(String::from)
    })
}

// ============================================================================
// JSONL STREAMING PARSER (Claude Code pattern from session.rs:38-70)
// ============================================================================

/// Parse Codex JSONL file with BufReader streaming
/// PATTERN: Copied from Claude Code's proven approach for memory efficiency
/// ERROR HANDLING: Continues on bad lines (graceful degradation)
pub fn parse_codex_jsonl(file_path: &Path) -> Result<Vec<CodexEvent>, String> {
    let file = File::open(file_path)
        .map_err(|e| format!("CODEX_FILE_ERROR: Failed to open file: {}", e))?;

    // Codex compresses old rollouts to .jsonl.zst; decompress into memory
    // (upstream #74bdee28). Plain files stay on the streaming reader.
    let is_compressed = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|name| name.ends_with(".jsonl.zst"));

    let mut events: Vec<CodexEvent> = Vec::new();

    if is_compressed {
        let bytes = zstd::decode_all(std::io::BufReader::new(file))
            .map_err(|e| format!("CODEX_ZST_ERROR: Failed to decompress rollout: {}", e))?;
        let content = String::from_utf8_lossy(&bytes);
        parse_event_lines(content.lines().map(|l| Ok(l.to_string())), &mut events)?;
    } else {
        let reader = BufReader::new(file);
        parse_event_lines(reader.lines(), &mut events)?;
    }

    Ok(events)
}

/// Line-level JSONL parsing shared by the streaming and decompressed paths.
fn parse_event_lines<I>(lines: I, events: &mut Vec<CodexEvent>) -> Result<(), String>
where
    I: Iterator<Item = std::io::Result<String>>,
{
    for (line_num, line_result) in lines.enumerate() {
        let line = line_result
            .map_err(|e| format!("CODEX_READ_ERROR: Line {}: Read error: {}", line_num + 1, e))?;
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<CodexEvent>(&line) {
            Ok(event) => events.push(event),
            Err(e) => {
                eprintln!("⚠️ CODEX_PARSE_ERROR: Line {}: {}", line_num + 1, e);
                continue;
            }
        }
    }
    Ok(())
}

/// True for a Codex rollout file, plain (`.jsonl`) or zstd-compressed
/// (`.jsonl.zst`). Codex generates these names itself, always lowercase.
#[allow(clippy::case_sensitive_file_extension_comparisons)]
pub fn is_rollout_jsonl(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            name.starts_with("rollout-")
                && (name.ends_with(".jsonl") || name.ends_with(".jsonl.zst"))
        })
}

/// Discovery filter for session walkers: every rollout
/// [`is_rollout_jsonl`] accepts, but a compressed `.jsonl.zst` whose plain
/// `.jsonl` twin exists is skipped — Codex materializes the plain file for
/// appends, so the plain one is current and listing both would duplicate
/// the session.
pub fn is_discoverable_rollout(path: &Path) -> bool {
    if !is_rollout_jsonl(path) {
        return false;
    }
    let is_compressed = path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.ends_with(".jsonl.zst"));
    if is_compressed {
        // "rollout-….jsonl.zst" → "rollout-….jsonl"
        let plain = path.with_extension("");
        if plain.exists() {
            return false;
        }
    }
    true
}

// ============================================================================
// CONVERSION TO UNIVERSAL FORMAT
// ============================================================================

/// Convert Codex event to UniversalMessage
/// PATTERN: Similar to claude_code.rs:18-136
/// CRITICAL: Uses camelCase metadata (Gemini lesson learned!)
pub fn codex_event_to_universal(
    event: &CodexEvent,
    project_id: String,
    source_id: String,
    sequence_number: i32,
    file_path: &str,
) -> UniversalMessage {
    // Extract role (user vs assistant)
    let role: MessageRole = determine_role(event);

    // Determine message type
    let message_type: MessageType = MessageType::Message; // Codex doesn't have summary/sidechain

    // Convert content
    let content: Vec<UniversalContent> = convert_content(event);

    // Extract CWD with priority logic
    let cwd: Option<String> = extract_cwd(event);

    // Extract model information
    let model: Option<String> = event
        .payload
        .as_ref()
        .and_then(|p| p.get("model"))
        .and_then(|m| m.as_str())
        .map(String::from);

    // ⭐ CRITICAL: Use camelCase for metadata (Gemini lesson learned!)
    // CLEAN CODE: Standardized metadata keys across all providers
    let mut metadata: HashMap<String, Value> = HashMap::new();
    metadata.insert("filePath".to_string(), json!(file_path));          // camelCase!
    metadata.insert("eventType".to_string(), json!(event.event_type));  // camelCase!

    if let Some(ref cwd_path) = cwd {
        metadata.insert("cwd".to_string(), json!(cwd_path));
    }

    // File size with camelCase key
    if let Ok(file_metadata) = fs::metadata(file_path) {
        metadata.insert("fileSizeBytes".to_string(), json!(file_metadata.len())); // camelCase!
    }

    // Store original event for debugging/recovery
    metadata.insert("originalEvent".to_string(), json!(event));  // camelCase!

    UniversalMessage {
        // CORE IDENTITY
        id: event.id.clone().unwrap_or_else(|| format!("codex-{}", sequence_number)),
        session_id: "".to_string(), // Will be set by caller
        project_id,
        source_id,
        provider_id: "codex".to_string(),

        // TEMPORAL
        timestamp: event
            .timestamp
            .clone()
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        sequence_number,

        // ROLE & TYPE
        role,
        message_type,

        // CONTENT
        content,

        // HIERARCHY (Codex doesn't have parent relationships)
        parent_id: None,
        depth: None,
        branch_id: None,

        // METADATA
        model,
        tokens: None,       // Codex doesn't expose token counts
        tool_calls: None,   // TODO: Extract from payload
        thinking: None,     // TODO: Check if Codex has thinking blocks
        attachments: None,
        errors: None,       // TODO: Extract from execution_context

        // RAW PRESERVATION
        original_format: "codex_jsonl".to_string(),
        provider_metadata: metadata,
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Determine MessageRole from event type and payload.role
/// CLEAN CODE: Explicit return type annotation
fn determine_role(event: &CodexEvent) -> MessageRole {
    // Priority 1: Check payload.role (for response_item events)
    if let Some(ref payload) = event.payload {
        if let Some(role_str) = payload.get("role").and_then(|r| r.as_str()) {
            return match role_str {
                "user" => MessageRole::User,
                "assistant" => MessageRole::Assistant,
                "system" => MessageRole::System,
                _ => MessageRole::Assistant,
            };
        }
    }

    // Priority 2: Check event_type (for event_msg events)
    match event.event_type.as_str() {
        "user_message" | "user_input" | "user" => MessageRole::User,
        "assistant_message" | "assistant_response" | "assistant" => MessageRole::Assistant,
        "system_message" | "system" => MessageRole::System,
        _ => MessageRole::Assistant, // Default to assistant
    }
}

/// Convert payload to UniversalContent items
/// CLEAN CODE: Explicit return type annotation
fn convert_content(event: &CodexEvent) -> Vec<UniversalContent> {
    let mut content_items: Vec<UniversalContent> = Vec::new();

    if let Some(ref payload) = event.payload {
        // Extract text content from payload.content field
        // Codex format: content: [{"type":"input_text","text":"..."}]
        if let Some(content_array) = payload.get("content").and_then(|c| c.as_array()) {
            for item in content_array {
                // Extract text from each content item
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    content_items.push(UniversalContent {
                        content_type: ContentType::Text,
                        data: json!({"text": text}),
                        encoding: None,
                        mime_type: Some("text/plain".to_string()),
                        size: Some(text.len()),
                        hash: None,
                    });
                }

                // TODO: Extract tool calls from item.type == "tool_use"
                // TODO: Extract code blocks from item.type == "code"
            }
        }
        // Fallback: Try string content (for older formats)
        else if let Some(text) = payload.get("content").and_then(|c| c.as_str()) {
            content_items.push(UniversalContent {
                content_type: ContentType::Text,
                data: json!({"text": text}),
                encoding: None,
                mime_type: Some("text/plain".to_string()),
                size: Some(text.len()),
                hash: None,
            });
        }

        // TODO: Extract tool calls from payload.tool_calls if present
        // TODO: Extract code blocks from payload.code if present
    }

    content_items
}

/// Extract CWD (current working directory) with priority logic
/// Priority: environment_context.cwd > execution_context.working_directory
/// CLEAN CODE: Explicit return type annotation, single source of truth
fn extract_cwd(event: &CodexEvent) -> Option<String> {
    // Priority 1: environment_context.cwd
    if let Some(cwd) = event
        .environment_context
        .as_ref()
        .and_then(|ctx| ctx.get("cwd"))
        .and_then(|v| v.as_str())
    {
        return Some(cwd.to_string());
    }

    // Priority 2: execution_context.working_directory
    if let Some(wd) = event
        .execution_context
        .as_ref()
        .and_then(|ctx| ctx.get("working_directory"))
        .and_then(|v| v.as_str())
    {
        return Some(wd.to_string());
    }

    None
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rollout_filename_valid() {
        let filename = "rollout-2025-01-27T14-30-45-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl";
        let result: Option<(String, String)> = parse_rollout_filename(filename);

        assert!(result.is_some());

        let (timestamp, uuid) = result.unwrap();
        assert_eq!(timestamp, "2025-01-27T14-30-45");
        assert_eq!(uuid, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    }

    #[test]
    fn test_parse_rollout_filename_invalid() {
        assert!(parse_rollout_filename("invalid.jsonl").is_none());
        assert!(parse_rollout_filename("rollout-2025.jsonl").is_none());
        assert!(parse_rollout_filename("rollout-2025-01-27.jsonl").is_none());
    }

    #[test]
    fn test_determine_role() {
        let mut event: CodexEvent = CodexEvent {
            id: Some("test".to_string()),
            timestamp: None,
            event_type: "user_message".to_string(),
            payload: None,
            internal: None,
            environment_context: None,
            execution_context: None,
        };

        assert_eq!(determine_role(&event), MessageRole::User);

        event.event_type = "assistant_response".to_string();
        assert_eq!(determine_role(&event), MessageRole::Assistant);

        event.event_type = "system".to_string();
        assert_eq!(determine_role(&event), MessageRole::System);
    }

    #[test]
    fn test_extract_session_id_from_internal() {
        let event: CodexEvent = CodexEvent {
            id: Some("test".to_string()),
            timestamp: None,
            event_type: "user".to_string(),
            payload: None,
            internal: Some(json!({
                "session": {
                    "id": "session-from-internal"
                }
            })),
            environment_context: None,
            execution_context: None,
        };

        let session_id: String = extract_session_id(&event, "fallback-uuid");
        assert_eq!(session_id, "session-from-internal");
    }

    #[test]
    fn test_extract_session_id_fallback_to_filename() {
        let event: CodexEvent = CodexEvent {
            id: Some("test".to_string()),
            timestamp: None,
            event_type: "user".to_string(),
            payload: None,
            internal: None,
            environment_context: None,
            execution_context: None,
        };

        let session_id: String = extract_session_id(&event, "filename-uuid-123");
        assert_eq!(session_id, "filename-uuid-123");
    }

    #[test]
    fn test_extract_cwd_priority() {
        // Test Priority 1: environment_context.cwd
        let event1: CodexEvent = CodexEvent {
            id: None,
            timestamp: None,
            event_type: "test".to_string(),
            payload: None,
            internal: None,
            environment_context: Some(json!({
                "cwd": "/env/path"
            })),
            execution_context: Some(json!({
                "working_directory": "/exec/path"
            })),
        };

        assert_eq!(extract_cwd(&event1), Some("/env/path".to_string()));

        // Test Priority 2: execution_context.working_directory
        let event2: CodexEvent = CodexEvent {
            id: None,
            timestamp: None,
            event_type: "test".to_string(),
            payload: None,
            internal: None,
            environment_context: None,
            execution_context: Some(json!({
                "working_directory": "/exec/path"
            })),
        };

        assert_eq!(extract_cwd(&event2), Some("/exec/path".to_string()));

        // Test fallback: None
        let event3: CodexEvent = CodexEvent {
            id: None,
            timestamp: None,
            event_type: "test".to_string(),
            payload: None,
            internal: None,
            environment_context: None,
            execution_context: None,
        };

        assert_eq!(extract_cwd(&event3), None);
    }

    // ========================================================================
    // zstd-compressed rollouts (.jsonl.zst) — upstream #74bdee28
    // ========================================================================

    #[test]
    fn test_parse_rollout_filename_zst() {
        let filename =
            "rollout-2025-01-27T14-30-45-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl.zst";
        let (timestamp, uuid) =
            parse_rollout_filename(filename).expect("zst rollout name should parse");
        assert_eq!(timestamp, "2025-01-27T14-30-45");
        assert_eq!(uuid, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    }

    #[test]
    fn test_discovery_skips_compressed_rollout_with_plain_twin() {
        let dir = tempfile::tempdir().unwrap();
        let name = "rollout-2025-01-27T14-30-45-a1b2c3d4-e5f6-7890-abcd-ef1234567890";
        let zst = dir.path().join(format!("{name}.jsonl.zst"));
        fs::write(&zst, b"x").unwrap();
        assert!(is_rollout_jsonl(&zst));
        assert!(is_discoverable_rollout(&zst), "no plain twin yet");

        let plain = dir.path().join(format!("{name}.jsonl"));
        fs::write(&plain, b"x").unwrap();
        assert!(
            !is_discoverable_rollout(&zst),
            "compressed twin must be skipped when the plain file exists"
        );
        assert!(is_discoverable_rollout(&plain));
    }

    #[test]
    fn test_parse_codex_jsonl_decompresses_zst() {
        let dir = tempfile::tempdir().unwrap();
        let body = concat!(
            r#"{"type":"session_meta","timestamp":"2025-01-27T14:30:45Z"}"#,
            "\n",
            r#"{"type":"user_message","timestamp":"2025-01-27T14:30:46Z"}"#,
            "\n",
        );
        let compressed = zstd::encode_all(body.as_bytes(), 3).expect("zstd encode");
        let zst = dir
            .path()
            .join("rollout-2025-01-27T14-30-45-a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl.zst");
        fs::write(&zst, compressed).unwrap();

        let events = parse_codex_jsonl(&zst).expect("parse compressed rollout");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].event_type, "session_meta");
        assert_eq!(events[1].event_type, "user_message");
    }
    #[test]
    fn test_session_id_first_meta_wins_over_replayed_source() {
        let mk = |t: &str, id: Option<&str>| CodexEvent {
            id: None,
            timestamp: None,
            event_type: t.to_string(),
            payload: id.map(|i| json!({ "id": i, "cwd": "/tmp/x" })),
            internal: None,
            environment_context: None,
            execution_context: None,
        };
        let events = vec![
            mk("session_meta", Some("own-session")),
            mk("user_message", None),
            // Replayed source meta from `codex fork` — must NOT win.
            mk("session_meta", Some("source-session")),
        ];
        assert_eq!(session_id_from_events(&events, "file-uuid"), "own-session");
    }

    #[test]
    fn test_session_id_meta_less_falls_back_to_filename() {
        let events = vec![CodexEvent {
            id: None,
            timestamp: None,
            event_type: "user_message".to_string(),
            payload: None,
            internal: None,
            environment_context: None,
            execution_context: None,
        }];
        assert_eq!(session_id_from_events(&events, "file-uuid"), "file-uuid");
    }

    #[test]
    fn test_cwd_last_turn_context_wins_when_no_meta() {
        let mk = |t: &str, cwd: Option<&str>| CodexEvent {
            id: None,
            timestamp: None,
            event_type: t.to_string(),
            payload: cwd.map(|c| json!({ "cwd": c })),
            internal: None,
            environment_context: None,
            execution_context: None,
        };
        // A fork replays source turn contexts first; the LAST one is real.
        let events = vec![
            mk("turn_context", Some("/src/replayed")),
            mk("turn_context", Some("/real/cwd")),
        ];
        assert_eq!(cwd_from_events(&events).as_deref(), Some("/real/cwd"));

        // session_meta cwd beats turn_context.
        let events = vec![
            mk("session_meta", Some("/meta/cwd")),
            mk("turn_context", Some("/turn/cwd")),
        ];
        assert_eq!(cwd_from_events(&events).as_deref(), Some("/meta/cwd"));
    }
}