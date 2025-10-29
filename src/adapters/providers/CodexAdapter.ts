// ============================================================================
// CODEX CLI ADAPTER (v1.8.0)
// ============================================================================
// Adapter for Codex CLI conversation history
// Structure matches GeminiAdapter for type compatibility

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

export class CodexAdapter implements IConversationAdapter {
  public readonly providerId: string = ProviderID.CODEX;
  public readonly providerDefinition: ProviderDefinition = {
    id: ProviderID.CODEX,
    name: 'Codex CLI',
    version: '1.0.0',
    author: 'Codex Team',
    description: 'Codex CLI conversation history',
    capabilities: {
      supportsThinking: false,
      supportsToolCalls: false,
      supportsBranching: false,
      supportsStreaming: false,
      supportsImages: false,
      supportsFiles: true,
      supportsFullTextSearch: false,
      supportsTokenCounting: false,
      supportsModelInfo: true,
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
      { type: 'directory', pattern: '.codex', weight: 90, required: true },
      { type: 'directory', pattern: 'sessions', weight: 90, required: true },
      { type: 'file', pattern: 'rollout-*.jsonl', weight: 80, required: false },
    ],
    pathConfig: { projectsPath: 'sessions' },
    icon: '🔮',
    color: '#9333EA',
  };

  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('CodexAdapter already initialized');
    }
    if (typeof invoke !== 'function') {
      throw new Error('Tauri API not available');
    }
    this.initialized = true;
    console.log('✅ CodexAdapter initialized');
  }

  async dispose(): Promise<void> {
    if (!this.initialized) return;
    this.initialized = false;
    console.log('🗑️  CodexAdapter disposed');
  }

  async validate(path: string): Promise<ValidationResult> {
    try {
      const isValid: boolean = await invoke<boolean>('validate_codex_folder', { path });
      if (!isValid) {
        return {
          isValid: false,
          confidence: 0,
          errors: [{ code: ErrorCode.INVALID_FORMAT, message: 'Not a valid Codex CLI folder' }],
          warnings: [],
        };
      }
      return { isValid: true, confidence: 100, errors: [], warnings: [] };
    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        errors: [{ code: classifyError(error as Error), message: (error as Error).message }],
        warnings: [],
      };
    }
  }

  async canHandle(path: string): Promise<DetectionScore> {
    try {
      const validation: ValidationResult = await this.validate(path);
      if (!validation.isValid) {
        return {
          canHandle: false,
          confidence: 0,
          matchedPatterns: [],
          missingPatterns: ['.codex directory', 'agent-sessions directory'],
        };
      }
      return {
        canHandle: true,
        confidence: 100,
        matchedPatterns: ['rollout-*.jsonl files'],
        missingPatterns: [],
      };
    } catch (error) {
      return { canHandle: false, confidence: 0, matchedPatterns: [], missingPatterns: [] };
    }
  }

  async scanProjects(sourcePath: string, sourceId: string): Promise<ScanResult<UniversalProject>> {
    this.ensureInitialized();
    try {
      const projects: UniversalProject[] = await invoke<UniversalProject[]>('scan_codex_projects', {
        codexPath: sourcePath,
        sourceId,
      });
      return { success: true, data: projects };
    } catch (error) {
      return {
        success: false,
        error: { code: classifyError(error as Error), message: (error as Error).message, recoverable: true },
      };
    }
  }

  async loadSessions(projectPath: string, projectId: string, sourceId: string): Promise<ScanResult<UniversalSession>> {
    this.ensureInitialized();
    try {
      const sessions: UniversalSession[] = await invoke<UniversalSession[]>('load_codex_sessions', {
        codexPath: '',
        projectPath,
        projectId,
        sourceId,
      });
      return { success: true, data: sessions };
    } catch (error) {
      return {
        success: false,
        error: { code: classifyError(error as Error), message: (error as Error).message, recoverable: true },
      };
    }
  }

  async loadMessages(sessionPath: string, _sessionId: string, options: LoadOptions): Promise<LoadResult<UniversalMessage>> {
    this.ensureInitialized();
    try {
      const offset: number = options?.offset ?? 0;
      const limit: number = options?.limit ?? 20;
      const messages: UniversalMessage[] = await invoke<UniversalMessage[]>('load_codex_messages', {
        sessionPath,
        offset,
        limit,
      });
      return {
        success: true,
        data: messages,
        pagination: { hasMore: messages.length === limit, nextOffset: offset + limit, totalCount: messages.length },
      };
    } catch (error) {
      return {
        success: false,
        error: { code: classifyError(error as Error), message: (error as Error).message, recoverable: true },
      };
    }
  }

  async searchMessages(_sourcePaths: string[], _query: string, _filters: AdapterSearchFilters): Promise<SearchResult<UniversalMessage>> {
    return {
      success: false,
      error: { code: ErrorCode.PROVIDER_UNAVAILABLE, message: 'Search not implemented for Codex CLI', recoverable: false },
    };
  }

  async healthCheck(sourcePath: string): Promise<HealthStatus> {
    try {
      const validation: ValidationResult = await this.validate(sourcePath);
      if (!validation.isValid) {
        return 'offline';
      }
      const scanResult: ScanResult<UniversalProject> = await this.scanProjects(sourcePath, 'health-check');
      if (!scanResult.success) {
        return 'degraded';
      }
      return 'healthy';
    } catch {
      return 'offline';
    }
  }

  handleError(error: Error, _context: ErrorContext): ErrorRecovery {
    const errorCode: ErrorCode = classifyError(error);
    switch (errorCode) {
      case ErrorCode.PATH_NOT_FOUND:
        return {
          recoverable: false,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Codex folder not found',
        };
      case ErrorCode.INVALID_FORMAT:
        return {
          recoverable: false,
          retry: { shouldRetry: false, maxAttempts: 0, delayMs: 0 },
          message: 'Invalid Codex folder structure',
        };
      default:
        return {
          recoverable: true,
          retry: { shouldRetry: true, maxAttempts: 3, delayMs: 1000 },
          message: 'Temporary error occurred',
        };
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('CodexAdapter not initialized');
    }
  }
}
