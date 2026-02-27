/**
 * Types Index
 *
 * Re-exports all types from domain-specific modules.
 * Import from '@/types' for convenience.
 *
 * @example
 * import type { ClaudeMessage, ContentItem, SessionTokenStats } from '@/types';
 */

// ============================================================================
// Core Types - Fundamental building blocks
// ============================================================================

// Message Types
export type {
  FileHistorySnapshotData,
  FileBackupEntry,
  FileHistorySnapshotMessage,
  ProgressDataType,
  ProgressData,
  ProgressMessage,
  QueueOperationType,
  QueueOperationMessage,
  MessagePayload,
  RawClaudeMessage,
  ClaudeMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeSystemMessage,
  ClaudeSummaryMessage,
  ClaudeFileHistoryMessage,
  ClaudeProgressMessage,
  ClaudeQueueMessage,
  MessageNode,
  MessagePage,
  PaginationState,
} from "./core/message";

// Content Types
export type {
  TextContent,
  ThinkingContent,
  RedactedThinkingContent,
  ImageContent,
  ImageMimeType,
  Base64ImageSource,
  URLImageSource,
  DocumentContent,
  Base64PDFSource,
  PlainTextSource,
  URLPDFSource,
  CitationsConfig,
  Citation,
  SearchResultContent,
} from "./core/content";

// Tool Types
export type {
  ContentItem,
  ToolUseContent,
  ToolResultContent,
  ClaudeToolUseResult,
  ServerToolUseContent,
  WebSearchToolResultContent,
  WebSearchResultItem,
  WebSearchToolError,
  WebFetchToolResultContent,
  WebFetchResult,
  WebFetchError,
  CodeExecutionToolResultContent,
  CodeExecutionResult,
  CodeExecutionError,
  BashCodeExecutionToolResultContent,
  BashCodeExecutionResult,
  BashCodeExecutionError,
  TextEditorCodeExecutionToolResultContent,
  TextEditorResult,
  TextEditorError,
  ToolSearchToolResultContent,
  ToolSearchResult,
  ToolSearchError,
} from "./core/tool";

// MCP Types
export type {
  MCPToolUseContent,
  MCPToolResultContent,
  MCPToolResultData,
  MCPTextResult,
  MCPImageResult,
  MCPResourceResult,
  MCPUnknownResult,
  ClaudeMCPResult,
} from "./core/mcp";

// Session Types
export type {
  GitWorktreeType,
  GitInfo,
  GitCommit,
  ProviderId,
  ProviderInfo,
  ClaudeProject,
  ClaudeSession,
  SearchFilters,
} from "./core/session";

// Project & Metadata Types
export type {
  SessionMetadata,
  ProjectMetadata,
  GroupingMode,
  UserSettings,
  UserMetadata,
} from "./core/project";
export {
  METADATA_SCHEMA_VERSION,
  DEFAULT_USER_METADATA,
  isSessionMetadataEmpty,
  isProjectMetadataEmpty,
  getSessionDisplayName,
  isProjectHidden,
} from "./core/project";

// Settings Types
export type {
  ClaudeModel,
  PermissionDefaultMode,
  PermissionsConfig,
  HookCommand,
  HooksConfig,
  StatusLineConfig,
  SandboxNetworkConfig,
  SandboxConfig,
  AttributionConfig,
  AutoUpdatesChannel,
  MarketplaceConfig,
  MCPServerType,
  MCPServerConfig,
  FeedbackSurveyState,
  ClaudeCodeSettings,
  SettingsScope,
  AllSettingsResponse,
  MCPSource,
  AllMCPServersResponse,
  ClaudeJsonConfigResponse,
  ClaudeJsonProjectSettings,
  ScopedSettings,
  SettingsPreset,
} from "./core/settings";
export { SCOPE_PRIORITY } from "./core/settings";

// ============================================================================
// Derived Types - Composed/aggregated types
// ============================================================================

// Preset Types (Unified)
export type {
  // Current types
  UnifiedPresetData,
  UnifiedPresetSummary,
  UnifiedPresetInput,
  UnifiedPresetApplyOptions,
  // Legacy types (deprecated)
  PresetData,
  PresetInput,
  MCPPresetData,
  MCPPresetInput,
} from "./derived/preset";
export {
  computePresetSummary,
  parsePresetContent,
  formatPresetDate,
  formatMCPPresetDate,
  formatUnifiedPresetDate,
  settingsToJson,
  jsonToSettings,
  createPresetInput,
  extractSettings,
  parseMCPServers,
} from "./derived/preset";

