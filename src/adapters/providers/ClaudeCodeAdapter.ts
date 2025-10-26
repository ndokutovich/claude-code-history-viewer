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
  WriteResult,
  ProjectInfo,
  SessionInfo,
  CreateSessionRequest,
  MessageInput,
} from '../base/IAdapter';
import { classifyError } from '../base/IAdapter';
import type {
  UniversalProject,
  UniversalSession,
  UniversalMessage,
} from '../../types/universal';
import type {
  ProviderDefinition,
} from '../../types/providers';
import { ProviderID, ErrorCode } from '../../types/providers';
import { invoke } from '@tauri-apps/api/core';

// UI display types (projects/sessions use UI format for component compatibility)
import type { UIProject, UISession, MessagePage } from '../../types/index';

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
      isReadOnly: false, // v1.6.0+: Now supports writing
      supportsProjectCreation: true, // v1.6.0+
      supportsSessionCreation: true, // v1.6.0+
      supportsMessageAppending: true, // v1.6.0+
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
      // Call existing Rust command (returns UI format from backend for backward compat)
      const uiProjects = await invoke<UIProject[]>('scan_projects', {
        claudePath: sourcePath,
      });

      // Convert UI format to universal format
      const universalProjects: UniversalProject[] = uiProjects.map((project) =>
        this.convertUIProject(project, sourceId)
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
      // Call existing Rust command (returns UI format from backend for backward compat)
      const uiSessions = await invoke<UISession[]>('load_project_sessions', {
        projectPath,
        excludeSidechain: false, // Load all sessions, let UI filter
      });

      // Convert UI format to universal format
      const universalSessions: UniversalSession[] = uiSessions.map((session) =>
        this.convertUISession(session, projectId, sourceId)
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
    _sessionId: string, // Unused - backend provides session ID
    options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();

    try {
      // Backend now returns UniversalMessage directly - no conversion needed!
      const messagePage = await invoke<MessagePage>('load_session_messages_paginated', {
        sessionPath,
        offset: options.offset || 0,
        limit: options.limit || 100,
        excludeSidechain: options.excludeSidechain || false,
      });

      // Messages are already in universal format from backend
      return {
        success: true,
        data: messagePage.messages,
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
      // Backend now returns UniversalMessage directly
      const universalMessages = await invoke<UniversalMessage[]>('search_messages', {
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
  // WRITE OPERATIONS (OPTIONAL - v1.6.0+)
  // ------------------------------------------------------------------------

  async createProject(
    sourcePath: string,
    projectName: string
  ): Promise<WriteResult<ProjectInfo>> {
    this.ensureInitialized();

    try {
      const response = await invoke<{ project_path: string; project_name: string }>(
        'create_claude_project',
        {
          request: {
            name: projectName,
            parent_path: sourcePath, // Use source path as parent
          },
        }
      );

      return {
        success: true,
        data: {
          projectPath: response.project_path,
          projectName: response.project_name,
          projectId: response.project_path,
        },
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : String(error),
          recoverable: errorCode !== ErrorCode.ACCESS_DENIED,
          retry: {
            shouldRetry: errorCode === ErrorCode.OPERATION_TIMEOUT,
            maxAttempts: 3,
            delayMs: 1000,
          },
        },
      };
    }
  }

  async createSession(
    projectPath: string,
    request: CreateSessionRequest
  ): Promise<WriteResult<SessionInfo>> {
    this.ensureInitialized();

    try {
      const response = await invoke<{
        session_path: string;
        session_id: string;
        message_count: number;
      }>('create_claude_session', {
        request: {
          project_path: projectPath,
          messages: request.messages,
          summary: request.summary,
        },
      });

      return {
        success: true,
        data: {
          sessionPath: response.session_path,
          sessionId: response.session_id,
          messageCount: response.message_count,
        },
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : String(error),
          recoverable: errorCode !== ErrorCode.ACCESS_DENIED,
          retry: {
            shouldRetry: errorCode === ErrorCode.OPERATION_TIMEOUT,
            maxAttempts: 3,
            delayMs: 1000,
          },
        },
      };
    }
  }

  async appendMessages(
    sessionPath: string,
    messages: MessageInput[]
  ): Promise<WriteResult<number>> {
    this.ensureInitialized();

    try {
      const messageCount = await invoke<number>('append_to_claude_session', {
        sessionPath,
        messages,
      });

      return {
        success: true,
        data: messageCount,
      };
    } catch (error) {
      const errorCode = classifyError(error as Error);
      return {
        success: false,
        error: {
          code: errorCode,
          message: error instanceof Error ? error.message : String(error),
          recoverable: errorCode !== ErrorCode.ACCESS_DENIED,
          retry: {
            shouldRetry: errorCode === ErrorCode.OPERATION_TIMEOUT,
            maxAttempts: 3,
            delayMs: 1000,
          },
        },
      };
    }
  }

  // ------------------------------------------------------------------------
  // CONVERSION HELPERS (PRIVATE)
  // ------------------------------------------------------------------------

  private convertUIProject(uiProject: UIProject, sourceId: string): UniversalProject {
    return {
      id: uiProject.path, // Use path as unique ID
      sourceId,
      providerId: this.providerId,
      name: uiProject.name,
      path: uiProject.path,
      sessionCount: uiProject.session_count,
      totalMessages: uiProject.message_count,
      firstActivityAt: uiProject.lastModified, // Approximate
      lastActivityAt: uiProject.lastModified,
      metadata: {
        checksum: this.generateChecksum(uiProject.path + uiProject.lastModified),
      },
    };
  }

  private convertUISession(
    uiSession: UISession,
    projectId: string,
    sourceId: string
  ): UniversalSession {
    return {
      id: uiSession.session_id,
      projectId,
      sourceId,
      providerId: this.providerId,
      title: uiSession.summary || 'Untitled Session',
      messageCount: uiSession.message_count,
      firstMessageAt: uiSession.first_message_time,
      lastMessageAt: uiSession.last_message_time,
      duration: this.calculateDuration(uiSession.first_message_time, uiSession.last_message_time),
      totalTokens: undefined, // Would need to load messages to calculate
      toolCallCount: uiSession.has_tool_use ? -1 : 0, // -1 means "has but count unknown"
      errorCount: uiSession.has_errors ? -1 : 0,
      metadata: {
        filePath: uiSession.file_path,
        actualSessionId: uiSession.actual_session_id,
        projectName: uiSession.project_name,
      },
      checksum: this.generateChecksum(uiSession.file_path + uiSession.last_modified),
    };
  }

  // NOTE: Message conversion removed - backend now returns UniversalMessage directly!
  // convertLegacyMessage, convertContent, extractToolCalls, extractThinking, mapRole, mapMessageType
  // have been removed because the Rust backend adapter handles all conversion.

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
    // Simple hash for cache invalidation (non-cryptographic)
    // This is sufficient for detecting JSONL file changes
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
