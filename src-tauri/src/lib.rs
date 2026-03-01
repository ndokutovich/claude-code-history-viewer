mod commands;
mod models;
mod utils;

use crate::commands::adapters::gemini::GeminiHashResolver;
use crate::commands::{
    claude_settings::*, codex::*, cursor::*, edits::*, feedback::*, files::*, gemini::*,
    mcp_presets::*, metadata::*, multi_provider::*, opencode::*, project::*, rename::*,
    resume::*, secure_update::*, session::*, session_writer::*, settings::*, stats::*,
    unified_presets::*, update::*, watcher::*,
};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GeminiResolverState(Mutex::new(GeminiHashResolver::new())))
        .manage(WatcherMap::default())
        .manage(MetadataState::default())
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
            get_claude_folder_path,
            validate_claude_folder,
            scan_projects,
            load_project_sessions,
            load_session_messages,
            load_session_messages_paginated,
            get_session_message_count,
            search_messages,
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
