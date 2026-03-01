//! Tauri commands for persistent session/project metadata (v1.9.0)
//!
//! All metadata is stored in a single JSON file:
//!   - Unix/macOS: `~/.claude-history-viewer/metadata.json`
//!   - Windows:    `%LOCALAPPDATA%\claude-history-viewer\metadata.json`
//!                 (falls back to `~/.claude-history-viewer/metadata.json`)
//!
//! Writes use an atomic temp-file rename to avoid corruption.
//! The file is lazily read on first use and cached in [`MetadataState`].

use crate::models::{AppMetadata, ProjectMeta, SessionMeta};
use chrono::Utc;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

// ============================================================================
// Managed state
// ============================================================================

/// Tauri-managed application state for metadata caching.
pub struct MetadataState {
    pub metadata: Mutex<Option<AppMetadata>>,
}

impl Default for MetadataState {
    fn default() -> Self {
        Self {
            metadata: Mutex::new(None),
        }
    }
}

// ============================================================================
// Path helpers
// ============================================================================

/// Returns the metadata directory.
///
/// Windows: `%LOCALAPPDATA%\claude-history-viewer`  (via `dirs::data_local_dir`)
/// Other:   `~/.claude-history-viewer`              (via `dirs::home_dir`)
fn get_metadata_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let base = dirs::data_local_dir()
        .ok_or_else(|| "METADATA_READ_ERROR: Could not resolve %LOCALAPPDATA%".to_string())?;

    #[cfg(not(target_os = "windows"))]
    let base = dirs::home_dir()
        .ok_or_else(|| "METADATA_READ_ERROR: Could not find home directory".to_string())?;

    Ok(base.join("claude-history-viewer"))
}

/// Returns the full path to `metadata.json`.
fn get_metadata_path() -> Result<PathBuf, String> {
    Ok(get_metadata_dir()?.join("metadata.json"))
}

/// Ensures the metadata directory exists, creating it if necessary.
fn ensure_metadata_dir() -> Result<PathBuf, String> {
    let dir = get_metadata_dir()?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| {
            format!("METADATA_WRITE_ERROR: Failed to create metadata directory: {e}")
        })?;
    }
    Ok(dir)
}

// ============================================================================
// Disk I/O helpers
// ============================================================================

/// Read metadata from disk, returning an empty [`AppMetadata`] if the file
/// does not yet exist.
fn read_metadata_from_disk() -> Result<AppMetadata, String> {
    let path = get_metadata_path()?;
    if !path.exists() {
        return Ok(AppMetadata::new());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("METADATA_READ_ERROR: Failed to read metadata file: {e}"))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("METADATA_PARSE_ERROR: Failed to parse metadata JSON: {e}"))
}

