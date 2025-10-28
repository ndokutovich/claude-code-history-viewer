// ============================================================================
// CLAUDE CODE ADAPTER
// ============================================================================
// Converts Claude Code JSONL message format to UniversalMessage
//
// CRITICAL: This adapter preserves ALL original Claude Code fields to ensure
// zero data loss during the migration to universal types.

use crate::models::universal::*;
use crate::models::ClaudeMessage;
use serde_json::{json, Value};
use std::collections::HashMap;

/// Convert Claude Code message to Universal format
///
/// This function carefully maps all Claude Code fields to the universal format,
/// preserving all original data in provider_metadata to ensure zero data loss.
pub fn claude_message_to_universal(
    msg: &ClaudeMessage,
    project_id: String,
    source_id: String,
    sequence_number: i32,
) -> UniversalMessage {
    // Extract role from message content or infer from type
    let role = determine_role(msg);

    // Determine message type (handling sidechain and summary types)
    let message_type = determine_message_type(msg);

    // Convert content to universal format
    let content = convert_content(msg);

    // Convert tool use to tool calls
    let tool_calls = convert_tool_use(msg);

    // Extract thinking blocks from content
    let thinking = extract_thinking(msg);

    // Convert usage/tokens
    let tokens = msg.usage.as_ref().map(|u| TokenUsage {
        input_tokens: u.input_tokens.unwrap_or(0) as i32,
        output_tokens: u.output_tokens.unwrap_or(0) as i32,
        total_tokens: (u.input_tokens.unwrap_or(0) + u.output_tokens.unwrap_or(0)) as i32,
        cache_creation_tokens: u.cache_creation_input_tokens.map(|t| t as i32),
        cache_read_tokens: u.cache_read_input_tokens.map(|t| t as i32),
        service_tier: u.service_tier.clone(),
    });

    // Extract error information from tool results
    let errors = extract_errors(msg);

    // Build provider_metadata with ALL original Claude Code fields
    let mut provider_metadata = HashMap::new();

    // Preserve original uuid for reference
    provider_metadata.insert("original_uuid".to_string(), json!(msg.uuid));

    // Preserve parent relationship
    if let Some(ref parent) = msg.parent_uuid {
        provider_metadata.insert("parent_uuid".to_string(), json!(parent));
    }

    // Preserve sidechain flag
    if let Some(is_sidechain) = msg.is_sidechain {
        provider_metadata.insert("is_sidechain".to_string(), json!(is_sidechain));
    }

    // Preserve message_id if present
    if let Some(ref message_id) = msg.message_id {
        provider_metadata.insert("message_id".to_string(), json!(message_id));
    }

    // Preserve stop_reason if present
    if let Some(ref stop_reason) = msg.stop_reason {
        provider_metadata.insert("stop_reason".to_string(), json!(stop_reason));
    }

    // Preserve original message_type string
    provider_metadata.insert("original_type".to_string(), json!(msg.message_type));

    // Preserve raw content for debugging/recovery
    if let Some(ref content_value) = msg.content {
        provider_metadata.insert("raw_content".to_string(), content_value.clone());
    }

    // Preserve raw tool_use for debugging/recovery
    if let Some(ref tool_use) = msg.tool_use {
        provider_metadata.insert("raw_tool_use".to_string(), tool_use.clone());
    }

    // Preserve raw tool_use_result for debugging/recovery
    if let Some(ref tool_result) = msg.tool_use_result {
        provider_metadata.insert("raw_tool_use_result".to_string(), tool_result.clone());
    }

    // Preserve project_path if present (used in search results)
    if let Some(ref proj_path) = msg.project_path {
        provider_metadata.insert("project_path".to_string(), json!(proj_path));
    }

    UniversalMessage {
        // CORE IDENTITY
        id: msg.uuid.clone(),
        session_id: msg.session_id.clone(),
        project_id,
        source_id,
        provider_id: "claude-code".to_string(),

        // TEMPORAL
        timestamp: msg.timestamp.clone(),
        sequence_number,

        // ROLE & TYPE
        role,
        message_type,

        // CONTENT
        content,

        // HIERARCHY (preserve parent relationship)
        parent_id: msg.parent_uuid.clone(),
        depth: None,     // Could be calculated if needed
        branch_id: None, // Claude Code doesn't have explicit branches yet

        // METADATA
        model: msg.model.clone(),
        tokens,
        tool_calls,
        thinking,
        attachments: None, // Claude Code doesn't have attachments yet
        errors,

        // RAW PRESERVATION
        original_format: "claude_jsonl".to_string(),
        provider_metadata,
    }
}

