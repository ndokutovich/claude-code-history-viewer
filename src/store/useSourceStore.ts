// ============================================================================
// SOURCE STORE (v2.0.0)
// ============================================================================
// Manages multiple conversation data sources (Claude Code, Cursor, etc.)
// Uses adapter pattern to support different providers

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { load, type StoreOptions } from '@tauri-apps/plugin-store';
import type { UniversalSource } from '../types/universal';
import { adapterRegistry } from '../adapters';

// Simple UUID v4 generator (RFC 4122 compliant)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// SOURCE STORE STATE
// ============================================================================

interface SourceStoreState {
  // Source management
  sources: UniversalSource[];
  selectedSourceId: string | null;
  isLoadingSources: boolean;
  isAddingSource: boolean;
  isValidatingSource: boolean;

  // Errors
  error: string | null;
  validationError: string | null;

  // Actions - Initialization
  initializeSources: () => Promise<void>;
  autoDetectDefaultSource: () => Promise<void>;

  // Actions - Source CRUD
  addSource: (path: string, name?: string) => Promise<UniversalSource>;
  removeSource: (sourceId: string) => Promise<void>;
  updateSource: (sourceId: string, updates: Partial<UniversalSource>) => Promise<void>;
  setDefaultSource: (sourceId: string) => Promise<void>;
  refreshSource: (sourceId: string) => Promise<void>;
  refreshAllSources: () => Promise<void>;

  // Actions - Selection
  selectSource: (sourceId: string | null) => void;
  getSelectedSource: () => UniversalSource | null;

  // Actions - Validation
  validatePath: (path: string) => Promise<{ isValid: boolean; providerId?: string; error?: string }>;

  // Actions - Error handling
  setError: (error: string | null) => void;
  clearErrors: () => void;

  // Actions - Persistence (internal)
  persistSources: () => Promise<void>;
}

// ============================================================================
// STORAGE KEY
// ============================================================================

const SOURCES_STORAGE_KEY = 'sources';
const SELECTED_SOURCE_KEY = 'selectedSourceId';

// ============================================================================
// SOURCE STORE
// ============================================================================

