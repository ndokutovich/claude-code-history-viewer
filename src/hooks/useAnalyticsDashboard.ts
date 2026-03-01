/**
 * useAnalyticsDashboard Hook
 *
 * Adapter hook that maps the fork's monolithic store fields
 * to what the AnalyticsDashboard component expects.
 */

import { useState, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import type { GlobalStatsSummary } from "../types";

interface DateFilter {
  start: Date | null;
  end: Date | null;
}

export function useAnalyticsDashboard() {
  const selectedProject = useAppStore((s) => s.selectedProject);
  const selectedSession = useAppStore((s) => s.selectedSession);
  const sessionTokenStats = useAppStore((s) => s.sessionTokenStats);
  const projectStatsSummary = useAppStore((s) => s.projectStatsSummary);
  const sessionComparison = useAppStore((s) => s.sessionComparison);

  // Date filter is local state until global stats slice is added
  const [dateFilter, setDateFilter] = useState<DateFilter>({
    start: null,
    end: null,
  });

  const handleSetDateFilter = useCallback((filter: DateFilter) => {
    setDateFilter(filter);
  }, []);

  return {
    selectedProject,
    selectedSession,
    sessionTokenStats,
    // Fork doesn't separate billing vs conversation stats yet
    sessionConversationTokenStats: sessionTokenStats,
    // Global stats - not yet wired up
    globalSummary: null as GlobalStatsSummary | null,
    globalConversationSummary: null as GlobalStatsSummary | null,
    isLoadingGlobalStats: false,
    // Project-level analytics
    projectSummary: projectStatsSummary,
    projectConversationSummary: projectStatsSummary,
    sessionComparison,
    // Date filtering
    dateFilter,
    setDateFilter: handleSetDateFilter,
  };
}