/// Determine MessageRole from Claude Code message
fn determine_role(msg: &ClaudeMessage) -> MessageRole {
    if let Some(ref role_str) = msg.role {
        match role_str.as_str() {
            "user" => MessageRole::User,
            "assistant" => MessageRole::Assistant,
            "system" => MessageRole::System,
            "function" => MessageRole::Function,
            _ => {
                // Infer from message_type if role is unknown
                match msg.message_type.as_str() {
                    "user" => MessageRole::User,
                    "assistant" => MessageRole::Assistant,
                    _ => MessageRole::Assistant, // Default
                }
            }
        }
    } else {
        // Infer from message_type
        match msg.message_type.as_str() {
            "user" => MessageRole::User,
            "assistant" => MessageRole::Assistant,
            "system" => MessageRole::System,
            _ => MessageRole::Assistant, // Default
        }
    }
}

/// Determine MessageType from Claude Code message
fn determine_message_type(msg: &ClaudeMessage) -> MessageType {
    // Check if it's a sidechain message
    if msg.is_sidechain == Some(true) {
        return MessageType::Sidechain;
    }

    // Map based on message_type field
    match msg.message_type.as_str() {
        "summary" => MessageType::Summary,
        "user" | "assistant" => MessageType::Message,
        "branch" => MessageType::Branch,
        "error" => MessageType::Error,
        _ => MessageType::Message, // Default
    }
}

/// Convert Claude Code content to universal format
fn convert_content(msg: &ClaudeMessage) -> Vec<UniversalContent> {
    let mut content_items = Vec::new();

    if let Some(ref content_value) = msg.content {
        match content_value {
            // String content (simple text)
            Value::String(text) => {
                content_items.push(UniversalContent {
                    content_type: ContentType::Text,
                    data: json!({"text": text}),
                    encoding: None,
                    mime_type: Some("text/plain".to_string()),
                    size: Some(text.len()),
                    hash: None,
                });
            }

            // Array content (structured content items)
            Value::Array(items) => {
                for item in items {
                    if let Some(content_item) = convert_content_item(item) {
                        content_items.push(content_item);
                    }
                }
            }

            // Object content (treat as single data blob)
            Value::Object(_) => {
                content_items.push(UniversalContent {
                    content_type: ContentType::Text,
                    data: content_value.clone(),
                    encoding: None,
                    mime_type: Some("application/json".to_string()),
                    size: None,
                    hash: None,
                });
            }

            _ => {
                // Handle other types (null, bool, number) as text
                content_items.push(UniversalContent {
                    content_type: ContentType::Text,
                    data: content_value.clone(),
                    encoding: None,
                    mime_type: None,
                    size: None,
                    hash: None,
                });
            }
        }
    }

    // Add tool use result as content if present
    if let Some(ref tool_result) = msg.tool_use_result {
        content_items.push(UniversalContent {
            content_type: ContentType::ToolResult,
            data: tool_result.clone(),
            encoding: None,
            mime_type: Some("application/json".to_string()),
            size: None,
            hash: None,
        });
    }

    content_items
}

