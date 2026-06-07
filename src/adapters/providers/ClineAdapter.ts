// ============================================================================
// CLINE / ROO CODE ADAPTER (v1.9.x)
// ============================================================================
// Adapter for Cline (saoudrizwan.claude-dev) and Roo Code
// (rooveterinaryinc.roo-cline) VS Code extension conversation history.
// Implements IConversationAdapter to enable multi-provider support.
//
// Read-only provider. Routes to Tauri commands defined in
// src-tauri/src/commands/cline.rs.
//
// PATTERN REFERENCE: OpenCodeAdapter.ts

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

export class ClineAdapter implements IConversationAdapter {
  // -------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // -------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.CLINE;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.CLINE,
    name: 'Cline',
    version: '1.0.0',
    author: 'Cline / Roo Code',
    description:
      'Cline and Roo Code conversation history from VS Code globalStorage (ui_messages.json)',
    capabilities: {
      supportsThinking: true, // Cline emits "reasoning" rows
      supportsToolCalls: true, // Cline emits "tool"/"command" rows
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: false,
      supportsFullTextSearch: false,
      supportsTokenCounting: true, // taskHistory carries tokensIn/tokensOut
      supportsModelInfo: true, // taskHistory carries modelId
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
        pattern: 'globalStorage',
        weight: 60,
        required: false,
      },
      {
        type: 'directory',
        pattern: 'tasks',
        weight: 80,
        required: true,
      },
      {
        type: 'file',
        pattern: 'taskHistory.json',
        weight: 90,
        required: false,
      },
    ],
    pathConfig: {
      projectsPath: 'tasks',
    },
    icon: 'cline-logo',
    color: '#0EA5E9',
  };

  private initialized: boolean = false;

  // -------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // -------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('ClineAdapter already initialized');
    }

    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize ClineAdapter');
    }

    this.initialized = true;
    console.log('ClineAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('ClineAdapter disposed');
  }

  // -------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // -------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid = await invoke<boolean>('validate_cline_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid Cline/Roo Code folder (missing tasks/ or taskHistory.json)',
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
          missingPatterns: ['tasks directory', 'taskHistory.json'],
        };
      }

      return {
        canHandle: true,
        confidence: 90,
        matchedPatterns: ['cline/roo globalStorage structure'],
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
      const projects = await invoke<UniversalProject[]>('scan_cline_projects', {
        clinePath: sourcePath,
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
      // projectPath is the "cline://<base>|<cwd>" scheme path produced by the scan.
      const sessions = await invoke<UniversalSession[]>('load_cline_sessions', {
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
      console.error('ClineAdapter.loadSessions error:', error);
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
      // Prefer the explicit "cline://" scheme path; fall back to sessionId
      // (which the store sets equal to the session.id / scheme path).
      const schemePath = sessionPath.startsWith('cline://') ? sessionPath : sessionId;
      const offset = options.offset ?? 0;
      const limit = options.limit ?? 20;

      const messages = await invoke<UniversalMessage[]>('load_cline_messages', {
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
      console.error('ClineAdapter.loadMessages error:', error);
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
        message: 'Per-adapter search is not implemented for Cline; use search_all_providers',
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
          message: 'The Cline/Roo Code folder or data was not found. Please check the path.',
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
          suggestion: 'Try reloading or check the Cline data files.',
        };

      case ErrorCode.CORRUPT_DATA:
        return {
          recoverable: true,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Some data is corrupted and will be skipped.',
          suggestion: 'Check the Cline data files for corruption.',
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
      throw new Error('ClineAdapter not initialized. Call initialize() first.');
    }
  }
}
