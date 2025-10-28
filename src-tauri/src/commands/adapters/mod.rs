// ============================================================================
// UNIVERSAL PROVIDER ADAPTERS
// ============================================================================
// This module contains adapters that convert provider-specific message formats
// to UniversalMessage (provider-agnostic), enabling consistent handling across
// all conversation history sources (Claude Code, Cursor IDE, etc.)
//
// Backend returns UniversalMessage → Frontend converts to UIMessage for display.

pub mod claude_code;
pub mod gemini;
pub mod codex;  // v1.8.0 - Codex CLI support
