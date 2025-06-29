import { useEffect, useState } from "react";
import { ProjectTree } from "./components/ProjectTree";
import { MessageViewer } from "./components/MessageViewer";
import { TokenStatsViewer } from "./components/TokenStatsViewer";
import { FolderSelector } from "./components/FolderSelector";
import { useAppStore } from "./store/useAppStore";
import type { ClaudeSession } from "./types";
import {
  AlertTriangle,
  Settings,
  Loader2,
  RefreshCw,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import "./App.css";

function App() {
  const [showTokenStats, setShowTokenStats] = useState(false);
  const [showFolderSelector, setShowFolderSelector] = useState(false);

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
    clearTokenStats,
    setClaudePath,
  } = useAppStore();

  // 세션 선택 시 토큰 통계 화면에서 채팅 화면으로 자동 전환
  const handleSessionSelect = async (session: ClaudeSession) => {
    if (showTokenStats) {
      setShowTokenStats(false);
      clearTokenStats();
    }
    await selectSession(session);
  };

  useEffect(() => {
    initializeApp().catch((error) => {
      // Check if the error is about missing claude folder
      if (error?.message?.includes("Claude folder not found")) {
        setShowFolderSelector(true);
      }
    });
  }, [initializeApp]);

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
        const sessionPath = `${selectedProject.path}/${selectedSession.session_id}.jsonl`;
        await loadSessionTokenStats(sessionPath);
      }

      setShowTokenStats(true);
    } catch (error) {
      console.error("Failed to load token stats:", error);
    }
  };

  // Show folder selector if needed
  if (
    showFolderSelector ||
    (error && error.includes("Claude folder not found"))
  ) {
    return <FolderSelector onFolderSelected={handleFolderSelected} />;
  }

  if (error && !error.includes("Claude folder not found")) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <div className="mb-4">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-red-800 mb-2">
            오류가 발생했습니다
          </h1>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img
              src="/app-icon.png"
              alt="Claude Code History Viewer"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Claude Code History Viewer
              </h1>
              <p className="text-sm text-gray-500">
                Claude Code 대화 기록을 탐색하고 분석하세요
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {selectedProject && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">{selectedProject.name}</span>
                {selectedSession && (
                  <>
                    <span className="mx-2">›</span>
                    <span>세션 {selectedSession.session_id.slice(-8)}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              {selectedProject && (
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
                  className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    showTokenStats
                      ? "bg-blue-100 text-blue-600"
                      : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                  title="토큰 사용량 통계"
                >
                  {isLoadingTokenStats ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <BarChart3 className="w-5 h-5" />
                  )}
                </button>
              )}

              {selectedSession && (
                <>
                  <button
                    onClick={() => {
                      if (showTokenStats) {
                        setShowTokenStats(false);
                        clearTokenStats();
                      }
                    }}
                    disabled={!showTokenStats}
                    className={`p-2 rounded-lg transition-colors ${
                      !showTokenStats
                        ? "bg-green-100 text-green-600"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    }`}
                    title="메시지 보기"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => refreshCurrentSession()}
                    disabled={isLoadingMessages}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="세션 새로고침"
                  >
                    <RefreshCw
                      className={`w-5 h-5 ${
                        isLoadingMessages ? "animate-spin" : ""
                      }`}
                    />
                  </button>
                </>
              )}

              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
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
          onProjectSelect={selectProject}
          onSessionSelect={handleSessionSelect}
          isLoading={isLoadingProjects || isLoadingSessions}
        />

        {/* Main Content Area */}
        <div className="w-full flex flex-col relative">
          {/* Content Header */}
          {(selectedSession || showTokenStats) && (
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {showTokenStats ? "토큰 사용량 통계" : "대화 내용"}
                  </h2>
                  <span className="text-sm text-gray-800">
                    {selectedSession?.summary ||
                      "세션 요약을 찾을 수 없습니다."}
                  </span>
                  {!showTokenStats && selectedSession && (
                    <p className="text-sm text-gray-500 mt-1">
                      {pagination.totalCount > messages.length &&
                        ` ${pagination.totalCount || "-"}개 • `}
                      {selectedSession.has_tool_use
                        ? "도구 사용됨"
                        : "일반 대화"}
                      {selectedSession.has_errors && " • 에러 발생"}
                    </p>
                  )}
                  {showTokenStats && (
                    <p className="text-sm text-gray-500 mt-1">
                      프로젝트별 토큰 사용량 분석 및 세션별 상세 통계
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {showTokenStats ? (
              <div className="h-full overflow-y-auto p-6">
                <TokenStatsViewer
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
                <div className="text-center text-gray-500">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg mb-2">세션을 선택해주세요</p>
                  <p className="text-sm">
                    좌측에서 프로젝트와 세션을 선택하면 대화 내용을 볼 수
                    있습니다
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>프로젝트: {projects.length}개</span>
            <span>세션: {sessions.length}개</span>
            {selectedSession && !showTokenStats && (
              <span>
                메시지: {messages.length}개
                {pagination.totalCount > messages.length &&
                  ` / ${pagination.totalCount}개`}
              </span>
            )}
            {showTokenStats && sessionTokenStats && (
              <span>
                현재 세션 토큰:{" "}
                {sessionTokenStats.total_tokens.toLocaleString()}개
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
                  {isLoadingTokenStats && "토큰 통계 로딩 중..."}
                  {isLoadingProjects && "프로젝트 스캔 중..."}
                  {isLoadingSessions && "세션 로딩 중..."}
                  {isLoadingMessages && "메시지 로딩 중..."}
                  {isLoading && "앱 초기화 중..."}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
