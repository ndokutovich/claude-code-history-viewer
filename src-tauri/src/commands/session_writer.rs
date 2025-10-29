use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use uuid::Uuid;

// ============================================================================
// SIMPLIFIED INPUT FORMATS FOR SESSION CREATION
// ============================================================================

/// Simple message input for creating sessions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageInput {
    pub role: String,               // "user" | "assistant" | "system"
    pub content: serde_json::Value, // Can be string or array of content items
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_use: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_use_result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsageInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsageInput {
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub cache_creation_input_tokens: Option<i32>,
    pub cache_read_input_tokens: Option<i32>,
}

/// Request to create a new Claude Code project
#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub parent_path: Option<String>, // If None, use ~/.claude/projects/
}

/// Request to create a new session
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub project_path: String,
    pub messages: Vec<MessageInput>,
    pub summary: Option<String>,
    pub cwd: Option<String>, // Optional working directory (defaults to project_path if not provided)
}

/// Request to extract message range from existing session
#[derive(Debug, Deserialize)]
pub struct ExtractMessageRangeRequest {
    pub session_path: String,
    pub start_message_id: Option<String>, // UUID - if None, start from beginning
    pub end_message_id: Option<String>,   // UUID - if None, go to end
}

/// Response containing created project info
#[derive(Debug, Serialize)]
pub struct CreateProjectResponse {
    pub project_path: String,
    pub project_name: String,
}

/// Response containing created session info
#[derive(Debug, Serialize)]
pub struct CreateSessionResponse {
    pub session_path: String,
    pub session_id: String,
    pub message_count: usize,
}

/// Response containing extracted messages
#[derive(Debug, Serialize)]
pub struct ExtractMessageRangeResponse {
    pub messages: Vec<MessageInput>,
    pub summary: Option<String>,
    pub message_count: usize,
    pub cwd: Option<String>, // Extracted working directory from source session
}

// ============================================================================
// TAURI COMMANDS
// ============================================================================

/// Create a new Claude Code project folder
#[tauri::command]
pub async fn create_claude_project(
    request: CreateProjectRequest,
) -> Result<CreateProjectResponse, String> {
    // Determine parent path
    let is_default_path = request.parent_path.is_none();
    let parent_path = if let Some(path) = request.parent_path {
        PathBuf::from(path)
    } else {
        // Use ~/.claude/projects/ as default
        let home_dir =
            dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;
        home_dir.join(".claude").join("projects")
    };

    // Validate parent path exists
    if !parent_path.exists() {
        // Try to create it if it's the default path
        if is_default_path {
            fs::create_dir_all(&parent_path)
                .map_err(|e| format!("Failed to create .claude/projects directory: {}", e))?;
        } else {
            return Err(format!(
                "Parent path does not exist: {}",
                parent_path.display()
            ));
        }
    }

    // Create project folder
    let project_path = parent_path.join(&request.name);

    // Check if project already exists
    if project_path.exists() {
        return Err(format!(
            "Project already exists: {}",
            project_path.display()
        ));
    }

    // Create the directory
    fs::create_dir_all(&project_path)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    Ok(CreateProjectResponse {
        project_path: project_path.to_string_lossy().to_string(),
        project_name: request.name,
    })
}

/// Create a new Claude Code session (JSONL file)
#[tauri::command]
pub async fn create_claude_session(
    request: CreateSessionRequest,
) -> Result<CreateSessionResponse, String> {
    let project_path = PathBuf::from(&request.project_path);

    // Validate project path exists
    if !project_path.exists() {
        return Err(format!(
            "Project path does not exist: {}",
            project_path.display()
        ));
    }

    // Generate session ID (UUID)
    let session_id = Uuid::new_v4().to_string();

    // Create session file path: {project_path}/{session_id}.jsonl
    let session_file_path = project_path.join(format!("{}.jsonl", session_id));

    // Check if session file already exists
    if session_file_path.exists() {
        return Err(format!(
            "Session file already exists: {}",
            session_file_path.display()
        ));
    }

    // Create the JSONL file
    let file = File::create(&session_file_path)
        .map_err(|e| format!("Failed to create session file: {}", e))?;

    let mut writer = BufWriter::new(file);

    // Get the UUID of the first real message (will be used in file-history-snapshot)
    let first_message_uuid = Uuid::new_v4().to_string();

    // Write file-history-snapshot as first message (required by Claude Code)
    let file_history_snapshot = serde_json::json!({
        "type": "file-history-snapshot",
        "messageId": first_message_uuid,
        "snapshot": {
            "messageId": first_message_uuid,
            "trackedFileBackups": {},
            "timestamp": Utc::now().to_rfc3339()
        },
        "isSnapshotUpdate": false
    });
    write_jsonl_line(&mut writer, &file_history_snapshot)?;

    // Write summary message (if provided)
    if let Some(summary) = &request.summary {
        let summary_msg = create_summary_message(&summary, &session_id, &request.messages);
        write_jsonl_line(&mut writer, &summary_msg)?;
    }

    // Write all messages
    let message_count = request.messages.len();
    // Use provided cwd if available, otherwise fall back to project_path
    let cwd_path = request.cwd.as_deref().unwrap_or(request.project_path.as_str());
    let mut previous_uuid: Option<String> = None;
    for (idx, msg) in request.messages.iter().enumerate() {
        let jsonl_msg = convert_to_jsonl_format(msg, &session_id, idx, cwd_path, previous_uuid.as_deref())?;

        // Extract the UUID we just generated for use as parent of next message
        if let Some(uuid) = jsonl_msg.get("uuid").and_then(|v| v.as_str()) {
            previous_uuid = Some(uuid.to_string());
        }

        write_jsonl_line(&mut writer, &jsonl_msg)?;
    }

    // Flush to ensure all data is written
    writer
        .flush()
        .map_err(|e| format!("Failed to flush writer: {}", e))?;

    Ok(CreateSessionResponse {
        session_path: session_file_path.to_string_lossy().to_string(),
        session_id,
        message_count,
    })
}

