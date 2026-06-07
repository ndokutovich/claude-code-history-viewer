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

use crate::commands::adapters::aider::{
    aider_available, get_aider_base_path, load_aider_messages as aider_load_messages,
    load_aider_sessions as aider_load_sessions, parse_scheme_path as aider_parse_scheme_path,
    scan_aider_projects as aider_scan_projects,
};
use crate::commands::adapters::antigravity::{
    get_antigravity_base_path, load_antigravity_messages as antigravity_load_messages,
    load_antigravity_sessions as antigravity_load_sessions,
    parse_scheme_path as antigravity_parse_scheme_path,
    scan_antigravity_projects as antigravity_scan_projects,
};
use crate::commands::adapters::cline::{
    get_all_cline_base_paths, load_cline_messages as cline_load_messages,
    load_cline_sessions as cline_load_sessions, parse_scheme_path as cline_parse_scheme_path,
    scan_cline_projects as cline_scan_projects,
};
use crate::commands::adapters::forgecode::{
    get_forgecode_base_path, load_forgecode_messages as forgecode_load_messages,
    load_forgecode_sessions as forgecode_load_sessions, parse_project_path as forgecode_parse_project_path,
    parse_session_path as forgecode_parse_session_path, scan_forgecode_projects as forgecode_scan_projects,
};
use crate::commands::adapters::gemini::GeminiHashResolver;
use crate::commands::adapters::opencode::{get_opencode_base_path, scan_opencode_projects_impl};
use crate::commands::search_match::{
    cache_key, current_search_generation, take_matching, top_k_by, QueryMatcher,
};
use crate::models::universal::{UniversalMessage, UniversalProject, UniversalSession};
use crate::models::SearchFilters;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::Mutex;

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
    let mut providers = Vec::with_capacity(7);

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

    // ---- Cline / Roo Code --------------------------------------------------
    {
        let bases = get_all_cline_base_paths();
        let result: Result<String, String> = match bases.first() {
            Some((p, _)) => Ok(p.to_string_lossy().to_string()),
            None => Err("CLINE_FOLDER_NOT_FOUND: No Cline or Roo Code installation found".to_string()),
        };
        let (available, path, error) = result_to_probe(result);
        providers.push(DetectedProvider {
            id: "cline".to_string(),
            display_name: "Cline".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- Aider -------------------------------------------------------------
    {
        let result: Result<String, String> = match (aider_available(), get_aider_base_path()) {
            (true, Some(p)) => Ok(p.to_string_lossy().to_string()),
            _ => Err("AIDER_FOLDER_NOT_FOUND: No Aider chat history found".to_string()),
        };
        let (available, path, error) = result_to_probe(result);
        providers.push(DetectedProvider {
            id: "aider".to_string(),
            display_name: "Aider".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- ForgeCode ---------------------------------------------------------
    {
        let result: Result<String, String> = match get_forgecode_base_path() {
            Some(p) => Ok(p.to_string_lossy().to_string()),
            None => Err("FORGECODE_FOLDER_NOT_FOUND: No ForgeCode installation found".to_string()),
        };
        let (available, path, error) = result_to_probe(result);
        providers.push(DetectedProvider {
            id: "forgecode".to_string(),
            display_name: "ForgeCode".to_string(),
            base_path: path,
            is_available: available,
            error,
        });
    }

    // ---- Antigravity -------------------------------------------------------
    {
        let result: Result<String, String> = match get_antigravity_base_path() {
            Some(p) => Ok(p.to_string_lossy().to_string()),
            None => {
                Err("ANTIGRAVITY_FOLDER_NOT_FOUND: No Antigravity installation found".to_string())
            }
        };
        let (available, path, error) = result_to_probe(result);
        providers.push(DetectedProvider {
            id: "antigravity".to_string(),
            display_name: "Antigravity".to_string(),
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
    custom_claude_paths: Option<Vec<String>>,
    wsl_enabled: Option<bool>,
    wsl_excluded_distros: Option<Vec<String>>,
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
        let mut seen_bases = std::collections::HashSet::new();

        // Default (or explicit `claude_path`) base. Scanned unconditionally to
        // preserve existing behavior (even symlinked ~/.claude setups).
        if let Some(base_path) = claude_path
            .clone()
            .or_else(futures_lite_workaround_get_claude_path)
        {
            if seen_bases.insert(base_path.clone()) {
                scan_claude_base_into(&base_path, &mut all_projects).await;
            }
        }

        // User-configured custom Claude directories. Each is validated and
        // invalid/unsafe entries are skipped gracefully.
        if let Some(customs) = custom_claude_paths.clone() {
            for base_path in customs {
                if !seen_bases.insert(base_path.clone()) {
                    continue;
                }
                if crate::utils::validate_custom_claude_path(&PathBuf::from(&base_path)).is_err() {
                    eprintln!(
                        "[multi_provider] Skipping invalid custom Claude dir: {}",
                        base_path
                    );
                    continue;
                }
                scan_claude_base_into(&base_path, &mut all_projects).await;
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

    // ---- Cline / Roo Code --------------------------------------------------
    if wanted.iter().any(|p| p == "cline") {
        for (base, _label) in get_all_cline_base_paths() {
            let source_id = format!("cline:{}", base.display());
            match cline_scan_projects(&base, &source_id) {
                Ok(projects) => all_projects.extend(projects),
                Err(e) => {
                    eprintln!("[multi_provider] Cline scan failed: {}", e);
                }
            }
        }
    }

    // ---- Aider -------------------------------------------------------------
    if wanted.iter().any(|p| p == "aider") {
        let base = get_aider_base_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let source_id = format!("aider:{}", base);
        match aider_scan_projects(&source_id) {
            Ok(projects) => all_projects.extend(projects),
            Err(e) => {
                eprintln!("[multi_provider] Aider scan failed: {}", e);
            }
        }
    }

    // ---- ForgeCode ---------------------------------------------------------
    if wanted.iter().any(|p| p == "forgecode") {
        if let Some(forge_base) = get_forgecode_base_path() {
            let source_id = format!("forgecode:{}", forge_base.display());
            match forgecode_scan_projects(&forge_base, &source_id) {
                Ok(projects) => all_projects.extend(projects),
                Err(e) => {
                    eprintln!("[multi_provider] ForgeCode scan failed: {}", e);
                }
            }
        }
    }

    // ---- Antigravity -------------------------------------------------------
    if wanted.iter().any(|p| p == "antigravity") {
        if let Some(root) = get_antigravity_base_path() {
            let source_id = format!("antigravity:{}", root.display());
            match antigravity_scan_projects(&root, &source_id) {
                Ok(projects) => all_projects.extend(projects),
                Err(e) => {
                    eprintln!("[multi_provider] Antigravity scan failed: {}", e);
                }
            }
        }
    }

    // ---- WSL (Claude Code only) -------------------------------------------
    // Other providers resolve their base path natively (Windows side), so their
    // WSL data would be visible but not loadable. Mirrors upstream: WSL scan is
    // currently Claude-only. No-op on non-Windows / no-WSL machines.
    if wsl_enabled.unwrap_or(false) && wanted.iter().any(|p| p == "claude-code") {
        let excluded = wsl_excluded_distros.clone().unwrap_or_default();
        for (distro, claude_unc) in crate::commands::wsl::resolve_active_claude_dirs(&excluded) {
            match crate::commands::project::scan_projects(claude_unc.clone()).await {
                Ok(projects) => {
                    let label = format!("WSL: {}", distro);
                    let universal: Vec<UniversalProject> = projects
                        .into_iter()
                        .map(|p| {
                            let mut up = claude_project_to_universal(p, &claude_unc);
                            up.metadata
                                .insert("wslDistro".to_string(), serde_json::json!(distro));
                            up.metadata.insert(
                                "customDirectoryLabel".to_string(),
                                serde_json::json!(label),
                            );
                            up
                        })
                        .collect();
                    all_projects.extend(universal);
                }
                Err(e) => {
                    eprintln!("[multi_provider] WSL Claude scan failed for '{}': {}", distro, e);
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

        "cline" => {
            // project_path is the `cline://<base>|<cwd>` scheme path.
            let (base, cwd) = cline_parse_scheme_path(&project_path)?;
            cline_load_sessions(&base, &cwd, &source_id)
        }

        "aider" => {
            // project_path is the `aider://<project_dir>` scheme path.
            let dir = aider_parse_scheme_path(&project_path)?;
            aider_load_sessions(&dir, &source_id)
        }

        "forgecode" => {
            // project_path is the `forgecode://<workspace_id>` scheme path.
            let base = get_forgecode_base_path()
                .ok_or_else(|| "MULTI_PROVIDER_FORGECODE: ForgeCode base path not found".to_string())?;
            let workspace_id = forgecode_parse_project_path(&project_path)?;
            forgecode_load_sessions(&base, &workspace_id, &source_id)
        }

        "antigravity" => {
            // project_path is the `antigravity://<root>` scheme path.
            let (root, _) = antigravity_parse_scheme_path(&project_path)?;
            antigravity_load_sessions(&root, &source_id)
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

        "cline" => {
            // session_path is the `cline://<base>|<task_id>` scheme path.
            let (base, task_id) = cline_parse_scheme_path(&session_path)?;
            let source_id = format!("cline:{}", base.display());
            cline_load_messages(
                &base,
                &task_id,
                &session_path,
                "",
                &source_id,
                offset,
                limit,
            )
        }

        "aider" => {
            // session_path is the `aider://<history_file>` scheme path.
            let history_path = aider_parse_scheme_path(&session_path)?;
            let project_id = history_path
                .parent()
                .map(|p| format!("aider://{}", p.to_string_lossy()))
                .unwrap_or_default();
            let source_id = format!("aider:{}", history_path.display());
            aider_load_messages(
                &history_path,
                &session_path,
                &project_id,
                &source_id,
                offset,
                limit,
            )
        }

        "forgecode" => {
            // session_path is the `forgecode://<workspace_id>/<conversation_id>` scheme path.
            let base = get_forgecode_base_path()
                .ok_or_else(|| "MULTI_PROVIDER_FORGECODE: ForgeCode base path not found".to_string())?;
            let (workspace_id, conversation_id) = forgecode_parse_session_path(&session_path)?;
            let project_path = format!("forgecode://{}", workspace_id);
            let source_id = format!("forgecode:{}", base.display());
            forgecode_load_messages(
                &base,
                &workspace_id,
                &conversation_id,
                &session_path,
                &project_path,
                &source_id,
                offset,
                limit,
            )
        }

        "antigravity" => {
            // session_path is the `antigravity://<root>|<session_id>` scheme path.
            let (root, session_id) = antigravity_parse_scheme_path(&session_path)?;
            let source_id = format!("antigravity:{}", root.display());
            antigravity_load_messages(
                &root,
                &session_id,
                &session_path,
                "",
                &source_id,
                offset,
                limit,
            )
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

/// Bounded LRU cache of federated search results, keyed by a hash of
/// (query, active_providers, limit). Entries carry the search generation they
/// were produced under; a generation bump (via the file watcher) makes them
/// stale without an explicit purge.
const SEARCH_CACHE_CAPACITY: usize = 64;

lazy_static::lazy_static! {
    static ref SEARCH_CACHE: Mutex<LruCache<u64, (u64, Vec<UniversalMessage>)>> = Mutex::new(
        LruCache::new(NonZeroUsize::new(SEARCH_CACHE_CAPACITY).expect("non-zero capacity")),
    );
}

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
    custom_claude_paths: Option<Vec<String>>,
    wsl_enabled: Option<bool>,
    wsl_excluded_distros: Option<Vec<String>>,
) -> Result<Vec<UniversalMessage>, String> {
    let max_results = limit.unwrap_or(100);

    // ---- Result cache (generation-gated) -----------------------------------
    let generation = current_search_generation();
    let key = cache_key(&(&query, &active_providers, max_results));
    if let Ok(mut cache) = SEARCH_CACHE.lock() {
        if let Some((cached_gen, cached)) = cache.get(&key) {
            if *cached_gen == generation {
                return Ok(cached.clone());
            }
        }
    }

    // Multi-term matcher built once and shared across every provider scan.
    let matcher = QueryMatcher::from_query(&query);
    if matcher.is_empty() {
        return Ok(Vec::new());
    }

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
        // Union the default base with any user-configured custom dirs.
        let mut claude_bases: Vec<String> = Vec::new();
        if let Some(base) = futures_lite_workaround_get_claude_path() {
            claude_bases.push(base);
        }
        if let Some(customs) = custom_claude_paths.clone() {
            for c in customs {
                if crate::utils::validate_custom_claude_path(&PathBuf::from(&c)).is_ok() {
                    claude_bases.push(c);
                } else {
                    eprintln!("[multi_provider] Skipping invalid custom Claude dir (search): {}", c);
                }
            }
        }

        let mut seen_bases = std::collections::HashSet::new();
        for claude_base in claude_bases {
            if !seen_bases.insert(claude_base.clone()) {
                continue;
            }
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
                claude_base.clone(),
                query.clone(),
                filters,
            )
            .await
            {
                Ok(results) => all_results.extend(results),
                Err(e) => {
                    eprintln!("[multi_provider] Claude search failed ({}): {}", claude_base, e);
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
                'codex_search: for project in projects {
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
                                let remaining = max_results.saturating_sub(all_results.len());
                                let matching =
                                    take_matching(msgs, remaining, |m| message_matches(m, &matcher));
                                all_results.extend(matching);
                                if all_results.len() >= max_results {
                                    break 'codex_search;
                                }
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
                'opencode_search: for project in projects {
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
                                let remaining = max_results.saturating_sub(all_results.len());
                                let matching =
                                    take_matching(msgs, remaining, |m| message_matches(m, &matcher));
                                all_results.extend(matching);
                                if all_results.len() >= max_results {
                                    break 'opencode_search;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- Cline / Roo Code --------------------------------------------------
    if wanted.iter().any(|p| p == "cline") {
        'cline_search: for (base, _label) in get_all_cline_base_paths() {
            let source_id = format!("cline:{}", base.display());
            if let Ok(projects) = cline_scan_projects(&base, &source_id) {
                for project in projects {
                    // project.path == "cline://<base>|<cwd>"
                    let cwd = match cline_parse_scheme_path(&project.path) {
                        Ok((_, cwd)) => cwd,
                        Err(_) => continue,
                    };
                    if let Ok(sessions) = cline_load_sessions(&base, &cwd, &source_id) {
                        for session in sessions {
                            // session.id == "cline://<base>|<task_id>"
                            let task_id = match cline_parse_scheme_path(&session.id) {
                                Ok((_, t)) => t,
                                Err(_) => continue,
                            };
                            if let Ok(msgs) = cline_load_messages(
                                &base,
                                &task_id,
                                &session.id,
                                &project.id,
                                &source_id,
                                0,
                                SEARCH_MAX_MESSAGES_PER_SESSION,
                            ) {
                                let matching: Vec<UniversalMessage> = msgs
                                    .into_iter()
                                    .filter(|m| message_matches(m, &matcher))
                                    .collect();
                                all_results.extend(matching);
                                if all_results.len() >= max_results {
                                    break 'cline_search;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- Aider -------------------------------------------------------------
    if wanted.iter().any(|p| p == "aider") {
        let base = get_aider_base_path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let source_id = format!("aider:{}", base);
        if let Ok(projects) = aider_scan_projects(&source_id) {
            'aider_search: for project in projects {
                // project.path == "aider://<project_dir>"
                let dir = match aider_parse_scheme_path(&project.path) {
                    Ok(d) => d,
                    Err(_) => continue,
                };
                if let Ok(sessions) = aider_load_sessions(&dir, &source_id) {
                    for session in sessions {
                        // session.id == "aider://<history_file>"
                        let history_path = match aider_parse_scheme_path(&session.id) {
                            Ok(p) => p,
                            Err(_) => continue,
                        };
                        if let Ok(msgs) = aider_load_messages(
                            &history_path,
                            &session.id,
                            &project.id,
                            &source_id,
                            0,
                            SEARCH_MAX_MESSAGES_PER_SESSION,
                        ) {
                            let matching: Vec<UniversalMessage> = msgs
                                .into_iter()
                                .filter(|m| message_matches(m, &matcher))
                                .collect();
                            all_results.extend(matching);
                            if all_results.len() >= max_results {
                                break 'aider_search;
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- ForgeCode ---------------------------------------------------------
    if wanted.iter().any(|p| p == "forgecode") {
        'forgecode_search: {
            let Some(forge_base) = get_forgecode_base_path() else {
                break 'forgecode_search;
            };
            let source_id = format!("forgecode:{}", forge_base.display());
            if let Ok(projects) = forgecode_scan_projects(&forge_base, &source_id) {
                for project in projects {
                    // project.path == "forgecode://<workspace_id>"
                    let workspace_id = match forgecode_parse_project_path(&project.path) {
                        Ok(id) => id,
                        Err(_) => continue,
                    };
                    if let Ok(sessions) =
                        forgecode_load_sessions(&forge_base, &workspace_id, &source_id)
                    {
                        for session in sessions {
                            // session.id == "forgecode://<workspace_id>/<conversation_id>"
                            let (ws, conv) = match forgecode_parse_session_path(&session.id) {
                                Ok(pair) => pair,
                                Err(_) => continue,
                            };
                            if let Ok(msgs) = forgecode_load_messages(
                                &forge_base,
                                &ws,
                                &conv,
                                &session.id,
                                &project.id,
                                &source_id,
                                0,
                                SEARCH_MAX_MESSAGES_PER_SESSION,
                            ) {
                                let matching: Vec<UniversalMessage> = msgs
                                    .into_iter()
                                    .filter(|m| message_matches(m, &matcher))
                                    .collect();
                                all_results.extend(matching);
                                if all_results.len() >= max_results {
                                    break 'forgecode_search;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ---- Antigravity -------------------------------------------------------
    if wanted.iter().any(|p| p == "antigravity") {
        if let Some(root) = get_antigravity_base_path() {
            let source_id = format!("antigravity:{}", root.display());
            if let Ok(sessions) = antigravity_load_sessions(&root, &source_id) {
                for session in sessions {
                    // session.id == "antigravity://<root>|<session_id>"
                    let session_id = match antigravity_parse_scheme_path(&session.id) {
                        Ok((_, id)) => id,
                        Err(_) => continue,
                    };
                    if let Ok(msgs) = antigravity_load_messages(
                        &root,
                        &session_id,
                        &session.id,
                        &session.project_id,
                        &source_id,
                        0,
                        SEARCH_MAX_MESSAGES_PER_SESSION,
                    ) {
                        let matching: Vec<UniversalMessage> = msgs
                            .into_iter()
                            .filter(|m| message_matches(m, &matcher))
                            .collect();
                        all_results.extend(matching);
                        if all_results.len() >= max_results {
                            break;
                        }
                    }
                }
            }
        }
    }

    // ---- WSL (Claude Code only) -------------------------------------------
    if wsl_enabled.unwrap_or(false) && wanted.iter().any(|p| p == "claude-code") {
        let excluded = wsl_excluded_distros.clone().unwrap_or_default();
        for (distro, claude_unc) in crate::commands::wsl::resolve_active_claude_dirs(&excluded) {
            let filters = SearchFilters {
                date_range: None,
                projects: None,
                session_id: None,
                message_type: None,
                has_tool_calls: None,
                has_errors: None,
                has_file_changes: None,
            };
            match crate::commands::session::search_messages(claude_unc, query.clone(), filters).await
            {
                Ok(results) => all_results.extend(results),
                Err(e) => {
                    eprintln!("[multi_provider] WSL Claude search failed for '{}': {}", distro, e);
                }
            }
        }
    }

    // Top-k by timestamp descending: O(n) partial selection instead of an
    // O(n log n) full sort when there are more candidates than requested.
    let results = top_k_by(all_results, max_results, |a, b| b.timestamp.cmp(&a.timestamp));

    // Cache under the generation captured at entry; a concurrent file change
    // will have advanced the generation, so this entry is simply skipped next time.
    if let Ok(mut cache) = SEARCH_CACHE.lock() {
        cache.put(key, (generation, results.clone()));
    }

    Ok(results)
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
///
/// Honors a valid `CLAUDE_CONFIG_DIR` override first, then falls back to the
/// default `~/.claude` location.
fn futures_lite_workaround_get_claude_path() -> Option<String> {
    if let Some(config_dir) = crate::utils::resolve_claude_config_dir() {
        return Some(config_dir);
    }
    let home = dirs::home_dir()?;
    let p = home.join(".claude");
    if p.exists() && std::fs::read_dir(&p).is_ok() {
        Some(p.to_string_lossy().to_string())
    } else {
        None
    }
}

/// Scan a single Claude base directory and append its projects (converted to
/// `UniversalProject`) to `out`. Errors are logged and swallowed.
async fn scan_claude_base_into(base_path: &str, out: &mut Vec<UniversalProject>) {
    match crate::commands::project::scan_projects(base_path.to_string()).await {
        Ok(claude_projects) => {
            out.extend(
                claude_projects
                    .into_iter()
                    .map(|p| claude_project_to_universal(p, base_path)),
            );
        }
        Err(e) => {
            eprintln!("[multi_provider] Claude scan failed ({}): {}", base_path, e);
        }
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
        entrypoint: s.entrypoint,
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

/// Check whether any content in a UniversalMessage matches the search query.
///
/// A message matches when its serialized content contains all query terms
/// (ASCII case-insensitive, order-independent), as determined by the shared
/// [`QueryMatcher`]. The matcher is built once per search and reused here.
fn message_matches(msg: &UniversalMessage, matcher: &QueryMatcher) -> bool {
    for content in &msg.content {
        if let Ok(json) = serde_json::to_string(content) {
            if matcher.is_match(&json) {
                return true;
            }
        }
    }
    false
}