// ============================================================================
// Domain Types - Feature-specific types
// ============================================================================

// Session State
export type {
  AppState,
} from "./session.types";

// Stats Types
export type {
  StatsMode,
  MetricMode,
  SessionTokenStats,
  PaginatedTokenStats,
  DailyStats,
  ActivityHeatmap,
  ToolUsageStats,
  ModelStats,
  DateRange,
  ProjectStatsSummary,
  ProjectRanking,
  ProviderUsageStats,
  SessionComparison,
  GlobalStatsSummary,
} from "./stats.types";

// Edit Types
export type { RecentFileEdit, RecentEditsResult, PaginatedRecentEdits } from "./edit.types";

// Update Types
export type {
  UpdatePriority,
  UpdateType,
  UpdateMessage,
  UpdateMetadata,
  UpdateInfo,
} from "./update.types";

// Error Types
export { AppErrorType } from "./error.types";
export type { AppError } from "./error.types";

// Analytics Types
export type {
  AnalyticsView,
  AnalyticsViewType,
  AnalyticsState,
  RecentEditsPagination,
} from "./analytics";

// Board Types
export type {
  BoardSessionStats,
  SessionFileEdit,
  SessionDepth,
  BoardSessionData,
  ZoomLevel,
  DateFilter,
  ActiveBrush,
  BrushableCard,
  BoardState,
} from "./board.types";

// Update Settings Types
export type {
  UpdateSettings,
} from "./updateSettings";
export { DEFAULT_UPDATE_SETTINGS } from "./updateSettings";

// ============================================================================
// Legacy / Fork-Specific Types - preserved for our unique components
// ============================================================================

// UIMessage: Legacy display format (maps to ClaudeMessage from upstream)
export type UIMessage = import("./core/message").ClaudeMessage & {
  // Additional fork-specific fields
  uuid?: string;
  parentUuid?: string;
  sessionId?: string;
  provider_metadata?: Record<string, unknown>;
  projectPath?: string;
  toolUse?: unknown;
  toolUseResult?: unknown;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  providerId?: string;
};

// UISession: alias for ClaudeSession with fork-specific extensions
export type UISession = import("./core/session").ClaudeSession & {
  providerId?: string;
  is_problematic?: boolean;
  git_branch?: string;
  git_commit?: string;
};

// UIProject: alias for ClaudeProject with fork-specific extensions
export type UIProject = import("./core/session").ClaudeProject & {
  lastModified?: string;
};

// File Activity Types (unique to our fork)
export type FileOperation =
  | "read"
  | "write"
  | "edit"
  | "delete"
  | "create"
  | "glob"
  | "multiedit";

export interface FileChange {
  old_string: string;
  new_string: string;
  line_start?: number;
  line_end?: number;
}

export interface FileActivity {
  file_path: string;
  operation: FileOperation;
  timestamp: string;
  session_id: string;
  project_id: string;
  message_id: string;
  tool_name: string;
  content_before?: string;
  content_after?: string;
  size_before?: number;
  size_after?: number;
  changes?: FileChange[];
  lines_added?: number;
  lines_removed?: number;
}

export interface FileActivityFilters {
  dateRange?: [string, string];
  projects?: string[];
  sessionId?: string;
  operations?: FileOperation[];
  fileExtensions?: string[];
  searchQuery?: string;
}

// Message Filters (unique to our fork)
export interface MessageFilters {
  showBashOnly: boolean;
  showToolUseOnly: boolean;
  showMessagesOnly: boolean;
  showCommandOnly: boolean;
}

// Message Builder (unique to our fork)
export interface MessageBuilder {
  id?: string;
  parent_id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  toolUse?: unknown;
  tool_use?: unknown;
  toolUseResult?: unknown;
  tool_use_result?: unknown;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  isExpanded?: boolean;
}

// Loading Progress (unique to our fork)
export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  progress: number;
  message?: string;
  details?: string;
  stage: string;
}
