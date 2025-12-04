// ============================================================================
// CURSOR IDE SESSION WRITER (v2.0.0)
// ============================================================================
// Tauri commands for writing Cursor IDE conversation history to SQLite databases
// Mirrors the Claude Code session_writer.rs functionality

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

// Re-use message input types from session_writer for consistency
use crate::commands::session_writer::{MessageInput, TokenUsageInput};

// ============================================================================
// CURSOR-SPECIFIC INPUT/OUTPUT TYPES
// ============================================================================

/// Request to create a new Cursor session (composer)
#[derive(Debug, Deserialize)]
pub struct CreateCursorSessionRequest {
    pub cursor_path: String,  // Base Cursor folder (e.g., AppData/Roaming/Cursor)
    pub workspace_id: String, // Workspace ID to create session in
    pub messages: Vec<MessageInput>,
    pub summary: Option<String>,
}

/// Response containing created Cursor session info
#[derive(Debug, Serialize)]
pub struct CreateCursorSessionResponse {
    pub session_id: String,
    pub workspace_id: String,
    pub message_count: usize,
    pub db_path: String, // Encoded path with session info
}

/// Request to append messages to existing Cursor session
#[derive(Debug, Deserialize)]
pub struct AppendCursorMessagesRequest {
    pub cursor_path: String, // Base Cursor folder
    pub session_id: String,  // Composer ID to append to
    pub messages: Vec<MessageInput>,
}

// ============================================================================
// CURSOR BUBBLE FORMAT (WRITE DIRECTION)
// ============================================================================

/// Cursor bubble format for writing to SQLite
#[derive(Debug, Serialize)]
struct CursorBubbleWrite {
    #[serde(rename = "type")]
    bubble_type: i32, // 1 = user, 2 = assistant

    text: String,

    #[serde(rename = "toolResults", skip_serializing_if = "Vec::is_empty")]
    tool_results: Vec<serde_json::Value>,

    #[serde(rename = "relevantFiles", skip_serializing_if = "Vec::is_empty")]
    relevant_files: Vec<serde_json::Value>,

    #[serde(rename = "attachedCodeChunks", skip_serializing_if = "Vec::is_empty")]
    attached_code_chunks: Vec<serde_json::Value>,

    #[serde(
        rename = "assistantSuggestedDiffs",
        skip_serializing_if = "Vec::is_empty"
    )]
    assistant_suggested_diffs: Vec<serde_json::Value>,

    #[serde(rename = "gitDiffs", skip_serializing_if = "Vec::is_empty")]
    git_diffs: Vec<serde_json::Value>,

    #[serde(rename = "interpreterResults", skip_serializing_if = "Vec::is_empty")]
    interpreter_results: Vec<serde_json::Value>,

    #[serde(rename = "consoleLogs", skip_serializing_if = "Vec::is_empty")]
    console_logs: Vec<serde_json::Value>,

    #[serde(rename = "allThinkingBlocks", skip_serializing_if = "Vec::is_empty")]
    all_thinking_blocks: Vec<serde_json::Value>,

    #[serde(rename = "tokenCount", skip_serializing_if = "Option::is_none")]
    token_count: Option<CursorTokenCount>,

    #[serde(rename = "toolFormerData", skip_serializing_if = "Option::is_none")]
    tool_former_data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct CursorTokenCount {
    #[serde(rename = "inputTokens")]
    input_tokens: i32,
    #[serde(rename = "outputTokens")]
    output_tokens: i32,
}

