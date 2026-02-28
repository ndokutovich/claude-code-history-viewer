/**
 * Analytics-related type definitions
 * Clear type structure for readability and predictability
 */

import type { ProjectStatsSummary, SessionComparison, RecentEditsResult, StatsMode, MetricMode } from './index';
import type { RecentEditsPaginationState } from '../utils/pagination';

/**
 * App-wide view types (unified view state)
 * Re-export from index.ts to maintain single source of truth
 */
export type { AppView } from './index';

/**
 * Pagination state for recent edits
 * Re-exported from pagination utilities for backwards compatibility
 */
export type RecentEditsPagination = RecentEditsPaginationState;

/**
 * Analytics view type
 */
export type AnalyticsView = 'messages' | 'tokenStats' | 'analytics' | 'recentEdits' | 'settings' | 'board' | 'files' | 'commandHistory' | 'rawMessage';
export type AnalyticsViewType = AnalyticsView;

/**
 * Analytics state interface
 * - High cohesion: Groups related states together
 * - Low coupling: Each state can be managed independently
 */
export interface AnalyticsState {
  // Currently active view
  currentView: AnalyticsView;
  statsMode: StatsMode;
  metricMode: MetricMode;

  // Data state
  projectSummary: ProjectStatsSummary | null;
  projectConversationSummary: ProjectStatsSummary | null;
  sessionComparison: SessionComparison | null;
  recentEdits: RecentEditsResult | null;
  recentEditsPagination: RecentEditsPagination;

  recentEditsSearchQuery: string;

  // Loading states
  isLoadingProjectSummary: boolean;
  isLoadingSessionComparison: boolean;
  isLoadingRecentEdits: boolean;

  // Error states
  projectSummaryError: string | null;
  sessionComparisonError: string | null;
  recentEditsError: string | null;
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
  setProjectConversationSummary: (summary: ProjectStatsSummary | null) => void;
  setSessionComparison: (comparison: SessionComparison | null) => void;
  setRecentEdits: (edits: RecentEditsResult | null) => void;
  setRecentEditsSearchQuery: (query: string) => void;

  // Loading state management
  setLoadingProjectSummary: (loading: boolean) => void;
  setLoadingSessionComparison: (loading: boolean) => void;
  setLoadingRecentEdits: (loading: boolean) => void;

  // Error state management
  setProjectSummaryError: (error: string | null) => void;
  setSessionComparisonError: (error: string | null) => void;
  setRecentEditsError: (error: string | null) => void;

  // Composite actions (business logic)
  switchToMessages: () => void;
  switchToTokenStats: () => void;
  switchToAnalytics: () => void;
  switchToRecentEdits: () => void;
  setStatsMode: (mode: StatsMode, options?: { isViewingGlobalStats?: boolean }) => Promise<void>;
  setMetricMode: (mode: MetricMode) => void;

  // Reset actions
  resetAnalytics: () => void;
  clearErrors: () => void;
}

/**
 * Initial analytics state
 */
import { createInitialRecentEditsPagination } from '../utils/pagination';

export const initialRecentEditsPagination: RecentEditsPagination =
  createInitialRecentEditsPagination();

export const initialAnalyticsState: AnalyticsState = {
  currentView: 'messages',
  statsMode: "billing_total",
  metricMode: "tokens",
  projectSummary: null,
  projectConversationSummary: null,
  sessionComparison: null,
  recentEdits: null,
  recentEditsPagination: initialRecentEditsPagination,
  recentEditsSearchQuery: "",
  isLoadingProjectSummary: false,
  isLoadingSessionComparison: false,
  isLoadingRecentEdits: false,
  projectSummaryError: null,
  sessionComparisonError: null,
  recentEditsError: null,
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
    switchToRecentEdits: () => Promise<void>;
    switchToSettings: () => void;
    switchToBoard: () => Promise<void>;
    setStatsMode: (mode: StatsMode, options?: { isViewingGlobalStats?: boolean }) => Promise<void>;
    setMetricMode: (mode: MetricMode) => void;
    refreshAnalytics: () => Promise<void>;
    clearAll: () => void;
  };

  // Computed values
  readonly computed: {
    isTokenStatsView: boolean;
    isAnalyticsView: boolean;
    isMessagesView: boolean;
    isRecentEditsView: boolean;
    isSettingsView: boolean;
    isBoardView: boolean;
    isFilesView: boolean;
    isCommandHistoryView: boolean;
    isRawMessageView: boolean;
    hasAnyError: boolean;
    isLoadingAnalytics: boolean;
    isLoadingTokenStats: boolean;
    isLoadingRecentEdits: boolean;
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
