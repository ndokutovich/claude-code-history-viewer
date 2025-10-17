// ============================================================================
// CLAUDE CODE ADAPTER (v2.0.0)
// ============================================================================
// Adapter for Claude Code CLI conversation history (.claude/projects/*.jsonl)
// Implements IConversationAdapter to enable multi-provider support

import {
  IConversationAdapter,
  ValidationResult,
  DetectionScore,
  ScanResult,
  LoadResult,
  SearchResult,
  LoadOptions,
  SearchFilters as AdapterSearchFilters,
  HealthStatus,
  ErrorRecovery,
  ErrorContext,
  classifyError,
} from '../base/IAdapter';
import {
  UniversalProject,
  UniversalSession,
  UniversalMessage,
  MessageRole,
  MessageType,
  ContentType,
  UniversalContent,
  ToolCall,
  ThinkingBlock,
  TokenUsage,
  ErrorCode,
} from '../../types/universal';
import {
  ProviderDefinition,
  ProviderCapabilities,
  ProviderID,
  DetectionPattern,
} from '../../types/providers';
import { invoke } from '@tauri-apps/api/core';

// Legacy types for backwards compatibility (will be phased out)
import type { ClaudeProject, ClaudeSession, ClaudeMessage, MessagePage } from '../../types/index';

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class ClaudeCodeAdapter implements IConversationAdapter {
  // ------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // ------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.CLAUDE_CODE;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.CLAUDE_CODE,
    name: 'Claude Code',
    version: '1.0.0',
    author: 'Anthropic',
    description: 'Official Anthropic Claude Code CLI conversation history',
    capabilities: {
      supportsThinking: true,
      supportsToolCalls: true,
      supportsBranching: true,
      supportsStreaming: false,
      supportsImages: false, // Data structure supports it, no UI renderer yet
      supportsFiles: true,
      supportsFullTextSearch: true,
      supportsTokenCounting: true,
      supportsModelInfo: true,
      requiresAuth: false,
      requiresNetwork: false,
      isReadOnly: true,
      maxMessagesPerRequest: 10000,
      preferredBatchSize: 100,
      supportsPagination: true,
    },
    detectionPatterns: [
      {
        type: 'directory',
        pattern: '.claude',
        location: 'root',
        required: true,
      },
      {
        type: 'directory',
        pattern: 'projects',
        location: '.claude',
        required: true,
      },
      {
        type: 'file',
        pattern: '*.jsonl',
        location: '.claude/projects/*',
        required: false,
      },
    ],
    icon: 'claude-logo',
    color: '#D97706', // Claude brand amber
  };

  private initialized = false;

  // ------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // ------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('ClaudeCodeAdapter already initialized');
    }

    // Verify Tauri is available
    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize ClaudeCodeAdapter');
    }

    this.initialized = true;
    console.log('✅ ClaudeCodeAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('🗑️  ClaudeCodeAdapter disposed');
  }

  // ------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // ------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      // Call Rust backend validation
      const isValid = await invoke<boolean>('validate_claude_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          errors: ['Not a valid Claude Code folder (missing .claude/projects structure)'],
          warnings: [],
        };
      }

      return {
        isValid: true,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        isValid: false,
        errors: [`Validation failed: ${(error as Error).message}`],
        warnings: [],
        errorCode,
      };
    }
  }

  async canHandle(path: string): Promise<DetectionScore> {
    try {
      const validation = await this.validate(path);

      if (!validation.isValid) {
        return {
          canHandle: false,
          confidence: 0,
          matchedPatterns: [],
          reason: validation.errors.join('; '),
        };
      }

      // High confidence for valid Claude folders
      return {
        canHandle: true,
        confidence: 0.95,
        matchedPatterns: ['.claude/projects directory structure'],
        reason: 'Valid Claude Code conversation history folder',
      };
    } catch (error) {
      return {
        canHandle: false,
        confidence: 0,
        matchedPatterns: [],
        reason: `Detection failed: ${(error as Error).message}`,
      };
    }
  }

  // ------------------------------------------------------------------------
  // DISCOVERY (REQUIRED)
  // ------------------------------------------------------------------------

  async scanProjects(sourcePath: string, sourceId: string): Promise<ScanResult<UniversalProject>> {
    this.ensureInitialized();

    try {
      // Call existing Rust command
      const legacyProjects = await invoke<ClaudeProject[]>('scan_projects', {
        claudePath: sourcePath,
      });

      // Convert to universal format
      const universalProjects: UniversalProject[] = legacyProjects.map((project) =>
        this.convertLegacyProject(project, sourceId)
      );

      return {
        success: true,
        data: universalProjects,
        count: universalProjects.length,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        data: [],
        count: 0,
        errors: [(error as Error).message],
        warnings: [],
        errorCode,
      };
    }
  }

  async loadSessions(
    projectPath: string,
    projectId: string,
    sourceId: string
  ): Promise<ScanResult<UniversalSession>> {
    this.ensureInitialized();

    try {
      // Call existing Rust command
      const legacySessions = await invoke<ClaudeSession[]>('load_project_sessions', {
        projectPath,
        excludeSidechain: false, // Load all sessions, let UI filter
      });

      // Convert to universal format
      const universalSessions: UniversalSession[] = legacySessions.map((session) =>
        this.convertLegacySession(session, projectId, sourceId)
      );

      return {
        success: true,
        data: universalSessions,
        count: universalSessions.length,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        data: [],
        count: 0,
        errors: [(error as Error).message],
        warnings: [],
        errorCode,
      };
    }
  }

  // ------------------------------------------------------------------------
  // DATA LOADING (REQUIRED)
  // ------------------------------------------------------------------------

  async loadMessages(
    sessionPath: string,
    sessionId: string,
    options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();

    try {
      // Use paginated loading for efficiency
      const messagePage = await invoke<MessagePage>('load_session_messages_paginated', {
        sessionPath,
        offset: options.offset || 0,
        limit: options.limit || 100,
        excludeSidechain: options.excludeSidechain || false,
      });

      // Convert to universal format
      const universalMessages: UniversalMessage[] = messagePage.messages.map((msg, index) =>
        this.convertLegacyMessage(msg, sessionId, index)
      );

      return {
        success: true,
        data: universalMessages,
        count: universalMessages.length,
        totalCount: messagePage.total_count,
        hasMore: messagePage.has_more,
        nextOffset: messagePage.next_offset,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        data: [],
        count: 0,
        totalCount: 0,
        hasMore: false,
        nextOffset: 0,
        errors: [(error as Error).message],
        warnings: [],
        errorCode,
      };
    }
  }

  // ------------------------------------------------------------------------
  // SEARCH (REQUIRED)
  // ------------------------------------------------------------------------

  async searchMessages(
    sourcePaths: string[],
    query: string,
    filters: AdapterSearchFilters
  ): Promise<SearchResult<UniversalMessage>> {
    this.ensureInitialized();

    if (sourcePaths.length === 0) {
      throw new Error('At least one source path required for search');
    }

    if (sourcePaths.length > 1) {
      throw new Error('ClaudeCodeAdapter does not support multi-source search yet');
    }

    try {
      // Call existing Rust search command
      const legacyMessages = await invoke<ClaudeMessage[]>('search_messages', {
        claudePath: sourcePaths[0],
        query,
        filters: {
          projects: filters.projectIds,
          session_id: filters.sessionIds?.[0],
          message_type: filters.messageTypes?.[0],
          has_tool_calls: filters.hasToolCalls,
          has_errors: filters.hasErrors,
          date_range: filters.dateRange
            ? [filters.dateRange.start, filters.dateRange.end]
            : undefined,
        },
      });

      // Convert to universal format
      const universalMessages: UniversalMessage[] = legacyMessages.map((msg, index) =>
        this.convertLegacyMessage(msg, msg.session_id, index)
      );

      return {
        success: true,
        data: universalMessages,
        count: universalMessages.length,
        query,
        filters,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        data: [],
        count: 0,
        query,
        filters,
        errors: [(error as Error).message],
        warnings: [],
        errorCode,
      };
    }
  }

  // ------------------------------------------------------------------------
  // HEALTH CHECK (REQUIRED)
  // ------------------------------------------------------------------------

  async healthCheck(sourcePath: string): Promise<HealthStatus> {
    try {
      const validation = await this.validate(sourcePath);

      if (!validation.isValid) {
        return HealthStatus.OFFLINE;
      }

      // Try to scan projects as a health check
      const scanResult = await this.scanProjects(sourcePath, 'health-check');

      if (!scanResult.success) {
        return HealthStatus.DEGRADED;
      }

      return HealthStatus.HEALTHY;
    } catch {
      return HealthStatus.OFFLINE;
    }
  }

  // ------------------------------------------------------------------------
  // ERROR RECOVERY (REQUIRED)
  // ------------------------------------------------------------------------

  handleError(error: Error, context: ErrorContext): ErrorRecovery {
    const errorCode = classifyError(error);

    switch (errorCode) {
      case ErrorCode.PATH_NOT_FOUND:
        return {
          canRecover: false,
          suggestedAction: 'retry',
          userMessage: 'The Claude folder or file was not found. Please check the path.',
          shouldRetry: false,
          retryAfterMs: 0,
        };

      case ErrorCode.ACCESS_DENIED:
        return {
          canRecover: false,
          suggestedAction: 'manual',
          userMessage: 'Permission denied. Please check file permissions.',
          shouldRetry: false,
          retryAfterMs: 0,
        };

      case ErrorCode.INVALID_FORMAT:
      case ErrorCode.PARSE_ERROR:
        return {
          canRecover: true,
          suggestedAction: 'skip',
          userMessage: 'Some messages have invalid format and will be skipped.',
          shouldRetry: false,
          retryAfterMs: 0,
        };

      case ErrorCode.CORRUPT_DATA:
        return {
          canRecover: true,
          suggestedAction: 'skip',
          userMessage: 'Some data is corrupted and will be skipped.',
          shouldRetry: false,
          retryAfterMs: 0,
        };

      case ErrorCode.NETWORK_ERROR:
        return {
          canRecover: true,
          suggestedAction: 'retry',
          userMessage: 'Network error. Retrying...',
          shouldRetry: true,
          retryAfterMs: 2000,
        };

      default:
        return {
          canRecover: false,
          suggestedAction: 'manual',
          userMessage: `Unexpected error: ${error.message}`,
          shouldRetry: false,
          retryAfterMs: 0,
        };
    }
  }

  // ------------------------------------------------------------------------
  // CONVERSION HELPERS (PRIVATE)
  // ------------------------------------------------------------------------

  private convertLegacyProject(legacy: ClaudeProject, sourceId: string): UniversalProject {
    return {
      id: legacy.path, // Use path as unique ID
      sourceId,
      providerId: this.providerId,
      name: legacy.name,
      path: legacy.path,
      sessionCount: legacy.session_count,
      messageCount: legacy.message_count,
      firstSessionAt: legacy.last_modified, // Approximate
      lastSessionAt: legacy.last_modified,
      totalTokens: undefined, // Not available in legacy format
      toolCallCount: 0, // Not available in legacy format
      errorCount: 0, // Not available in legacy format
      metadata: {},
      checksum: this.generateChecksum(legacy.path + legacy.last_modified),
    };
  }

  private convertLegacySession(
    legacy: ClaudeSession,
    projectId: string,
    sourceId: string
  ): UniversalSession {
    return {
      id: legacy.session_id,
      projectId,
      sourceId,
      providerId: this.providerId,
      title: legacy.summary || 'Untitled Session',
      messageCount: legacy.message_count,
      firstMessageAt: legacy.first_message_time,
      lastMessageAt: legacy.last_message_time,
      duration: this.calculateDuration(legacy.first_message_time, legacy.last_message_time),
      totalTokens: undefined, // Would need to load messages to calculate
      toolCallCount: legacy.has_tool_use ? -1 : 0, // -1 means "has but count unknown"
      errorCount: legacy.has_errors ? -1 : 0,
      metadata: {
        filePath: legacy.file_path,
        actualSessionId: legacy.actual_session_id,
        projectName: legacy.project_name,
      },
      checksum: this.generateChecksum(legacy.file_path + legacy.last_modified),
    };
  }

  private convertLegacyMessage(
    legacy: ClaudeMessage,
    sessionId: string,
    sequenceNumber: number
  ): UniversalMessage {
    // Determine role
    const role = this.mapRole(legacy.role || legacy.message_type);

    // Determine message type
    const messageType = this.mapMessageType(legacy.message_type);

    // Convert content
    const content = this.convertContent(legacy);

    // Extract tool calls
    const toolCalls = this.extractToolCalls(legacy);

    // Extract thinking
    const thinking = this.extractThinking(legacy);

    // Extract tokens
    const tokens = legacy.usage
      ? {
          inputTokens: legacy.usage.input_tokens || 0,
          outputTokens: legacy.usage.output_tokens || 0,
          cacheCreationTokens: legacy.usage.cache_creation_input_tokens || 0,
          cacheReadTokens: legacy.usage.cache_read_input_tokens || 0,
          totalTokens:
            (legacy.usage.input_tokens || 0) +
            (legacy.usage.output_tokens || 0) +
            (legacy.usage.cache_creation_input_tokens || 0) +
            (legacy.usage.cache_read_input_tokens || 0),
        }
      : undefined;

    return {
      // CORE IDENTITY (REQUIRED)
      id: legacy.uuid,
      sessionId,
      projectId: '', // Will be set by caller
      sourceId: '', // Will be set by caller
      providerId: this.providerId,

      // TEMPORAL (REQUIRED)
      timestamp: legacy.timestamp,
      sequenceNumber,

      // ROLE & TYPE (REQUIRED)
      role,
      messageType,

      // CONTENT (REQUIRED)
      content,

      // HIERARCHY (OPTIONAL)
      parentId: legacy.parent_uuid || undefined,

      // METADATA (OPTIONAL)
      model: legacy.model || undefined,
      tokens,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      thinking,

      // RAW PRESERVATION (REQUIRED)
      originalFormat: 'claude-code-jsonl',
      providerMetadata: {
        messageId: legacy.message_id,
        stopReason: legacy.stop_reason,
        isSidechain: legacy.is_sidechain,
        projectPath: legacy.project_path,
      },
    };
  }

  private convertContent(legacy: ClaudeMessage): UniversalContent[] {
    const contents: UniversalContent[] = [];

    if (!legacy.content) {
      return contents;
    }

    // Handle string content
    if (typeof legacy.content === 'string') {
      contents.push({
        type: ContentType.TEXT,
        text: legacy.content,
      });
      return contents;
    }

    // Handle array content
    if (Array.isArray(legacy.content)) {
      for (const item of legacy.content) {
        if (typeof item === 'string') {
          contents.push({
            type: ContentType.TEXT,
            text: item,
          });
        } else if (typeof item === 'object' && item !== null) {
          const contentType = (item as any).type;

          switch (contentType) {
            case 'text':
              contents.push({
                type: ContentType.TEXT,
                text: (item as any).text || '',
              });
              break;

            case 'tool_use':
              contents.push({
                type: ContentType.TOOL_USE,
                toolUse: {
                  id: (item as any).id,
                  name: (item as any).name,
                  input: (item as any).input,
                },
              });
              break;

            case 'tool_result':
              contents.push({
                type: ContentType.TOOL_RESULT,
                toolResult: {
                  toolUseId: (item as any).tool_use_id,
                  content: (item as any).content,
                  isError: (item as any).is_error || false,
                },
              });
              break;

            case 'thinking':
              contents.push({
                type: ContentType.THINKING,
                thinking: {
                  content: (item as any).thinking || '',
                  signature: (item as any).signature,
                },
              });
              break;

            default:
              // Unknown content type - preserve as metadata
              contents.push({
                type: ContentType.TEXT,
                text: JSON.stringify(item),
              });
          }
        }
      }
    }

    // Handle JSON object content
    if (typeof legacy.content === 'object' && !Array.isArray(legacy.content)) {
      contents.push({
        type: ContentType.TEXT,
        text: JSON.stringify(legacy.content),
      });
    }

    return contents;
  }

  private extractToolCalls(legacy: ClaudeMessage): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    // Extract from content array
    if (Array.isArray(legacy.content)) {
      for (const item of legacy.content) {
        if (typeof item === 'object' && (item as any).type === 'tool_use') {
          toolCalls.push({
            id: (item as any).id,
            name: (item as any).name,
            input: (item as any).input,
            result: undefined, // Will be filled from tool_use_result
          });
        }
      }
    }

    // Extract from tool_use field
    if (legacy.tool_use) {
      // Handle tool_use structure (if different from content)
      // TODO: Parse legacy.tool_use structure if needed
    }

    return toolCalls;
  }

  private extractThinking(legacy: ClaudeMessage): ThinkingBlock | undefined {
    // Extract from content array
    if (Array.isArray(legacy.content)) {
      for (const item of legacy.content) {
        if (typeof item === 'object' && (item as any).type === 'thinking') {
          return {
            content: (item as any).thinking || '',
            signature: (item as any).signature,
          };
        }
      }
    }

    return undefined;
  }

  private mapRole(role: string | undefined): MessageRole {
    switch (role?.toLowerCase()) {
      case 'user':
        return MessageRole.USER;
      case 'assistant':
        return MessageRole.ASSISTANT;
      case 'system':
        return MessageRole.SYSTEM;
      case 'function':
        return MessageRole.FUNCTION;
      default:
        return MessageRole.USER; // Default fallback
    }
  }

  private mapMessageType(type: string): MessageType {
    switch (type.toLowerCase()) {
      case 'summary':
        return MessageType.SUMMARY;
      case 'sidechain':
        return MessageType.SIDECHAIN;
      default:
        return MessageType.MESSAGE;
    }
  }

  private calculateDuration(start: string, end: string): number {
    try {
      const startTime = new Date(start).getTime();
      const endTime = new Date(end).getTime();
      return endTime - startTime;
    } catch {
      return 0;
    }
  }

  private generateChecksum(input: string): string {
    // Simple hash function (for now)
    // TODO: Use proper crypto hash in production
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ClaudeCodeAdapter not initialized. Call initialize() first.');
    }
  }
}
