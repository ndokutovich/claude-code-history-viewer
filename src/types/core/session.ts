/**
 * Core Session Types
 *
 * Project and session structures for Claude conversation organization.
 *
 * This is the canonical implementation. Legacy session types live in src/types/index.ts
 * as UIProject/UISession (our fork's provider-agnostic names).
 */

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderId = "claude" | "cursor" | "gemini" | "codex" | "opencode";

export interface ProviderInfo {
  id: ProviderId;
  display_name: string;
  base_path: string;
  is_available: boolean;
}

// ============================================================================
// Git Types
// ============================================================================

export type GitWorktreeType = "main" | "linked" | "not_git";

export interface GitInfo {
  /** Worktree type */
  worktree_type: GitWorktreeType;
  /** Main repo project path (for linked worktrees) */
  main_project_path?: string;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  timestamp: number;
}

// ============================================================================
// Project & Session
// ============================================================================

export interface ClaudeProject {
  name: string;
  /** Claude session storage path (e.g., "~/.claude/projects/-Users-jack-client-my-project") */
  path: string;
  /** Decoded actual filesystem path (e.g., "/Users/jack/client/my-project") */
  actual_path: string;
  session_count: number;
  message_count: number;
  last_modified: string;
  /** Git worktree info */
  git_info?: GitInfo;
  /** Provider identifier (claude, codex, opencode) */
  provider?: ProviderId;
}

export interface ClaudeSession {
  session_id: string; // Unique ID based on file path
  actual_session_id: string; // Actual session ID from the messages
  file_path: string; // JSONL file full path
  project_name: string;
  message_count: number;
  first_message_time: string;
  last_message_time: string;
  last_modified: string; // File last modified time
  has_tool_use: boolean;
  has_errors: boolean;
  summary?: string;
  relevance?: number;
  /** Provider identifier (claude, codex, opencode) */
  provider?: ProviderId;
}

// ============================================================================
// Search Filters
// ============================================================================

export interface SearchFilters {
  dateRange?: [Date, Date];
  projects?: string[];
  messageType?: "user" | "assistant" | "all";
  hasToolCalls?: boolean;
  hasErrors?: boolean;
  hasFileChanges?: boolean;
}

// ============================================================================
// Session Sort Order
// ============================================================================

/** Session sort order preference */
export type SessionSortOrder = "newest" | "oldest";
