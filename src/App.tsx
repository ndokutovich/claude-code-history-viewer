import { useEffect, useState } from "react";
import { ProjectTree } from "./components/ProjectTree";
import { MessageViewer } from "./components/MessageViewer";
import { TokenStatsViewer } from "./components/TokenStatsViewer";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { FolderSelector } from "./components/FolderSelector";
import { UpdateModal } from "./components/UpdateModal";
import { UpToDateNotification } from "./components/UpToDateNotification";
import { useAppStore } from "./store/useAppStore";
import { useTheme } from "./hooks/useTheme";
import { useUpdateChecker } from "./hooks/useUpdateChecker";
import { useTranslation } from "react-i18next";

import {
  AppErrorType,
  type ClaudeSession,
  type ClaudeProject,
  type Theme,
  type ProjectStatsSummary,
  type SessionComparison,
} from "./types";
import {
  AlertTriangle,
  Settings,
  Loader2,
  RefreshCw,
  BarChart3,
  MessageSquare,
  Sun,
  Moon,
  Laptop,
  Folder,
  Activity,
  Languages,
} from "lucide-react";
import { useLanguageStore } from "./store/useLanguageStore";
import { type SupportedLanguage, supportedLanguages } from "./i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import "./App.css";
import { cn } from "./utils/cn";
import { COLORS } from "./constants/colors";

