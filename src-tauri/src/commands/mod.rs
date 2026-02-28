pub mod adapters; // v2.0.0 - Universal provider adapters
pub mod claude_settings; // Settings CRUD and MCP server management
pub mod codex; // v1.8.0 - Codex CLI support
pub mod cursor; // v2.0.0 - Cursor IDE support
pub mod edits; // Recent file edits tracking and restore
pub mod feedback;
pub mod fs_utils; // Cross-platform filesystem utilities
pub mod files; // v1.5.0+ - File activity tracking
pub mod gemini; // v1.7.0 - Gemini CLI support
pub mod mcp_presets; // MCP server presets
pub mod project;
pub mod rename; // Native session renaming
pub mod resume; // Session resume functionality
pub mod secure_update;
pub mod session;
pub mod session_writer; // v1.6.0+ - Session creation and writing
pub mod settings; // Settings presets
pub mod stats;
pub mod unified_presets; // Unified presets (settings + MCP)
pub mod update;
pub mod watcher; // File watcher for real-time session detection
