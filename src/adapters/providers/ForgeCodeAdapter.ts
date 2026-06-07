// ============================================================================
// FORGECODE ADAPTER (v1.9.x)
// ============================================================================
// Adapter for ForgeCode conversation history stored in a SQLite database
// (`<base>/.forge.db`). Implements IConversationAdapter to enable
// multi-provider support.
//
// Read-only provider. Routes to Tauri commands defined in
// src-tauri/src/commands/forgecode.rs.
//
// PATTERN REFERENCE: ClineAdapter.ts

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

export class ForgeCodeAdapter implements IConversationAdapter {
  // -------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // -------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.FORGECODE;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.FORGECODE,
    name: 'ForgeCode',
    version: '1.0.0',
    author: 'ForgeCode',
    description:
      'ForgeCode conversation history from the local SQLite database (.forge.db)',
    capabilities: {
      supportsThinking: true, // thinking content blocks supported
      supportsToolCalls: true, // tool_use / tool_result entries
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: true, // image context entries
      supportsFiles: false,
      supportsFullTextSearch: false,
      supportsTokenCounting: true, // usage embedded in context entries
      supportsModelInfo: true, // model embedded in context entries
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
        type: 'file',
        pattern: '.forge.db',
        weight: 90,
        required: false,
      },
      {
        type: 'directory',
        pattern: 'logs',
        weight: 40,
        required: false,
      },
      {
        type: 'file',
        pattern: '.forge_history',
        weight: 40,
        required: false,
      },
    ],
    pathConfig: {
      projectsPath: '.forge.db',
    },
    icon: 'forgecode-logo',
    color: '#F97316',
  };

  private initialized: boolean = false;

  // -------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('ForgeCodeAdapter already initialized');
    }

    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize ForgeCodeAdapter');
    }

    this.initialized = true;
    console.log('ForgeCodeAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('ForgeCodeAdapter disposed');
  }

  // -------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // -------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid = await invoke<boolean>('validate_forgecode_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid ForgeCode folder (missing .forge.db, logs/, or .forge_history)',
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
          missingPatterns: ['.forge.db', 'logs/', '.forge_history'],
        };
      }

      return {
        canHandle: true,
        confidence: 90,
        matchedPatterns: ['forgecode database structure'],
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
      const projects = await invoke<UniversalProject[]>('scan_forgecode_projects', {
        forgecodePath: sourcePath,
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
    _projectId: string,
    sourceId: string
  ): Promise<ScanResult<UniversalSession>> {
    this.ensureInitialized();

    try {
      // projectPath is the "forgecode://<workspace_id>" scheme path from the scan.
      const sessions = await invoke<UniversalSession[]>('load_forgecode_sessions', {
        projectPath,
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
      console.error('ForgeCodeAdapter.loadSessions error:', error);
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
      // Prefer the explicit "forgecode://" scheme path; fall back to sessionId
      // (which the store sets equal to the session.id / scheme path).
      const schemePath = sessionPath.startsWith('forgecode://') ? sessionPath : sessionId;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 20;

      const messages = await invoke<UniversalMessage[]>('load_forgecode_messages', {
        sessionPath: schemePath,
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
      console.error('ForgeCodeAdapter.loadMessages error:', error);
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
  // SEARCH (REQUIRED - delegated to the multi-provider facade)
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
        message: 'Per-adapter search is not implemented for ForgeCode; use search_all_providers',
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
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'The ForgeCode folder or database was not found. Please check the path.',
        };

      case ErrorCode.ACCESS_DENIED:
        return {
          recoverable: false,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Permission denied. Please check file permissions.',
        };

      case ErrorCode.INVALID_FORMAT:
      case ErrorCode.PARSE_ERROR:
        return {
          recoverable: true,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Some data has invalid format and will be skipped.',
          suggestion: 'Try reloading or check the ForgeCode database.',
        };

      case ErrorCode.CORRUPT_DATA:
        return {
          recoverable: true,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Some data is corrupted and will be skipped.',
          suggestion: 'Check the ForgeCode database for corruption.',
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
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: `Unexpected error: ${error.message}`,
          suggestion: 'Please report this issue if it persists.',
        };
    }
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ForgeCodeAdapter not initialized. Call initialize() first.');
    }
  }
}
