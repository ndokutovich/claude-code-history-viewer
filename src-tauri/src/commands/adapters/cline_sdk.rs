//! Cline's SDK-era session store (upstream #589/#582).
//!
//! Current Cline releases — the VS Code extension included — no longer keep
//! tasks under the editor's `globalStorage`. Each session is a directory:
//!
//! ```text
//! ~/.cline/data/sessions/<sessionId>/
//!   <sessionId>.json             manifest: cwd, title, timestamps
//!   <sessionId>.messages.json    transcript (Anthropic-native content blocks)
//! ```
//!
//! Store root resolution mirrors upstream `paths.ts`: `CLINE_DATA_DIR`, else
//! `CLINE_DIR/data`, else `<home>/.cline/data`.
//!
//! Paths from this store are `cline://sdk:<cwd>` (projects) and
//! `cline://sdk:<sessionId>` (sessions); the root is resolved at call time so
//! Windows drive colons never have to be parsed back out of the path.

use crate::models::universal::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Scheme prefix for projects and sessions in this store.
pub const PREFIX: &str = "cline://sdk:";
const PROVIDER_ID: &str = "cline";
const SUMMARY_MAX_CHARS: usize = 100;

/// Resolve the store's `sessions` directory.
pub fn sessions_dir() -> Option<PathBuf> {
    let data = std::env::var("CLINE_DATA_DIR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            std::env::var("CLINE_DIR")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .map(|dir| PathBuf::from(dir).join("data"))
        })
        .or_else(|| dirs::home_dir().map(|home| home.join(".cline").join("data")))?;

    let sessions = data.join("sessions");
    sessions.is_dir().then_some(sessions)
}

fn is_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path)
        .map(|meta| !meta.file_type().is_symlink() && meta.is_file())
        .unwrap_or(false)
}

fn is_valid_session_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && !id.contains("..")
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
}

/// Manifest fields the viewer needs. Everything is optional: the store is
/// reverse-engineered and older sessions may miss most of it.
#[derive(Debug, Clone, Default)]
pub struct Manifest {
    pub session_id: String,
    pub cwd: Option<String>,
    pub title: Option<String>,
    pub created_ms: Option<i64>,
    pub updated_ms: Option<i64>,
}

fn read_manifest(root: &Path, id: &str) -> Option<Manifest> {
    let path = root.join(id).join(format!("{id}.json"));
    if !is_regular_file(&path) {
        return None;
    }
    let value: Value = serde_json::from_str(&fs::read_to_string(path).ok()?).ok()?;

    let cwd = value
        .get("cwd")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|cwd| !cwd.is_empty())
        .map(str::to_string);
    let title = value
        .get("title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .map(str::to_string);

    Some(Manifest {
        session_id: id.to_string(),
        cwd,
        title,
        created_ms: value.get("createdAt").and_then(Value::as_i64),
        updated_ms: value
            .get("updatedAt")
            .and_then(Value::as_i64)
            .or_else(|| value.get("lastModified").and_then(Value::as_i64)),
    })
}

/// Every readable manifest under the store, symlinked entries skipped.
fn read_manifests(root: &Path) -> Vec<Manifest> {
    let Ok(entries) = fs::read_dir(root) else {
        return Vec::new();
    };

    let mut manifests: Vec<Manifest> = entries
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_type()
                .map(|kind| kind.is_dir() && !kind.is_symlink())
                .unwrap_or(false)
        })
        .filter_map(|entry| {
            let id = entry.file_name().to_string_lossy().to_string();
            is_valid_session_id(&id).then(|| read_manifest(root, &id))?
        })
        .collect();

    manifests.sort_by(|a, b| b.updated_ms.cmp(&a.updated_ms));
    manifests
}

/// Transcript records for one session, tolerant of malformed lines.
fn read_transcript(root: &Path, id: &str) -> Vec<Value> {
    let path = root.join(id).join(format!("{id}.messages.json"));
    if !is_regular_file(&path) {
        return Vec::new();
    }
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&content) else {
        return Vec::new();
    };
    match value {
        Value::Array(items) => items,
        _ => Vec::new(),
    }
}

fn project_name_for_cwd(cwd: &str) -> String {
    Path::new(cwd)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| cwd.to_string())
}

fn truncate_title(text: &str) -> String {
    if text.chars().count() > SUMMARY_MAX_CHARS {
        format!("{}...", text.chars().take(SUMMARY_MAX_CHARS).collect::<String>())
    } else {
        text.to_string()
    }
}

