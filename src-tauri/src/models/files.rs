use serde::{Deserialize, Serialize};

// ============================================================================
// FILE ACTIVITY MODELS
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
