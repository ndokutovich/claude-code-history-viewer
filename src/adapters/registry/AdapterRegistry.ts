// Adapter Registry - Central management for all conversation adapters
// FAIL FAST: Strict validation, no silent failures

import type { IConversationAdapter } from '../base/IAdapter';
import type { DetectionScore, ProviderDefinition } from '../../types/providers';
import { ClaudeCodeAdapter } from '../providers/ClaudeCodeAdapter';
import { CursorAdapter } from '../providers/CursorAdapter';

// ============================================================================
// DETECTION RESULT
// ============================================================================

export interface DetectionResult {
  success: boolean;
  providerId?: string;
  confidence?: number;
  error?: string;
  allMatches?: Array<{
    providerId: string;
    confidence: number;
    patterns: string[];
  }>;
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

export class AdapterRegistry {
  private adapters: Map<string, IConversationAdapter> = new Map();
  private initialized = false;

  // SINGLETON PATTERN
  private static instance: AdapterRegistry;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /**
   * Initialize registry - MUST be called before use
   * FAIL FAST: Throws if already initialized or if adapter fails
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('AdapterRegistry already initialized');
    }

    console.log('🚀 Initializing AdapterRegistry...');

    try {
      // Register built-in adapters
      await this.registerBuiltinAdapters();

      // Future: Load external adapters
      // await this.loadExternalAdapters();

      this.initialized = true;
      console.log(`✅ AdapterRegistry initialized with ${this.adapters.size} adapters`);
    } catch (error) {
      console.error('❌ Failed to initialize AdapterRegistry:', error);
      throw error;
    }
  }

  /**
   * Register built-in adapters
   * Gracefully handles individual adapter failures
   */
  private async registerBuiltinAdapters(): Promise<void> {
    // Built-in adapters
    const adapters: IConversationAdapter[] = [
      new ClaudeCodeAdapter(), // ✅ Phase 4 COMPLETE
      new CursorAdapter(),     // ✅ v2.0.0 COMPLETE
    ];

    const failures: Array<{ id: string; error: Error }> = [];

    for (const adapter of adapters) {
      try {
        await this.register(adapter);
      } catch (error) {
        // Log but don't fail - allow other adapters to load
        const err = error instanceof Error ? error : new Error(String(error));
        failures.push({ id: adapter.providerId, error: err });
        console.error(`⚠️  Failed to register ${adapter.providerId}:`, err.message);
      }
    }

    // Fail only if ALL adapters failed
    if (this.adapters.size === 0) {
      const errorDetails = failures.map(f => `${f.id}: ${f.error.message}`).join(', ');
      throw new Error(`No adapters could be registered. Errors: ${errorDetails}`);
    }

    // Log warnings for partial failures
    if (failures.length > 0) {
      console.warn(`⚠️  ${failures.length}/${adapters.length} adapters failed to register`);
    }
  }

  /**
   * Register an adapter
   * FAIL FAST: Throws if adapter is invalid or already registered
   */
  async register(adapter: IConversationAdapter): Promise<void> {
    // Validate adapter
    this.validateAdapter(adapter);

    // Check for duplicate
    if (this.adapters.has(adapter.providerId)) {
      throw new Error(`Adapter already registered: ${adapter.providerId}`);
    }

    // Initialize adapter
    console.log(`📝 Initializing adapter: ${adapter.providerId}...`);
    await adapter.initialize();

    // Register
    this.adapters.set(adapter.providerId, adapter);
    console.log(`✅ Registered adapter: ${adapter.providerId}`);
  }

  /**
   * Validate adapter implementation
   * FAIL FAST: Throws if adapter is missing required methods
   */
  private validateAdapter(adapter: IConversationAdapter): void {
    if (!adapter.providerId) {
      throw new Error('Adapter must have providerId');
    }

    if (!adapter.providerDefinition) {
      throw new Error(`Adapter ${adapter.providerId} must have providerDefinition`);
    }

    // Check all required methods exist
    const requiredMethods: Array<keyof IConversationAdapter> = [
      'initialize',
      'dispose',
      'validate',
      'canHandle',
      'scanProjects',
      'loadSessions',
      'loadMessages',
      'searchMessages',
      'healthCheck',
      'handleError',
    ];

    for (const method of requiredMethods) {
      if (typeof adapter[method] !== 'function') {
        throw new Error(
          `Adapter ${adapter.providerId} missing required method: ${method}`
        );
      }
    }

    // Validate provider definition
    this.validateProviderDefinition(adapter.providerDefinition);
  }

