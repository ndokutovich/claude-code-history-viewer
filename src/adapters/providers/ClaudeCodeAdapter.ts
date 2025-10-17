// ============================================================================
// CLAUDE CODE ADAPTER (v2.0.0)
// ============================================================================
// Adapter for Claude Code CLI conversation history (.claude/projects/*.jsonl)
// Implements IConversationAdapter to enable multi-provider support

import type {
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
} from '../base/IAdapter';
import { classifyError } from '../base/IAdapter';
import type {
  UniversalProject,
  UniversalSession,
  UniversalMessage,
  UniversalContent,
  ToolCall,
  ThinkingBlock,
} from '../../types/universal';
import {
  MessageRole as MsgRole,
  MessageType as MsgType,
  ContentType as ContType,
  MessageRole,
  MessageType,
} from '../../types/universal';
import type {
  ProviderDefinition,
} from '../../types/providers';
import { ProviderID, ErrorCode } from '../../types/providers';
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
        weight: 90,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'projects',
        weight: 90,
        required: true,
      },
      {
        type: 'file',
        pattern: '*.jsonl',
        weight: 70,
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
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid Claude Code folder (missing .claude/projects structure)',
          }],
          warnings: [],
        };
      }

      return {
        isValid: true,
        confidence: 100,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        isValid: false,
        confidence: 0,
        errors: [{
          code: errorCode,
          message: `Validation failed: ${(error as Error).message}`,
        }],
        warnings: [],
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
          missingPatterns: ['.claude directory', 'projects directory'],
        };
      }

      // High confidence for valid Claude folders
      return {
        canHandle: true,
        confidence: 95,
        matchedPatterns: ['.claude/projects directory structure'],
        missingPatterns: [],
      };
    } catch (error) {
      return {
        canHandle: false,
        confidence: 0,
        matchedPatterns: [],
        missingPatterns: [],
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
        metadata: {
          scanDuration: 0,
          itemsFound: universalProjects.length,
          itemsSkipped: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: classifyError(error as Error),
          message: (error as Error).message,
          recoverable: true,
        },
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
        metadata: {
          scanDuration: 0,
          itemsFound: universalSessions.length,
          itemsSkipped: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: classifyError(error as Error),
          message: (error as Error).message,
          recoverable: true,
        },
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
        pagination: {
          hasMore: messagePage.has_more,
          nextOffset: messagePage.next_offset,
          totalCount: messagePage.total_count,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: classifyError(error as Error),
          message: (error as Error).message,
          recoverable: true,
        },
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
          projects: filters.projects,
          session_id: filters.sessionId,
          message_type: filters.messageType,
          has_tool_calls: filters.hasToolCalls,
          has_errors: filters.hasErrors,
          date_range: filters.dateRange
            ? [filters.dateRange[0], filters.dateRange[1]]
            : undefined,
        },
      });

      // Convert to universal format
      const universalMessages: UniversalMessage[] = legacyMessages.map((msg, index) =>
        this.convertLegacyMessage(msg, msg.sessionId, index)
      );

      return {
        success: true,
        data: universalMessages,
        totalMatches: universalMessages.length,
        searchDuration: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: classifyError(error as Error),
          message: (error as Error).message,
          recoverable: true,
        },
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
        return 'offline';
      }

      // Try to scan projects as a health check
      const scanResult = await this.scanProjects(sourcePath, 'health-check');

      if (!scanResult.success) {
        return 'degraded';
      }

      return 'healthy';
    } catch {
      return 'offline';
    }
  }

  // ------------------------------------------------------------------------
  // ERROR RECOVERY (REQUIRED)
  // ------------------------------------------------------------------------

  handleError(error: Error, _context: ErrorContext): ErrorRecovery {
    const errorCode = classifyError(error);

    switch (errorCode) {
      case ErrorCode.PATH_NOT_FOUND:
        return {
          recoverable: false,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'The Claude folder or file was not found. Please check the path.',
        };

      case ErrorCode.ACCESS_DENIED:
        return {
          recoverable: false,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'Permission denied. Please check file permissions.',
        };

      case ErrorCode.INVALID_FORMAT:
      case ErrorCode.PARSE_ERROR:
        return {
          recoverable: true,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'Some messages have invalid format and will be skipped.',
          suggestion: 'Try reloading or check the data integrity.',
        };

      case ErrorCode.CORRUPT_DATA:
        return {
          recoverable: true,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: 'Some data is corrupted and will be skipped.',
          suggestion: 'Check the source files for corruption.',
        };

      case ErrorCode.OPERATION_TIMEOUT:
        return {
          recoverable: true,
          retry: {
            shouldRetry: true,
            maxAttempts: 3,
            delayMs: 2000,
            backoffMultiplier: 1.5,
          },
          message: 'Operation timed out. Retrying...',
        };

      default:
        return {
          recoverable: false,
          retry: {
            shouldRetry: false,
            maxAttempts: 0,
            delayMs: 0,
          },
          message: `Unexpected error: ${error.message}`,
          suggestion: 'Please report this issue if it persists.',
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
      totalMessages: legacy.message_count,
      firstActivityAt: legacy.lastModified, // Approximate
      lastActivityAt: legacy.lastModified,
      metadata: {
        checksum: this.generateChecksum(legacy.path + legacy.lastModified),
      },
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
    const role = this.mapRole(legacy.type);

    // Determine message type
    const messageType = this.mapMessageType(legacy.type);

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
      parentId: legacy.parentUuid || undefined,

      // METADATA (OPTIONAL)
      model: legacy.model || undefined,
      tokens,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      thinking,

      // RAW PRESERVATION (REQUIRED)
      originalFormat: 'claude-code-jsonl',
      providerMetadata: {
        stopReason: legacy.stop_reason,
        isSidechain: legacy.isSidechain,
        projectPath: legacy.projectPath,
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
        type: ContType.TEXT,
        data: { text: legacy.content },
        encoding: 'plain',
        mimeType: 'text/plain',
      });
      return contents;
    }

    // Handle array content
    if (Array.isArray(legacy.content)) {
      for (const item of legacy.content) {
        if (typeof item === 'string') {
          contents.push({
            type: ContType.TEXT,
            data: { text: item },
            encoding: 'plain',
            mimeType: 'text/plain',
          });
        } else if (typeof item === 'object' && item !== null) {
          const contentType = (item as any).type;

          switch (contentType) {
            case 'text':
              contents.push({
                type: ContType.TEXT,
                data: { text: (item as any).text || '' },
                encoding: 'plain',
                mimeType: 'text/plain',
              });
              break;

            case 'tool_use':
              contents.push({
                type: ContType.TOOL_USE,
                data: {
                  id: (item as any).id,
                  name: (item as any).name,
                  input: (item as any).input,
                },
                encoding: 'json',
                mimeType: 'application/json',
              });
              break;

            case 'tool_result':
              contents.push({
                type: ContType.TOOL_RESULT,
                data: {
                  toolUseId: (item as any).tool_use_id,
                  content: (item as any).content,
                  isError: (item as any).is_error || false,
                },
                encoding: 'json',
                mimeType: 'application/json',
              });
              break;

            case 'thinking':
              contents.push({
                type: ContType.THINKING,
                data: {
                  content: (item as any).thinking || '',
                  signature: (item as any).signature,
                },
                encoding: 'plain',
                mimeType: 'text/plain',
              });
              break;

            default:
              // Unknown content type - preserve as metadata
              contents.push({
                type: ContType.TEXT,
                data: { text: JSON.stringify(item) },
                encoding: 'json',
                mimeType: 'application/json',
              });
          }
        }
      }
    }

    // Handle JSON object content
    if (typeof legacy.content === 'object' && !Array.isArray(legacy.content)) {
      contents.push({
        type: ContType.TEXT,
        data: { text: JSON.stringify(legacy.content) },
        encoding: 'json',
        mimeType: 'application/json',
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
            output: undefined, // Will be filled from tool_use_result
            status: 'pending',
          });
        }
      }
    }

    // Extract from toolUse field
    if (legacy.toolUse) {
      // Handle toolUse structure (if different from content)
      // TODO: Parse legacy.toolUse structure if needed
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
        return MsgRole.USER;
      case 'assistant':
        return MsgRole.ASSISTANT;
      case 'system':
        return MsgRole.SYSTEM;
      case 'function':
        return MsgRole.FUNCTION;
      default:
        return MsgRole.USER; // Default fallback
    }
  }

  private mapMessageType(type: string): MessageType {
    switch (type.toLowerCase()) {
      case 'summary':
        return MsgType.SUMMARY;
      case 'sidechain':
        return MsgType.SIDECHAIN;
      default:
        return MsgType.MESSAGE;
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
