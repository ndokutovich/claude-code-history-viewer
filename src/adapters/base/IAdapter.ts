// Base adapter interface - ALL providers MUST implement this
// FAIL FAST: Throw errors immediately on invalid data or states

import type {
  UniversalMessage,
  UniversalSession,
  UniversalProject,
  SearchFilters,
  HealthStatus,
} from '../../types/universal';
import type {
  ProviderDefinition,
  ValidationResult,
  DetectionScore,
} from '../../types/providers';
import { ErrorCode } from '../../types/providers';

// Re-export types that consumers need
export type { ValidationResult, DetectionScore, SearchFilters, HealthStatus } from '../../types/universal';
export type { ProviderDefinition } from '../../types/providers';
export { ErrorCode } from '../../types/providers';

// ============================================================================
// MAIN ADAPTER INTERFACE
// ============================================================================

export interface IConversationAdapter {
  // IDENTITY (REQUIRED)
  readonly providerId: string;
  readonly providerDefinition: ProviderDefinition;

  // LIFECYCLE (REQUIRED)
  initialize(): Promise<void>;
  dispose(): Promise<void>;

  // VALIDATION (REQUIRED, FAIL FAST)
  validate(path: string): Promise<ValidationResult>;
  canHandle(path: string): Promise<DetectionScore>;

  // DISCOVERY (REQUIRED)
  scanProjects(
    sourcePath: string,
    sourceId: string
  ): Promise<ScanResult<UniversalProject>>;

  loadSessions(
    projectPath: string,
    projectId: string,
    sourceId: string
  ): Promise<ScanResult<UniversalSession>>;

