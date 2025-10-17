/**
 * Analytics Hook
 *
 * Thin wrapper over useAppStore for analytics-related functionality.
 * Provides backward compatibility while using the unified view state.
 *
 * High cohesion: All analytics-related business logic is concentrated in one place
 * Low coupling: Components only need to depend on this hook
 * Readability: Clear function names and predictable behavior
 */

import { useCallback, useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import type { AppView } from "../types";

export interface UseAnalyticsReturn {
  // Current view
  readonly currentView: AppView;

  // Actions
  readonly actions: {
    switchToMessages: () => Promise<void>;
    switchToTokenStats: () => Promise<void>;
    switchToAnalytics: () => Promise<void>;
    switchToSearch: () => Promise<void>;
    refreshAnalytics: () => Promise<void>;
    clearAll: () => void;
  };

  // Computed values
  readonly computed: {
    isTokenStatsView: boolean;
    isAnalyticsView: boolean;
    isMessagesView: boolean;
    isSearchView: boolean;
    hasAnyError: boolean;
    isAnyLoading: boolean;
  };
}

export const useAnalytics = (): UseAnalyticsReturn => {
  const {
    // Root-level view state
    currentView,
    selectedProject,

    // Loading states
    isLoadingTokenStats,
    isLoadingProjectSummary,
    isLoadingSessionComparison,

    // Error states
    projectSummaryError,
    sessionComparisonError,

    // Actions
    switchView,
    clearTokenStats,
    clearAnalyticsData,
    clearAnalyticsErrors,
  } = useAppStore();

  /**
   * Switch to messages view
   */
  const switchToMessages = useCallback(async () => {
    await switchView("messages");
    clearAnalyticsErrors();
  }, [switchView, clearAnalyticsErrors]);

  /**
   * Switch to token statistics view
   */
  const switchToTokenStats = useCallback(async () => {
    if (!selectedProject) {
      throw new Error("No project selected.");
    }
    await switchView("tokenStats");
  }, [selectedProject, switchView]);

  /**
   * Switch to analytics view
   */
  const switchToAnalytics = useCallback(async () => {
    if (!selectedProject) {
      throw new Error("No project selected.");
    }
    await switchView("analytics");
  }, [selectedProject, switchView]);

  /**
   * Switch to search view
   */
  const switchToSearch = useCallback(async () => {
    await switchView("search");
  }, [switchView]);

  /**
   * Refresh analytics data for the current view
   */
  const refreshAnalytics = useCallback(async () => {
    // Simply re-invoke switchView with current view to reload data
    await switchView(currentView);
  }, [currentView, switchView]);

  /**
   * Clear all analytics state
   */
  const clearAll = useCallback(() => {
    clearAnalyticsData();
    clearTokenStats();
  }, [clearAnalyticsData, clearTokenStats]);

  /**
   * Computed values (performance optimization with memoization)
   */
  const computed = useMemo(
    () => ({
      isTokenStatsView: currentView === "tokenStats",
      isAnalyticsView: currentView === "analytics",
      isMessagesView: currentView === "messages",
      isSearchView: currentView === "search",
      hasAnyError: !!(projectSummaryError || sessionComparisonError),
      isAnyLoading:
        isLoadingProjectSummary ||
        isLoadingSessionComparison ||
        isLoadingTokenStats,
    }),
    [
      currentView,
      projectSummaryError,
      sessionComparisonError,
      isLoadingProjectSummary,
      isLoadingSessionComparison,
      isLoadingTokenStats,
    ]
  );

  return {
    currentView,
    actions: {
      switchToMessages,
      switchToTokenStats,
      switchToAnalytics,
      switchToSearch,
      refreshAnalytics,
      clearAll,
    },
    computed,
  };
};
