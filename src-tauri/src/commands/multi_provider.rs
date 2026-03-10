// ============================================================================
// MULTI-PROVIDER UNIFIED FACADE (v1.9.0)
// ============================================================================
// Provider-agnostic Tauri commands that dispatch to whichever providers
// are installed on the user's system.
//
// ARCHITECTURE:
// - detect_providers()        → query which tools are installed
// - scan_all_projects()       → gather UniversalProject from all providers
// - load_provider_sessions()  → route session load by provider id
// - load_provider_messages()  → route message load by provider id
// - search_all_providers()    → federated search across all providers

use crate::commands::adapters::gemini::GeminiHashResolver;
use crate::commands::adapters::opencode::{get_opencode_base_path, scan_opencode_projects_impl};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use crate::models::SearchFilters;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::path::PathBuf;

// ============================================================================
// DETECTED PROVIDER
// ============================================================================

/// Information about a provider detected (or not detected) on this system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedProvider {
    /// Stable identifier: "claude", "codex", "gemini", "cursor", "opencode"
    pub id: String,
    /// Human-readable display name
    pub display_name: String,
    /// Resolved base path when the provider is available
    pub base_path: Option<String>,
    /// Whether the provider data directory exists and is readable
    pub is_available: bool,
    /// Reason the provider is unavailable (None when is_available = true)
    pub error: Option<String>,
}

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