/// Write metadata to disk using an atomic temp-file → rename pattern.
fn write_metadata_to_disk(metadata: &AppMetadata) -> Result<(), String> {
    ensure_metadata_dir()?;
    let path = get_metadata_path()?;
    let temp_path = path.with_extension("json.tmp");

    let content = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("METADATA_WRITE_ERROR: Failed to serialize metadata: {e}"))?;

    {
        let mut file = fs::File::create(&temp_path)
            .map_err(|e| format!("METADATA_WRITE_ERROR: Failed to create temp file: {e}"))?;
        file.write_all(content.as_bytes())
            .map_err(|e| format!("METADATA_WRITE_ERROR: Failed to write temp file: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("METADATA_WRITE_ERROR: Failed to sync temp file: {e}"))?;
    }

    super::fs_utils::atomic_rename(&temp_path, &path)
}

// ============================================================================
// Cache helpers (load on first use)
// ============================================================================

/// Return a clone of the cached metadata, loading from disk if the cache is
/// empty.  The Mutex is held only for the duration of the read/clone.
fn get_cached(state: &State<'_, MetadataState>) -> Result<AppMetadata, String> {
    let mut guard = state
        .metadata
        .lock()
        .map_err(|e| format!("METADATA_READ_ERROR: Failed to acquire lock: {e}"))?;

    if guard.is_none() {
        *guard = Some(read_metadata_from_disk()?);
    }

    Ok(guard.as_ref().unwrap().clone())
}

/// Persist `metadata` to disk and update the in-memory cache atomically.
fn persist(state: &State<'_, MetadataState>, metadata: AppMetadata) -> Result<(), String> {
    write_metadata_to_disk(&metadata)?;

    let mut guard = state
        .metadata
        .lock()
        .map_err(|e| format!("METADATA_WRITE_ERROR: Failed to acquire lock: {e}"))?;
    *guard = Some(metadata);
    Ok(())
}

/// UTC timestamp in RFC-3339 format.
fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

// ============================================================================
// Session metadata commands
// ============================================================================

/// Return the [`SessionMeta`] for `session_id`, or `None` if not yet recorded.
#[tauri::command]
pub async fn get_session_metadata(
    session_id: String,
    state: State<'_, MetadataState>,
) -> Result<Option<SessionMeta>, String> {
    let meta = get_cached(&state)?;
    Ok(meta.sessions.get(&session_id).cloned())
}

/// Set (or clear) the custom display name for a session.
#[tauri::command]
pub async fn set_session_custom_name(
    session_id: String,
    name: Option<String>,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.sessions.entry(session_id.clone()).or_insert_with(|| SessionMeta {
        session_id: session_id.clone(),
        custom_name: None,
        starred: false,
        tags: Vec::new(),
        notes: None,
        has_claude_code_name: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    });
    entry.custom_name = name;
    entry.updated_at = now;
    persist(&state, meta)
}

/// Star or un-star a session.
#[tauri::command]
pub async fn set_session_starred(
    session_id: String,
    starred: bool,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.sessions.entry(session_id.clone()).or_insert_with(|| SessionMeta {
        session_id: session_id.clone(),
        custom_name: None,
        starred: false,
        tags: Vec::new(),
        notes: None,
        has_claude_code_name: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    });
    entry.starred = starred;
    entry.updated_at = now;
    persist(&state, meta)
}

/// Toggle whether the session should display its Claude-generated name.
#[tauri::command]
pub async fn set_session_has_claude_code_name(
    session_id: String,
    value: bool,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.sessions.entry(session_id.clone()).or_insert_with(|| SessionMeta {
        session_id: session_id.clone(),
        custom_name: None,
        starred: false,
        tags: Vec::new(),
        notes: None,
        has_claude_code_name: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    });
    entry.has_claude_code_name = value;
    entry.updated_at = now;
    persist(&state, meta)
}

/// Add a tag to a session (no-op if the tag already exists).
#[tauri::command]
pub async fn add_session_tag(
    session_id: String,
    tag: String,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.sessions.entry(session_id.clone()).or_insert_with(|| SessionMeta {
        session_id: session_id.clone(),
        custom_name: None,
        starred: false,
        tags: Vec::new(),
        notes: None,
        has_claude_code_name: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    });
    if !entry.tags.contains(&tag) {
        entry.tags.push(tag);
        entry.updated_at = now;
    }
    persist(&state, meta)
}

/// Remove a tag from a session (no-op if the tag does not exist).
#[tauri::command]
pub async fn remove_session_tag(
    session_id: String,
    tag: String,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    if let Some(entry) = meta.sessions.get_mut(&session_id) {
        let before = entry.tags.len();
        entry.tags.retain(|t| t != &tag);
        if entry.tags.len() != before {
            entry.updated_at = now;
        }
    }
    persist(&state, meta)
}

/// Set (or clear) the freeform notes for a session.
#[tauri::command]
pub async fn set_session_notes(
    session_id: String,
    notes: Option<String>,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.sessions.entry(session_id.clone()).or_insert_with(|| SessionMeta {
        session_id: session_id.clone(),
        custom_name: None,
        starred: false,
        tags: Vec::new(),
        notes: None,
        has_claude_code_name: false,
        created_at: now.clone(),
        updated_at: now.clone(),
    });
    entry.notes = notes;
    entry.updated_at = now;
    persist(&state, meta)
}

// ============================================================================
// Project metadata commands
// ============================================================================

/// Return the [`ProjectMeta`] for `project_path`, or `None` if not yet recorded.
#[tauri::command]
pub async fn get_project_metadata(
    project_path: String,
    state: State<'_, MetadataState>,
) -> Result<Option<ProjectMeta>, String> {
    let meta = get_cached(&state)?;
    Ok(meta.projects.get(&project_path).cloned())
}

/// Show or hide a project in the sidebar.
#[tauri::command]
pub async fn set_project_hidden(
    project_path: String,
    hidden: bool,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.projects.entry(project_path.clone()).or_insert_with(|| ProjectMeta {
        path: project_path.clone(),
        hidden: false,
        custom_name: None,
        tags: Vec::new(),
        updated_at: now.clone(),
    });
    entry.hidden = hidden;
    entry.updated_at = now;
    persist(&state, meta)
}

/// Set (or clear) the custom display name for a project.
#[tauri::command]
pub async fn set_project_custom_name(
    project_path: String,
    name: Option<String>,
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let mut meta = get_cached(&state)?;
    let now = now_rfc3339();
    let entry = meta.projects.entry(project_path.clone()).or_insert_with(|| ProjectMeta {
        path: project_path.clone(),
        hidden: false,
        custom_name: None,
        tags: Vec::new(),
        updated_at: now.clone(),
    });
    entry.custom_name = name;
    entry.updated_at = now;
    persist(&state, meta)
}

// ============================================================================
// Bulk commands
// ============================================================================

/// Return the complete [`AppMetadata`] blob (used for bulk reads on startup).
#[tauri::command]
pub async fn get_all_metadata(
    state: State<'_, MetadataState>,
) -> Result<AppMetadata, String> {
    get_cached(&state)
}

/// Wipe all persisted metadata from disk and clear the in-memory cache.
#[tauri::command]
pub async fn clear_all_metadata(
    state: State<'_, MetadataState>,
) -> Result<(), String> {
    let fresh = AppMetadata {
        sessions: HashMap::new(),
        projects: HashMap::new(),
        version: 1,
    };
    persist(&state, fresh)
}

// ============================================================================
// Upstream-compatible commands (kept for compatibility with load_user_metadata
// / update_session_metadata / update_project_metadata patterns)
// ============================================================================

/// Return the full metadata blob (upstream-compatible alias for `get_all_metadata`).
#[tauri::command]
pub async fn load_user_metadata(
    state: State<'_, MetadataState>,
) -> Result<AppMetadata, String> {
    get_cached(&state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_now_rfc3339_is_parseable() {
        let ts = now_rfc3339();
        // Must be parseable as an RFC-3339 timestamp
        assert!(chrono::DateTime::parse_from_rfc3339(&ts).is_ok(), "timestamp: {ts}");
    }

    #[test]
    fn test_app_metadata_default_is_empty() {
        let m = AppMetadata::new();
        assert!(m.sessions.is_empty());
        assert!(m.projects.is_empty());
        assert_eq!(m.version, 1);
    }
}
