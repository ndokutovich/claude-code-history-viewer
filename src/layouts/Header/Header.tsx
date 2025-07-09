import {
  Loader2,
  RefreshCw,
  BarChart3,
  MessageSquare,
  Activity,
} from "lucide-react";

import { TooltipButton } from "@/shared/TooltipButton";
import { useAppStore } from "@/store/useAppStore";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { useTranslation } from "react-i18next";
import type { ProjectStatsSummary, SessionComparison } from "@/types";
import { SettingDropdown } from "./SettingDropdown";

export const Header = () => {
  const [showTokenStats, setShowTokenStats] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [projectSummary, setProjectSummary] =
    useState<ProjectStatsSummary | null>(null);
  const [sessionComparison, setSessionComparison] =
    useState<SessionComparison | null>(null);

  const { t } = useTranslation("common");
  const { t: tComponents } = useTranslation("components");
  const { t: tMessages } = useTranslation("messages");

  const {
    selectedProject,
    selectedSession,
    isLoadingMessages,
    isLoadingTokenStats,
    loadProjectTokenStats,
    loadProjectStatsSummary,
    loadSessionComparison,
    clearTokenStats,
    refreshCurrentSession,
    loadSessionTokenStats,
  } = useAppStore();

  // 토큰 통계 로드
  const handleLoadTokenStats = async () => {
    if (!selectedProject) return;

    try {
      // 프로젝트 전체 통계 로드
      await loadProjectTokenStats(selectedProject.path);

      // 현재 세션 통계 로드 (선택된 경우)
      if (selectedSession) {
        // Use file_path from session directly
        const sessionPath = selectedSession.file_path;
        await loadSessionTokenStats(sessionPath);
      }

      setShowTokenStats(true);
      setShowAnalytics(false);
    } catch (error) {
      console.error("Failed to load token stats:", error);
    }
  };

  // 분석 대시보드 로드
  const handleLoadAnalytics = async () => {
    if (!selectedProject) return;

    try {
      setShowAnalytics(true);
      setShowTokenStats(false);

      // Load project summary
      const summary = await loadProjectStatsSummary(selectedProject.path);
      setProjectSummary(summary);

      // Load session comparison if session is selected
      if (selectedSession) {
        const comparison = await loadSessionComparison(
          selectedSession.session_id,
          selectedProject.path
        );
        setSessionComparison(comparison);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    }
  };

  return (
    <header
      className={cn(
        "px-6 py-4 border-b",
        COLORS.ui.background.secondary,
        COLORS.ui.border.light
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="/app-icon.png"
            alt="Claude Code History Viewer"
            className="w-10 h-10"
          />
          <div>
            <h1 className={cn("text-xl font-semibold", COLORS.ui.text.primary)}>
              {t("appName")}
            </h1>
            <p className={cn("text-sm", COLORS.ui.text.muted)}>
              {t("appDescription")}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {selectedProject && (
            <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
              <span className="font-medium">{selectedProject.name}</span>
              {selectedSession && (
                <>
                  <span className="mx-2">›</span>
                  <span>
                    {tComponents("session.title")}{" "}
                    {selectedSession.session_id.slice(-8)}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            {selectedProject && (
              <>
                <TooltipButton
                  content={tComponents("analytics.dashboard")}
                  onClick={() => {
                    if (showAnalytics) {
                      setShowAnalytics(false);
                      setProjectSummary(null);
                      setSessionComparison(null);
                    } else {
                      handleLoadAnalytics();
                    }
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    showAnalytics
                      ? COLORS.semantic.info.bgDark
                      : COLORS.ui.interactive.hover
                  )}
                >
                  <BarChart3
                    className={cn("w-5 h-5", COLORS.ui.text.primary)}
                  />
                </TooltipButton>
                <TooltipButton
                  onClick={() => {
                    if (showTokenStats) {
                      setShowTokenStats(false);
                      clearTokenStats();
                    } else {
                      handleLoadTokenStats();
                    }
                  }}
                  disabled={isLoadingTokenStats}
                  className={cn(
                    "p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    showTokenStats
                      ? COLORS.semantic.success.bgDark
                      : COLORS.ui.interactive.hover
                  )}
                  content={tMessages("tokenStats.existing")}
                >
                  {isLoadingTokenStats ? (
                    <Loader2
                      className={cn(
                        "w-5 h-5 animate-spin",
                        COLORS.ui.text.primary
                      )}
                    />
                  ) : (
                    <Activity
                      className={cn("w-5 h-5", COLORS.ui.text.primary)}
                    />
                  )}
                </TooltipButton>
              </>
            )}

            {selectedSession && (
              <>
                <TooltipButton
                  onClick={() => {
                    if (showTokenStats || showAnalytics) {
                      setShowTokenStats(false);
                      setShowAnalytics(false);
                      clearTokenStats();
                      setProjectSummary(null);
                      setSessionComparison(null);
                    }
                  }}
                  disabled={!showTokenStats && !showAnalytics}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    !showTokenStats && !showAnalytics
                      ? cn(
                          COLORS.semantic.success.bgDark,
                          COLORS.semantic.success.text
                        )
                      : cn(
                          COLORS.ui.text.disabled,
                          "hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                        )
                  )}
                  content={tComponents("message.view")}
                >
                  <MessageSquare
                    className={cn("w-5 h-5", COLORS.ui.text.primary)}
                  />
                </TooltipButton>
                <TooltipButton
                  onClick={() => refreshCurrentSession()}
                  disabled={isLoadingMessages}
                  className={cn(
                    "p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    COLORS.ui.text.disabled,
                    "hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                  )}
                  content={tComponents("session.refresh")}
                >
                  <RefreshCw
                    className={cn(
                      "w-5 h-5",
                      isLoadingMessages ? "animate-spin" : "",
                      COLORS.ui.text.primary
                    )}
                  />
                </TooltipButton>
              </>
            )}

            {/* // 여기 다시 드롭다운 */}
            <SettingDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};
