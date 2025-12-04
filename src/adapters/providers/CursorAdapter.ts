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
  WriteResult,
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
      isReadOnly: false, // v2.0.0: Now supports writing
      supportsProjectCreation: false, // Cursor uses workspaces, not projects
      supportsSessionCreation: true, // v2.0.0: Composer creation supported
      supportsMessageAppending: true, // v2.0.0: Message appending supported
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
    pathConfig: {
      projectsPath: 'User/workspaceStorage', // Cursor stores workspaces here
    },
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
      const errorMessage = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : JSON.stringify(error));
      const errorCode = error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN;

      return {
        isValid: false,
        confidence: 0,
        errors: [{
          code: errorCode,
          message: `Validation failed: ${errorMessage}`,
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
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : String(error),
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

    // Extract workspace ID early so it's available in catch block
    const normalizedPath = projectPath.replace(/\\/g, '/');
    const workspaceId = normalizedPath.split('/').pop() || projectId;

    try {

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

      console.log(`✅ Loaded ${cursorSessions.length} Cursor sessions from backend`);

      // Convert to universal format
      const universalSessions: UniversalSession[] = cursorSessions.map((session) =>
        this.convertCursorSession(session, projectId, sourceId)
      );

      console.log(`✅ Converted to ${universalSessions.length} universal sessions`);

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
      console.error('❌ CursorAdapter.loadSessions error:', error);
      console.error('Error details:', {
        projectPath: projectPath,
        workspaceId: workspaceId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: {
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : String(error),
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
      // Extract cursor base path from the encoded sessionPath
      // Format: <full_db_path>#session=<session_id>#timestamp=<timestamp>
      // We need to extract the Cursor base folder from the full DB path
      const cursorPath = this.extractCursorPathFromDbPath(sessionPath);

      console.log('🔍 CursorAdapter.loadMessages called with:', {
        sessionPath,
        extractedCursorPath: cursorPath,
        sessionId,
      });

      // Call Rust command to load messages from Cursor session DB
      const cursorMessages = await invoke<UniversalMessage[]>('load_cursor_messages', {
        cursorPath,           // Base Cursor folder path
        sessionDbPath: sessionPath,  // Encoded path with session info
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
      console.error('🔴 CursorAdapter.loadMessages error:', error);
      console.error('Error type:', typeof error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));

      const errorMessage = error instanceof Error
        ? error.message
        : (typeof error === 'string' ? error : JSON.stringify(error));

      return {
        success: false,
        error: {
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: errorMessage,
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
      return {
        success: false,
        error: {
          code: ErrorCode.PATH_NOT_FOUND,
          message: 'At least one source path required for search',
          recoverable: false,
        },
      };
    }

    if (sourcePaths.length > 1) {
      return {
        success: false,
        error: {
          code: ErrorCode.UNSUPPORTED_VERSION,
          message: 'CursorAdapter does not support multi-source search yet',
          recoverable: false,
        },
      };
    }

    try {
      // Call Rust command to search Cursor messages
      const result = await invoke<{ messages: UniversalMessage[], total: number }>('search_cursor_messages', {
        cursorPath: sourcePaths[0],
        query,
        filters: {
          dateRange: filters.dateRange,
          messageType: filters.messageType,
          hasToolCalls: filters.hasToolCalls,
          hasErrors: filters.hasErrors,
        },
      });

      return {
        success: true,
        data: result.messages,
        totalMatches: result.total,
        searchDuration: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: error instanceof Error ? classifyError(error) : ErrorCode.UNKNOWN,
          message: error instanceof Error ? error.message : String(error),
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
  // PATH MANAGEMENT (OPTIONAL - v2.0.0)
  // ------------------------------------------------------------------------

  /**
   * Get the workspaces root directory for Cursor
   * @param sourcePath - Base Cursor folder (e.g., AppData/Roaming/Cursor)
   * @returns Workspaces root directory (e.g., Cursor/User/workspaceStorage)
   */
  getProjectsRoot(sourcePath: string): string {
    const { projectsPath } = this.providerDefinition.pathConfig;
    return `${sourcePath}/${projectsPath}`;
  }

  /**
   * Convert a workspace ID to absolute workspace path
   * @param sourcePath - Base Cursor folder
   * @param workspaceId - ID of the workspace
   * @returns Absolute workspace path
   */
  convertToProjectPath(sourcePath: string, workspaceId: string): string {
    const workspacesRoot = this.getProjectsRoot(sourcePath);
    return `${workspacesRoot}/${workspaceId}`;
  }

  /**
   * Extract workspace ID from a full path
   * Example: ".../User/workspaceStorage/abc123/..." → "abc123"
   * @param fullPath - Full absolute path
   * @returns Workspace ID
   */
  sanitizePathToProjectName(fullPath: string): string {
    // For Cursor, extract the workspace ID from the path
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const parts = normalizedPath.split('/');

    // Find workspaceStorage in path and get the next segment
    const wsIndex = parts.findIndex(p => p.toLowerCase() === 'workspacestorage');
    if (wsIndex !== -1 && parts.length > wsIndex + 1) {
      return parts[wsIndex + 1];
    }

    // Fallback: return last segment
    return parts[parts.length - 1] || 'unknown';
  }

  // ------------------------------------------------------------------------
  // WRITE OPERATIONS (OPTIONAL - v2.0.0)
  // ------------------------------------------------------------------------

  /**
   * Create a new Cursor session (composer) in the specified workspace
   * Note: Cursor doesn't support creating new "projects" (workspaces are managed by the IDE)
   */
  async createSession(
    projectPath: string,
    request: CreateSessionRequest
  ): Promise<WriteResult<SessionInfo>> {
    this.ensureInitialized();

    try {
      // Extract workspace ID and Cursor base path from projectPath
      const workspaceId = this.sanitizePathToProjectName(projectPath);
      const cursorPath = this.extractCursorPathFromDbPath(projectPath);

      const response = await invoke<{
        session_id: string;
        workspace_id: string;
        message_count: number;
        db_path: string;
      }>('create_cursor_session', {
        request: {
          cursor_path: cursorPath,
          workspace_id: workspaceId,
          messages: request.messages,
          summary: request.summary,
        },
      });

      return {
        success: true,
        data: {
          sessionPath: response.db_path,
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

  /**
   * Append messages to an existing Cursor session
   */
  async appendMessages(
    sessionPath: string,
    messages: MessageInput[]
  ): Promise<WriteResult<number>> {
    this.ensureInitialized();

    try {
      // Extract session ID from encoded path
      // Format: <db-path>#session=<session-id>#workspace=<workspace-id>#timestamp=<iso-timestamp>
      const sessionIdMatch = sessionPath.match(/#session=([^#]+)/);
      if (!sessionIdMatch) {
        throw new Error('Cannot extract session ID from path');
      }
      const sessionId = sessionIdMatch[1];
      const cursorPath = this.extractCursorPathFromDbPath(sessionPath);

      const messageCount = await invoke<number>('append_to_cursor_session', {
        request: {
          cursor_path: cursorPath,
          session_id: sessionId,
          messages,
        },
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

  /**
   * Extract Cursor base path from the encoded DB path
   * Example input: "C:/Users/xxx/AppData/Roaming/Cursor/User/workspaceStorage/abc123/state.vscdb#session=xyz#timestamp=..."
   * Example output: "C:/Users/xxx/AppData/Roaming/Cursor"
   */
  private extractCursorPathFromDbPath(dbPath: string): string {
    // Remove encoded session info if present
    const parts = dbPath.split('#');
    const cleanPath = parts[0] || dbPath;

    // Find the Cursor folder in the path
    // Path structure: .../Cursor/User/workspaceStorage/...
    const cursorIndex = cleanPath.toLowerCase().indexOf('/cursor/');
    if (cursorIndex === -1) {
      // Try backslash for Windows
      const cursorIndexWin = cleanPath.toLowerCase().indexOf('\\cursor\\');
      if (cursorIndexWin === -1) {
        throw new Error(`Cannot extract Cursor base path from: ${dbPath}`);
      }
      return cleanPath.substring(0, cursorIndexWin + 7); // Include '\Cursor'
    }
    return cleanPath.substring(0, cursorIndex + 7); // Include '/Cursor'
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