  // DATA LOADING (REQUIRED)
  loadMessages(
    sessionPath: string,
    sessionId: string,
    options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>>;

  // SEARCH (REQUIRED, can return empty)
  searchMessages(
    sourcePaths: string[],
    query: string,
    filters: SearchFilters
  ): Promise<SearchResult<UniversalMessage>>;

  // STATS (OPTIONAL - return null if unsupported)
  getSessionStats?(sessionPath: string): Promise<SessionStats | null>;
  getProjectStats?(projectPath: string): Promise<ProjectStats | null>;

  // HEALTH CHECK (REQUIRED)
  healthCheck(sourcePath: string): Promise<HealthStatus>;

  // ERROR RECOVERY (REQUIRED)
  handleError(error: Error, context: ErrorContext): ErrorRecovery;

  // ============================================================================
  // PATH MANAGEMENT (OPTIONAL - v1.6.0+)
  // ============================================================================
  // Providers define how to convert user-selected paths to absolute project paths

  /**
   * Get the projects root directory for this provider
   * For Claude Code: ~/.claude/projects/
   * For Cursor: AppData/Roaming/Cursor/User/workspaceStorage/
   * @param sourcePath - The provider's base source path
   * @returns Absolute path to the projects root directory
   */
  getProjectsRoot?(sourcePath: string): string;

  /**
   * Convert a user-selected "browse folder" path to an absolute project path
   * For Claude Code: rootPath + "/projects/" + projectName
   * Provider can add subdirectories, validate paths, etc.
   * @param sourcePath - The provider's base source path
   * @param selectedPath - Path selected by user (could be relative or absolute)
   * @returns Absolute path where the project should be created/accessed
   */
  convertToProjectPath?(sourcePath: string, selectedPath: string): string;

  // ============================================================================
  // WRITE OPERATIONS (OPTIONAL - v1.6.0+)
  // ============================================================================
  // Providers can optionally support creating projects/sessions

  /**
   * Create a new project/workspace
   * @param sourcePath - Base path for this provider's data
   * @param projectName - Name of the project to create
   * @returns Write result with created project info
   */
  createProject?(
    sourcePath: string,
    projectName: string
  ): Promise<WriteResult<ProjectInfo>>;

  /**
   * Create a new conversation session
   * @param projectPath - Path to the project (relative to source)
   * @param request - Session creation request with messages
   * @returns Write result with created session info
   */
  createSession?(
    projectPath: string,
    request: CreateSessionRequest
  ): Promise<WriteResult<SessionInfo>>;

  /**
   * Append messages to an existing session
   * @param sessionPath - Path to the session
   * @param messages - Messages to append
   * @returns Write result with count of appended messages
   */
  appendMessages?(
    sessionPath: string,
    messages: MessageInput[]
  ): Promise<WriteResult<number>>;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface ScanResult<T> {
  success: boolean;
  data?: T[];
  error?: AdapterError;
  warnings?: string[];
  metadata?: {
    scanDuration: number;
    itemsFound: number;
    itemsSkipped: number;
  };
}

export interface LoadResult<T> {
  success: boolean;
  data?: T[];
  error?: AdapterError;
  pagination?: {
    hasMore: boolean;
    nextOffset: number;
    totalCount: number;
  };
}

export interface SearchResult<T> {
  success: boolean;
  data?: T[];
  error?: AdapterError;
  totalMatches?: number;
  searchDuration?: number;
}

export interface WriteResult<T> {
  success: boolean;
  data?: T;
  error?: AdapterError;
  warnings?: string[];
}

// ============================================================================
// OPTIONS
// ============================================================================

export interface LoadOptions {
  offset?: number;
  limit?: number;
  excludeSidechain?: boolean;
  includeRaw?: boolean; // Include originalFormat field
  includeMetadata?: boolean; // Include full metadata
  sortOrder?: 'asc' | 'desc';
}

export interface SearchOptions extends LoadOptions {
  caseSensitive?: boolean;
  useRegex?: boolean;
  maxResults?: number;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface AdapterError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  recoverable: boolean;
  retry?: RetryStrategy;
}

export interface RetryStrategy {
  shouldRetry: boolean;
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier?: number; // For exponential backoff
}

export interface ErrorContext {
  operation?: string;
  path?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface ErrorRecovery {
  recoverable: boolean;
  retry: RetryStrategy;
  message: string;
  suggestion?: string;
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface SessionStats {
  sessionId: string;
  messageCount: number;
  totalTokens?: number;
  duration: number; // milliseconds
  toolCallCount: number;
  errorCount: number;
  averageResponseTime?: number;
}

export interface ProjectStats {
  projectId: string;
  sessionCount: number;
  totalMessages: number;
  totalTokens?: number;
  activeTimeRange: {
    first: string;
    last: string;
  };
  topModels?: Array<{
    model: string;
    usage: number;
  }>;
}

// ============================================================================
// WRITE OPERATION TYPES (v1.6.0+)
// ============================================================================

/**
 * Message input for creating sessions (simplified format)
 */
export interface MessageInput {
  role: string; // "user" | "assistant" | "system"
  content: string | any[]; // Text or content array
  parent_id?: string;
  model?: string;
  tool_use?: Record<string, unknown>;
  tool_use_result?: Record<string, unknown>;
  usage?: TokenUsageInput;
}

export interface TokenUsageInput {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Request to create a new session
 */
export interface CreateSessionRequest {
  messages: MessageInput[];
  summary?: string;
  metadata?: Record<string, unknown>; // Provider-specific metadata
}

/**
 * Info about a created project
 */
export interface ProjectInfo {
  projectPath: string;
  projectName: string;
  projectId: string;
}

/**
 * Info about a created session
 */
export interface SessionInfo {
  sessionPath: string;
  sessionId: string;
  messageCount: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a standard adapter error
 */
export function createAdapterError(
  code: ErrorCode,
  message: string,
  details?: unknown,
  recoverable: boolean = true
): AdapterError {
  return {
    code,
    message,
    details,
    recoverable,
    retry: {
      shouldRetry: recoverable,
      maxAttempts: recoverable ? 3 : 0,
      delayMs: 1000,
    },
  };
}

/**
 * Check if error is a file system error
 */
export function isFileSystemError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('enoent') ||
    message.includes('eacces') ||
    message.includes('eperm') ||
    message.includes('not found') ||
    message.includes('permission denied')
  );
}

/**
 * Check if error is a parse error
 */
export function isParseError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('parse') ||
    message.includes('json') ||
    message.includes('syntax') ||
    message.includes('unexpected')
  );
}

/**
 * Classify error into ErrorCode
 */
export function classifyError(error: Error): ErrorCode {
  const message = (error.message || '').toLowerCase();

  // File system errors
  if (message.includes('enoent') || message.includes('not found')) {
    return ErrorCode.PATH_NOT_FOUND;
  }

  if (message.includes('eacces') || message.includes('eperm') || message.includes('permission')) {
    return ErrorCode.ACCESS_DENIED;
  }

  // Parse errors
  if (isParseError(error)) {
    return ErrorCode.PARSE_ERROR;
  }

  // Format errors
  if (message.includes('invalid') || message.includes('malformed')) {
    return ErrorCode.INVALID_FORMAT;
  }

  if (message.includes('corrupt')) {
    return ErrorCode.CORRUPT_DATA;
  }

  // Timeout
  if (message.includes('timeout')) {
    return ErrorCode.OPERATION_TIMEOUT;
  }

  return ErrorCode.UNKNOWN;
}