export const useSourceStore = create<SourceStoreState>((set, get) => ({
  // Initial state
  sources: [],
  selectedSourceId: null,
  isLoadingSources: false,
  isAddingSource: false,
  isValidatingSource: false,
  error: null,
  validationError: null,

  // ------------------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------------------

  initializeSources: async () => {
    set({ isLoadingSources: true, error: null });

    try {
      // Initialize adapter registry first
      await adapterRegistry.initialize();

      // Load saved sources from persistent storage
      const store = await load('sources.json', { autoSave: false } as StoreOptions);
      const savedSources = await store.get<UniversalSource[]>(SOURCES_STORAGE_KEY);
      const savedSelectedId = await store.get<string>(SELECTED_SOURCE_KEY);

      if (savedSources && Array.isArray(savedSources) && savedSources.length > 0) {
        set({ sources: savedSources, selectedSourceId: savedSelectedId || null });

        // Refresh all source health status in background
        get().refreshAllSources().catch((err) => {
          console.error('Failed to refresh sources:', err);
        });

        console.log(`✅ Loaded ${savedSources.length} sources from storage`);
      } else {
        // No saved sources - try to auto-detect default Claude Code folder
        console.log('No saved sources found, attempting auto-detection...');
        await get().autoDetectDefaultSource();
      }
    } catch (error) {
      console.error('Failed to initialize sources:', error);
      set({ error: `Failed to initialize sources: ${(error as Error).message}` });

      // Fallback: try auto-detection
      try {
        await get().autoDetectDefaultSource();
      } catch (autoDetectError) {
        console.error('Auto-detection also failed:', autoDetectError);
      }
    } finally {
      set({ isLoadingSources: false });
    }
  },

  // ------------------------------------------------------------------------
  // AUTO-DETECTION (INTERNAL)
  // ------------------------------------------------------------------------

  autoDetectDefaultSource: async () => {
    try {
      // Try to get default Claude Code folder
      const claudePath = await invoke<string>('get_claude_folder_path');

      // Validate it
      const validation = await get().validatePath(claudePath);

      if (validation.isValid && validation.providerId) {
        // Add as default source
        const source = await get().addSource(claudePath, 'Default (Auto-detected)');
        await get().setDefaultSource(source.id);

        console.log('✅ Auto-detected and added default Claude Code source');
      } else {
        throw new Error('Auto-detected path is not valid');
      }
    } catch (error) {
      console.warn('Auto-detection failed:', error);
      throw error;
    }
  },

  // ------------------------------------------------------------------------
  // SOURCE CRUD
  // ------------------------------------------------------------------------

  addSource: async (path: string, name?: string) => {
    set({ isAddingSource: true, error: null });

    try {
      // Validate path first
      const validation = await get().validatePath(path);

      if (!validation.isValid || !validation.providerId) {
        throw new Error(validation.error || 'Invalid source path');
      }

      // Check for duplicates
      const existingSources = get().sources;
      if (existingSources.some((s) => s.path === path)) {
        throw new Error('This source is already added');
      }

      // Get adapter
      const adapter = adapterRegistry.get(validation.providerId);

      // Create source
      const sourceId = generateUUID();
      const source: UniversalSource = {
        id: sourceId,
        name: name || `Source (${validation.providerId})`,
        path,
        providerId: validation.providerId,
        isDefault: existingSources.length === 0, // First source is default
        isAvailable: true,
        healthStatus: 'healthy',
        lastValidation: new Date().toISOString(),
        stats: {
          projectCount: 0,
          sessionCount: 0,
          messageCount: 0,
          totalSize: 0,
        },
        addedAt: new Date().toISOString(),
        providerConfig: {
          providerName: adapter.providerDefinition.name,
          providerVersion: adapter.providerDefinition.version,
        },
      };

      // Scan projects to get initial stats (in background)
      try {
        const scanResult = await adapter.scanProjects(path, sourceId);
        if (scanResult.success && scanResult.data) {
          source.stats.projectCount = scanResult.metadata?.itemsFound || scanResult.data.length;
          source.stats.messageCount = scanResult.data.reduce(
            (sum, p) => sum + (p.totalMessages || 0),
            0
          );
          source.stats.sessionCount = scanResult.data.reduce(
            (sum, p) => sum + p.sessionCount,
            0
          );
        }
      } catch (scanError) {
        console.warn('Failed to scan projects during add:', scanError);
        // Continue anyway - stats can be refreshed later
      }

      // Add to state
      const updatedSources = [...existingSources, source];
      set({ sources: updatedSources });

      // Save to persistent storage
      await get().persistSources();

      console.log(`✅ Added source: ${source.name} (${source.providerId})`);

      return source;
    } catch (error) {
      const errorMessage = `Failed to add source: ${(error as Error).message}`;
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isAddingSource: false });
    }
  },

  removeSource: async (sourceId: string) => {
    try {
      const sources = get().sources;
      const sourceToRemove = sources.find((s) => s.id === sourceId);

      if (!sourceToRemove) {
        throw new Error('Source not found');
      }

      // Cannot remove if it's the only source
      if (sources.length === 1) {
        throw new Error('Cannot remove the only source');
      }

      // Remove from state
      const updatedSources = sources.filter((s) => s.id !== sourceId);

      // If removed source was default, make first source default
      if (sourceToRemove.isDefault && updatedSources.length > 0 && updatedSources[0]) {
        updatedSources[0].isDefault = true;
      }

      // If removed source was selected, select first source
      const selectedSourceId = get().selectedSourceId;
      const newSelectedId = selectedSourceId === sourceId ? updatedSources[0]?.id || null : selectedSourceId;

      set({ sources: updatedSources, selectedSourceId: newSelectedId });

      // Save to persistent storage
      await get().persistSources();

      console.log(`✅ Removed source: ${sourceToRemove.name}`);
    } catch (error) {
      const errorMessage = `Failed to remove source: ${(error as Error).message}`;
      set({ error: errorMessage });
      throw error;
    }
  },

  updateSource: async (sourceId: string, updates: Partial<UniversalSource>) => {
    try {
      const sources = get().sources;
      const index = sources.findIndex((s) => s.id === sourceId);

      if (index === -1) {
        throw new Error('Source not found');
      }

      // Update source
      const updatedSource = { ...sources[index], ...updates } as UniversalSource;
      const updatedSources = [...sources];
      updatedSources[index] = updatedSource;

      set({ sources: updatedSources });

      // Save to persistent storage
      await get().persistSources();

      console.log(`✅ Updated source: ${updatedSource.name}`);
    } catch (error) {
      const errorMessage = `Failed to update source: ${(error as Error).message}`;
      set({ error: errorMessage });
      throw error;
    }
  },

  setDefaultSource: async (sourceId: string) => {
    try {
      const sources = get().sources;

      // Clear all defaults
      const updatedSources = sources.map((s) => ({
        ...s,
        isDefault: s.id === sourceId,
      }));

      set({ sources: updatedSources });

      // Save to persistent storage
      await get().persistSources();

      console.log(`✅ Set default source: ${sourceId}`);
    } catch (error) {
      const errorMessage = `Failed to set default source: ${(error as Error).message}`;
      set({ error: errorMessage });
      throw error;
    }
  },

  refreshSource: async (sourceId: string) => {
    try {
      const sources = get().sources;
      const source = sources.find((s) => s.id === sourceId);

      if (!source) {
        throw new Error('Source not found');
      }

      // Get adapter
      const adapter = adapterRegistry.get(source.providerId);

      // Health check
      const healthStatus = await adapter.healthCheck(source.path);

      // Scan projects
      const scanResult = await adapter.scanProjects(source.path, sourceId);

      // Update stats
      const updatedSource: Partial<UniversalSource> = {
        isAvailable: healthStatus === 'healthy' || healthStatus === 'degraded',
        healthStatus,
        lastValidation: new Date().toISOString(),
        stats: {
          ...source.stats,
          projectCount: scanResult.success && scanResult.metadata ? scanResult.metadata.itemsFound : 0,
          sessionCount: scanResult.success && scanResult.data
            ? scanResult.data.reduce((sum, p) => sum + p.sessionCount, 0)
            : 0,
          messageCount: scanResult.success && scanResult.data
            ? scanResult.data.reduce((sum, p) => sum + (p.totalMessages || 0), 0)
            : 0,
        },
        lastScanAt: new Date().toISOString(),
      };

      // Update state
      await get().updateSource(sourceId, updatedSource);

      console.log(`✅ Refreshed source: ${source.name}`);
    } catch (error) {
      console.error(`Failed to refresh source ${sourceId}:`, error);
      // Update source as degraded
      const source = get().sources.find((s) => s.id === sourceId);
      if (source) {
        await get().updateSource(sourceId, {
          isAvailable: false,
          healthStatus: 'offline',
        });
      }
    }
  },

  refreshAllSources: async () => {
    const sources = get().sources;

    // Refresh all sources in parallel
    await Promise.allSettled(
      sources.map((source) => get().refreshSource(source.id))
    );

    console.log('✅ Refreshed all sources');
  },

  // ------------------------------------------------------------------------
  // SELECTION
  // ------------------------------------------------------------------------

  selectSource: (sourceId: string | null) => {
    set({ selectedSourceId: sourceId });

    // Save selected source to storage
    if (sourceId) {
      load('sources.json', { autoSave: false } as StoreOptions)
        .then((store) => {
          store.set(SELECTED_SOURCE_KEY, sourceId);
          return store.save();
        })
        .catch((err) => {
          console.error('Failed to save selected source:', err);
        });
    }
  },

  getSelectedSource: () => {
    const { sources, selectedSourceId } = get();
    if (!selectedSourceId) return null;
    return sources.find((s) => s.id === selectedSourceId) || null;
  },

  // ------------------------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------------------------

  validatePath: async (path: string) => {
    set({ isValidatingSource: true, validationError: null });

    try {
      // Use adapter registry to detect provider
      const detection = await adapterRegistry.detectProvider(path);

      if (!detection.success || !detection.providerId) {
        return {
          isValid: false,
          error: detection.error || 'No compatible provider found',
        };
      }

      return {
        isValid: true,
        providerId: detection.providerId,
      };
    } catch (error) {
      return {
        isValid: false,
        error: (error as Error).message,
      };
    } finally {
      set({ isValidatingSource: false });
    }
  },

  // ------------------------------------------------------------------------
  // ERROR HANDLING
  // ------------------------------------------------------------------------

  setError: (error: string | null) => {
    set({ error });
  },

  clearErrors: () => {
    set({ error: null, validationError: null });
  },

  // ------------------------------------------------------------------------
  // PERSISTENCE (INTERNAL)
  // ------------------------------------------------------------------------

  persistSources: async () => {
    try {
      const store = await load('sources.json', { autoSave: false } as StoreOptions);
      await store.set(SOURCES_STORAGE_KEY, get().sources);
      await store.save();
      console.log('💾 Sources persisted to storage');
    } catch (error) {
      console.error('Failed to persist sources:', error);
      throw error;
    }
  },
}));
