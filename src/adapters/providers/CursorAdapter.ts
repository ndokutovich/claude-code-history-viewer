// ============================================================================
// CURSOR IDE ADAPTER (v2.0.0)
// ============================================================================
// Adapter for Cursor IDE conversation history (SQLite databases)
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
} from '../../types/universal';
import type {
  ProviderDefinition,
} from '../../types/providers';
import { ProviderID, ErrorCode } from '../../types/providers';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// CURSOR-SPECIFIC TYPES
// ============================================================================

interface CursorWorkspace {
  id: string;
  path: string;
  project_name: string;
  project_root: string;
  state_db_path: string;
  session_count: number;
  last_activity?: string; // ISO 8601 timestamp of most recent composer
}

interface CursorSession {
  id: string;
  workspace_id: string;
  project_name: string;
  db_path: string;
  message_count: number;
  last_modified: string;
}

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class CursorAdapter implements IConversationAdapter {
  // ------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // ------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.CURSOR;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.CURSOR,
    name: 'Cursor IDE',
    version: '1.0.0',
    author: 'Cursor Team',
    description: 'Cursor IDE conversation history from SQLite databases',
    capabilities: {
      supportsThinking: false,
      supportsToolCalls: false,
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: true,
      supportsFullTextSearch: false, // Not implemented yet
      supportsTokenCounting: false,
      supportsModelInfo: false,
      requiresAuth: false,
      requiresNetwork: false,
      isReadOnly: true,
      maxMessagesPerRequest: 10000,
      preferredBatchSize: 100,
      supportsPagination: false,
    },
    detectionPatterns: [
      {
        type: 'directory',
        pattern: 'Cursor',
        weight: 80,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'User/workspaceStorage',
        weight: 90,
        required: true,
      },
      {
        type: 'file',
        pattern: 'state.vscdb',
        weight: 70,
        required: false,
      },
    ],
    icon: 'cursor-logo',
    color: '#000000', // Cursor brand black
  };

  private initialized = false;

  // ------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // ------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('CursorAdapter already initialized');
    }

    // Verify Tauri is available
    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize CursorAdapter');
    }

    this.initialized = true;
    console.log('✅ CursorAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('🗑️  CursorAdapter disposed');
  }

  // ------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // ------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      // Call Rust backend validation
      const isValid = await invoke<boolean>('validate_cursor_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid Cursor folder (missing User/workspaceStorage structure)',
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
          missingPatterns: ['Cursor directory', 'User/workspaceStorage directory'],
        };
      }

      // High confidence for valid Cursor folders
      return {
        canHandle: true,
        confidence: 90,
        matchedPatterns: ['Cursor/User/workspaceStorage directory structure'],
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
      // Call Rust command to scan Cursor workspaces
      const cursorWorkspaces = await invoke<CursorWorkspace[]>('scan_cursor_workspaces', {
        cursorPath: sourcePath,
      });

      // Convert to universal format
      const universalProjects: UniversalProject[] = cursorWorkspaces.map((workspace) =>
        this.convertCursorWorkspace(workspace, sourceId)
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
      // Normalize path separators for cross-platform support
      const normalizedPath = projectPath.replace(/\\/g, '/');

      // Extract workspace ID from project path (last directory component)
      const workspaceId = normalizedPath.split('/').pop() || projectId;

      // Extract base Cursor path (everything before /User/workspaceStorage)
      let cursorBasePath = normalizedPath;
      const userIndex = normalizedPath.lastIndexOf('/User/workspaceStorage');
      if (userIndex !== -1) {
        cursorBasePath = normalizedPath.substring(0, userIndex);
      }

      // Convert back to platform-native path format
      // Keep original separator style from projectPath
      const isWindowsPath = projectPath.includes('\\');
      const finalCursorPath = isWindowsPath
        ? cursorBasePath.replace(/\//g, '\\')
        : cursorBasePath;

      console.log(`🔍 Loading Cursor sessions:`);
      console.log(`  Project path: ${projectPath}`);
      console.log(`  Cursor base: ${finalCursorPath}`);
      console.log(`  Workspace ID: ${workspaceId}`);

      // Call Rust command to load Cursor sessions
      const cursorSessions = await invoke<CursorSession[]>('load_cursor_sessions', {
        cursorPath: finalCursorPath,
        workspaceId,
      });

      // Convert to universal format
      const universalSessions: UniversalSession[] = cursorSessions.map((session) =>
        this.convertCursorSession(session, projectId, sourceId)
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
      // Call Rust command to load messages from Cursor session DB
      const cursorMessages = await invoke<UniversalMessage[]>('load_cursor_messages', {
        sessionDbPath: sessionPath,
      });

      // Apply offset/limit if specified
      const offset = options.offset || 0;
      const limit = options.limit || cursorMessages.length;
      const paginatedMessages = cursorMessages.slice(offset, offset + limit);

      // Update IDs to match our session
      const messagesWithIds = paginatedMessages.map((msg, index) => ({
        ...msg,
        sessionId,
        sequenceNumber: offset + index,
      }));

      return {
        success: true,
        data: messagesWithIds,
        pagination: {
          hasMore: offset + limit < cursorMessages.length,
          nextOffset: offset + limit,
          totalCount: cursorMessages.length,
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
    _sourcePaths: string[],
    _query: string,
    _filters: AdapterSearchFilters
  ): Promise<SearchResult<UniversalMessage>> {
    this.ensureInitialized();

    // TODO: Implement search for Cursor
    // For now, return empty results with a message
    return {
      success: false,
      error: {
        code: ErrorCode.UNSUPPORTED_VERSION,
        message: 'Search is not yet implemented for Cursor IDE',
        recoverable: false,
      },
    };
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

      // Try to scan workspaces as a health check
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
          message: 'The Cursor folder or database was not found. Please check the path.',
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
          message: 'Some data has invalid format and will be skipped.',
          suggestion: 'Try reloading or check the database integrity.',
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
          suggestion: 'Check the Cursor database files for corruption.',
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

  private convertCursorWorkspace(workspace: CursorWorkspace, sourceId: string): UniversalProject {
    return {
      id: workspace.id,
      sourceId,
      providerId: this.providerId,
      name: workspace.project_name,
      path: workspace.path,
      sessionCount: workspace.session_count,
      totalMessages: 0, // Will be calculated when sessions are loaded
      firstActivityAt: workspace.last_activity || new Date().toISOString(),
      lastActivityAt: workspace.last_activity || new Date().toISOString(), // Most recent composer timestamp
      metadata: {
        projectRoot: workspace.project_root,
        stateDbPath: workspace.state_db_path,
        checksum: this.generateChecksum(workspace.path),
      },
    };
  }

  private convertCursorSession(
    session: CursorSession,
    projectId: string,
    sourceId: string
  ): UniversalSession {
    return {
      id: session.id,
      projectId,
      sourceId,
      providerId: this.providerId,
      title: session.project_name || 'Untitled Session',
      messageCount: session.message_count,
      firstMessageAt: session.last_modified, // Cursor doesn't store first message time
      lastMessageAt: session.last_modified,
      duration: 0, // Unknown
      totalTokens: undefined,
      toolCallCount: 0,
      errorCount: 0,
      metadata: {
        filePath: session.db_path,
        workspaceId: session.workspace_id,
      },
      checksum: this.generateChecksum(session.db_path + session.last_modified),
    };
  }

  private generateChecksum(input: string): string {
    // Simple hash function (same as ClaudeCodeAdapter)
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
      throw new Error('CursorAdapter not initialized. Call initialize() first.');
    }
  }
}
