export interface ClaudeMCPResult {
  server: string;
  method: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string;
}

export interface ClaudeToolUseResult {
  command: string;
  stream: string;
  output: string;
  timestamp: string;
  exitCode: number;
}

// Raw message structure from JSONL files
export interface RawClaudeMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  timestamp: string;
  type: "user" | "assistant" | "system" | "summary";
  message: {
    role: "user" | "assistant";
    content: string | ContentItem[];
  };
  toolUse?: Record<string, unknown>;
  toolUseResult?: Record<string, unknown>;
  isSidechain?: boolean;
  userType?: string;
  cwd?: string;
  version?: string;
  requestId?: string;
}

// Content types based on CLAUDE.md
export type ContentItem =
  | TextContent
  | ToolUseContent
  | ToolResultContent
  | ThinkingContent;

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
  signature?: string;
}

// Processed message for UI
export interface ClaudeMessage {
  uuid: string;
  parentUuid?: string;
  sessionId: string;
  timestamp: string;
  type: string;
  content?: string | Record<string, unknown>;
  toolUse?: Record<string, unknown>;
  toolUseResult?: Record<string, unknown>;
  isSidechain?: boolean;
}

export interface ClaudeProject {
  name: string;
  path: string;
  session_count: number;
  message_count: number;
  lastModified: string;
}

export interface ClaudeSession {
  session_id: string;
  project_name: string;
  message_count: number;
  first_message_time: string;
  last_message_time: string;
  has_tool_use: boolean;
  has_errors: boolean;
}

export interface SearchFilters {
  dateRange?: [Date, Date];
  projects?: string[];
  messageType?: "user" | "assistant" | "all";
  hasToolCalls?: boolean;
  hasErrors?: boolean;
  hasFileChanges?: boolean;
}

export interface MessageNode {
  message: ClaudeMessage;
  children: MessageNode[];
  depth: number;
  isExpanded: boolean;
  isBranchRoot: boolean;
  branchDepth: number;
}

export interface MessagePage {
  messages: ClaudeMessage[];
  total_count: number;
  has_more: boolean;
  next_offset: number;
}

export interface PaginationState {
  currentOffset: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export interface AppState {
  claudePath: string;
  projects: ClaudeProject[];
  selectedProject: ClaudeProject | null;
  sessions: ClaudeSession[];
  selectedSession: ClaudeSession | null;
  messages: ClaudeMessage[];
  pagination: PaginationState;
  searchQuery: string;
  searchResults: ClaudeMessage[];
  searchFilters: SearchFilters;
  isLoading: boolean;
  error: string | null;
}
