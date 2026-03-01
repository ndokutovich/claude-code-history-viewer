/**
 * Provider Slice
 *
 * Manages provider selection and health status:
 * - defaultProviderId: the provider used when none is explicitly specified
 * - providerHealthStatus: per-provider health check results
 * - detectedProviders: providers detected on this system (v1.9.0)
 * - isDetectingProviders: loading flag for detection (v1.9.0)
 * - activeProviderIds: user-selected subset of detected providers (v1.9.0)
 */

import type { DetectedProvider } from '../../types/providers';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// State Interface
// ============================================================================

export interface ProviderSliceState {
  /** ID of the default provider (used when none is explicitly specified) */
  defaultProviderId: string;
  /** Per-provider health status keyed by provider ID */
  providerHealthStatus: Record<string, 'ok' | 'error' | 'unknown'>;
  /** Providers detected on this system (v1.9.0) */
  detectedProviders: DetectedProvider[];
  /** True while detect_providers command is running (v1.9.0) */
  isDetectingProviders: boolean;
  /** User-selected subset of detected provider ids (v1.9.0) */
  activeProviderIds: string[];
}

export interface ProviderSliceActions {
  setDefaultProviderId: (id: string) => void;
  setProviderHealthStatus: (status: Record<string, 'ok' | 'error' | 'unknown'>) => void;
  /** Replace the detected provider list (v1.9.0) */
  setDetectedProviders: (providers: DetectedProvider[]) => void;
  /** Set the detecting-providers loading flag (v1.9.0) */
  setIsDetectingProviders: (loading: boolean) => void;
  /** Replace the active provider id list (v1.9.0) */
  setActiveProviderIds: (ids: string[]) => void;
  /**
   * Invoke the Tauri `detect_providers` command, update `detectedProviders`,
   * and set `activeProviderIds` to all available ones. (v1.9.0)
   */
  detectProviders: () => Promise<void>;
}

export type ProviderSlice = ProviderSliceState & ProviderSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialProviderState: ProviderSliceState = {
  defaultProviderId: 'claude-code',
  providerHealthStatus: {},
  detectedProviders: [],
  isDetectingProviders: false,
  activeProviderIds: ['claude-code'],
};

// ============================================================================
// Slice factory  (called by useAppStore to wire state + actions)
// ============================================================================

/**
 * Build the provider slice actions.
 * `set` and `get` come from Zustand's `StateCreator` pattern.
 */
export function createProviderSliceActions(
  set: (partial: Partial<ProviderSliceState>) => void,
): ProviderSliceActions {
  return {
    setDefaultProviderId: (id) => set({ defaultProviderId: id }),

    setProviderHealthStatus: (status) => set({ providerHealthStatus: status }),

    setDetectedProviders: (providers) => set({ detectedProviders: providers }),

    setIsDetectingProviders: (loading) => set({ isDetectingProviders: loading }),

    setActiveProviderIds: (ids) => set({ activeProviderIds: ids }),

    detectProviders: async () => {
      set({ isDetectingProviders: true });
      try {
        const providers = await invoke<DetectedProvider[]>('detect_providers');
        const availableIds = providers
          .filter((p) => p.is_available)
          .map((p) => p.id);
        set({
          detectedProviders: providers,
          activeProviderIds: availableIds,
        });
      } catch (err) {
        console.error('[providerSlice] detect_providers failed:', err);
      } finally {
        set({ isDetectingProviders: false });
      }
    },
  };
}
