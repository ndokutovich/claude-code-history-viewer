/**
 * Filter Slice
 *
 * Handles message display filter preferences:
 * - showSystemMessages: whether to include system messages in the message list
 * - metricMode: which metric to display in analytics views (tokens vs cost)
 * - excludeSidechain: whether to exclude sidechain messages
 */

import type { MetricMode } from "../../types";

// ============================================================================
// State Interface
// ============================================================================

export interface FilterSliceState {
  /** Whether to show system messages in the message list */
  showSystemMessages: boolean;
  /** Metric mode for analytics views */
  metricMode: MetricMode;
  /** Whether to exclude sidechain messages globally */
  excludeSidechain: boolean;
  /** Per-session sidechain filter (persists during pagination) */
  sessionExcludeSidechain: boolean;
}

export interface FilterSliceActions {
  setShowSystemMessages: (show: boolean) => void;
  setMetricMode: (mode: MetricMode) => void;
  setExcludeSidechain: (exclude: boolean) => void;
}

export type FilterSlice = FilterSliceState & FilterSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialFilterState: FilterSliceState = {
  showSystemMessages: false,
  metricMode: "tokens",
  excludeSidechain: true,
  sessionExcludeSidechain: true,
};
