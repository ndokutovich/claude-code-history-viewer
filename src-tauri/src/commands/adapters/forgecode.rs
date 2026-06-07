// ============================================================================
// FORGECODE ADAPTER (v1.9.x)
// ============================================================================
// Converts ForgeCode conversation history into UniversalMessage.
//
// ForgeCode stores data in a SQLite database:
//   <base>/.forge.db
//     conversations(id|conversation_id, workspace_id, title, context, metrics,
//                   created_at, updated_at)
//   The `context` column holds a JSON transcript (array of entries or an object
//   with a `messages` array). `logs/` and `.forge_history` are secondary
//   detection artifacts only — the DB is the authoritative source of truth.
//
// PATTERN REFERENCE:
// - SQLite read-only access / Windows lock handling: commands/cursor.rs
// - Universal construction / scheme paths: commands/adapters/cline.rs
//
// PATH SCHEME: forgecode://<workspace_id>/<conversation_id>
// (`..` and other path-traversal characters are rejected by the
//  `is_valid_virtual_component` allowlist).

use crate::commands::adapters::opencode::epoch_ms_to_rfc3339;
use crate::models::universal::*;
use chrono::{DateTime, NaiveDateTime, Utc};
use rusqlite::{Connection, OpenFlags};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

// ============================================================================
// CONSTANTS
// ============================================================================

const PROVIDER_ID: &str = "forgecode";
const SCHEME_PREFIX: &str = "forgecode://";

// ============================================================================
// SCHEMA RESOLUTION
// ============================================================================

