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

export interface AppState {
  claudePath: string;
  projects: ClaudeProject[];
  selectedProject: ClaudeProject | null;
  sessions: ClaudeSession[];
  selectedSession: ClaudeSession | null;
  messages: ClaudeMessage[];
  searchQuery: string;
  searchResults: ClaudeMessage[];
  searchFilters: SearchFilters;
  isLoading: boolean;
  error: string | null;
}
