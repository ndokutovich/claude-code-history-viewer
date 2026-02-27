pub mod adapters;
pub mod claude_settings;
pub mod cursor;
pub mod feedback;
pub mod files;
pub mod fs_utils;
pub mod gemini;
pub mod mcp_presets;
pub mod metadata;
pub mod multi_provider;
pub mod project;
pub mod resume;
pub mod session;
pub mod session_writer;
pub mod settings;
pub mod stats;
pub mod unified_presets;
pub mod watcher;

#[cfg(test)]
mod proptest_examples;
