/**
 * Project Slice
 *
 * Manages extended project-level loading state:
 * - isLoadingAllSessions: whether all sessions across all projects are being loaded
 * - projectsLastRefreshed: epoch timestamp of the most recent project scan
 */

// ============================================================================
// State Interface
// ============================================================================

export interface ProjectSliceState {
  /** Whether an all-sessions background load is in progress */
  isLoadingAllSessions: boolean;
  /** Epoch timestamp (ms) of the most recent project scan, or null if never */
  projectsLastRefreshed: number | null;
}

export interface ProjectSliceActions {
  setIsLoadingAllSessions: (loading: boolean) => void;
  setProjectsLastRefreshed: (timestamp: number | null) => void;
}

export type ProjectSlice = ProjectSliceState & ProjectSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialProjectState: ProjectSliceState = {
  isLoadingAllSessions: false,
  projectsLastRefreshed: null,
};
