// ============================================================================
// GEMINI CLI ADAPTER (v1.7.0)
// ============================================================================
// Adapter for Gemini CLI conversation history (~/.gemini/tmp/**/session-*.json)
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
// ADAPTER IMPLEMENTATION
// ============================================================================

export class GeminiAdapter implements IConversationAdapter {
  // ------------------------------------------------------------------------
  // IDENTITY (REQUIRED)
  // ------------------------------------------------------------------------

  public readonly providerId: string = ProviderID.GEMINI;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.GEMINI,
    name: 'Gemini CLI',
    version: '1.0.0',
    author: 'Google',
    description: 'Google Gemini CLI conversation history',
    capabilities: {
      supportsThinking: false, // Gemini doesn't expose thinking blocks
      supportsToolCalls: true,
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: true,
      supportsFullTextSearch: false, // Not yet implemented
      supportsTokenCounting: false, // Gemini doesn't expose token counts in session files
      supportsModelInfo: true,
      requiresAuth: false,
      requiresNetwork: false,
      isReadOnly: true, // No write support yet
      supportsProjectCreation: false,
      supportsSessionCreation: false,
      supportsMessageAppending: false,
      maxMessagesPerRequest: 10000,
      preferredBatchSize: 100,
      supportsPagination: false, // Load all messages at once
    },
    detectionPatterns: [
      {
        type: 'directory',
        pattern: '.gemini',
        weight: 90,
        required: true,
      },
      {
        type: 'directory',
        pattern: 'tmp',
        weight: 90,
        required: true,
      },
      {
        type: 'file',
        pattern: 'session-*.json',
        weight: 80,
        required: false,
      },
    ],
    pathConfig: {
      projectsPath: 'tmp', // Gemini stores sessions at ~/.gemini/tmp/
    },
    icon: '💎',
    color: '#4285F4', // Google Blue
  };

  private initialized = false;

  // ------------------------------------------------------------------------
  // LIFECYCLE (REQUIRED)
  // ------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('GeminiAdapter already initialized');
    }

    // Verify Tauri is available
    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available - cannot initialize GeminiAdapter');
    }

    this.initialized = true;
    console.log('✅ GeminiAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.initialized = false;
    console.log('🗑️  GeminiAdapter disposed');
  }

  // ------------------------------------------------------------------------
  // VALIDATION (REQUIRED, FAIL FAST)
  // ------------------------------------------------------------------------

  async validate(path: string): Promise<ValidationResult> {
    try {
      // Call Rust backend validation
      const isValid = await invoke<boolean>('validate_gemini_folder', { path });

      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{
            code: ErrorCode.INVALID_FORMAT,
            message: 'Not a valid Gemini CLI folder (missing .gemini/tmp structure)',
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
          missingPatterns: ['.gemini directory', 'tmp directory'],
        };
      }

      // High confidence for valid Gemini folders
      return {
        canHandle: true,
        confidence: 95,
        matchedPatterns: ['.gemini/tmp directory structure'],
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
      // Call Rust command (returns UniversalProject directly from backend)
      const universalProjects = await invoke<UniversalProject[]>('scan_gemini_projects', {
        geminiPath: sourcePath,
        sourceId,
      });

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
      // Call Rust command (returns UniversalSession directly from backend)
      const universalSessions = await invoke<UniversalSession[]>('load_gemini_sessions', {
        geminiPath: '', // Not needed, projectPath already has full path
        projectPath,
        projectId,
        sourceId,
      });

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
    _options: LoadOptions
  ): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();

    try {
      // Note: Gemini backend needs projectId and sourceId, but interface doesn't support it
      // For now, pass empty strings - backend will extract from session file
      // TODO: Refactor backend to extract these from sessionPath
      const universalMessages = await invoke<UniversalMessage[]>('load_gemini_messages', {
        sessionPath,
        sessionId,
        projectId: '', // TODO: Extract from session metadata
        sourceId: '',  // TODO: Extract from session metadata
      });

      return {
        success: true,
        data: universalMessages,
        pagination: {
          hasMore: false, // Load all messages at once
          nextOffset: universalMessages.length,
          totalCount: universalMessages.length,
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
    // Search not yet implemented for Gemini CLI
    return {
      success: false,
      error: {
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: 'Search not yet implemented for Gemini CLI',
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
          message: 'The Gemini folder or file was not found. Please check the path.',
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
  // PATH MANAGEMENT (OPTIONAL - not needed for Gemini)
  // ------------------------------------------------------------------------

  getProjectsRoot(sourcePath: string): string {
    const { projectsPath } = this.providerDefinition.pathConfig;
    return `${sourcePath}/${projectsPath}`;
  }

  // ------------------------------------------------------------------------
  // HELPER METHODS (PRIVATE)
  // ------------------------------------------------------------------------

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GeminiAdapter not initialized. Call initialize() first.');
    }
  }
}
