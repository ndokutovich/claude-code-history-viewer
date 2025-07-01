use serde::{Deserialize, Serialize};

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeProject {
    pub name: String,
    pub path: String,
    pub session_count: usize,
    pub message_count: usize,
    pub last_modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSession {
    pub session_id: String,  // Unique ID based on file path
    pub actual_session_id: String,  // Actual session ID from the messages
    pub file_path: String,
    pub project_name: String,
    pub message_count: usize,
    pub first_message_time: String,
    pub last_message_time: String,
    pub last_modified: String,
    pub has_tool_use: bool,
    pub has_errors: bool,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagePage {
    pub messages: Vec<ClaudeMessage>,
    pub total_count: usize,
    pub has_more: bool,
    pub next_offset: usize,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTokenStats {
    pub session_id: String,
    pub project_name: String,
    pub total_input_tokens: u32,
    pub total_output_tokens: u32,
    pub total_cache_creation_tokens: u32,
    pub total_cache_read_tokens: u32,
    pub total_tokens: u32,
    pub message_count: usize,
    pub first_message_time: String,
    pub last_message_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyStats {
    pub date: String,
    pub total_tokens: u32,
    pub input_tokens: u32,
    pub output_tokens: u32,
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
    pub tokens_used: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectStatsSummary {
    pub project_name: String,
    pub total_sessions: usize,
    pub total_messages: usize,
    pub total_tokens: u32,
    pub avg_tokens_per_session: u32,
    pub avg_session_duration: u32,
    pub most_active_hour: u8,
    pub most_used_tools: Vec<ToolUsageStats>,
    pub daily_stats: Vec<DailyStats>,
    pub activity_heatmap: Vec<ActivityHeatmap>,
    pub token_distribution: TokenDistribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenDistribution {
    pub input: u32,
    pub output: u32,
    pub cache_creation: u32,
    pub cache_read: u32,
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