/// The set of `conversations` columns this ForgeCode DB exposes.
/// Column names vary between ForgeCode versions, so they are resolved at
/// runtime via `PRAGMA table_info`.
#[derive(Debug, Clone)]
struct ConversationColumns {
    id: String,
    workspace_id: String,
    title: Option<String>,
    context: String,
    metrics: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

/// A single conversation row read from the DB (all values cast to TEXT).
#[derive(Debug, Clone)]
struct ConversationRow {
    conversation_id: String,
    workspace_id: String,
    title: Option<String>,
    context_json: String,
    metrics_json: Option<String>,
    created_at: String,
    updated_at: String,
}

// ============================================================================
// PATH DETECTION
// ============================================================================

/// Resolve the ForgeCode base path.
///
/// Lookup precedence:
/// 1. `$FORGE_CONFIG`
/// 2. `~/.forge`
pub fn get_forgecode_base_path() -> Option<PathBuf> {
    if let Ok(config_dir) = std::env::var("FORGE_CONFIG") {
        let path = PathBuf::from(&config_dir);
        if path.exists() {
            return Some(path);
        }
    }

    let home = dirs::home_dir()?;
    let default_path = home.join(".forge");
    if default_path.exists() {
        Some(default_path)
    } else {
        None
    }
}

/// Open the ForgeCode SQLite database read-only.
///
/// Uses the same flags as the Cursor adapter (`SQLITE_OPEN_READ_ONLY |
/// SQLITE_OPEN_NO_MUTEX`) plus a busy timeout so that an editor holding an
/// OS-level lock on Windows cannot hang us indefinitely.
fn open_forgecode_db(base_path: &Path) -> Option<Connection> {
    let db_path = base_path.join(".forge.db");
    if !db_path.is_file() {
        return None;
    }

    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .ok()?;
    let _ = conn.execute_batch("PRAGMA busy_timeout = 3000;");
    Some(conn)
}

/// Resolve the conversation table columns exposed by the ForgeCode schema.
fn resolve_conversation_columns(conn: &Connection) -> Option<ConversationColumns> {
    let mut stmt = conn.prepare("PRAGMA table_info(conversations)").ok()?;
    let column_names: std::collections::HashSet<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .ok()?
        .filter_map(std::result::Result::ok)
        .collect();

    let pick = |names: &[&str]| {
        names
            .iter()
            .find(|name| column_names.contains(**name))
            .map(|name| (*name).to_string())
    };

    Some(ConversationColumns {
        id: pick(&["conversation_id", "id"])?,
        workspace_id: pick(&["workspace_id"])?,
        title: pick(&["title"]),
        context: pick(&["context"])?,
        metrics: pick(&["metrics"]),
        created_at: pick(&["created_at", "createdAt"]),
        updated_at: pick(&["updated_at", "updatedAt"]),
    })
}

// ============================================================================
// ROW LOADING
// ============================================================================

/// Load every conversation row that has a workspace id and context.
fn load_all_rows(conn: &Connection, columns: &ConversationColumns) -> Option<Vec<ConversationRow>> {
    let query = format!(
        "SELECT {id}, {workspace_id}, {title}, {context}, {metrics}, {created_at}, {updated_at}
         FROM conversations
         WHERE {workspace_id_raw} IS NOT NULL AND {context_raw} IS NOT NULL
         ORDER BY {updated_at_raw} DESC, {created_at_raw} DESC",
        id = cast_text_expr(&columns.id),
        workspace_id = cast_text_expr(&columns.workspace_id),
        title = optional_cast_text_expr(columns.title.as_deref()),
        context = cast_text_expr(&columns.context),
        metrics = optional_cast_text_expr(columns.metrics.as_deref()),
        created_at = optional_cast_text_expr(columns.created_at.as_deref()),
        updated_at = optional_cast_text_expr(columns.updated_at.as_deref()),
        workspace_id_raw = quote_ident(&columns.workspace_id),
        context_raw = quote_ident(&columns.context),
        updated_at_raw = optional_order_expr(columns.updated_at.as_deref()),
        created_at_raw = optional_order_expr(columns.created_at.as_deref()),
    );

    read_rows(conn, &query, [])
}

/// Load conversation rows for a single workspace.
fn load_workspace_rows(
    conn: &Connection,
    columns: &ConversationColumns,
    workspace_id: &str,
) -> Option<Vec<ConversationRow>> {
    let query = format!(
        "SELECT {id}, {workspace_id}, {title}, {context}, {metrics}, {created_at}, {updated_at}
         FROM conversations
         WHERE CAST({workspace_id_raw} AS TEXT) = ?1 AND {context_raw} IS NOT NULL
         ORDER BY {updated_at_raw} DESC, {created_at_raw} DESC",
        id = cast_text_expr(&columns.id),
        workspace_id = cast_text_expr(&columns.workspace_id),
        title = optional_cast_text_expr(columns.title.as_deref()),
        context = cast_text_expr(&columns.context),
        metrics = optional_cast_text_expr(columns.metrics.as_deref()),
        created_at = optional_cast_text_expr(columns.created_at.as_deref()),
        updated_at = optional_cast_text_expr(columns.updated_at.as_deref()),
        workspace_id_raw = quote_ident(&columns.workspace_id),
        context_raw = quote_ident(&columns.context),
        updated_at_raw = optional_order_expr(columns.updated_at.as_deref()),
        created_at_raw = optional_order_expr(columns.created_at.as_deref()),
    );

    read_rows(conn, &query, [workspace_id])
}

/// Load a single conversation row by workspace + conversation id.
fn load_conversation_row(
    conn: &Connection,
    columns: &ConversationColumns,
    workspace_id: &str,
    conversation_id: &str,
) -> Option<ConversationRow> {
    let query = format!(
        "SELECT {id}, {workspace_id}, {title}, {context}, {metrics}, {created_at}, {updated_at}
         FROM conversations
         WHERE CAST({workspace_id_raw} AS TEXT) = ?1 AND CAST({id_raw} AS TEXT) = ?2
         LIMIT 1",
        id = cast_text_expr(&columns.id),
        workspace_id = cast_text_expr(&columns.workspace_id),
        title = optional_cast_text_expr(columns.title.as_deref()),
        context = cast_text_expr(&columns.context),
        metrics = optional_cast_text_expr(columns.metrics.as_deref()),
        created_at = optional_cast_text_expr(columns.created_at.as_deref()),
        updated_at = optional_cast_text_expr(columns.updated_at.as_deref()),
        workspace_id_raw = quote_ident(&columns.workspace_id),
        id_raw = quote_ident(&columns.id),
    );

    read_rows(conn, &query, [workspace_id, conversation_id])?
        .into_iter()
        .next()
}

/// Execute a prepared conversation query and collect the rows.
fn read_rows<P: rusqlite::Params>(
    conn: &Connection,
    query: &str,
    params: P,
) -> Option<Vec<ConversationRow>> {
    let mut stmt = conn.prepare(query).ok()?;
    let rows = stmt
        .query_map(params, |row| {
            Ok(ConversationRow {
                conversation_id: row.get(0)?,
                workspace_id: row.get(1)?,
                title: empty_to_none(row.get::<_, String>(2)?),
                context_json: row.get(3)?,
                metrics_json: empty_to_none(row.get::<_, String>(4)?),
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .ok()?;

    Some(rows.filter_map(std::result::Result::ok).collect())
}

// ============================================================================
// PROJECT SCANNING
// ============================================================================

#[derive(Debug, Default)]
struct ProjectAccumulator {
    session_count: usize,
    message_count: usize,
    last_modified: String,
    cwd_votes: BTreeMap<String, usize>,
}

/// Scan ForgeCode projects (one per workspace) from the `.forge.db` database.
pub fn scan_forgecode_projects(
    base_path: &Path,
    source_id: &str,
) -> Result<Vec<UniversalProject>, String> {
    let Some(conn) = open_forgecode_db(base_path) else {
        return Ok(Vec::new());
    };
    let Some(columns) = resolve_conversation_columns(&conn) else {
        return Ok(Vec::new());
    };
    let Some(rows) = load_all_rows(&conn, &columns) else {
        return Ok(Vec::new());
    };

    let mut workspaces: BTreeMap<String, ProjectAccumulator> = BTreeMap::new();

    for row in rows {
        let message_count = parse_context_entries(&row.context_json).len();
        let last_modified = latest_timestamp(&row.created_at, &row.updated_at);
        let cwds = extract_cwd_votes(&row.context_json);

        let entry = workspaces.entry(row.workspace_id).or_default();
        entry.session_count += 1;
        entry.message_count += message_count;
        entry.last_modified = max_timestamp(&entry.last_modified, &last_modified);
        for (cwd, count) in cwds {
            *entry.cwd_votes.entry(cwd).or_default() += count;
        }
    }

    let mut projects: Vec<UniversalProject> = workspaces
        .into_iter()
        .map(|(workspace_id, acc)| {
            let best_cwd = choose_best_cwd(&acc.cwd_votes);
            let name = best_cwd
                .as_deref()
                .and_then(|cwd| {
                    PathBuf::from(cwd)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                })
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| format!("Workspace {workspace_id}"));

            let scheme_path = project_virtual_path(&workspace_id);
            let last_activity = if acc.last_modified.is_empty() {
                None
            } else {
                Some(acc.last_modified.clone())
            };

            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert("workspaceId".to_string(), json!(workspace_id));
            if let Some(cwd) = best_cwd {
                metadata.insert("projectWorktree".to_string(), json!(cwd));
            }

            UniversalProject {
                id: scheme_path.clone(),
                source_id: source_id.to_string(),
                provider_id: PROVIDER_ID.to_string(),
                name,
                path: scheme_path,
                session_count: acc.session_count,
                total_messages: acc.message_count,
                first_activity_at: None,
                last_activity_at: last_activity,
                metadata,
            }
        })
        .collect();

    projects.sort_by(|a, b| b.last_activity_at.cmp(&a.last_activity_at));
    Ok(projects)
}

// ============================================================================
// SESSION LOADING
// ============================================================================

/// Load sessions (one per conversation) for a single ForgeCode workspace.
pub fn load_forgecode_sessions(
    base_path: &Path,
    workspace_id: &str,
    source_id: &str,
) -> Result<Vec<UniversalSession>, String> {
    let Some(conn) = open_forgecode_db(base_path) else {
        return Ok(Vec::new());
    };
    let Some(columns) = resolve_conversation_columns(&conn) else {
        return Ok(Vec::new());
    };
    let Some(rows) = load_workspace_rows(&conn, &columns, workspace_id) else {
        return Ok(Vec::new());
    };

    let mut sessions: Vec<UniversalSession> = rows
        .into_iter()
        .filter(|row| !row.context_json.trim().is_empty())
        .map(|row| {
            let entries = parse_context_entries(&row.context_json);
            let has_tool_use = entries.iter().any(entry_has_tool_use);
            let _ = has_tool_use;
            let first_message_at = normalize_timestamp_text(&row.created_at);
            let last_message_at = latest_timestamp(&row.created_at, &row.updated_at);
            let scheme_session = session_virtual_path(&row.workspace_id, &row.conversation_id);

            let summary = row.title.clone().filter(|t| !t.trim().is_empty());
            let title = summary
                .clone()
                .unwrap_or_else(|| row.conversation_id.clone());

            let mut metadata: HashMap<String, Value> = HashMap::new();
            metadata.insert("filePath".to_string(), json!(scheme_session));
            metadata.insert("workspaceId".to_string(), json!(row.workspace_id));
            metadata.insert("conversationId".to_string(), json!(row.conversation_id));

            UniversalSession {
                id: scheme_session,
                project_id: project_virtual_path(&row.workspace_id),
                source_id: source_id.to_string(),
                provider_id: PROVIDER_ID.to_string(),
                title,
                description: summary,
                message_count: entries.len(),
                first_message_at,
                last_message_at,
                duration: 0,
                total_tokens: None,
                tool_call_count: 0,
                error_count: 0,
                metadata,
                checksum: format!("{}:{}", row.workspace_id, row.conversation_id),
            }
        })
        .collect();

    sessions.sort_by(|a, b| b.last_message_at.cmp(&a.last_message_at));
    Ok(sessions)
}

// ============================================================================
// MESSAGE LOADING
// ============================================================================

/// Load messages for one ForgeCode conversation with pagination.
#[allow(clippy::too_many_arguments)]
pub fn load_forgecode_messages(
    base_path: &Path,
    workspace_id: &str,
    conversation_id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    let Some(conn) = open_forgecode_db(base_path) else {
        return Ok(Vec::new());
    };
    let Some(columns) = resolve_conversation_columns(&conn) else {
        return Ok(Vec::new());
    };
    let Some(row) = load_conversation_row(&conn, &columns, workspace_id, conversation_id) else {
        return Ok(Vec::new());
    };

    let entries = parse_context_entries(&row.context_json);
    let created_at = normalize_timestamp_text(&row.created_at);
    let updated_at = latest_timestamp(&row.created_at, &row.updated_at);

    let converted: Vec<UniversalMessage> = entries
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            context_entry_to_universal(
                entry,
                index,
                session_id,
                project_id,
                source_id,
                &created_at,
                &updated_at,
            )
        })
        .collect();

    let total = converted.len();
    let start = offset.min(total);
    let end = offset.saturating_add(limit).min(total);
    Ok(converted[start..end].to_vec())
}

// ============================================================================
// CONTEXT PARSING
// ============================================================================

/// Parse the ForgeCode `context` JSON into a list of entry values.
/// Accepts either a top-level array or an object with a `messages` array.
fn parse_context_entries(context_json: &str) -> Vec<Value> {
    let Ok(value) = serde_json::from_str::<Value>(context_json) else {
        return Vec::new();
    };

    match value {
        Value::Array(entries) => entries,
        Value::Object(mut object) => object
            .remove("messages")
            .and_then(|messages| messages.as_array().cloned())
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

/// Identify the variant ("text" | "tool" | "image") of a context entry and
/// return the inner payload value to interpret.
fn extract_context_variant(entry: &Value) -> (&'static str, &Value) {
    if let Some(message) = entry.get("message") {
        if let Some(text) = message.get("text") {
            return ("text", text);
        }
        if let Some(tool) = message.get("tool") {
            return ("tool", tool);
        }
        if let Some(image) = message.get("image") {
            return ("image", image);
        }
    }

    if let Some(text) = entry.get("Text") {
        return ("text", text);
    }
    if let Some(tool) = entry.get("Tool") {
        return ("tool", tool);
    }
    if let Some(image) = entry.get("Image") {
        return ("image", image);
    }

    if let Some(kind) = entry.get("type").and_then(Value::as_str) {
        return match kind.to_ascii_lowercase().as_str() {
            "tool" => ("tool", entry),
            "image" => ("image", entry),
            _ => ("text", entry),
        };
    }

    ("text", entry)
}

/// Whether a context entry contains tool usage data.
fn entry_has_tool_use(entry: &Value) -> bool {
    let (kind, payload) = extract_context_variant(entry);
    if kind == "tool" {
        return true;
    }
    payload.get("tool_calls").is_some()
        || payload.get("toolCalls").is_some()
        || payload.get("tool_use").is_some()
}

// ============================================================================
// CONVERSION TO UNIVERSAL FORMAT
// ============================================================================

/// Convert one ForgeCode context entry to a UniversalMessage.
#[allow(clippy::too_many_arguments)]
fn context_entry_to_universal(
    entry: &Value,
    index: usize,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    created_at: &str,
    updated_at: &str,
) -> UniversalMessage {
    let (kind, payload_ref) = extract_context_variant(entry);
    let payload = merge_entry_metadata(entry, payload_ref);

    let timestamp = extract_string(&payload, &["timestamp", "created_at", "createdAt", "time"])
        .map(|raw| normalize_timestamp_text(&raw))
        .filter(|t| !t.is_empty())
        .or_else(|| {
            extract_string(entry, &["timestamp", "created_at", "createdAt", "time"])
                .map(|raw| normalize_timestamp_text(&raw))
                .filter(|t| !t.is_empty())
        })
        .unwrap_or_else(|| fallback_timestamp(index, created_at, updated_at));

    let model = extract_string(&payload, &["model", "model_id", "modelId"]);
    let id = format!("forgecode-{}-{}", session_id, index);

    match kind {
        "image" => build_image_message(
            &payload, &id, session_id, project_id, source_id, &timestamp, model, index,
        ),
        "tool" => build_tool_message(
            &payload, &id, session_id, project_id, source_id, &timestamp, model, index,
        ),
        _ => build_text_message(
            &payload, &id, session_id, project_id, source_id, &timestamp, model, index,
        ),
    }
}

/// Merge select metadata keys from the outer entry into the inner payload.
fn merge_entry_metadata(entry: &Value, payload: &Value) -> Value {
    let mut merged = payload.clone();
    let Some(merged_object) = merged.as_object_mut() else {
        return merged;
    };
    let Some(entry_object) = entry.as_object() else {
        return merged;
    };

    for key in [
        "usage",
        "timestamp",
        "created_at",
        "createdAt",
        "time",
        "model",
        "role",
    ] {
        if !merged_object.contains_key(key) {
            if let Some(value) = entry_object.get(key) {
                merged_object.insert(key.to_string(), value.clone());
            }
        }
    }

    merged
}

/// Build a text-style message, expanding any embedded content blocks /
/// tool_calls into UniversalContent + ToolCall.
#[allow(clippy::too_many_arguments)]
fn build_text_message(
    payload: &Value,
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    model: Option<String>,
    sequence_number: usize,
) -> UniversalMessage {
    let role = normalize_role(
        extract_string(payload, &["role", "speaker", "author"]).as_deref(),
        MessageRole::User,
    );

    let mut content: Vec<UniversalContent> = Vec::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();

    match payload.get("content") {
        Some(Value::String(text)) if !text.trim().is_empty() => {
            content.push(text_content(text));
        }
        Some(Value::Array(blocks)) => {
            collect_content_blocks(blocks, &mut content, &mut tool_calls);
        }
        _ => {
            // No structured content; fall back to a `text` field if present.
            if let Some(text) = extract_string(payload, &["text"]) {
                if !text.trim().is_empty() {
                    content.push(text_content(&text));
                }
            }
        }
    }

    // Top-level tool_calls array (separate from content blocks).
    if let Some(calls) = payload
        .get("tool_calls")
        .or_else(|| payload.get("toolCalls"))
        .and_then(Value::as_array)
    {
        for call in calls {
            if let Some((tool_use, tool_call)) = normalize_tool_call(call) {
                content.push(tool_use);
                tool_calls.push(tool_call);
            }
        }
    }

    let mut msg = build_message(
        id,
        session_id,
        project_id,
        source_id,
        timestamp,
        role,
        MessageType::Message,
        content,
        model,
        sequence_number,
    );
    msg.tokens = extract_tokens(payload);
    if !tool_calls.is_empty() {
        msg.tool_calls = Some(tool_calls);
    }
    msg
}

/// Build a tool-style message: either a tool_use (assistant) or a tool_result
/// (user), depending on the shape of the payload.
#[allow(clippy::too_many_arguments)]
fn build_tool_message(
    payload: &Value,
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    model: Option<String>,
    sequence_number: usize,
) -> UniversalMessage {
    let role_hint = extract_string(payload, &["role", "speaker", "author"]);
    let tool_name = extract_string(payload, &["name", "tool_name", "toolName"])
        .unwrap_or_else(|| "tool".to_string());
    let tool_use_id =
        extract_string(payload, &["tool_use_id", "toolUseId", "call_id", "callId", "id"])
            .unwrap_or_else(|| format!("forgecode_tool_{}", id));

    let result_value = payload
        .get("output")
        .or_else(|| payload.get("result"))
        .or_else(|| payload.get("tool_result"))
        .or_else(|| payload.get("toolResult"))
        .cloned();
    let input_value = payload
        .get("input")
        .or_else(|| payload.get("arguments"))
        .or_else(|| payload.get("args"))
        .or_else(|| payload.get("params"))
        .cloned();

    let is_result = matches!(role_hint.as_deref(), Some("tool") | Some("user"))
        || (result_value.is_some() && input_value.is_none());

    if is_result {
        let result_data = result_value.unwrap_or_else(|| payload.clone());
        let content = vec![UniversalContent {
            content_type: ContentType::ToolResult,
            data: json!({
                "tool_use_id": tool_use_id,
                "name": tool_name,
                "content": result_data,
            }),
            encoding: None,
            mime_type: Some("application/json".to_string()),
            size: None,
            hash: None,
        }];
        let mut msg = build_message(
            id,
            session_id,
            project_id,
            source_id,
            timestamp,
            MessageRole::User,
            MessageType::Message,
            content,
            model,
            sequence_number,
        );
        msg.tokens = extract_tokens(payload);
        return msg;
    }

    let input_map = value_to_input_map(input_value.unwrap_or(Value::Null));
    let content = vec![UniversalContent {
        content_type: ContentType::ToolUse,
        data: json!({
            "id": tool_use_id,
            "name": tool_name,
            "input": Value::Object(input_map.clone().into_iter().collect()),
        }),
        encoding: None,
        mime_type: Some("application/json".to_string()),
        size: None,
        hash: None,
    }];

    let mut msg = build_message(
        id,
        session_id,
        project_id,
        source_id,
        timestamp,
        MessageRole::Assistant,
        MessageType::Message,
        content,
        model,
        sequence_number,
    );
    msg.tokens = extract_tokens(payload);
    msg.tool_calls = Some(vec![ToolCall {
        id: tool_use_id,
        name: tool_name,
        input: input_map,
        output: None,
        error: None,
        status: ToolCallStatus::Success,
    }]);
    msg
}

/// Build an image-style message.
#[allow(clippy::too_many_arguments)]
fn build_image_message(
    payload: &Value,
    id: &str,
    session_id: &str,
    project_id: &str,
    source_id: &str,
    timestamp: &str,
    model: Option<String>,
    sequence_number: usize,
) -> UniversalMessage {
    let role = normalize_role(
        extract_string(payload, &["role", "speaker", "author"]).as_deref(),
        MessageRole::User,
    );
    let source = payload
        .get("source")
        .cloned()
        .unwrap_or_else(|| payload.clone());
    let content = vec![UniversalContent {
        content_type: ContentType::Image,
        data: json!({ "source": source }),
        encoding: None,
        mime_type: None,
        size: None,
        hash: None,
    }];
    build_message(
        id,
        session_id,
        project_id,
        source_id,
        timestamp,
        role,
        MessageType::Message,
        content,
        model,
        sequence_number,
    )
}

/// Expand an array of content blocks into UniversalContent + ToolCall entries.
fn collect_content_blocks(
    blocks: &[Value],
    content: &mut Vec<UniversalContent>,
    tool_calls: &mut Vec<ToolCall>,
) {
    for block in blocks {
        let block_type = block.get("type").and_then(Value::as_str).unwrap_or("");
        match block_type {
            "text" => {
                if let Some(text) = block.get("text").and_then(Value::as_str) {
                    if !text.trim().is_empty() {
                        content.push(text_content(text));
                    }
                }
            }
            "thinking" => {
                if let Some(text) = block.get("thinking").and_then(Value::as_str) {
                    content.push(thinking_content(text));
                }
            }
            "tool_use" => {
                if let Some((tool_use, tool_call)) = normalize_tool_call(block) {
                    content.push(tool_use);
                    tool_calls.push(tool_call);
                }
            }
            "tool_result" => {
                content.push(UniversalContent {
                    content_type: ContentType::ToolResult,
                    data: block.clone(),
                    encoding: None,
                    mime_type: Some("application/json".to_string()),
                    size: None,
                    hash: None,
                });
            }
            "image" => {
                content.push(UniversalContent {
                    content_type: ContentType::Image,
                    data: block.clone(),
                    encoding: None,
                    mime_type: None,
                    size: None,
                    hash: None,
                });
            }
            _ => {
                // Unknown block carrying text → render as text.
                if let Some(text) = block.get("text").and_then(Value::as_str) {
                    if !text.trim().is_empty() {
                        content.push(text_content(text));
                    }
                }
            }
        }
    }
}

/// Normalize a tool_use / tool_call block into (UniversalContent, ToolCall).
fn normalize_tool_call(block: &Value) -> Option<(UniversalContent, ToolCall)> {
    let name = extract_string(block, &["name"])?;
    let call_id = extract_string(block, &["id", "call_id", "callId"])
        .unwrap_or_else(|| format!("tool-{}", name.to_ascii_lowercase()));

    let raw_input = block
        .get("input")
        .or_else(|| block.get("arguments"))
        .or_else(|| block.get("args"))
        .or_else(|| block.get("params"))
        .cloned()
        .unwrap_or(Value::Null);
    let input_map = value_to_input_map(raw_input);

    let content = UniversalContent {
        content_type: ContentType::ToolUse,
        data: json!({
            "id": call_id,
            "name": name,
            "input": Value::Object(input_map.clone().into_iter().collect()),
        }),
        encoding: None,
        mime_type: Some("application/json".to_string()),
        size: None,
        hash: None,
    };

    let tool_call = ToolCall {
        id: call_id,
        name,
        input: input_map,
        output: None,
        error: None,
        status: ToolCallStatus::Success,
    };

    Some((content, tool_call))
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
    model: Option<String>,
    sequence_number: usize,
) -> UniversalMessage {
    UniversalMessage {
        id: id.to_string(),
        session_id: session_id.to_string(),
        project_id: project_id.to_string(),
        source_id: source_id.to_string(),
        provider_id: PROVIDER_ID.to_string(),
        timestamp: timestamp.to_string(),
        sequence_number: sequence_number.try_into().unwrap_or(i32::MAX),
        role,
        message_type,
        content,
        parent_id: None,
        depth: None,
        branch_id: None,
        model,
        tokens: None,
        tool_calls: None,
        thinking: None,
        attachments: None,
        errors: None,
        original_format: "forgecode_sqlite".to_string(),
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

fn thinking_content(text: &str) -> UniversalContent {
    UniversalContent {
        content_type: ContentType::Thinking,
        data: json!({ "thinking": text }),
        encoding: None,
        mime_type: Some("text/plain".to_string()),
        size: Some(text.len()),
        hash: None,
    }
}

/// Map a JSON value to a tool-input HashMap. String inputs that hold JSON are
/// re-parsed; non-object values are wrapped under a `value` key.
fn value_to_input_map(value: Value) -> HashMap<String, Value> {
    let normalized = match value {
        Value::String(text) => serde_json::from_str(&text).unwrap_or(Value::String(text)),
        other => other,
    };
    match normalized {
        Value::Object(map) => map.into_iter().collect(),
        Value::Null => HashMap::new(),
        other => {
            let mut map = HashMap::new();
            map.insert("value".to_string(), other);
            map
        }
    }
}

/// Extract token usage from a ForgeCode payload (`usage` object or inline).
fn extract_tokens(payload: &Value) -> Option<TokenUsage> {
    let usage = payload.get("usage").unwrap_or(payload);

    let input = u32_field(
        usage,
        &["input_tokens", "inputTokens", "prompt_tokens", "promptTokens"],
    );
    let output = u32_field(
        usage,
        &[
            "output_tokens",
            "outputTokens",
            "completion_tokens",
            "completionTokens",
        ],
    );
    let cache_read = u32_field(
        usage,
        &[
            "cache_read_input_tokens",
            "cacheReadInputTokens",
            "cached_tokens",
            "cachedTokens",
        ],
    );
    let cache_creation = u32_field(
        usage,
        &["cache_creation_input_tokens", "cacheCreationInputTokens"],
    );
    let service_tier = extract_string(usage, &["service_tier", "serviceTier"]);

    if input.is_none()
        && output.is_none()
        && cache_read.is_none()
        && cache_creation.is_none()
        && service_tier.is_none()
    {
        return None;
    }

    let input_tokens = input.unwrap_or(0) as i32;
    let output_tokens = output.unwrap_or(0) as i32;

    Some(TokenUsage {
        input_tokens,
        output_tokens,
        total_tokens: input_tokens.saturating_add(output_tokens),
        cache_creation_tokens: cache_creation.map(|v| v as i32),
        cache_read_tokens: cache_read.map(|v| v as i32),
        service_tier,
    })
}

/// Read a u32-like value, supporting numbers, numeric strings, and the
/// ForgeCode `{ "actual": N }` wrapper.
fn u32_field(value: &Value, keys: &[&str]) -> Option<u32> {
    keys.iter()
        .filter_map(|k| value.get(k))
        .find_map(value_to_u32)
}

fn value_to_u32(value: &Value) -> Option<u32> {
    match value {
        Value::Number(n) => n.as_u64().and_then(|v| u32::try_from(v).ok()),
        Value::String(s) => s.parse::<u32>().ok(),
        Value::Object(obj) => obj
            .get("actual")
            .or_else(|| obj.get("value"))
            .or_else(|| obj.get("count"))
            .and_then(value_to_u32),
        _ => None,
    }
}

/// Normalize a role string into a MessageRole. ForgeCode "tool" roles map to
/// User (tool results), matching upstream behavior.
fn normalize_role(role: Option<&str>, default_role: MessageRole) -> MessageRole {
    match role.map(|r| r.trim().to_ascii_lowercase()).as_deref() {
        Some("assistant") => MessageRole::Assistant,
        Some("system") => MessageRole::System,
        Some("user") | Some("tool") => MessageRole::User,
        Some("") | None => default_role,
        _ => default_role,
    }
}

fn extract_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value.get(key).and_then(|inner| match inner {
            Value::String(text) if !text.trim().is_empty() => Some(text.clone()),
            Value::Number(number) => Some(number.to_string()),
            _ => None,
        })
    })
}

// ============================================================================
// CWD / DISPLAY NAME HELPERS
// ============================================================================

/// Collect `cwd` vote counts from a context JSON blob (recursively).
fn extract_cwd_votes(context_json: &str) -> BTreeMap<String, usize> {
    let mut votes = BTreeMap::new();
    if let Ok(parsed) = serde_json::from_str::<Value>(context_json) {
        collect_cwd_votes(&parsed, &mut votes);
    }
    votes
}

fn collect_cwd_votes(value: &Value, votes: &mut BTreeMap<String, usize>) {
    match value {
        Value::Object(map) => {
            if let Some(cwd) = map.get("cwd").and_then(Value::as_str) {
                let trimmed = cwd.trim();
                if !trimmed.is_empty() {
                    *votes.entry(trimmed.to_string()).or_default() += 1;
                }
            }
            for nested in map.values() {
                collect_cwd_votes(nested, votes);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_cwd_votes(item, votes);
            }
        }
        _ => {}
    }
}

/// Pick the most-voted cwd, excluding bare home directories.
fn choose_best_cwd(cwd_votes: &BTreeMap<String, usize>) -> Option<String> {
    let home_dir = dirs::home_dir();
    cwd_votes
        .iter()
        .filter(|(path, _)| {
            let p = Path::new(path.as_str());
            !home_dir.as_deref().is_some_and(|home| p == home)
        })
        .max_by(|(left_path, left_votes), (right_path, right_votes)| {
            left_votes
                .cmp(right_votes)
                .then_with(|| right_path.len().cmp(&left_path.len()))
                .then_with(|| left_path.cmp(right_path))
        })
        .map(|(path, _)| path.clone())
}

// ============================================================================
// PATH SCHEME
// ============================================================================

fn project_virtual_path(workspace_id: &str) -> String {
    format!("{SCHEME_PREFIX}{workspace_id}")
}

fn session_virtual_path(workspace_id: &str, conversation_id: &str) -> String {
    format!("{SCHEME_PREFIX}{workspace_id}/{conversation_id}")
}

/// Parse a `forgecode://<workspace_id>` project path → workspace id.
pub fn parse_project_path(project_path: &str) -> Result<String, String> {
    let body = project_path
        .strip_prefix(SCHEME_PREFIX)
        .unwrap_or(project_path);
    let workspace_id = body.split('/').next().unwrap_or(body);
    if is_valid_virtual_component(workspace_id) {
        Ok(workspace_id.to_string())
    } else {
        Err(format!(
            "FORGECODE_PATH_ERROR: Invalid project path: {project_path}"
        ))
    }
}

/// Parse a `forgecode://<workspace_id>/<conversation_id>` session path.
pub fn parse_session_path(session_path: &str) -> Result<(String, String), String> {
    let body = session_path
        .strip_prefix(SCHEME_PREFIX)
        .unwrap_or(session_path);
    let (workspace_id, conversation_id) = body
        .split_once('/')
        .ok_or_else(|| format!("FORGECODE_PATH_ERROR: Invalid session path: {session_path}"))?;

    if !is_valid_virtual_component(workspace_id) || !is_valid_virtual_component(conversation_id) {
        return Err(format!(
            "FORGECODE_SECURITY_ERROR: Unsafe session path: {session_path}"
        ));
    }
    Ok((workspace_id.to_string(), conversation_id.to_string()))
}

/// Validate a single virtual path component (`^[A-Za-z0-9_-]+$`).
/// Rejects `..`, slashes, and any other path-traversal characters.
fn is_valid_virtual_component(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

// ============================================================================
// SQL IDENTIFIER / CAST HELPERS
// ============================================================================

fn quote_ident(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

fn cast_text_expr(identifier: &str) -> String {
    format!("COALESCE(CAST({} AS TEXT), '')", quote_ident(identifier))
}

fn optional_cast_text_expr(identifier: Option<&str>) -> String {
    identifier.map_or_else(|| "''".to_string(), cast_text_expr)
}

fn optional_order_expr(identifier: Option<&str>) -> String {
    identifier
        .map(quote_ident)
        .unwrap_or_else(|| "rowid".to_string())
}

fn empty_to_none(value: String) -> Option<String> {
    if value.trim().is_empty() {
        None
    } else {
        Some(value)
    }
}

// ============================================================================
// TIMESTAMP HELPERS
// ============================================================================

/// Normalize a timestamp string into RFC3339 form when possible.
/// Supports RFC3339, `%Y-%m-%d %H:%M:%S`, naive ISO, and epoch (s/ms) integers.
fn normalize_timestamp_text(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Ok(raw_number) = trimmed.parse::<i64>() {
        let millis = if raw_number.abs() >= 10_000_000_000 {
            raw_number
        } else {
            raw_number.saturating_mul(1000)
        };
        return epoch_ms_to_rfc3339(millis);
    }

    if let Ok(ts) = DateTime::parse_from_rfc3339(trimmed) {
        return ts.with_timezone(&Utc).to_rfc3339();
    }

    if let Ok(ts) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S%.f") {
        return ts.and_utc().to_rfc3339();
    }
    if let Ok(ts) = NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%dT%H:%M:%S%.f") {
        return ts.and_utc().to_rfc3339();
    }

    trimmed.to_string()
}

/// Return the newer of two timestamp strings (preferring `updated_at`).
fn latest_timestamp(created_at: &str, updated_at: &str) -> String {
    let updated = normalize_timestamp_text(updated_at);
    if updated.is_empty() {
        normalize_timestamp_text(created_at)
    } else {
        updated
    }
}

/// Return the later of two already-normalized timestamps.
fn max_timestamp(current: &str, candidate: &str) -> String {
    if current.is_empty() {
        return candidate.to_string();
    }
    if candidate.is_empty() {
        return current.to_string();
    }
    if candidate >= current {
        candidate.to_string()
    } else {
        current.to_string()
    }
}

/// Build a fallback message timestamp when the entry has none.
fn fallback_timestamp(index: usize, created_at: &str, updated_at: &str) -> String {
    if index == 0 && !created_at.is_empty() {
        created_at.to_string()
    } else if !updated_at.is_empty() {
        updated_at.to_string()
    } else {
        created_at.to_string()
    }
}

// ============================================================================
// UNIT TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use tempfile::TempDir;

    fn create_test_db(tmp: &TempDir) -> Connection {
        let db_path = tmp.path().join(".forge.db");
        let conn = Connection::open(db_path).expect("create forgecode test db");
        conn.execute_batch(
            "CREATE TABLE conversations (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                title TEXT,
                context TEXT,
                metrics TEXT,
                created_at TEXT,
                updated_at TEXT
            );",
        )
        .expect("create conversations table");
        conn
    }

    fn seed(conn: &Connection) {
        conn.execute(
            "INSERT INTO conversations (id, workspace_id, title, context, metrics, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "conv-001",
                "workspace-alpha",
                "Text and tool session",
                serde_json::to_string(&json!({
                    "cwd": "/home/dev/projects/banana-service",
                    "messages": [
                        {
                            "Text": {
                                "role": "user",
                                "content": "Inspect src/main.rs",
                                "timestamp": "2026-01-10T08:00:00Z"
                            }
                        },
                        {
                            "message": {
                                "text": {
                                    "role": "Assistant",
                                    "content": "",
                                    "tool_calls": [
                                        {
                                            "name": "Read",
                                            "call_id": "tool-123",
                                            "arguments": { "file_path": "/tmp/src/main.rs" }
                                        }
                                    ],
                                    "model": "forge-model-v1"
                                }
                            },
                            "usage": {
                                "prompt_tokens": 120,
                                "completion_tokens": 45,
                                "cached_tokens": 30
                            },
                            "timestamp": "2026-01-10T08:00:05Z"
                        },
                        {
                            "message": {
                                "tool": {
                                    "name": "Read",
                                    "call_id": "tool-123",
                                    "output": { "content": "fn main() {}" }
                                }
                            },
                            "timestamp": "2026-01-10T08:00:06Z"
                        }
                    ]
                }))
                .unwrap(),
                Value::Null.to_string(),
                "2026-01-10T08:00:00Z",
                "2026-01-10T08:00:06Z"
            ],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO conversations (id, workspace_id, title, context, metrics, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "conv-002",
                "workspace-beta",
                "Image session",
                serde_json::to_string(&json!([
                    {
                        "cwd": "/home/dev/projects/image-lab",
                        "Image": {
                            "role": "user",
                            "source": { "mime_type": "image/png", "path": "/tmp/shot.png" },
                            "timestamp": "2026-01-11T09:15:00Z"
                        }
                    }
                ]))
                .unwrap(),
                Value::Null.to_string(),
                "2026-01-11T09:15:00Z",
                "2026-01-11T09:15:00Z"
            ],
        )
        .unwrap();
    }

