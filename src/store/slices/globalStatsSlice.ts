/**
 * Global Stats Slice
 *
 * Manages cross-project aggregated statistics:
 * - globalStats: aggregated stats summary across all projects
 * - isLoadingGlobalStats: loading flag
 * - globalStatsError: error message if load failed
 */

import type { ProjectStatsSummary } from '../../types';

// ============================================================================
// State Interface
// ============================================================================

export interface GlobalStatsSliceState {
  /** Aggregated stats summary across all projects, or null if not yet loaded */
  globalStats: ProjectStatsSummary | null;
  /** Whether global stats are currently being loaded */
  isLoadingGlobalStats: boolean;
  /** Error message from the last global stats load attempt, or null */
  globalStatsError: string | null;
}

export interface GlobalStatsSliceActions {
  setGlobalStats: (stats: ProjectStatsSummary | null) => void;
  setIsLoadingGlobalStats: (loading: boolean) => void;
  setGlobalStatsError: (error: string | null) => void;
}

export type GlobalStatsSlice = GlobalStatsSliceState & GlobalStatsSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialGlobalStatsState: GlobalStatsSliceState = {
  globalStats: null,
  isLoadingGlobalStats: false,
  globalStatsError: null,
};
