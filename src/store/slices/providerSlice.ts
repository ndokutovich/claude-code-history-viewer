/**
 * Provider Slice
 *
 * Manages provider selection and health status:
 * - defaultProviderId: the provider used when none is explicitly specified
 * - providerHealthStatus: per-provider health check results
 */

// ============================================================================
// State Interface
// ============================================================================

export interface ProviderSliceState {
  /** ID of the default provider (used when none is explicitly specified) */
  defaultProviderId: string;
  /** Per-provider health status keyed by provider ID */
  providerHealthStatus: Record<string, 'ok' | 'error' | 'unknown'>;
}

export interface ProviderSliceActions {
  setDefaultProviderId: (id: string) => void;
  setProviderHealthStatus: (status: Record<string, 'ok' | 'error' | 'unknown'>) => void;
}

export type ProviderSlice = ProviderSliceState & ProviderSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialProviderState: ProviderSliceState = {
  defaultProviderId: 'claude-code',
  providerHealthStatus: {},
};