    fn first_text(msg: &UniversalMessage) -> String {
        msg.content[0]
            .data
            .get("text")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    }

    #[test]
    fn test_scan_projects_groups_by_workspace() {
        let tmp = tempfile::tempdir().unwrap();
        let conn = create_test_db(&tmp);
        seed(&conn);
        drop(conn);

        let projects = scan_forgecode_projects(tmp.path(), "src").unwrap();
        assert_eq!(projects.len(), 2, "one project per workspace");

        let alpha = projects
            .iter()
            .find(|p| p.id == "forgecode://workspace-alpha")
            .expect("workspace-alpha project");
        assert_eq!(alpha.provider_id, "forgecode");
        assert_eq!(alpha.name, "banana-service");
        assert_eq!(alpha.session_count, 1);
        assert_eq!(alpha.total_messages, 3);

        let beta = projects
            .iter()
            .find(|p| p.id == "forgecode://workspace-beta")
            .expect("workspace-beta project");
        assert_eq!(beta.name, "image-lab");
    }

    #[test]
    fn test_load_sessions_for_workspace() {
        let tmp = tempfile::tempdir().unwrap();
        let conn = create_test_db(&tmp);
        seed(&conn);
        drop(conn);

        let sessions = load_forgecode_sessions(tmp.path(), "workspace-alpha", "src").unwrap();
        assert_eq!(sessions.len(), 1);
        let s = &sessions[0];
        assert_eq!(s.id, "forgecode://workspace-alpha/conv-001");
        assert_eq!(s.project_id, "forgecode://workspace-alpha");
        assert_eq!(s.provider_id, "forgecode");
        assert_eq!(s.title, "Text and tool session");
        assert_eq!(s.message_count, 3);
    }