/// Convert individual content item from Claude Code format
fn convert_content_item(item: &Value) -> Option<UniversalContent> {
    let content_type = item.get("type")?.as_str()?;

    match content_type {
        "text" => {
            let text = item.get("text")?.as_str()?.to_string();
            Some(UniversalContent {
                content_type: ContentType::Text,
                data: json!({"text": text}),
                encoding: None,
                mime_type: Some("text/plain".to_string()),
                size: Some(text.len()),
                hash: None,
            })
        }

        "tool_use" => Some(UniversalContent {
            content_type: ContentType::ToolUse,
            data: item.clone(),
            encoding: None,
            mime_type: Some("application/json".to_string()),
            size: None,
            hash: None,
        }),

        "tool_result" => Some(UniversalContent {
            content_type: ContentType::ToolResult,
            data: item.clone(),
            encoding: None,
            mime_type: Some("application/json".to_string()),
            size: None,
            hash: None,
        }),

        "thinking" => Some(UniversalContent {
            content_type: ContentType::Thinking,
            data: item.clone(),
            encoding: None,
            mime_type: Some("application/json".to_string()),
            size: None,
            hash: None,
        }),

        "image" => {
            Some(UniversalContent {
                content_type: ContentType::Image,
                data: item.clone(),
                encoding: None,
                mime_type: None, // Could extract from item if available
                size: None,
                hash: None,
            })
        }

        _ => {
            // Unknown content type - preserve as-is
            Some(UniversalContent {
                content_type: ContentType::Text,
                data: item.clone(),
                encoding: None,
                mime_type: Some("application/json".to_string()),
                size: None,
                hash: None,
            })
        }
    }
}