/// Detect which providers are available on this system.
///
/// Inspects each known provider's default data location and marks it
/// available or unavailable. This command never fails — it always returns the
/// full list with availability flags so the frontend can show a summary.
#[tauri::command]
pub async fn detect_providers() -> Result<Vec<DetectedProvider>, String> {
    let mut providers = Vec::with_capacity(5);

    // ---- Claude Code -------------------------------------------------------
    {
        let (available, path, error) =
            probe(|| crate::commands::project::get_claude_folder_path()).await;
        providers.push(DetectedProvider {
            id: "claude-code".to_string(),
            display_name: "Claude Code".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- Codex CLI ---------------------------------------------------------
    {
        let (available, path, error) = probe(|| crate::commands::codex::get_codex_path()).await;
        providers.push(DetectedProvider {
            id: "codex".to_string(),
            display_name: "Codex CLI".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- Gemini CLI --------------------------------------------------------
    {
        let (available, path, error) = probe(|| crate::commands::gemini::get_gemini_path()).await;
        providers.push(DetectedProvider {
            id: "gemini".to_string(),
            display_name: "Gemini CLI".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- Cursor IDE --------------------------------------------------------
    {
        let (available, path, error) = probe(|| crate::commands::cursor::get_cursor_path()).await;
        providers.push(DetectedProvider {
            id: "cursor".to_string(),
            display_name: "Cursor IDE".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- OpenCode ----------------------------------------------------------
    {
        let result: Result<String, String> = match get_opencode_base_path() {
            Some(p) => Ok(p.to_string_lossy().to_string()),
            None => Err(
                "OPENCODE_FOLDER_NOT_FOUND: OpenCode folder not found".to_string(),
            ),
        };
        let (available, path, error) = result_to_probe(result);
        providers.push(DetectedProvider {
            id: "opencode".to_string(),
            display_name: "OpenCode".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    Ok(providers)
}

// ============================================================================
// SCAN ALL PROJECTS
// ============================================================================

/// Scan projects across all active providers.
///
/// `claude_path`: optional override for the Claude Code base directory.
/// `active_providers`: optional list of provider ids to include; when `None`
///   all detected (available) providers are scanned.
///
/// Results are merged and sorted by `last_activity_at` descending.  Each
/// project carries a `provider_id` so the frontend can route subsequent calls.
#[tauri::command]
pub async fn scan_all_projects(
    claude_path: Option<String>,
    active_providers: Option<Vec<String>>,
) -> Result<Vec<UniversalProject>, String> {
    // Determine which providers to include
    let wanted: Vec<String> = match active_providers {
        Some(list) => list,
        None => {
            // Default: all available providers
            detect_providers()
                .await?
                .into_iter()
                .filter(|p| p.is_available)
                .map(|p| p.id)
                .collect()
        }
    };

    let mut all_projects: Vec<UniversalProject> = Vec::new();

    // ---- Claude Code -------------------------------------------------------
    if wanted.iter().any(|p| p == "claude-code") {
        let base = claude_path.clone().or_else(|| {
            futures_lite_workaround_get_claude_path()
        });
        if let Some(base_path) = base {
            match crate::commands::project::scan_projects(base_path.clone()).await {
                Ok(claude_projects) => {
                    // Convert ClaudeProject → UniversalProject
                    let universal: Vec<UniversalProject> = claude_projects
                        .into_iter()
                        .map(|p| claude_project_to_universal(p, &base_path))
                        .collect();
                    all_projects.extend(universal);
                }
                Err(e) => {
                    eprintln!("[multi_provider] Claude scan failed: {}", e);
                }
            }
        }
    }

    // ---- Codex CLI ---------------------------------------------------------
    if wanted.iter().any(|p| p == "codex") {
        let codex_path_result = crate::commands::codex::get_codex_path().await;
        if let Ok(codex_path) = codex_path_result {
            // source_id uses the path as a stable identifier
            let source_id = format!("codex:{}", codex_path);
            match crate::commands::codex::scan_codex_projects(codex_path, source_id).await {
                Ok(projects) => all_projects.extend(projects),
                Err(e) => {
                    eprintln!("[multi_provider] Codex scan failed: {}", e);
                }
            }
        }
    }

    // ---- Gemini CLI --------------------------------------------------------
    if wanted.iter().any(|p| p == "gemini") {
        let gemini_path_result = crate::commands::gemini::get_gemini_path().await;
        if let Ok(gemini_path) = gemini_path_result {
            let source_id = format!("gemini:{}", gemini_path);
            match crate::commands::gemini::scan_gemini_projects(gemini_path, source_id).await {
                Ok(projects) => all_projects.extend(projects),
                Err(e) => {
                    eprintln!("[multi_provider] Gemini scan failed: {}", e);
                }
            }
        }
    }

    // ---- OpenCode ----------------------------------------------------------
    if wanted.iter().any(|p| p == "opencode") {
        if let Some(opencode_base) = get_opencode_base_path() {
            let source_id = format!("opencode:{}", opencode_base.display());
            match scan_opencode_projects_impl(&opencode_base, &source_id) {
                Ok(projects) => all_projects.extend(projects),
                Err(e) => {
                    eprintln!("[multi_provider] OpenCode scan failed: {}", e);
                }
            }
        }
    }

    // Cursor IDE provides workspaces, not projects in the same sense; skip
    // in the unified scan (users access Cursor via its dedicated commands).

    // Sort by last_activity_at descending (nulls last)
    all_projects.sort_by(|a, b| sort_by_activity(a, b));

    Ok(all_projects)
}

// ============================================================================
// LOAD PROVIDER SESSIONS
// ============================================================================

/// Load sessions for a project using the appropriate provider adapter.
///
/// `provider`: one of "claude", "codex", "gemini", "cursor", "opencode"
/// `project_path`: the project's path as returned by scan
/// `source_id`: the source identifier used when the project was scanned
#[tauri::command]
pub async fn load_provider_sessions(
    provider: String,
    project_path: String,
    source_id: String,
) -> Result<Vec<UniversalSession>, String> {
    match provider.as_str() {
        "claude-code" => {
            // Claude sessions are loaded per JSONL file; the project_path is the
            // directory containing the JSONL files.
            let claude_sessions =
                crate::commands::session::load_project_sessions(project_path.clone(), Some(false), None)
                    .await?;

            // Convert ClaudeSession → UniversalSession
            let universal = claude_sessions
                .into_iter()
                .map(|s| claude_session_to_universal(s, &project_path, &source_id))
                .collect();
            Ok(universal)
        }

        "codex" => {
            // For Codex, the project_path is the rollout file path and project_id
            // matches the session group key.
            let project_id = extract_last_segment(&project_path);
            crate::commands::codex::load_codex_sessions(
                String::new(),  // codex_path not used in the implementation
                project_path,
                project_id,
                source_id,
            )
            .await
        }

        "gemini" => {
            // Gemini needs a temporary resolver (no state available in plain fn)
            let resolver = GeminiHashResolver::new();
            let project_id = extract_last_segment(&project_path);
            load_gemini_sessions_no_state(project_path, project_id, source_id, resolver).await
        }

        "cursor" => {
            // Cursor load_cursor_sessions returns CursorSession, not UniversalSession.
            // Return empty here; Cursor users access sessions via the dedicated commands.
            Err(
                "MULTI_PROVIDER_CURSOR: Use load_cursor_sessions directly for Cursor provider"
                    .to_string(),
            )
        }

        "opencode" => {
            if let Some(opencode_base) = get_opencode_base_path() {
                let opencode_path = opencode_base.to_string_lossy().to_string();
                let project_id = extract_last_segment(&project_path);
                crate::commands::opencode::load_opencode_sessions(
                    opencode_path,
                    project_id,
                    source_id,
                )
                .await
            } else {
                Err("MULTI_PROVIDER_OPENCODE: OpenCode base path not found".to_string())
            }
        }

        other => Err(format!(
            "MULTI_PROVIDER_UNKNOWN_PROVIDER: Unknown provider '{}'",
            other
        )),
    }
}

// ============================================================================
// LOAD PROVIDER MESSAGES
// ============================================================================

/// Load messages for a session using the appropriate provider adapter.
///
/// `provider`: one of "claude", "codex", "gemini", "cursor", "opencode"
/// `session_path`: the session path/identifier as returned by load_provider_sessions
/// `offset` / `limit`: pagination parameters
#[tauri::command]
pub async fn load_provider_messages(
    provider: String,
    session_path: String,
    offset: usize,
    limit: usize,
) -> Result<Vec<UniversalMessage>, String> {
    match provider.as_str() {
        "claude-code" => {
            // load_session_messages returns Vec<UniversalMessage> directly;
            // apply manual offset/limit pagination after loading.
            let all = crate::commands::session::load_session_messages(session_path, None).await?;
            let total = all.len();
            let start = offset.min(total);
            let end = (offset + limit).min(total);
            Ok(all[start..end].to_vec())
        }

        "codex" => {
            crate::commands::codex::load_codex_messages(session_path, offset, limit).await
        }

        "gemini" => {
            // Gemini messages need session_id, project_id, source_id extracted
            // from the path (encoded by the session loader)
            let (actual_path, session_id, project_id, source_id) =
                parse_gemini_session_path(&session_path);
            crate::commands::gemini::load_gemini_messages(
                actual_path,
                session_id,
                project_id,
                source_id,
            )
            .await
        }

        "cursor" => {
            // Cursor uses cursor_path + session_db_path combined
            Err(
                "MULTI_PROVIDER_CURSOR: Use load_cursor_messages directly for Cursor provider"
                    .to_string(),
            )
        }

        "opencode" => {
            if let Some(opencode_base) = get_opencode_base_path() {
                let opencode_path = opencode_base.to_string_lossy().to_string();
                let session_id = extract_last_segment(&session_path);
                // Derive project_id from the session_path parent directory segment
                let project_id = PathBuf::from(&session_path)
                    .parent()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                let source_id = format!("opencode:{}", opencode_path);
                crate::commands::opencode::load_opencode_messages(
                    opencode_path,
                    session_id,
                    Some(project_id),
                    Some(source_id),
                    offset,
                    limit,
                )
                .await
            } else {
                Err("MULTI_PROVIDER_OPENCODE: OpenCode base path not found".to_string())
            }
        }

        other => Err(format!(
            "MULTI_PROVIDER_UNKNOWN_PROVIDER: Unknown provider '{}'",
            other
        )),
    }
}

// ============================================================================
// SEARCH ALL PROVIDERS
// ============================================================================

/// Search messages across all providers (or a subset).
///
/// `query`: full-text search query
/// `active_providers`: optional filter — if None, search all detected providers
/// `limit`: maximum number of results to return (default 100)
#[tauri::command]
pub async fn search_all_providers(
    query: String,
    active_providers: Option<Vec<String>>,
    limit: Option<usize>,
) -> Result<Vec<UniversalMessage>, String> {
    let max_results = limit.unwrap_or(100);

    let wanted: Vec<String> = match active_providers {
        Some(list) => list,
        None => {
            detect_providers()
                .await?
                .into_iter()
                .filter(|p| p.is_available)
                .map(|p| p.id)
                .collect()
        }
    };

    let mut all_results: Vec<UniversalMessage> = Vec::new();

    // ---- Claude Code -------------------------------------------------------
    if wanted.iter().any(|p| p == "claude-code") {
        if let Some(claude_base) = futures_lite_workaround_get_claude_path() {
            let filters = SearchFilters {
                date_range: None,
                projects: None,
                session_id: None,
                message_type: None,
                has_tool_calls: None,
                has_errors: None,
                has_file_changes: None,
            };
            match crate::commands::session::search_messages(
                claude_base,
                query.clone(),
                filters,
            )
            .await
            {
                Ok(results) => all_results.extend(results),
                Err(e) => {
                    eprintln!("[multi_provider] Claude search failed: {}", e);
                }
            }
        }
    }

    // ---- Codex CLI ---------------------------------------------------------
    if wanted.iter().any(|p| p == "codex") {
        if let Ok(codex_path) = crate::commands::codex::get_codex_path().await {
            let source_id = format!("codex:{}", codex_path);
            // Load all projects then search messages (Codex has no dedicated search command)
            if let Ok(projects) =
                crate::commands::codex::scan_codex_projects(codex_path, source_id.clone()).await
            {
                for project in projects {
                    if let Ok(sessions) = crate::commands::codex::load_codex_sessions(
                        String::new(),
                        project.path.clone(),
                        project.id.clone(),
                        source_id.clone(),
                    )
                    .await
                    {
                        for session in sessions {
                            if let Ok(msgs) = crate::commands::codex::load_codex_messages(
                                session
                                    .metadata
                                    .get("filePath")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or(&project.path)
                                    .to_string(),
                                0,
                                SEARCH_MAX_MESSAGES_PER_SESSION,
                            )
                            .await
                            {
                                let matching: Vec<UniversalMessage> = msgs
                                    .into_iter()
                                    .filter(|m| message_matches_query(m, &query))
                                    .collect();
                                all_results.extend(matching);
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- OpenCode ----------------------------------------------------------
    if wanted.iter().any(|p| p == "opencode") {
        if let Some(opencode_base) = get_opencode_base_path() {
            let source_id = format!("opencode:{}", opencode_base.display());
            if let Ok(projects) = scan_opencode_projects_impl(&opencode_base, &source_id) {
                for project in projects {
                    let opencode_path = opencode_base.to_string_lossy().to_string();
                    if let Ok(sessions) = crate::commands::opencode::load_opencode_sessions(
                        opencode_path.clone(),
                        project.id.clone(),
                        source_id.clone(),
                    )
                    .await
                    {
                        for session in sessions {
                            if let Ok(msgs) = crate::commands::opencode::load_opencode_messages(
                                opencode_path.clone(),
                                session.id.clone(),
                                Some(project.id.clone()),
                                Some(source_id.clone()),
                                0,
                                SEARCH_MAX_MESSAGES_PER_SESSION,
                            )
                            .await
                            {
                                let matching: Vec<UniversalMessage> = msgs
                                    .into_iter()
                                    .filter(|m| message_matches_query(m, &query))
                                    .collect();
                                all_results.extend(matching);
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by timestamp descending and truncate
    all_results.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    all_results.truncate(max_results);

    Ok(all_results)
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/// Maximum number of messages loaded per session during a federated search.
/// Prevents OOM on sessions with huge message counts.
const SEARCH_MAX_MESSAGES_PER_SESSION: usize = 10_000;

/// Probe a provider's path-detection async command.  Returns (available, path, error).
async fn probe<F, Fut>(f: F) -> (bool, Option<String>, Option<String>)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<String, String>>,
{
    let result = f().await;
    result_to_probe(result)
}

fn result_to_probe(result: Result<String, String>) -> (bool, Option<String>, Option<String>) {
    match result {
        Ok(path) => (true, Some(path), None),
        Err(e) => (false, None, Some(e)),
    }
}

/// Synchronously resolve the Claude folder path without going through Tauri
/// command machinery (which requires a running event-loop context).
fn futures_lite_workaround_get_claude_path() -> Option<String> {
    let home = dirs::home_dir()?;
    let p = home.join(".claude");
    if p.exists() && std::fs::read_dir(&p).is_ok() {
        Some(p.to_string_lossy().to_string())
    } else {
        None
    }
}

/// Sort two `UniversalProject` values by last_activity_at descending (nulls last).
fn sort_by_activity(a: &UniversalProject, b: &UniversalProject) -> Ordering {
    match (&a.last_activity_at, &b.last_activity_at) {
        (Some(a_ts), Some(b_ts)) => b_ts.cmp(a_ts),
        (Some(_), None) => Ordering::Less,
        (None, Some(_)) => Ordering::Greater,
        (None, None) => Ordering::Equal,
    }
}

/// Extract the last path segment (directory name or filename stem) from a path
/// string. Used as a project/session id fallback.
fn extract_last_segment(path: &str) -> String {
    let buf = PathBuf::from(path);
    // Prefer the stem (filename without extension), fall back to the full filename.
    if let Some(stem) = buf.file_stem() {
        return stem.to_string_lossy().to_string();
    }
    if let Some(name) = buf.file_name() {
        return name.to_string_lossy().to_string();
    }
    path.to_string()
}

/// Convert a provider-specific `ClaudeProject` to the universal type.
fn claude_project_to_universal(
    p: crate::models::ClaudeProject,
    claude_base: &str,
) -> UniversalProject {
    use std::collections::HashMap;
    let source_id = format!("claude-code:{}", claude_base);
    UniversalProject {
        id: p.path.clone(),
        source_id,
        provider_id: "claude-code".to_string(),
        name: p.name,
        path: p.path,
        session_count: p.session_count,
        total_messages: p.message_count,
        first_activity_at: None,
        last_activity_at: Some(p.last_modified),
        metadata: HashMap::new(),
    }
}

/// Convert a provider-specific `ClaudeSession` to the universal type.
fn claude_session_to_universal(
    s: crate::models::ClaudeSession,
    project_path: &str,
    source_id: &str,
) -> UniversalSession {
    use std::collections::HashMap;
    let mut metadata = HashMap::new();
    metadata.insert(
        "filePath".to_string(),
        serde_json::json!(s.file_path),
    );
    if let Some(ref branch) = s.git_branch {
        metadata.insert("gitBranch".to_string(), serde_json::json!(branch));
    }

    UniversalSession {
        id: s.session_id.clone(),
        project_id: project_path.to_string(),
        source_id: source_id.to_string(),
        provider_id: "claude-code".to_string(),
        title: s
            .summary
            .clone()
            .unwrap_or_else(|| s.actual_session_id.clone()),
        description: s.summary,
        message_count: s.message_count,
        first_message_at: s.first_message_time,
        last_message_at: s.last_message_time,
        duration: 0,
        total_tokens: None,
        tool_call_count: 0,
        error_count: if s.has_errors { 1 } else { 0 },
        metadata,
        checksum: s.session_id,
    }
}

/// Load Gemini sessions without Tauri state (creates a fresh resolver).
async fn load_gemini_sessions_no_state(
    project_path: String,
    project_id: String,
    source_id: String,
    resolver: GeminiHashResolver,
) -> Result<Vec<UniversalSession>, String> {
    use crate::commands::adapters::gemini::gemini_file_to_session;
    use std::path::Path;

    let project_dir = Path::new(&project_path);
    let mut sessions = Vec::new();

    fn visit_dirs(dir: &std::path::Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, out)?;
                } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("session-") && name.ends_with(".json") {
                        out.push(path);
                    }
                }
            }
        }
        Ok(())
    }

    let mut session_files = Vec::new();
    visit_dirs(project_dir, &mut session_files)
        .map_err(|e| format!("GEMINI_SCAN_ERROR: {}", e))?;

    for file in session_files {
        match gemini_file_to_session(&file, project_id.clone(), source_id.clone(), &resolver) {
            Ok(session) => sessions.push(session),
            Err(e) => {
                eprintln!("[multi_provider] Gemini session parse error {}: {}", file.display(), e);
            }
        }
    }

    Ok(sessions)
}

/// Parse a Gemini session path that may encode metadata as fragments.
/// Falls back to sensible defaults when no metadata is embedded.
fn parse_gemini_session_path(path: &str) -> (String, String, String, String) {
    // Format used by gemini commands: raw file path (no fragment encoding)
    let actual_path = path.to_string();
    let session_id = extract_last_segment(path)
        .trim_start_matches("session-")
        .trim_end_matches(".json")
        .to_string();
    let project_id = PathBuf::from(path)
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let source_id = format!("gemini:{}", project_id);
    (actual_path, session_id, project_id, source_id)
}

/// Check whether any content in a UniversalMessage matches the search query
/// (case-insensitive substring search).
fn message_matches_query(msg: &UniversalMessage, query: &str) -> bool {
    let lower_query = query.to_lowercase();
    for content in &msg.content {
        if let Ok(json) = serde_json::to_string(content) {
            if json.to_lowercase().contains(&lower_query) {
                return true;
            }
        }
    }
    false
}
