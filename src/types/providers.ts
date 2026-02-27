// Provider type system and capabilities
// FAIL FAST: All providers must implement complete definitions

// ============================================================================
// PROVIDER DEFINITION
// ============================================================================

export interface ProviderDefinition {
  id: string; // Unique identifier (kebab-case)
  name: string; // Display name
  version: string; // Provider adapter version
  author: string;
  description: string;

  // Capabilities (REQUIRED)
  capabilities: ProviderCapabilities;

  // File patterns for detection
  detectionPatterns: DetectionPattern[];

  // Path configuration (REQUIRED for write operations)
  // Defines directory structure relative to source root
  pathConfig: {
    projectsPath: string; // Relative path from source root to projects directory
                          // E.g., "projects" for Claude Code → source.path + "/projects/"
                          // E.g., "User/workspaceStorage" for Cursor
  };

  // Icon/branding
  icon: string; // Emoji or icon identifier
  color: string; // Hex color for UI

  // Documentation
  documentationUrl?: string;
  supportUrl?: string;
}

// ============================================================================
// PROVIDER CAPABILITIES
// ============================================================================

export interface ProviderCapabilities {
  // Core features
  supportsThinking: boolean; // Extended thinking blocks
  supportsToolCalls: boolean; // Tool/function calls
  supportsBranching: boolean; // Conversation branches
  supportsStreaming: boolean; // Streaming responses
  supportsImages: boolean; // Image content
  supportsFiles: boolean; // File operations

  // Search & Analytics
  supportsFullTextSearch: boolean; // Can search message content
  supportsTokenCounting: boolean; // Provides token usage
  supportsModelInfo: boolean; // Provides model information

  // Data access
  requiresAuth: boolean; // Needs authentication
  requiresNetwork: boolean; // Needs network access
  isReadOnly: boolean; // Cannot modify data

  // Write operations (v1.6.0+)
  supportsProjectCreation?: boolean; // Can create new projects
  supportsSessionCreation?: boolean; // Can create new sessions
  supportsMessageAppending?: boolean; // Can append to existing sessions

  // Performance hints
  maxMessagesPerRequest: number; // Max messages to load at once
  preferredBatchSize: number; // Optimal batch size
  supportsPagination: boolean; // Supports offset/limit
}

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

export interface DetectionPattern {
  type: 'file' | 'directory' | 'content';
  pattern: string; // glob pattern or regex
  weight: number; // 0-100, higher = more confident
  required: boolean; // Must match for provider to be valid
}

// ============================================================================
// ENUMS
// ============================================================================

export enum ProviderID {
  CLAUDE_CODE = 'claude-code',
  CURSOR = 'cursor',
  GEMINI = 'gemini', // v1.7.0 - Gemini CLI support
  CODEX = 'codex',   // v1.8.0 - Codex CLI support
  COPILOT = 'copilot',
  CLINE = 'cline',
  AIDER = 'aider',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  FUNCTION = 'function',
}

export enum MessageType {
  MESSAGE = 'message',
  SUMMARY = 'summary',
  BRANCH = 'branch',
  SIDECHAIN = 'sidechain',
  ERROR = 'error',
}

export enum ContentType {
  TEXT = 'text',
  CODE = 'code',
  IMAGE = 'image',
  FILE = 'file',
  TOOL_USE = 'tool_use',
  TOOL_RESULT = 'tool_result',
  THINKING = 'thinking',
  WEB_SEARCH = 'web_search',
  COMMAND = 'command',
}

// ============================================================================
// ERROR CODES
// ============================================================================

export enum ErrorCode {
  // File system
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PATH_NOT_ACCESSIBLE = 'PATH_NOT_ACCESSIBLE',

  // Format
  INVALID_FORMAT = 'INVALID_FORMAT',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  CORRUPT_DATA = 'CORRUPT_DATA',

  // Data
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_DATA = 'INVALID_DATA',
  PARSE_ERROR = 'PARSE_ERROR',

  // Runtime
  ADAPTER_NOT_INITIALIZED = 'ADAPTER_NOT_INITIALIZED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',

  // Provider
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationError {
  code: ErrorCode;
  message: string;
  path?: string; // File path that caused error
  details?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-100
  providerId?: string;
  version?: string;
  errors: ValidationError[];
  warnings: string[];
}

// ============================================================================
// DETECTION
// ============================================================================

export interface DetectionScore {
  canHandle: boolean;
  confidence: number; // 0-100
  matchedPatterns: string[];
  missingPatterns: string[];
}

export interface DetectionResult {
  success: boolean;
  providerId?: string;
  confidence?: number;
  error?: string;
  allMatches?: Array<{
    providerId: string;
    confidence: number;
  }>;
}
