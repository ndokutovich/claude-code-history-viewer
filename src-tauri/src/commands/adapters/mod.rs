// ============================================================================
// UNIVERSAL PROVIDER ADAPTERS
// ============================================================================
// This module contains adapters that convert provider-specific message formats
// to the universal UniversalMessage type, enabling consistent handling across
// all conversation history sources (Claude Code, Cursor IDE, etc.)

pub mod claude_code;
pub mod cursor;

// Re-export for convenience
pub use claude_code::claude_message_to_universal;
pub use cursor::cursor_bubble_to_universal;