fn epoch_ms_to_rfc3339(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

fn content_blocks(message: &Value) -> Vec<Value> {
    message
        .get("content")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

fn first_user_text(messages: &[Value]) -> Option<String> {
    for message in messages {
        let is_user = message
            .get("role")
            .and_then(Value::as_str)
            .map(|role| role == "user")
            .unwrap_or(false);
        if !is_user {
            continue;
        }
        for block in content_blocks(message) {
            if block.get("type").and_then(Value::as_str) == Some("text") {
                if let Some(text) = block.get("text").and_then(Value::as_str) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        return Some(truncate_title(trimmed));
                    }
                }
            }
        }
    }
    None
}

/// Scan the store into one project per working directory.
pub fn scan_projects(root: &Path, source_id: &str) -> Vec<UniversalProject> {
    struct Acc {
        sessions: usize,
        messages: usize,
        last_ms: Option<i64>,
    }

    let mut by_cwd: HashMap<Option<String>, Acc> = HashMap::new();
    for manifest in read_manifests(root) {
        let messages = read_transcript(root, &manifest.session_id);
        if messages.is_empty() {
            continue;
        }
        let acc = by_cwd.entry(manifest.cwd.clone()).or_insert(Acc {
            sessions: 0,
            messages: 0,
            last_ms: None,
        });
        acc.sessions += 1;
        acc.messages += messages.len();
        if let Some(ms) = manifest.updated_ms {
            acc.last_ms = Some(acc.last_ms.map_or(ms, |current| current.max(ms)));
        }
    }

    let mut projects: Vec<UniversalProject> = by_cwd
        .into_iter()
        .map(|(cwd, acc)| {
            let name = cwd
                .as_deref()
                .map(project_name_for_cwd)
                .unwrap_or_else(|| "Cline".to_string());
            let scheme = format!("{PREFIX}{}", cwd.clone().unwrap_or_default());
            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert("storageType".to_string(), json!("cline-sdk"));
            if let Some(cwd) = &cwd {
                metadata.insert("cwd".to_string(), json!(cwd));
            }

            UniversalProject {
                id: scheme.clone(),
                source_id: source_id.to_string(),
                provider_id: PROVIDER_ID.to_string(),
                name,
                path: scheme,
                session_count: acc.sessions,
                total_messages: acc.messages,
                first_activity_at: None,
                last_activity_at: acc.last_ms.map(epoch_ms_to_rfc3339),
                metadata,
            }
        })
        .collect();

    projects.sort_by(|a, b| b.last_activity_at.cmp(&a.last_activity_at));
    projects
}

/// Sessions for one cwd project (`cline://sdk:<cwd>`), or every session when
/// `cwd` is empty.
pub fn load_sessions(
    root: &Path,
    cwd: Option<&str>,
    source_id: &str,
) -> Vec<UniversalSession> {
    let mut sessions: Vec<UniversalSession> = read_manifests(root)
        .into_iter()
        .filter(|manifest| match (manifest.cwd.as_deref(), cwd) {
            (Some(session_cwd), Some(wanted)) => session_cwd == wanted,
            (None, Some(_)) => false,
            (_, None) => true,
        })
        .filter_map(|manifest| {
            let messages = read_transcript(root, &manifest.session_id);
            if messages.is_empty() {
                return None;
            }

            let scheme = format!("{PREFIX}{}", manifest.session_id);
            let project_scheme = format!("{PREFIX}{}", manifest.cwd.clone().unwrap_or_default());
            let first_ts = manifest
                .created_ms
                .map(epoch_ms_to_rfc3339)
                .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());
            let last_ts = manifest
                .updated_ms
                .map(epoch_ms_to_rfc3339)
                .unwrap_or_else(|| first_ts.clone());

            let title = manifest
                .title
                .clone()
                .or_else(|| first_user_text(&messages))
                .unwrap_or_else(|| format!("Cline {}", manifest.session_id.chars().take(8).collect::<String>()));

            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert("storageType".to_string(), json!("cline-sdk"));
            if let Some(cwd) = &manifest.cwd {
                metadata.insert("cwd".to_string(), json!(cwd));
            }

            Some(UniversalSession {
                id: scheme,
                project_id: project_scheme,
                source_id: source_id.to_string(),
                provider_id: PROVIDER_ID.to_string(),
                title,
                description: None,
                message_count: messages.len(),
                first_message_at: first_ts,
                last_message_at: last_ts.clone(),
                duration: 0,
                total_tokens: None,
                tool_call_count: 0,
                error_count: 0,
                entrypoint: None,
                metadata,
                checksum: format!("{}:{}", manifest.session_id, messages.len()),
            })
        })
        .collect();

    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    sessions
}

