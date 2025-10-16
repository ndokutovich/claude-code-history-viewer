/**
 * Analytics Hook
 *
 * Thin wrapper over useAppStore for analytics-related functionality.
 * Provides backward compatibility while using the unified view state.
 *
 * 높은 응집도: Analytics 관련 모든 비즈니스 로직을 한 곳에 집중
 * 낮은 결합도: 컴포넌트는 이 hook만 의존하면 됨
 * 가독성: 명확한 함수명과 예측 가능한 동작
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
   * 메시지 뷰로 전환
   */
  const switchToMessages = useCallback(async () => {
    await switchView("messages");
    clearAnalyticsErrors();
  }, [switchView, clearAnalyticsErrors]);

  /**
   * 토큰 통계 뷰로 전환
   */
  const switchToTokenStats = useCallback(async () => {
    if (!selectedProject) {
      throw new Error("프로젝트가 선택되지 않았습니다.");
    }
    await switchView("tokenStats");
  }, [selectedProject, switchView]);

  /**
   * 분석 뷰로 전환
   */
  const switchToAnalytics = useCallback(async () => {
    if (!selectedProject) {
      throw new Error("프로젝트가 선택되지 않았습니다.");
    }
    await switchView("analytics");
  }, [selectedProject, switchView]);

  /**
   * 검색 뷰로 전환
   */
  const switchToSearch = useCallback(async () => {
    await switchView("search");
  }, [switchView]);

  /**
   * 현재 뷰의 분석 데이터 새로고침
   */
  const refreshAnalytics = useCallback(async () => {
    // Simply re-invoke switchView with current view to reload data
    await switchView(currentView);
  }, [currentView, switchView]);

  /**
   * 모든 analytics 상태 초기화
   */
  const clearAll = useCallback(() => {
    clearAnalyticsData();
    clearTokenStats();
  }, [clearAnalyticsData, clearTokenStats]);

  /**
   * 계산된 값들 (메모이제이션으로 성능 최적화)
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
