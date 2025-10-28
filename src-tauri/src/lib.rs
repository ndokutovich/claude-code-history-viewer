mod commands;
mod models;
mod utils;

use crate::commands::adapters::gemini::GeminiHashResolver;
use crate::commands::{
    cursor::*, feedback::*, files::*, gemini::*, project::*, secure_update::*, session::*,
    session_writer::*, stats::*, update::*,
};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GeminiResolverState(Mutex::new(GeminiHashResolver::new())))
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
            // Gemini CLI support (v1.7.0)
            get_gemini_path,
            validate_gemini_folder,
            scan_gemini_projects,
            load_gemini_sessions,
            load_gemini_messages,
            seed_gemini_resolver
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