    #[test]
    fn test_load_messages_converts_context_entries() {
        let tmp = tempfile::tempdir().unwrap();
        let conn = create_test_db(&tmp);
        seed(&conn);
        drop(conn);

        let messages = load_forgecode_messages(
            tmp.path(),
            "workspace-alpha",
            "conv-001",
            "forgecode://workspace-alpha/conv-001",
            "forgecode://workspace-alpha",
            "src",
            0,
            100,
        )
        .unwrap();

        assert_eq!(messages.len(), 3);

        // 1) user text
        assert_eq!(messages[0].role, MessageRole::User);
        assert_eq!(messages[0].content[0].content_type, ContentType::Text);
        assert_eq!(first_text(&messages[0]), "Inspect src/main.rs");

        // 2) assistant with embedded tool_calls → tool_use content + ToolCall + tokens
        assert_eq!(messages[1].role, MessageRole::Assistant);
        assert_eq!(messages[1].content[0].content_type, ContentType::ToolUse);
        assert_eq!(
            messages[1].content[0].data.get("name").and_then(Value::as_str),
            Some("Read")
        );
        let tool_calls = messages[1].tool_calls.as_ref().expect("tool_calls present");
        assert_eq!(tool_calls[0].name, "Read");
        let tokens = messages[1].tokens.as_ref().expect("tokens present");
        assert_eq!(tokens.input_tokens, 120);
        assert_eq!(tokens.output_tokens, 45);
        assert_eq!(tokens.cache_read_tokens, Some(30));

        // 3) tool result → user / tool_result
        assert_eq!(messages[2].role, MessageRole::User);
        assert_eq!(messages[2].content[0].content_type, ContentType::ToolResult);
    }