fn token_usage_from_metrics(metrics: &Value) -> Option<TokenUsage> {
    let input = metrics.get("inputTokens").and_then(Value::as_u64).unwrap_or(0);
    let output = metrics.get("outputTokens").and_then(Value::as_u64).unwrap_or(0);
    let cache_read = metrics
        .get("cacheReadTokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cache_write = metrics
        .get("cacheWriteTokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let total = input + output + cache_read + cache_write;
    if total == 0 {
        return None;
    }
    let clamp = |value: u64| value.min(i32::MAX as u64) as i32;
    Some(TokenUsage {
        input_tokens: clamp(input),
        output_tokens: clamp(output),
        total_tokens: clamp(total),
        cache_creation_tokens: Some(clamp(cache_write)),
        cache_read_tokens: Some(clamp(cache_read)),
        service_tier: None,
    })
}

fn message_role(message: &Value) -> MessageRole {
    match message.get("role").and_then(Value::as_str) {
        Some("user") => MessageRole::User,
        Some("assistant") => MessageRole::Assistant,
        _ => MessageRole::System,
    }
}

fn convert_block(block: &Value) -> Option<UniversalContent> {
    let block_type = block.get("type").and_then(Value::as_str)?;

    let content = |content_type: ContentType, data: Value| UniversalContent {
        content_type,
        data,
        encoding: None,
        mime_type: None,
        size: None,
        hash: None,
    };

    match block_type {
        "text" => block
            .get("text")
            .and_then(Value::as_str)
            .map(|text| content(ContentType::Text, json!({ "text": text }))),
        "thinking" => block
            .get("thinking")
            .and_then(Value::as_str)
            .map(|text| content(ContentType::Thinking, json!({ "text": text }))),
        "tool_use" => Some(content(
            ContentType::ToolUse,
            json!({
                "id": block.get("id").cloned().unwrap_or(Value::Null),
                "name": block.get("name").cloned().unwrap_or(Value::Null),
                "input": block.get("input").cloned().unwrap_or(json!({})),
            }),
        )),
        "tool_result" => Some(content(
            ContentType::ToolResult,
            json!({
                "tool_use_id": block.get("tool_use_id").cloned().unwrap_or(Value::Null),
                "content": block.get("content").cloned().unwrap_or(Value::Null),
            }),
        )),
        _ => None,
    }
}

/// Messages for one session (`cline://sdk:<sessionId>`), paginated.
pub fn load_messages(
    root: &Path,
    session_id: &str,
    session_scheme: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    if !is_valid_session_id(session_id) {
        return Err(format!(
            "CLINE_SECURITY_ERROR: unsafe session id: {session_id}"
        ));
    }

    let manifest = read_manifest(root, session_id);
    let project_scheme = format!(
        "{PREFIX}{}",
        manifest
            .as_ref()
            .and_then(|m| m.cwd.clone())
            .unwrap_or_default()
    );
    let fallback_ts = manifest
        .as_ref()
        .and_then(|m| m.updated_ms)
        .map(epoch_ms_to_rfc3339)
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

    let mut messages: Vec<UniversalMessage> = Vec::new();
    for (index, record) in read_transcript(root, session_id).iter().enumerate() {
        let content: Vec<UniversalContent> = content_blocks(record)
            .iter()
            .filter_map(convert_block)
            .collect();
        if content.is_empty() {
            continue;
        }

        let model = record
            .get("modelInfo")
            .and_then(|info| info.get("id"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let tokens = record
            .get("metrics")
            .and_then(token_usage_from_metrics);

        messages.push(UniversalMessage {
            id: format!("{session_id}-{index}"),
            session_id: session_scheme.to_string(),
            project_id: project_scheme.clone(),
            source_id: source_id.to_string(),
            provider_id: PROVIDER_ID.to_string(),
            timestamp: fallback_ts.clone(),
            sequence_number: index as i32,
            role: message_role(record),
            message_type: MessageType::Message,
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
            original_format: "cline_sdk_messages".to_string(),
            provider_metadata: HashMap::new(),
        });
    }

    let total = messages.len();
    let start = offset.min(total);
    let end = offset.saturating_add(limit).min(total);
    Ok(messages[start..end].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seed_session(root: &Path, id: &str, cwd: &str, transcript: Value) {
        let dir = root.join(id);
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join(format!("{id}.json")),
            serde_json::to_string(&json!({
                "cwd": cwd,
                "title": format!("Session {id}"),
                "createdAt": 1_700_000_000_000i64,
                "updatedAt": 1_700_000_100_000i64,
            }))
            .unwrap(),
        )
        .unwrap();
        fs::write(
            dir.join(format!("{id}.messages.json")),
            serde_json::to_string(&transcript).unwrap(),
        )
        .unwrap();
    }

    fn sample_transcript() -> Value {
        json!([
            { "role": "user", "content": [{ "type": "text", "text": "Fix the parser" }] },
            { "role": "assistant", "content": [{ "type": "text", "text": "Done." }] }
        ])
    }

    #[test]
    fn scans_projects_by_cwd_and_ignores_unsafe_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("sessions");
        fs::create_dir_all(&root).unwrap();
        seed_session(&root, "sess-1", "/work/alpha", sample_transcript());
        seed_session(&root, "sess-2", "/work/alpha", sample_transcript());
        seed_session(&root, "sess-3", "/work/beta", sample_transcript());
        // Directory that is not a valid session id.
        fs::create_dir_all(root.join("..evil")).unwrap();

        let projects = scan_projects(&root, "src");
        assert_eq!(projects.len(), 2);
        let alpha = projects.iter().find(|p| p.name == "alpha").unwrap();
        assert_eq!(alpha.session_count, 2);
        assert_eq!(alpha.path, "cline://sdk:/work/alpha");
        assert_eq!(alpha.total_messages, 4);
    }

    #[test]
    fn loads_sessions_for_one_cwd() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("sessions");
        fs::create_dir_all(&root).unwrap();
        seed_session(&root, "sess-1", "/work/alpha", sample_transcript());
        seed_session(&root, "sess-2", "/work/beta", sample_transcript());

        let sessions = load_sessions(&root, Some("/work/alpha"), "src");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].id, "cline://sdk:sess-1");
        assert_eq!(sessions[0].title, "Session sess-1");
        assert_eq!(sessions[0].message_count, 2);
    }

    #[test]
    fn converts_native_content_blocks_and_metrics() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("sessions");
        fs::create_dir_all(&root).unwrap();
        seed_session(
            &root,
            "sess-9",
            "/work/alpha",
            json!([
                { "role": "user", "content": [{ "type": "text", "text": "hi" }] },
                { "role": "assistant",
                  "modelInfo": { "id": "claude-opus-4" },
                  "metrics": { "inputTokens": 100, "outputTokens": 50, "cacheReadTokens": 10 },
                  "content": [
                      { "type": "thinking", "thinking": "hmm" },
                      { "type": "tool_use", "id": "t1", "name": "read_file", "input": { "path": "a.rs" } }
                  ] }
            ]),
        );

        let messages = load_messages(&root, "sess-9", "cline://sdk:sess-9", "src", 0, 50).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, MessageRole::User);
        assert_eq!(messages[1].content.len(), 2);
        assert_eq!(messages[1].content[0].content_type, ContentType::Thinking);
        assert_eq!(messages[1].content[1].content_type, ContentType::ToolUse);
        assert_eq!(messages[1].model.as_deref(), Some("claude-opus-4"));
        let tokens = messages[1].tokens.as_ref().expect("usage from metrics");
        assert_eq!(tokens.input_tokens, 100);
        assert_eq!(tokens.total_tokens, 160);
    }

    #[test]
    fn messages_are_paginated() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("sessions");
        fs::create_dir_all(&root).unwrap();
        let transcript: Vec<Value> = (0..5)
            .map(|i| json!({ "role": "user", "content": [{ "type": "text", "text": format!("m{i}") }] }))
            .collect();
        seed_session(&root, "sess-p", "/work/alpha", Value::Array(transcript));

        let page = load_messages(&root, "sess-p", "cline://sdk:sess-p", "src", 2, 2).unwrap();
        assert_eq!(page.len(), 2);
    }

    #[test]
    fn rejects_unsafe_session_ids() {
        let dir = tempfile::tempdir().unwrap();
        let err = load_messages(dir.path(), "../evil", "s", "src", 0, 10).unwrap_err();
        assert!(err.contains("CLINE_SECURITY_ERROR"));
    }
}
