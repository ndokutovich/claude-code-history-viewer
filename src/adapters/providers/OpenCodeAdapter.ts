// ============================================================================
// OPENCODE ADAPTER (v1.9.0)
// ============================================================================
// Adapter for OpenCode conversation history (normalized JSON directory structure).
// Implements IConversationAdapter to enable multi-provider support.
//
// PATTERN REFERENCE: CursorAdapter.ts (gold standard)

import type {
  IConversationAdapter,
  ValidationResult,
  DetectionScore,
  ScanResult,
  LoadResult,
  SearchResult,
  LoadOptions,
  SearchFilters as AdapterSearchFilters,
  ErrorContext,
  ErrorRecovery,
} from '../base/IAdapter';
import { classifyError } from '../base/IAdapter';
import type { HealthStatus } from '../../types/universal';
import type {
  UniversalProject,
  UniversalSession,
  UniversalMessage,
} from '../../types/universal';
import type { ProviderDefinition } from '../../types/providers';
import { ProviderID, ErrorCode } from '../../types/providers';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// ADAPTER IMPLEMENTATION
// ============================================================================

export class OpenCodeAdapter implements IConversationAdapter {
  // -------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // -------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.OPENCODE;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.OPENCODE,
    name: 'OpenCode',
    version: '1.0.0',
    author: 'OpenCode Team',
    description: 'OpenCode conversation history from normalized JSON directory structure',
    capabilities: {
      supportsThinking: true,    // OpenCode has "reasoning" parts
      supportsToolCalls: true,   // OpenCode has "tool" parts
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: true,       // OpenCode has "file" parts
      supportsFullTextSearch: false,
      supportsTokenCounting: true,   // OpenCode has tokens field in messages
      supportsModelInfo: true,       // OpenCode has modelID field
      requiresAuth: false,
      requiresNetwork: false,
      isReadOnly: true,
      supportsProjectCreation: false,
      supportsSessionCreation: false,
      supportsMessageAppending: false,
      maxMessagesPerRequest: 10000,
      preferredBatchSize: 100,
      supportsPagination: true,
    },
    detectionPatterns: [
      {
        type: 'directory',
        pattern: 'opencode',
        weight: 80,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'storage',
        weight: 90,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'project',
        weight: 70,
        required: false,
      },
    ],
    pathConfig: {
      projectsPath: 'storage/project',
    },
    icon: 'opencode-logo',
    color: '#F59E0B',
  };

  private initialized: boolean = false;

  // -------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('OpenCodeAdapter already initialized');
    }

    // Verify Tauri is available
    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize OpenCodeAdapter');
    }

    this.initialized = true;
    console.log('OpenCodeAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('OpenCodeAdapter disposed');
  }

  // -------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // -------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid = await invoke<boolean>('validate_opencode_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid OpenCode folder (missing storage/ subdirectory)',
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
          missingPatterns: ['opencode directory', 'storage subdirectory'],
        };
      }

      return {
        canHandle: true,
        confidence: 90,
        matchedPatterns: ['opencode/storage directory structure'],
        missingPatterns: [],
      };
    } catch {
      return {
        canHandle: false,
        confidence: 0,
        matchedPatterns: [],
        missingPatterns: [],
      };
    }
  }

  // -------------------------------------------------------------------------
  // DISCOVERY (REQUIRED)
  // -------------------------------------------------------------------------

  async scanProjects(
    sourcePath: string,
    sourceId: string
  ): Promise<ScanResult<UniversalProject>> {
    this.ensureInitialized();

    try {
      const projects = await invoke<UniversalProject[]>('scan_opencode_projects', {
        opencodePath: sourcePath,
        sourceId,
      });

      return {
        success: true,
        data: projects,
        metadata: {
          scanDuration: 0,
          itemsFound: projects.length,
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

    try {
      // projectPath for OpenCode is "opencode://{id}" (virtual path)
      // We need to extract the actual base path from the source configuration.
      // The opencode_path is the base opencode folder; projectId is the actual project ID.
      //
      // Since OpenCode projects use virtual paths (opencode://{id}), we need to call
      // get_opencode_path first to obtain the real filesystem path.
      const opencodePath = await this.resolveOpencodePath(projectPath);

      const sessions = await invoke<UniversalSession[]>('load_opencode_sessions', {
        opencodePath,
        projectId,
        sourceId,
      });

      return {
        success: true,
        data: sessions,
        metadata: {
          scanDuration: 0,
          itemsFound: sessions.length,
          itemsSkipped: 0,
        },
      };
    } catch (error) {
      console.error('OpenCodeAdapter.loadSessions error:', error);
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

  // -------------------------------------------------------------------------
  // DATA LOADING (REQUIRED)
  // -------------------------------------------------------------------------

  async loadMessages(
    sessionPath: string,
    sessionId: string,
    options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();

    try {
      const opencodePath = await this.resolveOpencodePath(sessionPath);
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 20;

      const messages = await invoke<UniversalMessage[]>('load_opencode_messages', {
        opencodePath,
        sessionId,
        offset,
        limit,
      });

      return {
        success: true,
        data: messages,
        pagination: {
          hasMore: messages.length === limit,
          nextOffset: offset + limit,
          totalCount: messages.length,
        },
      };
    } catch (error) {
      console.error('OpenCodeAdapter.loadMessages error:', error);
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

  // -------------------------------------------------------------------------
  // SEARCH (REQUIRED - not implemented for OpenCode)
  // -------------------------------------------------------------------------

  async searchMessages(
    _sourcePaths: string[],
    _query: string,
    _filters: AdapterSearchFilters
  ): Promise<SearchResult<UniversalMessage>> {
    return {
      success: false,
      error: {
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: 'Full-text search is not implemented for OpenCode',
        recoverable: false,
      },
    };
  }

  // -------------------------------------------------------------------------
  // HEALTH CHECK (REQUIRED)
  // -------------------------------------------------------------------------

  async healthCheck(sourcePath: string): Promise<HealthStatus> {
    try {
      const validation = await this.validate(sourcePath);

      if (!validation.isValid) {
        return 'offline';
      }

      const scanResult = await this.scanProjects(sourcePath, 'health-check');

      if (!scanResult.success) {
        return 'degraded';
      }

      return 'healthy';
    } catch {
      return 'offline';
    }
  }

  // -------------------------------------------------------------------------
  // ERROR RECOVERY (REQUIRED)
  // -------------------------------------------------------------------------

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
          message: 'The OpenCode folder or data was not found. Please check the path.',
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
          suggestion: 'Try reloading or check the OpenCode data files.',
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
          suggestion: 'Check the OpenCode data files for corruption.',
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

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  /**
   * Resolve the real filesystem OpenCode base path.
   * OpenCode projects use virtual paths like "opencode://{id}".
   * We call the Rust backend to get the actual base path.
   */
  private async resolveOpencodePath(virtualOrRealPath: string): Promise<string> {
    // Virtual path - ask Rust for the real base path
    if (virtualOrRealPath.startsWith('opencode://')) {
      return invoke<string>('get_opencode_path');
    }

    // Bare UUID or non-path string — resolve via backend
    if (!virtualOrRealPath.includes('/') && !virtualOrRealPath.includes('\\')) {
      return invoke<string>('get_opencode_path');
    }

    // Real filesystem path - use it directly
    return virtualOrRealPath;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('OpenCodeAdapter not initialized. Call initialize() first.');
    }
  }
}