    #[test]
    fn test_load_messages_pagination() {
        let tmp = tempfile::tempdir().unwrap();
        let conn = create_test_db(&tmp);
        seed(&conn);
        drop(conn);

        let page = load_forgecode_messages(
            tmp.path(),
            "workspace-alpha",
            "conv-001",
            "forgecode://workspace-alpha/conv-001",
            "forgecode://workspace-alpha",
            "src",
            1,
            1,
        )
        .unwrap();
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].role, MessageRole::Assistant);
    }

    #[test]
    fn test_image_message_conversion() {
        let tmp = tempfile::tempdir().unwrap();
        let conn = create_test_db(&tmp);
        seed(&conn);
        drop(conn);

        let messages = load_forgecode_messages(
            tmp.path(),
            "workspace-beta",
            "conv-002",
            "forgecode://workspace-beta/conv-002",
            "forgecode://workspace-beta",
            "src",
            0,
            100,
        )
        .unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content[0].content_type, ContentType::Image);
    }

    #[test]
    fn test_parse_session_path_rejects_traversal() {
        assert!(parse_session_path("forgecode://ws/conv").is_ok());
        assert_eq!(
            parse_session_path("forgecode://ws/conv").unwrap(),
            ("ws".to_string(), "conv".to_string())
        );
        assert!(parse_session_path("forgecode://../etc/passwd").is_err());
        assert!(parse_session_path("forgecode://ws/..").is_err());
        assert!(parse_session_path("forgecode://ws").is_err());
    }

    #[test]
    fn test_parse_project_path() {
        assert_eq!(
            parse_project_path("forgecode://workspace-alpha").unwrap(),
            "workspace-alpha"
        );
        assert!(parse_project_path("forgecode://bad..ws").is_err());
    }

    #[test]
    fn test_normalize_timestamp_epoch_and_rfc3339() {
        assert!(normalize_timestamp_text("2026-01-10T08:00:00Z").starts_with("2026-01-10"));
        assert!(normalize_timestamp_text("1704067200000").starts_with("2024-01-01"));
        assert!(normalize_timestamp_text("1704067200").starts_with("2024-01-01"));
        assert_eq!(normalize_timestamp_text(""), "");
    }
}
