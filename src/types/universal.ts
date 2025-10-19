// Universal message format that ALL adapters translate to
// FAIL FAST: All required fields must be present, optional fields explicitly marked

import { MessageRole, MessageType, ContentType } from './providers';

// ============================================================================
// UNIVERSAL MESSAGE
// ============================================================================

export interface UniversalMessage {
  // CORE IDENTITY (REQUIRED)
  id: string;
  sessionId: string;
  projectId: string;
  sourceId: string;
  providerId: string;

  // TEMPORAL (REQUIRED)
  timestamp: string; // ISO 8601 ONLY
  sequenceNumber: number; // Order within session

  // ROLE & TYPE (REQUIRED)
  role: MessageRole;
  messageType: MessageType;

  // CONTENT (REQUIRED - can be empty array)
  content: UniversalContent[];

  // HIERARCHY (OPTIONAL but validated)
  parentId?: string;
  depth?: number;
  branchId?: string;

  // METADATA (OPTIONAL but typed)
  model?: string;
  tokens?: TokenUsage;
  toolCalls?: ToolCall[];
  thinking?: ThinkingBlock;
  attachments?: Attachment[];
  errors?: ErrorInfo[];

  // RAW PRESERVATION (REQUIRED)
  originalFormat: string; // JSON string of original
  providerMetadata: Record<string, unknown>;
}

// ============================================================================
// UNIVERSAL CONTENT
// ============================================================================

export interface UniversalContent {
  type: ContentType;
  data: unknown; // VALIDATED by type
  encoding?: 'plain' | 'base64' | 'json';
  mimeType?: string;
  size?: number;
  hash?: string; // SHA-256 for verification
}

// ============================================================================
// UNIVERSAL SESSION
// ============================================================================

export interface UniversalSession {
  id: string;
  projectId: string;
  sourceId: string;
  providerId: string;

  // Session Info
  title: string;
  description?: string;

  // Stats (REQUIRED, computed)
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  duration: number; // milliseconds

  // Aggregates
  totalTokens?: TokenUsage;
  toolCallCount: number;
  errorCount: number;

  // Metadata
  metadata: Record<string, unknown>;
  checksum: string; // For change detection
}

// ============================================================================
// UNIVERSAL PROJECT
// ============================================================================

export interface UniversalProject {
  id: string;
  sourceId: string;
  providerId: string;

  name: string;
  path: string; // Absolute path

  // Stats
  sessionCount: number;
  totalMessages: number;
  firstActivityAt?: string;
  lastActivityAt?: string;

  // Provider-specific
  metadata: Record<string, unknown>;
}

// ============================================================================
// UNIVERSAL SOURCE
// ============================================================================

export interface UniversalSource {
  id: string; // UUID v4
  name: string;
  path: string; // Absolute path
  providerId: string;

  // Status
  isDefault: boolean;
  isAvailable: boolean; // Path exists and readable
  lastValidation: string;
  validationError?: string;

  // Timestamps
  addedAt: string;
  lastScanAt?: string;
  lastModifiedAt?: string;

  // Stats (cached)
  stats: SourceStats;

  // Provider config
  providerConfig: Record<string, unknown>;

  // Health check
  healthStatus: HealthStatus;
}

export interface SourceStats {
  projectCount: number;
  sessionCount: number;
  messageCount: number;
  totalSize: number; // bytes
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  serviceTier?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  status: 'pending' | 'success' | 'error';
}

export interface ThinkingBlock {
  content: string;
  signature?: string;
  model?: string;
}

export interface Attachment {
  type: 'file' | 'image' | 'url';
  name: string;
  path?: string;
  url?: string;
  size?: number;
  mimeType?: string;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'offline';

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  version?: string;
}

export interface SearchFilters {
  dateRange?: [Date, Date];
  sources?: string[];
  projects?: string[];
  sessionId?: string;
  messageType?: MessageType;
  role?: MessageRole;
  hasToolCalls?: boolean;
  hasErrors?: boolean;
  hasFileChanges?: boolean;
  model?: string;
}

// ============================================================================
// RE-EXPORTS (for convenience)
// ============================================================================

export { MessageRole, MessageType, ContentType } from './providers';
export type { ValidationResult, DetectionScore, ValidationError } from './providers';