function App() {
  const [showTokenStats, setShowTokenStats] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [projectSummary, setProjectSummary] =
    useState<ProjectStatsSummary | null>(null);
  const [sessionComparison, setSessionComparison] =
    useState<SessionComparison | null>(null);

  const {
    projects,
    sessions,
    selectedProject,
    selectedSession,
    messages,
    pagination,
    isLoading,
    isLoadingProjects,
    isLoadingSessions,
    isLoadingMessages,
    isLoadingTokenStats,
    error,
    sessionTokenStats,
    projectTokenStats,
    initializeApp,
    selectProject,
    selectSession,
    loadMoreMessages,
    refreshCurrentSession,
    loadSessionTokenStats,
    loadProjectTokenStats,
    loadProjectStatsSummary,
    loadSessionComparison,
    clearTokenStats,
    setClaudePath,
  } = useAppStore();

  const { theme, setTheme } = useTheme();
  const updateChecker = useUpdateChecker();
  const { t, i18n: i18nInstance } = useTranslation("common");
  const { t: tComponents } = useTranslation("components");
  const { t: tMessages } = useTranslation("messages");
  const { language, setLanguage, loadLanguage } = useLanguageStore();

  // 디버깅: 언어 상태 확인
  // console.log("Language in store:", language);
  // console.log("Language in i18n:", i18nInstance.language);

  // 세션 선택 시 토큰 통계 화면에서 채팅 화면으로 자동 전환
  const handleSessionSelect = async (session: ClaudeSession) => {
    if (showTokenStats || showAnalytics) {
      setShowTokenStats(false);
      setShowAnalytics(false);
      clearTokenStats();
    }
    await selectSession(session);

    // Load session comparison if analytics was open
    if (selectedProject && showAnalytics) {
      try {
        const comparison = await loadSessionComparison(
          session.session_id,
          selectedProject.path
        );
        setSessionComparison(comparison);
      } catch (error) {
        console.error("Failed to load session comparison:", error);
      }
    }
  };

  useEffect(() => {
    // 언어 설정 로드 후 앱 초기화
    loadLanguage().then(() => {
      initializeApp();
    });
  }, [initializeApp, loadLanguage]);

  // i18n 언어 변경 감지
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      // 스토어의 언어와 다르면 업데이트
      const currentLang = lng.startsWith("zh")
        ? lng.includes("TW") || lng.includes("HK")
          ? "zh-TW"
          : "zh-CN"
        : lng.split("-")[0];

      if (
        currentLang &&
        currentLang !== language &&
        ["en", "ko", "ja", "zh-CN", "zh-TW"].includes(currentLang)
      ) {
        useLanguageStore.setState({
          language: currentLang as SupportedLanguage,
        });
      }
    };

    i18nInstance.on("languageChanged", handleLanguageChange);
    return () => {
      i18nInstance.off("languageChanged", handleLanguageChange);
    };
  }, [language, i18nInstance]);

  // Handle errors
  useEffect(() => {
    if (error?.type === AppErrorType.CLAUDE_FOLDER_NOT_FOUND) {
      setShowFolderSelector(true);
    }
  }, [error]);

  const handleFolderSelected = async (path: string) => {
    // If user selected the .claude folder itself, use it directly
    // If user selected a parent folder containing .claude, append .claude
    let claudeFolderPath = path;
    if (!path.endsWith(".claude")) {
      claudeFolderPath = `${path}/.claude`;
    }

    setClaudePath(claudeFolderPath);
    setShowFolderSelector(false);
    await useAppStore.getState().scanProjects();
  };

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

  // 프로젝트 선택 핸들러 (분석 상태 초기화 포함)
  const handleProjectSelect = async (project: ClaudeProject) => {
    const wasAnalyticsOpen = showAnalytics;
    const wasTokenStatsOpen = showTokenStats;

    // 기존 분석 데이터 초기화
    if (showAnalytics || showTokenStats) {
      setShowAnalytics(false);
      setShowTokenStats(false);
      setProjectSummary(null);
      setSessionComparison(null);
      clearTokenStats();
    }

    // 프로젝트 선택
    await selectProject(project);

    // 분석 탭이 열려있었다면 새 프로젝트의 분석 데이터 자동 로드
    if (wasAnalyticsOpen) {
      try {
        setShowAnalytics(true);
        const summary = await loadProjectStatsSummary(project.path);
        setProjectSummary(summary);
      } catch (error) {
        console.error("Failed to auto-load analytics for new project:", error);
      }
    }

    // 토큰 통계 탭이 열려있었다면 새 프로젝트의 토큰 통계 자동 로드
    if (wasTokenStatsOpen) {
      try {
        setShowTokenStats(true);
        await loadProjectTokenStats(project.path);
      } catch (error) {
        console.error(
          "Failed to auto-load token stats for new project:",
          error
        );
      }
    }
  };

  // Show folder selector if needed
  if (showFolderSelector) {
    return (
      <FolderSelector
        onFolderSelected={handleFolderSelected}
        mode={
          error?.type === AppErrorType.CLAUDE_FOLDER_NOT_FOUND
            ? "notFound"
            : "change"
        }
        onClose={() => setShowFolderSelector(false)}
      />
    );
  }

  if (error && error.type !== AppErrorType.CLAUDE_FOLDER_NOT_FOUND) {
    return (
      <div
        className={cn(
          "h-screen flex items-center justify-center",
          COLORS.semantic.error.bg
        )}
      >
        <div className="text-center">
          <div className="mb-4">
            <AlertTriangle
              className={cn("w-12 h-12 mx-auto", COLORS.semantic.error.icon)}
            />
          </div>
          <h1
            className={cn(
              "text-xl font-semibold mb-2",
              COLORS.semantic.error.text
            )}
          >
            {t("errorOccurred")}
          </h1>
          <p className={cn("mb-4", COLORS.semantic.error.text)}>
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className={cn(
              "px-4 py-2 rounded-lg transition-colors",
              COLORS.semantic.error.bg,
              COLORS.semantic.error.text
            )}
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-screen flex flex-col", COLORS.ui.background.primary)}>
      {/* Header */}
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
              <h1
                className={cn("text-xl font-semibold", COLORS.ui.text.primary)}
              >
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
                  <button
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
                    title={tComponents("analytics.dashboard")}
                  >
                    <BarChart3
                      className={cn("w-5 h-5", COLORS.ui.text.primary)}
                    />
                  </button>

                  <button
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
                    title={tMessages("tokenStats.existing")}
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
                  </button>
                </>
              )}

              {selectedSession && (
                <>
                  <button
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
                    title={tComponents("message.view")}
                  >
                    <MessageSquare
                      className={cn("w-5 h-5", COLORS.ui.text.primary)}
                    />
                  </button>

                  <button
                    onClick={() => refreshCurrentSession()}
                    disabled={isLoadingMessages}
                    className={cn(
                      "p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                      COLORS.ui.text.disabled,
                      "hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                    )}
                    title={tComponents("session.refresh")}
                  >
                    <RefreshCw
                      className={cn(
                        "w-5 h-5",
                        isLoadingMessages ? "animate-spin" : "",
                        COLORS.ui.text.primary
                      )}
                    />
                  </button>
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      COLORS.ui.text.disabled,
                      "hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                    )}
                  >
                    <Settings
                      className={cn("w-5 h-5", COLORS.ui.text.primary)}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("settings.title")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setShowFolderSelector(true)}>
                    <Folder
                      className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)}
                    />
                    <span>{t("settings.changeFolder")}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>
                    {t("settings.theme.title")}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(value) => setTheme(value as Theme)}
                  >
                    <DropdownMenuRadioItem value="light">
                      <Sun
                        className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)}
                      />
                      <span>{t("settings.theme.light")}</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon
                        className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)}
                      />
                      <span>{t("settings.theme.dark")}</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <Laptop
                        className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)}
                      />
                      <span>{t("settings.theme.system")}</span>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuLabel>
                    {t("settings.language.title")}
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={language}
                    onValueChange={(value) =>
                      setLanguage(value as SupportedLanguage)
                    }
                  >
                    {Object.entries(supportedLanguages).map(([code, name]) => (
                      <DropdownMenuRadioItem key={code} value={code}>
                        <Languages
                          className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)}
                        />
                        <span>{name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => updateChecker.checkForUpdates(true)}
                  >
                    <RefreshCw
                      className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)}
                    />
                    {t("settings.checkUpdate")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <ProjectTree
          projects={projects}
          sessions={sessions}
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          onProjectSelect={handleProjectSelect}
          onSessionSelect={handleSessionSelect}
          isLoading={isLoadingProjects || isLoadingSessions}
        />

        {/* Main Content Area */}
        <div className="w-full flex flex-col relative">
          {/* Content Header */}
          {(selectedSession || showTokenStats || showAnalytics) && (
            <div
              className={cn(
                "p-4 border-b",
                COLORS.ui.background.secondary,
                COLORS.ui.border.light
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className={cn(
                      "text-lg font-semibold",
                      COLORS.ui.text.primary
                    )}
                  >
                    {showAnalytics
                      ? tComponents("analytics.dashboard")
                      : showTokenStats
                      ? tMessages("tokenStats.title")
                      : tComponents("message.conversation")}
                  </h2>
                  <span className={cn("text-sm", COLORS.ui.text.secondary)}>
                    {selectedSession?.summary ||
                      tComponents("session.summaryNotFound")}
                  </span>
                  {!showTokenStats && !showAnalytics && selectedSession && (
                    <div>
                      <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
                        {pagination.totalCount >= messages.length &&
                          ` ${pagination.totalCount || "-"}개 • `}
                        {selectedSession.has_tool_use
                          ? tComponents("tools.toolUsed")
                          : tComponents("tools.generalConversation")}
                        {selectedSession.has_errors &&
                          ` • ${tComponents("tools.errorOccurred")}`}
                      </p>
                    </div>
                  )}
                  {showTokenStats && (
                    <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
                      {tComponents("analytics.tokenUsageDetailed")}
                    </p>
                  )}
                  {showAnalytics && (
                    <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
                      {selectedSession
                        ? tComponents("analytics.projectSessionAnalysis")
                        : tComponents("analytics.projectOverallAnalysis")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {showAnalytics ? (
              <div className="h-full overflow-y-auto">
                <AnalyticsDashboard
                  selectedProject={selectedProject?.name}
                  selectedSession={selectedSession?.session_id}
                  sessionStats={sessionTokenStats}
                  projectStats={projectTokenStats}
                  projectSummary={projectSummary}
                  sessionComparison={sessionComparison}
                />
              </div>
            ) : showTokenStats ? (
              <div className="h-full overflow-y-auto p-6 space-y-8">
                <TokenStatsViewer
                  title={tMessages("tokenStats.title")}
                  sessionStats={sessionTokenStats}
                  projectStats={projectTokenStats}
                />
              </div>
            ) : selectedSession ? (
              <MessageViewer
                messages={messages}
                pagination={pagination}
                isLoading={isLoading}
                selectedSession={selectedSession}
                onLoadMore={loadMoreMessages}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className={cn("text-center", COLORS.ui.text.muted)}>
                  <MessageSquare
                    className={cn(
                      "w-16 h-16 mx-auto mb-4",
                      COLORS.ui.text.disabledDark
                    )}
                  />
                  <p className="text-lg mb-2">
                    {tComponents("session.select")}
                  </p>
                  <p className="text-sm">
                    {tComponents("session.selectDescription")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div
        className={cn(
          "px-6 py-2 border-t",
          COLORS.ui.background.secondary,
          COLORS.ui.border.light
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between text-xs",
            COLORS.ui.text.muted
          )}
        >
          <div className="flex items-center space-x-4">
            <span>
              {tComponents("project.count", { count: projects.length })}
            </span>
            <span>
              {tComponents("session.count", { count: sessions.length })}
            </span>
            {selectedSession && !showTokenStats && !showAnalytics && (
              <span>
                {tComponents("message.countWithTotal", {
                  current: messages.length,
                  total: pagination.totalCount || messages.length,
                })}
              </span>
            )}
            {showTokenStats && sessionTokenStats && (
              <span>
                {tComponents("analytics.currentSessionTokens", {
                  count: sessionTokenStats.total_tokens,
                })}
              </span>
            )}
            {showAnalytics && projectSummary && (
              <span>
                {tComponents("analytics.projectTokens", {
                  count: projectSummary.total_tokens,
                })}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {(isLoading ||
              isLoadingProjects ||
              isLoadingSessions ||
              isLoadingMessages ||
              isLoadingTokenStats) && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {isLoadingTokenStats && tComponents("status.loadingStats")}
                  {isLoadingProjects && tComponents("status.scanning")}
                  {isLoadingSessions && tComponents("status.loadingSessions")}
                  {isLoadingMessages && tComponents("status.loadingMessages")}
                  {isLoading && tComponents("status.initializing")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Update Modal */}
      {updateChecker.updateInfo && (
        <UpdateModal
          updateInfo={updateChecker.updateInfo}
          onDownload={updateChecker.downloadUpdate}
          onPostpone={updateChecker.postponeUpdate}
          onSkip={updateChecker.skipVersion}
          onClose={updateChecker.closeModal}
          isVisible={updateChecker.showModal}
        />
      )}

      {/* Up to Date Notification */}
      {updateChecker.updateInfo && (
        <UpToDateNotification
          updateInfo={updateChecker.updateInfo}
          onClose={updateChecker.closeUpToDateNotification}
          isVisible={updateChecker.showUpToDateNotification}
        />
      )}
    </div>
  );
}

export default App;