/// Convert tool_use field to ToolCall structures
/// Extracts tool calls from both:
/// 1. The legacy tool_use field (if present)
/// 2. The content array items with type: "tool_use" (modern Claude Code format)
fn convert_tool_use(msg: &ClaudeMessage) -> Option<Vec<ToolCall>> {
    let mut tool_calls = Vec::new();

    // Extract from legacy tool_use field (if present)
    if let Some(tool_value) = &msg.tool_use {
        match tool_value {
            Value::Object(obj) => {
                if let Some(tool_call) = parse_tool_use_object(obj) {
                    tool_calls.push(tool_call);
                }
            }
            Value::Array(arr) => {
                for item in arr {
                    if let Value::Object(obj) = item {
                        if let Some(tool_call) = parse_tool_use_object(obj) {
                            tool_calls.push(tool_call);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Extract from content array (modern Claude Code format)
    // Tool calls are stored as content items with type: "tool_use"
    if let Some(ref content_value) = msg.content {
        if let Value::Array(items) = content_value {
            for item in items {
                if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                    if item_type == "tool_use" {
                        if let Value::Object(obj) = item {
                            if let Some(tool_call) = parse_tool_use_object(obj) {
                                tool_calls.push(tool_call);
                            }
                        }
                    }
                }
            }
        }
    }

    if tool_calls.is_empty() {
        None
    } else {
        // Deduplicate by ID (in case tool calls appear in both legacy and modern formats)
        use std::collections::HashSet;
        let mut seen_ids = HashSet::new();
        tool_calls.retain(|tc| seen_ids.insert(tc.id.clone()));

        Some(tool_calls)
    }
}

/// Parse a tool use object into ToolCall
fn parse_tool_use_object(obj: &serde_json::Map<String, Value>) -> Option<ToolCall> {
    let id = obj.get("id")?.as_str()?.to_string();
    let name = obj.get("name")?.as_str()?.to_string();

    let mut input = HashMap::new();
    if let Some(Value::Object(input_obj)) = obj.get("input") {
        for (k, v) in input_obj {
            input.insert(k.clone(), v.clone());
        }
    }

    Some(ToolCall {
        id,
        name,
        input,
        output: None, // Would come from tool_use_result
        error: None,
        status: ToolCallStatus::Pending, // Could infer from tool_use_result
    })
}

/// Extract thinking blocks from content
fn extract_thinking(msg: &ClaudeMessage) -> Option<ThinkingBlock> {
    if let Some(ref content_value) = msg.content {
        if let Value::Array(items) = content_value {
            for item in items {
                if let Some(item_type) = item.get("type").and_then(|t| t.as_str()) {
                    if item_type == "thinking" {
                        if let Some(thinking_text) = item.get("thinking").and_then(|t| t.as_str()) {
                            return Some(ThinkingBlock {
                                content: thinking_text.to_string(),
                                signature: item
                                    .get("signature")
                                    .and_then(|s| s.as_str())
                                    .map(String::from),
                                model: msg.model.clone(),
                            });
                        }
                    }
                }
            }
        }
    }
    None
}

/// Extract error information from tool results
fn extract_errors(msg: &ClaudeMessage) -> Option<Vec<ErrorInfo>> {
    let mut errors = Vec::new();

    // Check tool_use_result for errors
    if let Some(ref tool_result) = msg.tool_use_result {
        // Check if it's a string error
        if let Value::String(error_str) = tool_result {
            if error_str.starts_with("Error:") || error_str.contains("error") {
                errors.push(ErrorInfo {
                    code: "tool_error".to_string(),
                    message: error_str.clone(),
                    details: None,
                    timestamp: msg.timestamp.clone(),
                });
            }
        }

        // Check if it's an object with is_error flag
        if let Value::Object(obj) = tool_result {
            if let Some(Value::Bool(true)) = obj.get("is_error") {
                let error_msg = obj
                    .get("content")
                    .and_then(|c| c.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();

                errors.push(ErrorInfo {
                    code: "tool_result_error".to_string(),
                    message: error_msg,
                    details: Some(tool_result.clone()),
                    timestamp: msg.timestamp.clone(),
                });
            }
        }
    }

    // Check content array for tool_result errors
    if let Some(ref content_value) = msg.content {
        if let Value::Array(items) = content_value {
            for item in items {
                if let Some("tool_result") = item.get("type").and_then(|t| t.as_str()) {
                    if let Some(Value::Bool(true)) = item.get("is_error") {
                        let error_msg = item
                            .get("content")
                            .and_then(|c| c.as_str())
                            .unwrap_or("Unknown error")
                            .to_string();

                        errors.push(ErrorInfo {
                            code: "tool_result_error".to_string(),
                            message: error_msg,
                            details: Some(item.clone()),
                            timestamp: msg.timestamp.clone(),
                        });
                    }
                }
            }
        }
    }

    if errors.is_empty() {
        None
    } else {
        Some(errors)
    }
}

/// Extract project ID from project path or file path
/// Uses std::path for cross-platform compatibility (Windows, macOS, Linux)
pub fn extract_project_id(project_path: &Option<String>, file_path: &str) -> String {
    // Prefer explicit project_path
    if let Some(ref path) = project_path {
        if let Some(name) = std::path::Path::new(path)
            .file_name()
            .and_then(|s| s.to_str())
        {
            return name.to_string();
        }
    }

    // Fallback: scan components to find "projects/<name>"
    let mut iter = std::path::Path::new(file_path).components();
    while let Some(comp) = iter.next() {
        if let std::path::Component::Normal(os) = comp {
            if os == "projects" {
                if let Some(std::path::Component::Normal(next)) = iter.next() {
                    if let Some(s) = next.to_str() {
                        return s.to_string();
                    }
                }
                break;
            }
        }
    }
    "unknown".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_project_id_from_path() {
        let file_path = "/home/user/.claude/projects/my-project/session.jsonl";
        let project_id = extract_project_id(&None, file_path);
        assert_eq!(project_id, "my-project");
    }

    #[test]
    fn test_extract_project_id_from_project_path() {
        let project_path = Some("/home/user/.claude/projects/test-project".to_string());
        let project_id = extract_project_id(&project_path, "");
        assert_eq!(project_id, "test-project");
    }
}
