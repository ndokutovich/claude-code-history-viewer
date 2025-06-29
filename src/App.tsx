import { useEffect } from "react";
import { ProjectTree } from "./components/ProjectTree";
import { MessageViewer } from "./components/MessageViewer";
import { useAppStore } from "./store/useAppStore";
import { AlertTriangle, Settings, Loader2 } from "lucide-react";
import "./App.css";

function App() {
  const {
    projects,
    sessions,
    selectedProject,
    selectedSession,
    messages,
    pagination,
    isLoading,
    error,
    initializeApp,
    selectProject,
    selectSession,
    loadMoreMessages,
  } = useAppStore();

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  if (error) {
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

            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
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
          onSessionSelect={selectSession}
          isLoading={isLoading}
        />

        {/* Main Content Area */}
        <div className="w-full flex flex-col relative">
          {/* Content Header */}
          {selectedSession && (
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    대화 내용
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {pagination.totalCount > messages.length &&
                      ` ${pagination.totalCount}개`}{" "}
                    •{" "}
                    {selectedSession.has_tool_use ? "도구 사용됨" : "일반 대화"}
                    {selectedSession.has_errors && " • 에러 발생"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Message Viewer */}
          <MessageViewer
            messages={messages}
            pagination={pagination}
            isLoading={isLoading}
            onLoadMore={loadMoreMessages}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>프로젝트: {projects.length}개</span>
            <span>세션: {sessions.length}개</span>
            {selectedSession && (
              <span>
                메시지: {messages.length}개
                {pagination.totalCount > messages.length &&
                  ` / ${pagination.totalCount}개`}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {isLoading && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>로딩 중...</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
