// Universal message models for Rust backend
// These mirror the TypeScript universal types
//
// NOTE: These types are designed for a universal abstraction layer that would
// uniformly handle both Claude Code and Cursor IDE conversation histories.
// Currently NOT IMPLEMENTED - the codebase handles each provider separately.
// These types are kept for potential future refactoring to a universal adapter pattern.

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
    pub session_id: String,
    pub project_id: String,
    pub source_id: String,
    pub provider_id: String,

    // TEMPORAL (REQUIRED)
    pub timestamp: String,
    pub sequence_number: i32,

    // ROLE & TYPE (REQUIRED)
    pub role: MessageRole,
    pub message_type: MessageType,

    // CONTENT (REQUIRED)
    pub content: Vec<UniversalContent>,

    // HIERARCHY (OPTIONAL)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth: Option<i32>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch_id: Option<String>,

    // METADATA (OPTIONAL)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<TokenUsage>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<ThinkingBlock>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<Vec<ErrorInfo>>,

    // RAW PRESERVATION (REQUIRED)
    pub original_format: String,
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

    #[serde(skip_serializing_if = "Option::is_none")]
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
    pub project_id: String,
    pub source_id: String,
    pub provider_id: String,

    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub message_count: usize,
    pub first_message_at: String,
    pub last_message_at: String,
    pub duration: i64, // milliseconds

    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<TokenUsage>,
    pub tool_call_count: usize,
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
    pub source_id: String,
    pub provider_id: String,

    pub name: String,
    pub path: String,

    pub session_count: usize,
    pub total_messages: usize,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_activity_at: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
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
    pub provider_id: String,

    pub is_default: bool,
    pub is_available: bool,
    pub last_validation: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_error: Option<String>,

    pub added_at: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_scan_at: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified_at: Option<String>,

    pub stats: SourceStats,
    pub provider_config: HashMap<String, serde_json::Value>,
    pub health_status: HealthStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceStats {
    pub project_count: usize,
    pub session_count: usize,
    pub message_count: usize,
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

    #[serde(skip_serializing_if = "Option::is_none", rename = "cacheCreationTokens")]
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

    #[serde(skip_serializing_if = "Option::is_none")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
    Function,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageType {
    Message,
    Summary,
    Branch,
    Sidechain,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
