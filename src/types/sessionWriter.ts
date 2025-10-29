// ============================================================================
// SESSION WRITER TYPES (v1.6.0+)
// ============================================================================
// TypeScript types matching the Rust session_writer.rs backend

/**
 * Token usage information for a message
 */
export interface TokenUsageInput {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Simplified message input for creating sessions
 * Matches Rust MessageInput struct
 */
export interface MessageInput {
  role: string; // "user" | "assistant" | "system"
  content: string | any[]; // Can be string or array of content items
  parent_id?: string;
  model?: string;
  tool_use?: Record<string, unknown>;
  tool_use_result?: Record<string, unknown>;
  usage?: TokenUsageInput;
}

/**
 * Request to create a new Claude Code project
 * Matches Rust CreateProjectRequest struct
 */
export interface CreateProjectRequest {
  name: string;
  parent_path?: string; // If undefined, uses ~/.claude/projects/
}

/**
 * Request to create a new session
 * Matches Rust CreateSessionRequest struct
 */
export interface CreateSessionRequest {
  project_path: string;
  messages: MessageInput[];
  summary?: string;
  cwd?: string; // Optional working directory (defaults to project_path if not provided)
}

/**
 * Response from creating a project
 * Matches Rust CreateProjectResponse struct
 */
export interface CreateProjectResponse {
  project_path: string;
  project_name: string;
}

/**
 * Response from creating a session
 * Matches Rust CreateSessionResponse struct
 */
export interface CreateSessionResponse {
  session_path: string;
  session_id: string;
  message_count: number;
}

/**
 * Request to extract a range of messages from an existing session
 * Matches Rust ExtractMessageRangeRequest struct
 */
export interface ExtractMessageRangeRequest {
  session_path: string;
  start_message_id?: string; // UUID - if undefined, start from beginning
  end_message_id?: string; // UUID - if undefined, go to end
}

/**
 * Response containing extracted messages
 * Matches Rust ExtractMessageRangeResponse struct
 */
export interface ExtractMessageRangeResponse {
  messages: MessageInput[];
  summary?: string;
  message_count: number;
  cwd?: string; // Extracted working directory from source session
}

// ============================================================================
// BUILDER TYPES (Frontend UI)
// ============================================================================

/**
 * Message being composed in the UI
 * Extended from MessageInput with UI-specific fields
 */
export interface MessageBuilder extends MessageInput {
  id: string; // Temporary ID for React keys
  isExpanded?: boolean; // UI state for collapsible editing
}

/**
 * Context selection from existing sessions
 */
export interface ContextSelection {
  session_id: string;
  session_path: string;
  project_name: string;
  selected_message_ids: string[]; // UUIDs of selected messages
  message_range?: {
    start_index: number;
    end_index: number;
  };
}

/**
 * Session builder state
 */
export interface SessionBuilderState {
  // Project selection
  targetProject?: {
    path: string;
    name: string;
    isNew: boolean; // True if creating new project
  };

  // Session metadata
  sessionSummary?: string;

  // Messages being composed
  messages: MessageBuilder[];

  // Context from existing sessions
  contextSelections: ContextSelection[];

  // UI state
  isComposing: boolean;
  isSaving: boolean;
  validationErrors: string[];
}
