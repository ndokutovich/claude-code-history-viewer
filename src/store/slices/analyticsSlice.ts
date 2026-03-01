/**
 * Analytics Slice
 *
 * Holds analytics-related state extracted from the monolithic store:
 * - Token statistics (session-level and project-level)
 * - Project stats summary (activity heatmaps, tool usage)
 * - Session comparison data (ranking / percentiles)
 * - Loading and error states for all the above
 *
 * Actions live in useAppStore because they depend on cross-cutting
 * concerns (selectedProject, selectedSession, invoke, provider routing).
 * This file provides the state shape and initial values only.
 */

import type {
  SessionTokenStats,
  ProjectStatsSummary,
  SessionComparison,
} from "../../types";

// ============================================================================
// State Interface
// ============================================================================

/**
 * Analytics slice state.
 *
 * Many of these fields are also declared in `AppState` (types/index.ts).
 * The interface below documents the full set; the `AppStore` composes them
 * by extending both `AppState` and `AnalyticsSliceActions` — no runtime
 * duplication occurs.
 */
export interface AnalyticsSliceState {
  /** Token stats for the currently selected session */
  sessionTokenStats: SessionTokenStats | null;
  /** Token stats per session for the currently selected project */
  projectTokenStats: SessionTokenStats[];
  /** Aggregated project stats summary (activity heatmap, tool usage) */
  projectStatsSummary: ProjectStatsSummary | null;
  /** Percentile/ranking comparison for the currently selected session */
  sessionComparison: SessionComparison | null;
  /** Loading flag for token stats */
  isLoadingTokenStats: boolean;
  /** Loading flag for project summary */
  isLoadingProjectSummary: boolean;
  /** Loading flag for session comparison */
  isLoadingSessionComparison: boolean;
  /** Error message from project summary load */
  projectSummaryError: string | null;
  /** Error message from session comparison load */
  sessionComparisonError: string | null;
}

export interface AnalyticsSliceActions {
  setProjectSummary: (summary: ProjectStatsSummary | null) => void;
  setSessionComparison: (comparison: SessionComparison | null) => void;
  setLoadingProjectSummary: (loading: boolean) => void;
  setLoadingSessionComparison: (loading: boolean) => void;
  setProjectSummaryError: (error: string | null) => void;
  setSessionComparisonError: (error: string | null) => void;
  clearAnalyticsData: () => void;
  clearAnalyticsErrors: () => void;
}

export type AnalyticsSlice = AnalyticsSliceState & AnalyticsSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialAnalyticsState: AnalyticsSliceState = {
  sessionTokenStats: null,
  projectTokenStats: [],
  projectStatsSummary: null,
  sessionComparison: null,
  isLoadingTokenStats: false,
  isLoadingProjectSummary: false,
  isLoadingSessionComparison: false,
  projectSummaryError: null,
  sessionComparisonError: null,
};
