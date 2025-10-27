/**
 * Analytics-related type definitions
 * Clear type structure for readability and predictability
 */

import type { ProjectStatsSummary, SessionComparison } from './index';

/**
 * App-wide view types (unified view state)
 * Re-export from index.ts to maintain single source of truth
 */
export type { AppView } from './index';

/**
 * @deprecated Use AppView instead. Kept for backward compatibility during migration.
 */
export type AnalyticsView = 'messages' | 'tokenStats' | 'analytics';
export type AnalyticsViewType = AnalyticsView;

/**
 * Analytics state interface
 * - High cohesion: Groups related states together
 * - Low coupling: Each state can be managed independently
 */
export interface AnalyticsState {
  // Currently active view
  currentView: AnalyticsView;

  // Data state
  projectSummary: ProjectStatsSummary | null;
  sessionComparison: SessionComparison | null;

  // Loading states
  isLoadingProjectSummary: boolean;
  isLoadingSessionComparison: boolean;

  // Error states
  projectSummaryError: string | null;
  sessionComparisonError: string | null;
}

/**
 * Analytics action interface
 * Each action performs a single responsibility following the Single Responsibility Principle
 */
export interface AnalyticsActions {
  // View transitions
  setCurrentView: (view: AnalyticsView) => void;

  // Data setters
  setProjectSummary: (summary: ProjectStatsSummary | null) => void;
  setSessionComparison: (comparison: SessionComparison | null) => void;

  // Loading state management
  setLoadingProjectSummary: (loading: boolean) => void;
  setLoadingSessionComparison: (loading: boolean) => void;

  // Error state management
  setProjectSummaryError: (error: string | null) => void;
  setSessionComparisonError: (error: string | null) => void;

  // Composite actions (business logic)
  switchToMessages: () => void;
  switchToTokenStats: () => void;
  switchToAnalytics: () => void;
  switchToFiles: () => void;

  // Reset actions
  resetAnalytics: () => void;
  clearErrors: () => void;
}

/**
 * Initial analytics state
 */
export const initialAnalyticsState: AnalyticsState = {
  currentView: 'messages',
  projectSummary: null,
  sessionComparison: null,
  isLoadingProjectSummary: false,
  isLoadingSessionComparison: false,
  projectSummaryError: null,
  sessionComparisonError: null,
};

/**
 * Analytics hook return type
 * Exposes only the minimal interface needed by components
 */
export interface UseAnalyticsReturn {
  // State (read-only)
  readonly state: AnalyticsState;

  // Actions (with predictable names)
  readonly actions: {
    switchToMessages: () => void;
    switchToTokenStats: () => Promise<void>;
    switchToAnalytics: () => Promise<void>;
    switchToFiles: () => Promise<void>;
    refreshAnalytics: () => Promise<void>;
    clearAll: () => void;
  };

  // Computed values
  readonly computed: {
    isTokenStatsView: boolean;
    isAnalyticsView: boolean;
    isMessagesView: boolean;
    hasAnyError: boolean;
    isAnyLoading: boolean;
  };
}

/**
 * Analytics context type
 * Context containing project and session information
 */
export interface AnalyticsContext {
  selectedProject: {
    name: string;
    path: string;
  } | null;
  selectedSession: {
    session_id: string;
    file_path: string;
  } | null;
}