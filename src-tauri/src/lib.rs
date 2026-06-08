mod cli;
mod commands;
mod models;
mod utils;

use crate::cli::{get_startup_session_hint, parse_session_hint, StartupSessionHint};
use crate::commands::adapters::gemini::GeminiHashResolver;
use crate::commands::{
    aider::*, antigravity::*, claude_settings::*, codex::*, cursor::*, edits::*, feedback::*, files::*,
    gemini::*, cline::*, forgecode::*, mcp_presets::*, metadata::*, multi_provider::*, opencode::*,
    project::*, rename::*,
    resume::*, secure_update::*, session::*, session_delete::*, session_writer::*, settings::*, stats::*,
    unified_presets::*, update::*, watcher::*, wsl::*,
};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::{Emitter, Manager};

    // Parse CLI args once for a session preload hint (e.g. `--session <uuid>`).
    // A missing or unrecognized value yields None and the GUI runs as usual.
    let startup_session_hint =
        StartupSessionHint(parse_session_hint(&std::env::args().collect::<Vec<_>>()));

    tauri::Builder::default()
        // Single-instance MUST be the first plugin so a second launch is
        // intercepted before any other plugin does work. The callback runs in
        // the ALREADY-running process and receives the second process's argv;
        // we re-focus the window and forward any `--session` hint as an event.
        // A panic in the callback is caught so a malformed argv cannot freeze
        // the live window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                if let Some(hint) = parse_session_hint(&argv) {
                    let _ = app.emit("cli-session-hint", hint);
                }
            }));
            if outcome.is_err() {
                log::error!("single_instance callback panicked; argv dropped");
            }
        }))
        .manage(GeminiResolverState(Mutex::new(GeminiHashResolver::new())))
        .manage(WatcherMap::default())
        .manage(MetadataState::default())
        .manage(startup_session_hint)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            // CLI session launch (--session <uuid>)
            get_startup_session_hint,
            resolve_session_by_id,
            get_claude_folder_path,
            validate_claude_folder,
            scan_projects,
            load_project_sessions,
            load_session_messages,
            load_session_messages_paginated,
            get_session_message_count,
            search_messages,
            delete_session,
            fix_session,
            get_session_token_stats,
            get_project_token_stats,
            get_project_stats_summary,
            get_session_comparison,
            check_for_updates,
            check_for_updates_secure,
            verify_download_integrity,
            send_feedback,
            get_system_info,
            open_github_issues,
            // Cursor IDE support (v2.0.0)
            get_cursor_path,
            validate_cursor_folder,
            scan_cursor_workspaces,
            load_cursor_sessions,
            load_cursor_messages,
            search_cursor_messages,
            // Universal Analytics (v2.1.0 - works with both Claude Code and Cursor)
            get_universal_session_token_stats,
            get_universal_project_token_stats,
            get_universal_project_stats_summary,
            get_universal_session_comparison,
            // File Activities (v1.5.0+)
            get_file_activities,
            // Session Writing (v1.6.0+)
            create_claude_project,
            create_claude_session,
            append_to_claude_session,
            extract_message_range,
            // Gemini CLI support (v1.7.0)
            get_gemini_path,
            validate_gemini_folder,
            scan_gemini_projects,
            load_gemini_sessions,
            load_gemini_messages,
            seed_gemini_resolver,
            // Codex CLI support (v1.8.0)
            get_codex_path,
            validate_codex_folder,
            scan_codex_projects,
            load_codex_sessions,
            load_codex_messages,
            // OpenCode support (v1.9.0)
            get_opencode_path,
            validate_opencode_folder,
            scan_opencode_projects,
            load_opencode_sessions,
            load_opencode_messages,
            rename_opencode_session_native,
            // Cline / Roo Code support (v1.9.x)
            get_cline_path,
            validate_cline_folder,
            scan_cline_projects,
            load_cline_sessions,
            load_cline_messages,
            // Aider support (v1.9.x)
            get_aider_path,
            validate_aider_folder,
            scan_aider_projects,
            load_aider_sessions,
            load_aider_messages,
            // ForgeCode support (v1.9.x)
            get_forgecode_path,
            validate_forgecode_folder,
            scan_forgecode_projects,
            load_forgecode_sessions,
            load_forgecode_messages,
            // Antigravity support (v1.9.x)
            get_antigravity_path,
            validate_antigravity_folder,
            scan_antigravity_projects,
            load_antigravity_sessions,
            load_antigravity_messages,
            // Global stats (upstream-enhanced)
            get_global_stats_summary,
            // Git log for Session Board
            get_git_log,
            // Native session renaming
            rename_session_native,
            reset_session_native_name,
            // Resume functionality
            resume_session,
            get_resume_command,
            get_session_cwd,
            provider_supports_resume,
            // File watcher (real-time session detection)
            start_file_watcher,
            stop_file_watcher,
            // Recent file edits tracking and restore
            get_recent_edits,
            restore_file,
            // Settings CRUD and MCP server management
            get_settings_by_scope,
            save_settings,
            get_all_settings,
            get_mcp_servers,
            get_all_mcp_servers,
            save_mcp_servers,
            get_claude_json_config,
            write_text_file,
            read_text_file,
            // Settings presets
            save_preset,
            load_presets,
            get_preset,
            delete_preset,
            // MCP presets
            save_mcp_preset,
            load_mcp_presets,
            get_mcp_preset,
            delete_mcp_preset,
            // Unified presets
            save_unified_preset,
            load_unified_presets,
            get_unified_preset,
            delete_unified_preset,
            // Multi-provider unified commands (v1.9.0)
            detect_providers,
            scan_all_projects,
            load_provider_sessions,
            load_provider_messages,
            search_all_providers,
            // WSL support (Windows) — distro detection + AI-tool dirs
            detect_wsl_distros,
            is_wsl_available_cmd,
            // Metadata persistence (v1.9.0)
            get_session_metadata,
            set_session_custom_name,
            set_session_starred,
            set_session_has_claude_code_name,
            add_session_tag,
            remove_session_tag,
            set_session_notes,
            get_project_metadata,
            set_project_hidden,
            set_project_custom_name,
            get_all_metadata,
            clear_all_metadata,
            load_user_metadata
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS-only: Spotlight / Dock / Finder launches don't re-exec
            // argv, so the single-instance plugin can't see them. The OS
            // instead delivers the target as an Apple Event surfaced as
            // `RunEvent::Opened { urls }`. We translate the first resolvable
            // URL into a SessionHint and reuse the same `cli-session-hint`
            // event the single-instance callback emits, so the frontend has a
            // single unified listener. Best-effort: custom-scheme registration
            // is a follow-up (see report); `file://` works without it.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                for url in urls {
                    if let Some(hint) = crate::cli::parse_session_hint_from_url(url) {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                        let _ = app.emit("cli-session-hint", hint);
                        break;
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = app;
                let _ = event;
            }
        });
}
