import { useEffect, useState, useMemo } from "react";
import { ProjectTree } from "./components/ProjectTree";
import { MessageViewer } from "./components/MessageViewer";
import { RawMessageView } from "./components/RawMessageView";
import { CommandHistoryView } from "./components/CommandHistoryView";
import { MessageViewControls } from "./components/MessageViewControls";
import { TokenStatsViewer } from "./components/TokenStatsViewer";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { FilesView } from "./components/FilesView";
import { SimpleUpdateManager } from "./components/SimpleUpdateManager";
import { SearchView } from "./components/SearchView";
import { DebugConsole } from "./components/DebugConsole";
import { SplashScreen } from "./components/SplashScreen";
import { ResizableSplitter } from "./components/ResizableSplitter";
import { ExportControls } from "./components/ExportControls";
import { useAppStore } from "./store/useAppStore";
import { useSourceStore } from "./store/useSourceStore";
import { useAnalytics } from "./hooks/useAnalytics";
import { getSessionTitle } from "./utils/sessionUtils";
import { filterMessages } from "./utils/messageFilters";

import { useTranslation } from "react-i18next";
import { AppErrorType, type UISession, type UIProject } from "./types";
import { AlertTriangle, Loader2, MessageSquare } from "lucide-react";
import { useLanguageStore } from "./store/useLanguageStore";
import { type SupportedLanguage } from "./i18n.config";
import { Toaster } from "sonner";

import "./App.css";
import { cn } from "./utils/cn";
import { COLORS } from "./constants/colors";
import { Header } from "@/layouts/Header/Header";
import { ModalContainer } from "./layouts/Header/SettingDropdown/ModalContainer";

function App() {
  const {
    projects,
    sessions,
    sessionsByProject,
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
    messageViewMode,
    messageFilters,
    initializeApp,
    selectProject,
    selectSession,
    clearSelection,
    loadMoreMessages,
    setLoadingProgress,
  } = useAppStore();

  // Filter messages based on active filters
  const filteredMessages = useMemo(() => {
    return filterMessages(messages, messageFilters);
  }, [messages, messageFilters]);

  const {
    actions: analyticsActions,
    computed,
  } = useAnalytics();

  const { t, i18n: i18nInstance } = useTranslation("common");
  const { t: tComponents } = useTranslation("components");
  const { t: tMessages } = useTranslation("messages");
  const { language, loadLanguage } = useLanguageStore();

  // Sidebar width state for resizable splitter
  const [sidebarWidth, setSidebarWidth] = useState(320);

  // Source store for multi-source management
  const {
    initializeSources,
  } = useSourceStore();

  // Maintain current view when session is selected
  const handleSessionSelect = async (session: UISession | null) => {
    await selectSession(session);
    // Token stats will auto-refresh via useEffect below
  };

  useEffect(() => {
    // Initialize sources and app after loading language settings
    const initialize = async () => {
      try {
        // Stage 1: Initializing (0-20%)
        setLoadingProgress({
          stage: 'initializing',
          message: i18nInstance.t('splash:status.initializing', 'Initializing application'),
          progress: 5,
        });

        await loadLanguage();

        setLoadingProgress({
          stage: 'initializing',
          message: i18nInstance.t('splash:status.loadingLanguage', 'Loading language settings'),
          progress: 15,
        });

        // Stage 2: Detecting sources (20-40%)
        setLoadingProgress({
          stage: 'detecting-sources',
          message: i18nInstance.t('splash:status.detectingSources', 'Detecting conversation sources'),
          progress: 25,
        });

        await initializeSources();

        setLoadingProgress({
          stage: 'loading-adapters',
          message: i18nInstance.t('splash:status.loadingAdapters', 'Loading adapters'),
          progress: 45,
        });

        // Stage 3: Scanning projects (40-80%)
        setLoadingProgress({
          stage: 'scanning-projects',
          message: i18nInstance.t('splash:status.scanningProjects', 'Scanning projects'),
          progress: 65,
        });

        await initializeApp();

        setLoadingProgress({
          stage: 'scanning-projects',
          message: i18nInstance.t('splash:status.finalizing', 'Finalizing'),
          progress: 90,
        });

        // Stage 4: Complete (80-100%)
        setLoadingProgress({
          stage: 'complete',
          message: i18nInstance.t('splash:status.ready', 'Ready'),
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

  // Auto-refresh token stats when session changes (if token stats view is active)
  useEffect(() => {
    const refreshTokenStatsForSession = async () => {
      // Only auto-refresh if we're in token stats view and have a selected session
      if (computed.isTokenStatsView && selectedSession?.file_path) {
        console.log('🔄 Auto-refreshing token stats for newly selected session:', selectedSession.session_id);
        try {
          // Call loadSessionTokenStats directly instead of refreshAnalytics to avoid view switching
          const { loadSessionTokenStats } = useAppStore.getState();
          await loadSessionTokenStats(selectedSession.file_path);
        } catch (error) {
          console.error('Failed to auto-refresh token stats:', error);
        }
      }
    };

    refreshTokenStatsForSession();
    // Only depend on session_id changing, NOT on the view or analyticsActions
    // This prevents infinite loops and only triggers when user selects a different session
  }, [selectedSession?.session_id, computed.isTokenStatsView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Project selection handler (includes analytics state reset)
  const handleProjectSelect = async (project: UIProject | null) => {
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
          {/* Sidebar with fixed width */}
          <div style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 overflow-hidden">
            <ProjectTree
              projects={projects}
              sessions={sessions}
              sessionsByProject={sessionsByProject}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onClearSelection={clearSelection}
              isLoading={isLoadingProjects || isLoadingSessions}
            />
          </div>

          {/* Resizable Splitter */}
          <ResizableSplitter
            minWidth={200}
            maxWidth={800}
            defaultWidth={320}
            onWidthChange={setSidebarWidth}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col relative overflow-hidden">
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
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
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
                      {/* Export Controls - Only show in Messages view */}
                      {computed.isMessagesView && selectedSession && messages.length > 0 && (
                        <div className="flex-shrink-0">
                          <ExportControls messages={messages} session={selectedSession} />
                        </div>
                      )}
                    </div>

                    {/* Message View Controls - Only show in Messages view with messages */}
                    {computed.isMessagesView && selectedSession && messages.length > 0 && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'inherit' }}>
                        <MessageViewControls />
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                  {/* Loading overlay when switching sessions/loading content */}
                  {isLoadingMessages && selectedSession && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
                        <p className={cn("text-sm font-medium", COLORS.ui.text.secondary)}>
                          {tComponents("session.loadingContent")}
                        </p>
                      </div>
                    </div>
                  )}

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
                  ) : computed.isFilesView ? (
                    <FilesView />
                  ) : selectedSession ? (
                    messageFilters.showCommandOnly ? (
                      <CommandHistoryView messages={filteredMessages} />
                    ) : messageViewMode === "raw" ? (
                      <RawMessageView messages={filteredMessages} />
                    ) : (
                      <MessageViewer
                        messages={filteredMessages}
                        pagination={pagination}
                        isLoading={isLoading}
                        selectedSession={selectedSession}
                        onLoadMore={loadMoreMessages}
                      />
                    )
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
                    current: filteredMessages.length,
                    total: pagination.totalCount || messages.length,
                  })}
                  {filteredMessages.length !== messages.length && (
                    <span className="text-blue-500 ml-1">
                      ({tComponents("message.filtered")})
                    </span>
                  )}
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

      {/* Toast Notifications */}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}

export default App;
