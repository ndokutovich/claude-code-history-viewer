// ============================================================================
// AIDER ADAPTER (v1.9.x)
// ============================================================================
// Adapter for Aider (`aider`) Markdown chat history (.aider.chat.history.md).
// Implements IConversationAdapter to enable multi-provider support.
//
// Read-only provider. Routes to Tauri commands defined in
// src-tauri/src/commands/aider.rs.
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

export class AiderAdapter implements IConversationAdapter {
  // -------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // -------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.AIDER;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.AIDER,
    name: 'Aider',
    version: '1.0.0',
    author: 'Aider',
    description:
      'Aider conversation history from Markdown chat logs (.aider.chat.history.md)',
    capabilities: {
      supportsThinking: false,
      supportsToolCalls: false, // tool output is rendered as system text
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: false,
      supportsFullTextSearch: false,
      supportsTokenCounting: false,
      supportsModelInfo: false,
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
        pattern: '.aider.chat.history.md',
        weight: 95,
        required: true,
      },
    ],
    pathConfig: {
      projectsPath: '.',
    },
    icon: 'aider-logo',
    color: '#16A34A',
  };

  private initialized: boolean = false;

  // -------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('AiderAdapter already initialized');
    }

    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize AiderAdapter');
    }

    this.initialized = true;
    console.log('AiderAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('AiderAdapter disposed');
  }

  // -------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // -------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid = await invoke<boolean>('validate_aider_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid Aider folder (missing .aider.chat.history.md)',
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
          missingPatterns: ['.aider.chat.history.md'],
        };
      }

      return {
        canHandle: true,
        confidence: 95,
        matchedPatterns: ['aider chat history file'],
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
      const projects = await invoke<UniversalProject[]>('scan_aider_projects', {
        aiderPath: sourcePath,
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
      // projectPath is the "aider://<project_dir>" scheme path produced by the scan.
      const sessions = await invoke<UniversalSession[]>('load_aider_sessions', {
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
      console.error('AiderAdapter.loadSessions error:', error);
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
      // Prefer the explicit "aider://" scheme path; fall back to sessionId
      // (which the store sets equal to the session.id / scheme path).
      const schemePath = sessionPath.startsWith('aider://') ? sessionPath : sessionId;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 20;

      const messages = await invoke<UniversalMessage[]>('load_aider_messages', {
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
      console.error('AiderAdapter.loadMessages error:', error);
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
        message: 'Per-adapter search is not implemented for Aider; use search_all_providers',
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
          message: 'The Aider history file was not found. Please check the path.',
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
          suggestion: 'Try reloading or check the .aider.chat.history.md file.',
        };

      case ErrorCode.CORRUPT_DATA:
        return {
          recoverable: true,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Some data is corrupted and will be skipped.',
          suggestion: 'Check the Aider history file for corruption.',
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
      throw new Error('AiderAdapter not initialized. Call initialize() first.');
    }
  }
}
