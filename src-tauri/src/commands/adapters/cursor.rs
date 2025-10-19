// ============================================================================
// CURSOR IDE ADAPTER
// ============================================================================
// Cursor IDE already uses UniversalMessage natively in cursor.rs
// This module provides a thin wrapper for consistency with the adapter pattern

use crate::models::universal::UniversalMessage;

/// Load Cursor messages (already in universal format)
///
/// Note: Cursor implementation in ../cursor.rs already returns UniversalMessage,
/// so this is just a passthrough for consistency with the adapter pattern.
pub async fn load_cursor_messages_universal(
    cursor_base_path: String,
    session_id: String,
    session_timestamp: String,
) -> Result<Vec<UniversalMessage>, String> {
    use crate::commands::cursor::load_cursor_messages;
    use std::path::PathBuf;

    // Build the encoded path format that load_cursor_messages expects
    // Format: <full_db_path>#session=<session_id>#timestamp=<timestamp>
    let cursor_base = PathBuf::from(cursor_base_path);
    let global_db = cursor_base.join("User").join("globalStorage").join("state.vscdb");

    let encoded_path = format!(
        "{}#session={}#timestamp={}",
        global_db.to_string_lossy(),
        session_id,
        session_timestamp
    );

    // Cursor's load_cursor_messages already returns UniversalMessage ✅
    load_cursor_messages(encoded_path).await
}

/// Wrapper function for the existing Cursor bubble to universal conversion
///
/// The actual conversion logic is in ../cursor.rs load_cursor_messages function,
/// which handles parsing the SQLite database and converting CursorBubble to UniversalMessage.
pub fn cursor_bubble_to_universal() -> &'static str {
    "Cursor bubble conversion is handled in commands/cursor.rs:load_cursor_messages"
}