/// Append messages to an existing session
#[tauri::command]
pub async fn append_to_claude_session(
    session_path: String,
    messages: Vec<MessageInput>,
) -> Result<usize, String> {
    let session_file_path = PathBuf::from(&session_path);

    // Validate session file exists
    if !session_file_path.exists() {
        return Err(format!(
            "Session file does not exist: {}",
            session_file_path.display()
        ));
    }

    // Extract session ID from filename
    let session_id = session_file_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Invalid session file name".to_string())?
        .to_string();

    // Get parent directory as cwd
    let cwd_path = session_file_path
        .parent()
        .and_then(|p| p.to_str())
        .ok_or_else(|| "Invalid session file path".to_string())?;

    // Read the last message to get its UUID (for parent linking)
    let last_uuid = get_last_message_uuid(&session_file_path)?;

    // Open file in append mode
    let file = OpenOptions::new()
        .append(true)
        .open(&session_file_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let mut writer = BufWriter::new(file);

    // Write all messages
    let message_count = messages.len();
    let mut previous_uuid = last_uuid;
    for (idx, msg) in messages.iter().enumerate() {
        let jsonl_msg = convert_to_jsonl_format(msg, &session_id, idx, cwd_path, previous_uuid.as_deref())?;

        // Extract the UUID we just generated for use as parent of next message
        if let Some(uuid) = jsonl_msg.get("uuid").and_then(|v| v.as_str()) {
            previous_uuid = Some(uuid.to_string());
        }

        write_jsonl_line(&mut writer, &jsonl_msg)?;
    }

    // Flush to ensure all data is written
    writer
        .flush()
        .map_err(|e| format!("Failed to flush writer: {}", e))?;

    Ok(message_count)
}

/// Extract a range of messages from an existing session
#[tauri::command]
pub async fn extract_message_range(
    request: ExtractMessageRangeRequest,
) -> Result<ExtractMessageRangeResponse, String> {
    use std::io::{BufRead, BufReader};

    let session_file_path = PathBuf::from(&request.session_path);

    // Validate session file exists
    if !session_file_path.exists() {
        return Err(format!(
            "Session file does not exist: {}",
            session_file_path.display()
        ));
    }

    // Read the JSONL file
    let file = File::open(&session_file_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let reader = BufReader::new(file);

    // Parse all messages
    let mut all_messages: Vec<serde_json::Value> = Vec::new();
    let mut summary: Option<String> = None;
    let mut extracted_cwd: Option<String> = None;

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("Failed to read line {}: {}", line_num + 1, e))?;

        if line.trim().is_empty() {
            continue;
        }

        let msg: serde_json::Value = serde_json::from_str(&line)
            .map_err(|e| format!("Failed to parse JSON at line {}: {}", line_num + 1, e))?;

        // Extract summary if present
        if msg.get("type").and_then(|t| t.as_str()) == Some("summary") {
            summary = msg.get("summary").and_then(|s| s.as_str()).map(|s| s.to_string());
            continue;
        }

        // Extract cwd from first message that has it (and it's not a .claude/projects path)
        if extracted_cwd.is_none() {
            if let Some(cwd) = msg.get("cwd").and_then(|v| v.as_str()) {
                // Skip .claude/projects paths - we want the actual source directory
                if !cwd.contains(".claude") && !cwd.contains("projects") {
                    extracted_cwd = Some(cwd.to_string());
                }
            }
        }

        // Skip sidechain messages
        if msg.get("isSidechain").and_then(|v| v.as_bool()).unwrap_or(false) {
            continue;
        }

        all_messages.push(msg);
    }

    // Find start and end indices
    let start_idx = if let Some(start_id) = &request.start_message_id {
        all_messages
            .iter()
            .position(|msg| msg.get("uuid").and_then(|v| v.as_str()) == Some(start_id))
            .ok_or_else(|| format!("Start message ID not found: {}", start_id))?
    } else {
        0 // Start from beginning
    };

    let end_idx = if let Some(end_id) = &request.end_message_id {
        all_messages
            .iter()
            .position(|msg| msg.get("uuid").and_then(|v| v.as_str()) == Some(end_id))
            .ok_or_else(|| format!("End message ID not found: {}", end_id))?
    } else {
        all_messages.len() - 1 // Go to end
    };

    // Validate range
    if start_idx > end_idx {
        return Err(format!(
            "Invalid range: start index ({}) is after end index ({})",
            start_idx, end_idx
        ));
    }

    // Extract the range (inclusive)
    let extracted_messages = &all_messages[start_idx..=end_idx];

    // Convert to MessageInput format
    let mut converted_messages: Vec<MessageInput> = Vec::new();

    for msg in extracted_messages {
        // Extract the nested "message" object
        let message_obj = match msg.get("message") {
            Some(obj) => obj,
            None => {
                // Skip messages without a message object (malformed or special types)
                eprintln!("Warning: Skipping message without 'message' object: {}", msg.get("uuid").and_then(|v| v.as_str()).unwrap_or("unknown"));
                continue;
            }
        };

        let role = match message_obj.get("role").and_then(|v| v.as_str()) {
            Some(r) => r.to_string(),
            None => {
                eprintln!("Warning: Skipping message without 'role': {}", msg.get("uuid").and_then(|v| v.as_str()).unwrap_or("unknown"));
                continue;
            }
        };

        let content = match message_obj.get("content") {
            Some(c) => c.clone(),
            None => {
                eprintln!("Warning: Skipping message without 'content': {}", msg.get("uuid").and_then(|v| v.as_str()).unwrap_or("unknown"));
                continue;
            }
        };

        let model = message_obj.get("model").and_then(|v| v.as_str()).map(|s| s.to_string());

        // Extract usage if present
        let usage = if let Some(usage_obj) = message_obj.get("usage") {
            Some(TokenUsageInput {
                input_tokens: usage_obj.get("input_tokens").and_then(|v| v.as_i64()).map(|v| v as i32),
                output_tokens: usage_obj.get("output_tokens").and_then(|v| v.as_i64()).map(|v| v as i32),
                cache_creation_input_tokens: usage_obj
                    .get("cache_creation_input_tokens")
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32),
                cache_read_input_tokens: usage_obj
                    .get("cache_read_input_tokens")
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32),
            })
        } else {
            None
        };

        // Extract tool_use and tool_use_result from top level
        let tool_use = msg.get("toolUse").cloned();
        let tool_use_result = msg.get("toolUseResult").cloned();

        // Build parent chain (we'll set parent_id to previous message for linear chain)
        let parent_id = if converted_messages.is_empty() {
            None
        } else {
            // Link to previous message (we'll generate UUIDs later)
            Some("previous".to_string()) // Placeholder
        };

        converted_messages.push(MessageInput {
            role,
            content,
            parent_id,
            model,
            tool_use,
            tool_use_result,
            usage,
        });
    }

    let message_count = converted_messages.len();

    // Ensure we got at least one valid message
    if message_count == 0 {
        return Err("No valid messages found in the specified range".to_string());
    }

    Ok(ExtractMessageRangeResponse {
        messages: converted_messages,
        summary,
        message_count,
        cwd: extracted_cwd,
    })
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Helper: Create a summary message (first line in JSONL)
fn create_summary_message(
    summary: &str,
    session_id: &str,
    _messages: &[MessageInput],
) -> serde_json::Value {
    // Generate a UUID for the summary message
    let summary_uuid = Uuid::new_v4().to_string();

    // Find the last message UUID as leafUuid (or use summary uuid)
    let leaf_uuid = summary_uuid.clone();

    serde_json::json!({
        "uuid": summary_uuid,
        "sessionId": session_id,
        "timestamp": Utc::now().to_rfc3339(),
        "type": "summary",
        "summary": summary,
        "leafUuid": leaf_uuid,
    })
}

