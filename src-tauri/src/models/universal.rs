// Universal message models for Rust backend
// These mirror the TypeScript universal types
//
// ✅ FULLY IMPLEMENTED: Backend now returns UniversalMessage for all message operations.
// Adapters in src/commands/adapters/ convert provider-specific formats to UniversalMessage.
// - Claude Code: adapters/claude_code.rs
// - Cursor IDE: commands/cursor.rs (native UniversalMessage)

// Note: Some types below are used only by frontend TypeScript (via JSON serialization)
// and not directly by Rust backend code. Warnings for unused structs are expected.
#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// UNIVERSAL MESSAGE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalMessage {
    // CORE IDENTITY (REQUIRED)
    pub id: String,

    #[serde(rename = "sessionId")]
    pub session_id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "sourceId")]
    pub source_id: String,

    #[serde(rename = "providerId")]
    pub provider_id: String,

    // TEMPORAL (REQUIRED)
    pub timestamp: String,

    #[serde(rename = "sequenceNumber")]
    pub sequence_number: i32,

    // ROLE & TYPE (REQUIRED)
    pub role: MessageRole,

    #[serde(rename = "messageType")]
    pub message_type: MessageType,

    // CONTENT (REQUIRED)
    pub content: Vec<UniversalContent>,

    // HIERARCHY (OPTIONAL)
    #[serde(skip_serializing_if = "Option::is_none", rename = "parentId")]
    pub parent_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "branchId")]
    pub branch_id: Option<String>,

    // METADATA (OPTIONAL)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<TokenUsage>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "toolCalls")]
    pub tool_calls: Option<Vec<ToolCall>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<ThinkingBlock>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<ErrorInfo>>,

    // RAW PRESERVATION (REQUIRED)
    #[serde(rename = "originalFormat")]
    pub original_format: String,

    #[serde(rename = "providerMetadata")]
    pub provider_metadata: HashMap<String, serde_json::Value>,
}

// ============================================================================
// UNIVERSAL CONTENT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalContent {
    #[serde(rename = "type")]
    pub content_type: ContentType,
    pub data: serde_json::Value,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub encoding: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "mimeType")]
    pub mime_type: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
}

// ============================================================================
// UNIVERSAL SESSION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalSession {
    pub id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "sourceId")]
    pub source_id: String,

    #[serde(rename = "providerId")]
    pub provider_id: String,

    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(rename = "messageCount")]
    pub message_count: usize,

    #[serde(rename = "firstMessageAt")]
    pub first_message_at: String,

    #[serde(rename = "lastMessageAt")]
    pub last_message_at: String,

    pub duration: i64, // milliseconds

    #[serde(skip_serializing_if = "Option::is_none", rename = "totalTokens")]
    pub total_tokens: Option<TokenUsage>,

    #[serde(rename = "toolCallCount")]
    pub tool_call_count: usize,

    #[serde(rename = "errorCount")]
    pub error_count: usize,

    pub metadata: HashMap<String, serde_json::Value>,
    pub checksum: String,
}

// ============================================================================
// UNIVERSAL PROJECT
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalProject {
    pub id: String,

    #[serde(rename = "sourceId")]
    pub source_id: String,

    #[serde(rename = "providerId")]
    pub provider_id: String,

    pub name: String,
    pub path: String,

    #[serde(rename = "sessionCount")]
    pub session_count: usize,

    #[serde(rename = "totalMessages")]
    pub total_messages: usize,

    #[serde(skip_serializing_if = "Option::is_none", rename = "firstActivityAt")]
    pub first_activity_at: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "lastActivityAt")]
    pub last_activity_at: Option<String>,

    pub metadata: HashMap<String, serde_json::Value>,
}

// ============================================================================
// UNIVERSAL SOURCE
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UniversalSource {
    pub id: String,
    pub name: String,
    pub path: String,

    #[serde(rename = "providerId")]
    pub provider_id: String,

    #[serde(rename = "isDefault")]
    pub is_default: bool,

    #[serde(rename = "isAvailable")]
    pub is_available: bool,

    #[serde(rename = "lastValidation")]
    pub last_validation: String,

    #[serde(skip_serializing_if = "Option::is_none", rename = "validationError")]
    pub validation_error: Option<String>,

    #[serde(rename = "addedAt")]
    pub added_at: String,

    #[serde(skip_serializing_if = "Option::is_none", rename = "lastScanAt")]
    pub last_scan_at: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "lastModifiedAt")]
    pub last_modified_at: Option<String>,

    pub stats: SourceStats,

    #[serde(rename = "providerConfig")]
    pub provider_config: HashMap<String, serde_json::Value>,

    #[serde(rename = "healthStatus")]
    pub health_status: HealthStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceStats {
    #[serde(rename = "projectCount")]
    pub project_count: usize,

    #[serde(rename = "sessionCount")]
    pub session_count: usize,

    #[serde(rename = "messageCount")]
    pub message_count: usize,

    #[serde(rename = "totalSize")]
    pub total_size: u64,
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    #[serde(rename = "inputTokens")]
    pub input_tokens: i32,

    #[serde(rename = "outputTokens")]
    pub output_tokens: i32,

    #[serde(rename = "totalTokens")]
    pub total_tokens: i32,

    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "cacheCreationTokens"
    )]
    pub cache_creation_tokens: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "cacheReadTokens")]
    pub cache_read_tokens: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "serviceTier")]
    pub service_tier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub input: HashMap<String, serde_json::Value>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<HashMap<String, serde_json::Value>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    pub status: ToolCallStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingBlock {
    pub content: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    #[serde(rename = "type")]
    pub attachment_type: AttachmentType,
    pub name: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,

    #[serde(skip_serializing_if = "Option::is_none", rename = "mimeType")]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    pub code: String,
    pub message: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,

    pub timestamp: String,
}

// ============================================================================
// ENUMS
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
    Function,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Message,
    Summary,
    Branch,
    Sidechain,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContentType {
    Text,
    Code,
    Image,
    File,
    ToolUse,
    ToolResult,
    Thinking,
    WebSearch,
    Command,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolCallStatus {
    Pending,
    Success,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AttachmentType {
    File,
    Image,
    Url,
}

// ============================================================================
// RESULT TYPES FOR TAURI COMMANDS
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult<T> {
    pub success: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<T>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ScanMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanMetadata {
    pub scan_duration: u64,
    pub items_found: usize,
    pub items_skipped: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadResult<T> {
    pub success: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<T>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_more: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_offset: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult<T> {
    pub success: bool,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Vec<T>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_matches: Option<usize>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_duration: Option<u64>,
}
