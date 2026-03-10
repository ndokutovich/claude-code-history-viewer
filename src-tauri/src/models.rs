use serde::{Deserialize, Serialize};

// ============================================================================
// UNIVERSAL TYPES MODULE (v2.0.0)
// ============================================================================
pub mod universal;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub cache_creation_input_tokens: Option<u32>,
    pub cache_read_input_tokens: Option<u32>,
    pub service_tier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageContent {
    pub role: String,
    pub content: serde_json::Value,
    // Optional fields for assistant messages
    pub id: Option<String>,
    pub model: Option<String>,
    pub stop_reason: Option<String>,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawLogEntry {
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "type")]
    pub message_type: String,

    // Git information (top-level fields in Claude Code format)
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    #[serde(rename = "gitCommit")]
    pub git_commit: Option<String>,

    // Fields for summary
    pub summary: Option<String>,
    #[serde(rename = "leafUuid")]
    pub leaf_uuid: Option<String>,

    // Fields for regular messages
    pub message: Option<MessageContent>,
    #[serde(rename = "toolUse")]
    pub tool_use: Option<serde_json::Value>,
    #[serde(rename = "toolUseResult")]
    pub tool_use_result: Option<serde_json::Value>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
    pub cwd: Option<String>,

    // System message fields (compaction boundaries, hooks, etc.)
    pub subtype: Option<String>,
    pub level: Option<String>,
    #[serde(rename = "compactMetadata")]
    pub compact_metadata: Option<serde_json::Value>,
    #[serde(rename = "microcompactMetadata")]
    pub microcompact_metadata: Option<serde_json::Value>,
    #[serde(rename = "durationMs")]
    pub duration_ms: Option<u64>,
    #[serde(rename = "hookCount")]
    pub hook_count: Option<u32>,
    #[serde(rename = "hookInfos")]
    pub hook_infos: Option<serde_json::Value>,
    #[serde(rename = "stopReasonSystem")]
    pub stop_reason_system: Option<String>,
    #[serde(rename = "preventedContinuation")]
    pub prevented_continuation: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMessage {
    pub uuid: String,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub message_type: String,
    pub content: Option<serde_json::Value>,
    #[serde(rename = "toolUse")]
    pub tool_use: Option<serde_json::Value>,
    #[serde(rename = "toolUseResult")]
    pub tool_use_result: Option<serde_json::Value>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsage>,
    // Additional fields from MessageContent that might be useful
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    // Project path for search results
    #[serde(skip_serializing_if = "Option::is_none", rename = "projectPath")]
    pub project_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
    // System message fields
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtype: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "systemMetadata")]
    pub system_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub timestamp: i64,
    pub date: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeProject {
    pub name: String,
    pub path: String,
    #[serde(rename = "session_count")]
    pub session_count: usize,
    #[serde(rename = "message_count")]
    pub message_count: usize,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSession {
    pub session_id: String,        // Unique ID based on file path
    pub actual_session_id: String, // Actual session ID from the messages
    pub file_path: String,
    pub project_name: String,
    pub message_count: usize,
    pub first_message_time: String,
    pub last_message_time: String,
    pub last_modified: String,
    pub has_tool_use: bool,
    pub has_errors: bool,
    pub is_problematic: bool,      // Session ends in unclean state (not resumable in Claude Code)
    pub summary: Option<String>,
    pub git_branch: Option<String>, // Git branch name
    pub git_commit: Option<String>, // Git commit hash (short, 8 chars)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePage {
    pub messages: Vec<universal::UniversalMessage>,
    pub total_count: usize,
    pub has_more: bool,
    pub next_offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTokenStats {
    pub session_id: String,
    pub project_name: String,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_creation_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_tokens: u64,
    pub message_count: usize,
    pub first_message_time: String,
    pub last_message_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    pub most_used_tools: Vec<ToolUsageStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyStats {
    pub date: String,
    pub total_tokens: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub message_count: usize,
    pub session_count: usize,
    pub active_hours: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUsageStats {
    pub tool_name: String,
    pub usage_count: u32,
    pub success_rate: f32,
    pub avg_execution_time: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityHeatmap {
    pub hour: u8,
    pub day: u8,
    pub activity_count: u32,
    pub tokens_used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectStatsSummary {
    pub project_name: String,
    pub total_sessions: usize,
    pub total_messages: usize,
    pub total_tokens: u64,
    pub avg_tokens_per_session: u64,
    pub avg_session_duration: u32,
    pub total_session_duration: u32,
    pub most_active_hour: u8,
    pub most_used_tools: Vec<ToolUsageStats>,
    pub daily_stats: Vec<DailyStats>,
    pub activity_heatmap: Vec<ActivityHeatmap>,
    pub token_distribution: TokenDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenDistribution {
    pub input: u64,
    pub output: u64,
    pub cache_creation: u64,
    pub cache_read: u64,
}

// ============================================================================
// GLOBAL STATISTICS MODELS (upstream-enhanced)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlobalStatsSummary {
    pub total_projects: u32,
    pub total_sessions: u32,
    pub total_messages: u32,
    pub total_tokens: u64,
    pub total_session_duration_minutes: u64,
    pub token_distribution: TokenDistribution,
    pub most_used_tools: Vec<ToolUsageStats>,
    pub model_distribution: Vec<ModelStats>,
    pub provider_distribution: Vec<ProviderUsageStats>,
    pub top_projects: Vec<ProjectRanking>,
    pub daily_stats: Vec<DailyStats>,
    pub activity_heatmap: Vec<ActivityHeatmap>,
    pub date_range: DateRange,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DateRange {
    pub first_message: Option<String>,
    pub last_message: Option<String>,
    pub days_span: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelStats {
    pub model_name: String,
    pub message_count: u32,
    pub token_count: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRanking {
    pub project_name: String,
    pub sessions: u32,
    pub messages: u32,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderUsageStats {
    pub provider_id: String,
    pub projects: u32,
    pub sessions: u32,
    pub messages: u32,
    pub tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionComparison {
    pub session_id: String,
    pub percentage_of_project_tokens: f32,
    pub percentage_of_project_messages: f32,
    pub rank_by_tokens: usize,
    pub rank_by_duration: usize,
    pub is_above_average: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    #[serde(rename = "dateRange")]
    pub date_range: Option<Vec<String>>,
    pub projects: Option<Vec<String>>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    #[serde(rename = "messageType")]
    pub message_type: Option<String>,
    #[serde(rename = "hasToolCalls")]
    pub has_tool_calls: Option<bool>,
    #[serde(rename = "hasErrors")]
    pub has_errors: Option<bool>,
    #[serde(rename = "hasFileChanges")]
    pub has_file_changes: Option<bool>,
}

// ============================================================================
// FILE ACTIVITY MODELS (v1.5.0+)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileOperation {
    Read,
    Write,
    Edit,
    Delete,
    Create,
    Glob,
    MultiEdit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChange {
    pub old_string: String,
    pub new_string: String,
    pub line_start: Option<usize>,
    pub line_end: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileActivity {
    pub file_path: String,
    pub operation: FileOperation,
    pub timestamp: String,
    pub session_id: String,
    pub project_id: String,
    pub message_id: String,
    pub tool_name: String,

    // Content tracking
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_before: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_after: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_before: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_after: Option<usize>,

    // Diff information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub changes: Option<Vec<FileChange>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines_added: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines_removed: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FileActivityFilters {
    #[serde(rename = "dateRange")]
    pub date_range: Option<Vec<String>>,
    pub projects: Option<Vec<String>>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub operations: Option<Vec<String>>,
    #[serde(rename = "fileExtensions")]
    pub file_extensions: Option<Vec<String>>,
    #[serde(rename = "searchQuery")]
    pub search_query: Option<String>,
}

// ============================================================================
// USER SETTINGS MODELS (Settings Presets)
// ============================================================================

/// User settings for preset validation
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    /// Glob patterns for projects to hide (e.g., "folders-dg-*")
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hidden_patterns: Vec<String>,

    /// Whether to automatically group worktrees under their parent repos
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree_grouping: Option<bool>,

    /// Whether user has explicitly set worktree grouping (prevents auto-override)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree_grouping_user_set: Option<bool>,

    /// Project tree grouping mode: "none", "worktree", or "directory"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grouping_mode: Option<String>,
}

// ============================================================================
// METADATA PERSISTENCE MODELS (v1.9.0)
// ============================================================================

/// Per-session user metadata persisted to ~/.claude-history-viewer/metadata.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMeta {
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    #[serde(default)]
    pub starred: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    /// Whether to display the real Claude-generated session name instead of custom_name
    #[serde(default)]
    pub has_claude_code_name: bool,
    /// ISO 8601 timestamp: when this metadata entry was first created
    pub created_at: String,
    /// ISO 8601 timestamp: last time any field was updated
    pub updated_at: String,
}

/// Per-project user metadata persisted alongside SessionMeta
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub path: String,
    #[serde(default)]
    pub hidden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub updated_at: String,
}

/// Top-level container for all persisted user metadata
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppMetadata {
    #[serde(default)]
    pub sessions: std::collections::HashMap<String, SessionMeta>,
    #[serde(default)]
    pub projects: std::collections::HashMap<String, ProjectMeta>,
    #[serde(default = "default_metadata_version")]
    pub version: u32,
}

fn default_metadata_version() -> u32 {
    1
}

// Legacy compatibility types referenced from upstream metadata.rs
/// Upstream-compatible alias – used by load_user_metadata / update_session_metadata
pub type UserMetadata = AppMetadata;

/// Upstream-compatible thin wrapper for session updates
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    #[serde(default)]
    pub starred: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(default)]
    pub has_claude_code_name: bool,
}

impl SessionMetadata {
    /// Returns true when no field carries any useful data (used to decide whether to delete)
    pub fn is_empty(&self) -> bool {
        self.custom_name.is_none()
            && !self.starred
            && self.tags.is_empty()
            && self.notes.is_none()
            && !self.has_claude_code_name
    }
}

/// Upstream-compatible thin wrapper for project updates
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMetadata {
    #[serde(default)]
    pub hidden: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_name: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ProjectMetadata {
    /// Returns true when no field carries any useful data (used to decide whether to delete)
    pub fn is_empty(&self) -> bool {
        !self.hidden && self.custom_name.is_none() && self.tags.is_empty()
    }
}

impl AppMetadata {
    pub fn new() -> Self {
        Self {
            sessions: std::collections::HashMap::new(),
            projects: std::collections::HashMap::new(),
            version: 1,
        }
    }

    pub fn is_project_hidden(&self, path: &str) -> bool {
        self.projects
            .get(path)
            .map(|p| p.hidden)
            .unwrap_or(false)
    }

    pub fn get_session(&self, session_id: &str) -> Option<&SessionMeta> {
        self.sessions.get(session_id)
    }
}

// ============================================================================
// RECENT FILE EDIT MODELS (Recent Edits Viewer)
// ============================================================================

/// Recent file edit information for recovery purposes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFileEdit {
    pub file_path: String,
    pub timestamp: String,
    pub session_id: String,
    pub operation_type: String, // "edit" or "write"
    pub content_after_change: String,
    pub original_content: Option<String>,
    pub lines_added: usize,
    pub lines_removed: usize,
    pub cwd: Option<String>,
}