/// Helper: Convert MessageInput to Claude Code JSONL format
fn convert_to_jsonl_format(
    msg: &MessageInput,
    session_id: &str,
    _idx: usize,
    project_path: &str,
    previous_uuid: Option<&str>,
) -> Result<serde_json::Value, String> {
    // Generate UUID for this message
    let msg_uuid = Uuid::new_v4().to_string();
    let timestamp = Utc::now().to_rfc3339();

    // Build message object
    let mut message_obj = serde_json::json!({
        "role": msg.role,
        "content": msg.content,
    });

    // Add optional fields to message object
    if let Some(message_obj_map) = message_obj.as_object_mut() {
        if let Some(model) = &msg.model {
            message_obj_map.insert(
                "model".to_string(),
                serde_json::Value::String(model.clone()),
            );
        }

        if let Some(usage) = &msg.usage {
            let mut usage_obj = serde_json::Map::new();
            if let Some(input) = usage.input_tokens {
                usage_obj.insert("input_tokens".to_string(), serde_json::json!(input));
            }
            if let Some(output) = usage.output_tokens {
                usage_obj.insert("output_tokens".to_string(), serde_json::json!(output));
            }
            if let Some(cache_creation) = usage.cache_creation_input_tokens {
                usage_obj.insert(
                    "cache_creation_input_tokens".to_string(),
                    serde_json::json!(cache_creation),
                );
            }
            if let Some(cache_read) = usage.cache_read_input_tokens {
                usage_obj.insert(
                    "cache_read_input_tokens".to_string(),
                    serde_json::json!(cache_read),
                );
            }
            if !usage_obj.is_empty() {
                message_obj_map.insert("usage".to_string(), serde_json::Value::Object(usage_obj));
            }
        }
    }

    // Build the full JSONL message with all required Claude Code metadata
    let mut jsonl_msg = serde_json::json!({
        "uuid": msg_uuid,
        "sessionId": session_id,
        "timestamp": timestamp,
        "type": msg.role.to_lowercase(),
        "message": message_obj,
        "isSidechain": false,
        "cwd": project_path,  // Working directory - critical for resume functionality
        "userType": "external",
        "version": "2.0.28",  // Claude Code version (match real sessions)
        "gitBranch": "main",  // Default git branch (required by Claude Code)
    });

    // Add requestId for assistant messages (required by Claude Code)
    if msg.role.to_lowercase() == "assistant" {
        if let Some(obj) = jsonl_msg.as_object_mut() {
            obj.insert(
                "requestId".to_string(),
                serde_json::Value::String(format!("req_{}", Uuid::new_v4().to_string().replace("-", ""))),
            );
        }
    }

    // Add thinkingMetadata for user messages (required by Claude Code)
    if msg.role.to_lowercase() == "user" {
        if let Some(obj) = jsonl_msg.as_object_mut() {
            obj.insert(
                "thinkingMetadata".to_string(),
                serde_json::json!({
                    "level": "high",
                    "disabled": false,
                    "triggers": []
                }),
            );
        }
    }

    // Add parentUuid (link to previous message in chain)
    if let Some(parent_uuid) = previous_uuid {
        if let Some(obj) = jsonl_msg.as_object_mut() {
            obj.insert(
                "parentUuid".to_string(),
                serde_json::Value::String(parent_uuid.to_string()),
            );
        }
    }

    // Add optional tool_use
    if let Some(tool_use) = &msg.tool_use {
        if let Some(obj) = jsonl_msg.as_object_mut() {
            obj.insert("toolUse".to_string(), tool_use.clone());
        }
    }

    // Add optional tool_use_result
    if let Some(tool_use_result) = &msg.tool_use_result {
        if let Some(obj) = jsonl_msg.as_object_mut() {
            obj.insert("toolUseResult".to_string(), tool_use_result.clone());
        }
    }

    Ok(jsonl_msg)
}

/// Helper: Write a JSON object as a JSONL line
fn write_jsonl_line<W: Write>(writer: &mut W, value: &serde_json::Value) -> Result<(), String> {
    let json_string =
        serde_json::to_string(value).map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    writeln!(writer, "{}", json_string)
        .map_err(|e| format!("Failed to write JSONL line: {}", e))?;

    Ok(())
}

/// Helper: Get the UUID of the last message in a session file
fn get_last_message_uuid(session_file_path: &PathBuf) -> Result<Option<String>, String> {
    use std::io::{BufRead, BufReader};

    let file = File::open(session_file_path)
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let reader = BufReader::new(file);
    let mut last_uuid: Option<String> = None;

    // Read all lines and extract UUID from the last non-empty line
    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
        if line.trim().is_empty() {
            continue;
        }

        let msg: serde_json::Value = serde_json::from_str(&line)
            .map_err(|e| format!("Failed to parse JSONL line: {}", e))?;

        if let Some(uuid) = msg.get("uuid").and_then(|v| v.as_str()) {
            last_uuid = Some(uuid.to_string());
        }
    }

    Ok(last_uuid)
}
