import { useEffect } from "react";
import { ProjectTree } from "./components/ProjectTree";
import { MessageViewer } from "./components/MessageViewer";
import { TokenStatsViewer } from "./components/TokenStatsViewer";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { SimpleUpdateManager } from "./components/SimpleUpdateManager";
import { SearchView } from "./components/SearchView";
import { DebugConsole } from "./components/DebugConsole";
import { SplashScreen } from "./components/SplashScreen";
import { useAppStore } from "./store/useAppStore";
import { useSourceStore } from "./store/useSourceStore";
import { useAnalytics } from "./hooks/useAnalytics";
import { getSessionTitle } from "./utils/sessionUtils";

import { useTranslation } from "react-i18next";
import { AppErrorType, type ClaudeSession, type ClaudeProject } from "./types";
import { AlertTriangle, Loader2, MessageSquare } from "lucide-react";
import { useLanguageStore } from "./store/useLanguageStore";
import { type SupportedLanguage } from "./i18n";

import "./App.css";
import { cn } from "./utils/cn";
import { COLORS } from "./constants/colors";
import { Header } from "@/layouts/Header/Header";
import { ModalContainer } from "./layouts/Header/SettingDropdown/ModalContainer";

function App() {
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
    error,
    sessionTokenStats,
    projectTokenStats,
    projectStatsSummary,
    loadingProgress,
    initializeApp,
    selectProject,
    selectSession,
    clearSelection,
    loadMoreMessages,
    setLoadingProgress,
  } = useAppStore();

  const {
    actions: analyticsActions,
    computed,
  } = useAnalytics();

  const { t, i18n: i18nInstance } = useTranslation("common");
  const { t: tComponents } = useTranslation("components");
  const { t: tMessages } = useTranslation("messages");
  const { language, loadLanguage } = useLanguageStore();

  // Source store for multi-source management
  const {
    initializeSources,
  } = useSourceStore();

  // Maintain current view when session is selected (automatic data update handled in useAnalytics hook)
  const handleSessionSelect = async (session: ClaudeSession | null) => {
    await selectSession(session);
    // Data update is automatically handled in useAnalytics hook's useEffect
  };

  useEffect(() => {
    // Initialize sources and app after loading language settings
    const initialize = async () => {
      try {
        // Stage 1: Initializing (0-20%)
        setLoadingProgress({
          stage: 'initializing',
          message: 'Initializing application',
          progress: 5,
        });

        await loadLanguage();

        setLoadingProgress({
          stage: 'initializing',
          message: 'Loading language settings',
          progress: 15,
        });

        // Stage 2: Detecting sources (20-40%)
        setLoadingProgress({
          stage: 'detecting-sources',
          message: 'Detecting conversation sources',
          progress: 25,
        });

        await initializeSources();

        setLoadingProgress({
          stage: 'loading-adapters',
          message: 'Loading adapters',
          progress: 45,
        });

        // Stage 3: Scanning projects (40-80%)
        setLoadingProgress({
          stage: 'scanning-projects',
          message: 'Scanning projects',
          progress: 65,
        });

        await initializeApp();

        setLoadingProgress({
          stage: 'scanning-projects',
          message: 'Finalizing',
          progress: 90,
        });

        // Stage 4: Complete (80-100%)
        setLoadingProgress({
          stage: 'complete',
          message: 'Ready',
          progress: 100,
        });

        // Remove splash screen after a short delay
        setTimeout(() => {
          setLoadingProgress(null);
        }, 300);
      } catch (error) {
        console.error("Failed to initialize:", error);
        // Clear splash screen even on error so user can see the error message
        setLoadingProgress(null);
      }
    };

    // Start initialization immediately
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps to run only once on mount

  // Cmd+F keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        if (computed.isSearchView) {
          analyticsActions.switchToMessages();
        } else {
          analyticsActions.switchToSearch();
        }
      }
      // Escape to close search
      if (e.key === "Escape" && computed.isSearchView) {
        analyticsActions.switchToMessages();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [computed.isSearchView, analyticsActions]);

  // Detect i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      // Update if different from store's language
      const currentLang = lng.startsWith("zh")
        ? lng.includes("TW") || lng.includes("HK")
          ? "zh-TW"
          : "zh-CN"
        : lng.split("-")[0];

      if (
        currentLang &&
        currentLang !== language &&
        ["en", "ko", "ja", "zh-CN", "zh-TW", "ru"].includes(currentLang)
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

  // Project selection handler (includes analytics state reset)
  const handleProjectSelect = async (project: ClaudeProject | null) => {
    // If null, just clear selection
    if (project === null) {
      await selectProject(null);
      return;
    }

    const wasAnalyticsOpen = computed.isAnalyticsView;
    const wasTokenStatsOpen = computed.isTokenStatsView;

    // Reset existing analytics data
    if (!computed.isMessagesView) {
      analyticsActions.switchToMessages();
    }

    // Select project
    await selectProject(project);

    // Auto-load analytics data for new project if analytics tab was open
    if (wasAnalyticsOpen) {
      try {
        await analyticsActions.switchToAnalytics();
      } catch (error) {
        console.error("Failed to auto-load analytics for new project:", error);
      }
    }

    // Auto-load token stats for new project if token stats tab was open
    if (wasTokenStatsOpen) {
      try {
        await analyticsActions.switchToTokenStats();
      } catch (error) {
        console.error(
          "Failed to auto-load token stats for new project:",
          error
        );
      }
    }
  };

  // Show splash screen during initialization
  if (loadingProgress) {
    return <SplashScreen progress={loadingProgress} />;
  }

  // Show folder selector if needed
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
    <>
      <div
        className={cn("h-screen flex flex-col", COLORS.ui.background.primary)}
      >
        {/* Header */}
        <Header />

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
            onClearSelection={clearSelection}
            isLoading={isLoadingProjects || isLoadingSessions}
          />

          {/* Main Content Area */}
          <div className="w-full flex flex-col relative">
            {computed.isSearchView ? (
              /* Search View - Full overlay */
              <SearchView />
            ) : (
              <>
                {/* Content Header */}
                {(selectedSession ||
                  computed.isTokenStatsView ||
                  computed.isAnalyticsView) && (
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
                          {computed.isAnalyticsView
                            ? tComponents("analytics.dashboard")
                            : computed.isTokenStatsView
                            ? tMessages("tokenStats.title")
                            : tComponents("message.conversation")}
                        </h2>
                        <span className={cn("text-sm", COLORS.ui.text.secondary)}>
                          {getSessionTitle(selectedSession, messages)}
                        </span>
                        {computed.isMessagesView && selectedSession && (
                          <div>
                            <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
                              {pagination.totalCount >= messages.length &&
                                ` ${pagination.totalCount || "-"}${t("update.items")} • `}
                              {selectedSession.has_tool_use
                                ? tComponents("tools.toolUsed")
                                : tComponents("tools.generalConversation")}
                              {selectedSession.has_errors &&
                                ` • ${tComponents("tools.errorOccurred")}`}
                            </p>
                          </div>
                        )}
                        {computed.isTokenStatsView && (
                          <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
                            {tComponents("analytics.tokenUsageDetailed")}
                          </p>
                        )}
                        {computed.isAnalyticsView && (
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
                  {computed.isAnalyticsView ? (
                    <div className="h-full overflow-y-auto">
                      <AnalyticsDashboard />
                    </div>
                  ) : computed.isTokenStatsView ? (
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
              </>
            )}
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
              {selectedSession && computed.isMessagesView && (
                <span>
                  {tComponents("message.countWithTotal", {
                    current: messages.length,
                    total: pagination.totalCount || messages.length,
                  })}
                </span>
              )}
              {computed.isTokenStatsView && sessionTokenStats && (
                <span>
                  {tComponents("analytics.currentSessionTokens", {
                    count: sessionTokenStats.total_tokens,
                  })}
                </span>
              )}
              {computed.isAnalyticsView && projectStatsSummary && (
                <span>
                  {tComponents("analytics.projectTokens", {
                    count: projectStatsSummary.total_tokens,
                  })}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {(isLoading ||
                isLoadingProjects ||
                isLoadingSessions ||
                isLoadingMessages ||
                computed.isAnyLoading) && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {computed.isAnyLoading &&
                      tComponents("status.loadingStats")}
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
        {/* Simple Update Manager */}
        <SimpleUpdateManager />
      </div>

      {/* Modals */}
      <ModalContainer />

      {/* Debug Console */}
      <DebugConsole />
    </>
  );
}

export default App;