/// Composer metadata for workspace database
#[derive(Debug, Serialize, Deserialize)]
struct ComposerMetadata {
    #[serde(rename = "composerId")]
    composer_id: String,
    #[serde(rename = "lastUpdatedAt")]
    last_updated_at: Option<i64>,
    #[serde(rename = "createdAt")]
    created_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WorkspaceComposerData {
    #[serde(rename = "allComposers")]
    all_composers: Vec<ComposerMetadata>,
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Create a new Cursor session (composer) in the specified workspace
#[tauri::command]
pub async fn create_cursor_session(
    request: CreateCursorSessionRequest,
) -> Result<CreateCursorSessionResponse, String> {
    let cursor_base = PathBuf::from(&request.cursor_path);

    // Validate cursor path exists
    if !cursor_base.exists() {
        return Err(format!(
            "CURSOR_PATH_NOT_FOUND: Cursor folder not found at {}",
            cursor_base.display()
        ));
    }

    // Build paths to databases
    let workspace_db_path = cursor_base
        .join("User")
        .join("workspaceStorage")
        .join(&request.workspace_id)
        .join("state.vscdb");

    let global_db_path = cursor_base
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    // Validate databases exist
    if !workspace_db_path.exists() {
        return Err(format!(
            "CURSOR_WORKSPACE_NOT_FOUND: Workspace database not found at {}",
            workspace_db_path.display()
        ));
    }

    if !global_db_path.exists() {
        return Err(format!(
            "CURSOR_GLOBAL_DB_NOT_FOUND: Global database not found at {}",
            global_db_path.display()
        ));
    }

    // Generate new session (composer) ID
    let session_id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let timestamp_ms = now.timestamp_millis();

    // Step 1: Update workspace database with new composer metadata
    update_workspace_composer_data(&workspace_db_path, &session_id, timestamp_ms)?;

    // Step 2: Write messages to global database
    let message_count =
        write_messages_to_global_db(&global_db_path, &session_id, &request.messages)?;

    // Build encoded db_path for session identification
    let db_path_encoded = format!(
        "{}#session={}#workspace={}#timestamp={}",
        global_db_path.to_string_lossy(),
        session_id,
        request.workspace_id,
        now.to_rfc3339()
    );

    Ok(CreateCursorSessionResponse {
        session_id,
        workspace_id: request.workspace_id,
        message_count,
        db_path: db_path_encoded,
    })
}

/// Append messages to an existing Cursor session
#[tauri::command]
pub async fn append_to_cursor_session(
    request: AppendCursorMessagesRequest,
) -> Result<usize, String> {
    let cursor_base = PathBuf::from(&request.cursor_path);

    // Validate cursor path exists
    if !cursor_base.exists() {
        return Err(format!(
            "CURSOR_PATH_NOT_FOUND: Cursor folder not found at {}",
            cursor_base.display()
        ));
    }

    let global_db_path = cursor_base
        .join("User")
        .join("globalStorage")
        .join("state.vscdb");

    if !global_db_path.exists() {
        return Err(format!(
            "CURSOR_GLOBAL_DB_NOT_FOUND: Global database not found at {}",
            global_db_path.display()
        ));
    }

    // Get the current highest message index for this session
    let start_index = get_session_message_count(&global_db_path, &request.session_id)?;

    // Write new messages starting from the next index
    let conn = Connection::open(&global_db_path)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open global database: {}", e))?;

    let message_count = request.messages.len();

    for (idx, msg) in request.messages.iter().enumerate() {
        let bubble = convert_message_to_bubble(msg)?;
        let bubble_json = serde_json::to_string(&bubble)
            .map_err(|e| format!("CURSOR_SERIALIZE_ERROR: Failed to serialize bubble: {}", e))?;

        let key = format!("bubbleId:{}:{}", request.session_id, start_index + idx);

        conn.execute(
            "INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            params![key, bubble_json],
        )
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to insert message: {}", e))?;
    }

    Ok(message_count)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Update workspace composer metadata to include new session
fn update_workspace_composer_data(
    workspace_db_path: &PathBuf,
    session_id: &str,
    timestamp_ms: i64,
) -> Result<(), String> {
    let conn = Connection::open(workspace_db_path)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open workspace database: {}", e))?;

    // Read existing composer data
    let existing_data: Option<String> = conn
        .query_row(
            "SELECT value FROM ItemTable WHERE key = 'composer.composerData'",
            params![],
            |row| row.get(0),
        )
        .ok();

    let mut workspace_data = if let Some(json_str) = existing_data {
        serde_json::from_str::<WorkspaceComposerData>(&json_str).unwrap_or(WorkspaceComposerData {
            all_composers: Vec::new(),
        })
    } else {
        WorkspaceComposerData {
            all_composers: Vec::new(),
        }
    };

    // Add new composer
    workspace_data.all_composers.push(ComposerMetadata {
        composer_id: session_id.to_string(),
        last_updated_at: Some(timestamp_ms),
        created_at: Some(timestamp_ms),
    });

    // Serialize and save
    let updated_json = serde_json::to_string(&workspace_data).map_err(|e| {
        format!(
            "CURSOR_SERIALIZE_ERROR: Failed to serialize composer data: {}",
            e
        )
    })?;

    // Check if entry exists
    let entry_exists: bool = conn
        .query_row(
            "SELECT 1 FROM ItemTable WHERE key = 'composer.composerData'",
            params![],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if entry_exists {
        conn.execute(
            "UPDATE ItemTable SET value = ?1 WHERE key = 'composer.composerData'",
            params![updated_json],
        )
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to update composer data: {}", e))?;
    } else {
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES ('composer.composerData', ?1)",
            params![updated_json],
        )
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to insert composer data: {}", e))?;
    }

    Ok(())
}

/// Write messages to global database
fn write_messages_to_global_db(
    global_db_path: &PathBuf,
    session_id: &str,
    messages: &[MessageInput],
) -> Result<usize, String> {
    let conn = Connection::open(global_db_path)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open global database: {}", e))?;

    // Ensure cursorDiskKV table exists (it should, but just in case)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cursorDiskKV (key TEXT PRIMARY KEY, value TEXT)",
        params![],
    )
    .map_err(|e| format!("CURSOR_DB_ERROR: Failed to create table: {}", e))?;

    let message_count = messages.len();

    for (idx, msg) in messages.iter().enumerate() {
        let bubble = convert_message_to_bubble(msg)?;
        let bubble_json = serde_json::to_string(&bubble)
            .map_err(|e| format!("CURSOR_SERIALIZE_ERROR: Failed to serialize bubble: {}", e))?;

        let key = format!("bubbleId:{}:{}", session_id, idx);

        conn.execute(
            "INSERT OR REPLACE INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            params![key, bubble_json],
        )
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to insert message: {}", e))?;
    }

    Ok(message_count)
}

/// Get the current message count for a session
fn get_session_message_count(global_db_path: &PathBuf, session_id: &str) -> Result<usize, String> {
    let conn = Connection::open(global_db_path)
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to open global database: {}", e))?;

    let pattern = format!("bubbleId:{}:%", session_id);

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM cursorDiskKV WHERE key LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|e| format!("CURSOR_DB_ERROR: Failed to count messages: {}", e))?;

    Ok(count as usize)
}

/// Convert MessageInput to CursorBubble format
fn convert_message_to_bubble(msg: &MessageInput) -> Result<CursorBubbleWrite, String> {
    // Determine bubble type (1 = user, 2 = assistant)
    let bubble_type = match msg.role.to_lowercase().as_str() {
        "user" => 1,
        "assistant" => 2,
        "system" => 2, // Treat system as assistant for Cursor
        _ => 1,        // Default to user
    };

    // Extract text content
    let text = extract_text_content(&msg.content)?;

    // Convert token usage if present
    let token_count = msg.usage.as_ref().map(|u| CursorTokenCount {
        input_tokens: u.input_tokens.unwrap_or(0),
        output_tokens: u.output_tokens.unwrap_or(0),
    });

    // Convert tool results if present
    let tool_results = if let Some(ref tool_result) = msg.tool_use_result {
        vec![tool_result.clone()]
    } else {
        Vec::new()
    };

    // Convert tool use to toolFormerData if present
    let tool_former_data = msg.tool_use.clone();

    Ok(CursorBubbleWrite {
        bubble_type,
        text,
        tool_results,
        relevant_files: Vec::new(),
        attached_code_chunks: Vec::new(),
        assistant_suggested_diffs: Vec::new(),
        git_diffs: Vec::new(),
        interpreter_results: Vec::new(),
        console_logs: Vec::new(),
        all_thinking_blocks: Vec::new(),
        token_count,
        tool_former_data,
    })
}

/// Extract text content from content Value (string or array)
fn extract_text_content(content: &serde_json::Value) -> Result<String, String> {
    match content {
        // Simple string content
        serde_json::Value::String(s) => Ok(s.clone()),

        // Array content - extract text from items
        serde_json::Value::Array(items) => {
            let mut texts = Vec::new();

            for item in items {
                if let Some(obj) = item.as_object() {
                    // Check for "text" type content
                    if obj.get("type").and_then(|t| t.as_str()) == Some("text") {
                        if let Some(text) = obj.get("text").and_then(|t| t.as_str()) {
                            texts.push(text.to_string());
                        }
                    }
                    // Check for direct "text" field
                    else if let Some(text) = obj.get("text").and_then(|t| t.as_str()) {
                        texts.push(text.to_string());
                    }
                }
            }

            Ok(texts.join("\n"))
        }

        // Other types - try to convert to string
        _ => Ok(content.to_string()),
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_text_content_string() {
        let content = serde_json::json!("Hello, world!");
        let result = extract_text_content(&content).unwrap();
        assert_eq!(result, "Hello, world!");
    }

    #[test]
    fn test_extract_text_content_array() {
        let content = serde_json::json!([
            {"type": "text", "text": "First line"},
            {"type": "text", "text": "Second line"}
        ]);
        let result = extract_text_content(&content).unwrap();
        assert_eq!(result, "First line\nSecond line");
    }

    #[test]
    fn test_convert_message_to_bubble_user() {
        let msg = MessageInput {
            role: "user".to_string(),
            content: serde_json::json!("Test message"),
            parent_id: None,
            model: None,
            tool_use: None,
            tool_use_result: None,
            usage: None,
        };

        let bubble = convert_message_to_bubble(&msg).unwrap();
        assert_eq!(bubble.bubble_type, 1);
        assert_eq!(bubble.text, "Test message");
    }

    #[test]
    fn test_convert_message_to_bubble_assistant() {
        let msg = MessageInput {
            role: "assistant".to_string(),
            content: serde_json::json!("Assistant response"),
            parent_id: None,
            model: Some("gpt-4".to_string()),
            tool_use: None,
            tool_use_result: None,
            usage: Some(TokenUsageInput {
                input_tokens: Some(100),
                output_tokens: Some(50),
                cache_creation_input_tokens: None,
                cache_read_input_tokens: None,
            }),
        };

        let bubble = convert_message_to_bubble(&msg).unwrap();
        assert_eq!(bubble.bubble_type, 2);
        assert_eq!(bubble.text, "Assistant response");
        assert!(bubble.token_count.is_some());
        let tc = bubble.token_count.unwrap();
        assert_eq!(tc.input_tokens, 100);
        assert_eq!(tc.output_tokens, 50);
    }
}