  /**
   * Validate provider definition
   */
  private validateProviderDefinition(def: ProviderDefinition): void {
    if (!def.id || typeof def.id !== 'string') {
      throw new Error('ProviderDefinition must have valid id');
    }

    if (!def.name || typeof def.name !== 'string') {
      throw new Error('ProviderDefinition must have valid name');
    }

    if (!def.capabilities) {
      throw new Error('ProviderDefinition must have capabilities');
    }

    if (!Array.isArray(def.detectionPatterns) || def.detectionPatterns.length === 0) {
      throw new Error('ProviderDefinition must have at least one detection pattern');
    }
  }

  /**
   * Get adapter by provider ID
   * FAIL FAST: Throws if not found
   */
  get(providerId: string): IConversationAdapter {
    this.ensureInitialized();

    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${providerId}`);
    }

    return adapter;
  }

  /**
   * Try to get adapter (returns undefined if not found)
   */
  tryGet(providerId: string): IConversationAdapter | undefined {
    this.ensureInitialized();
    return this.adapters.get(providerId);
  }

  /**
   * Get all registered adapters
   */
  getAll(): IConversationAdapter[] {
    this.ensureInitialized();
    return Array.from(this.adapters.values());
  }

  /**
   * Get all provider definitions
   */
  getAllProviders(): ProviderDefinition[] {
    return this.getAll().map(a => a.providerDefinition);
  }

  /**
   * Check if provider is registered
   */
  has(providerId: string): boolean {
    this.ensureInitialized();
    return this.adapters.has(providerId);
  }

  /**
   * AUTO-DETECT PROVIDER
   * Tests all registered adapters against the path
   * Returns best match or error if none found
   */
  async detectProvider(path: string): Promise<DetectionResult> {
    this.ensureInitialized();

    console.log(`🔍 Detecting provider for path: ${path}`);

    const scores: Array<{
      adapter: IConversationAdapter;
      score: DetectionScore;
    }> = [];

    // Test all adapters
    for (const adapter of this.adapters.values()) {
      try {
        const score = await adapter.canHandle(path);
        if (score.canHandle) {
          scores.push({ adapter, score });
          console.log(
            `  ✓ ${adapter.providerId}: ${score.confidence}% (${score.matchedPatterns.length} patterns)`
          );
        } else {
          console.log(`  ✗ ${adapter.providerId}: Cannot handle`);
        }
      } catch (error) {
        console.error(`  ❌ ${adapter.providerId}: Detection failed`, error);
      }
    }

    // Sort by confidence (highest first)
    scores.sort((a, b) => b.score.confidence - a.score.confidence);

    // No matches
    if (scores.length === 0) {
      console.log('❌ No compatible provider found');
      return {
        success: false,
        error: 'No compatible provider found for this path',
      };
    }

    // Return best match
    const best = scores[0];

    if (!best) {
      return {
        success: false,
        error: 'No providers available',
      };
    }

    console.log(`✅ Best match: ${best.adapter.providerId} (${best.score.confidence}%)`);

    return {
      success: true,
      providerId: best.adapter.providerId,
      confidence: best.score.confidence,
      allMatches: scores.map(s => ({
        providerId: s.adapter.providerId,
        confidence: s.score.confidence,
        patterns: s.score.matchedPatterns,
      })),
    };
  }

  /**
   * Ensure registry is initialized
   * FAIL FAST: Throws if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AdapterRegistry not initialized. Call initialize() first.');
    }
  }

  /**
   * Dispose all adapters and reset registry
   */
  async dispose(): Promise<void> {
    console.log('🧹 Disposing AdapterRegistry...');

    for (const adapter of this.adapters.values()) {
      try {
        await adapter.dispose();
        console.log(`  ✓ Disposed: ${adapter.providerId}`);
      } catch (error) {
        console.error(`  ✗ Failed to dispose ${adapter.providerId}:`, error);
      }
    }

    this.adapters.clear();
    this.initialized = false;
    console.log('✅ AdapterRegistry disposed');
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAdapters: number;
    initialized: boolean;
    providers: string[];
  } {
    return {
      totalAdapters: this.adapters.size,
      initialized: this.initialized,
      providers: Array.from(this.adapters.keys()),
    };
  }
}

// Export singleton instance
export const adapterRegistry = AdapterRegistry.getInstance();
