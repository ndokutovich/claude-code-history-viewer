// src/components/ProjectTree.tsx
import React, { useState } from "react";
import {
  Folder,
  Wrench,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Loader2,
} from "lucide-react";
import type { ClaudeProject, ClaudeSession } from "../types";
import { cn } from "../utils/cn";

interface ProjectTreeProps {
  projects: ClaudeProject[];
  sessions: ClaudeSession[];
  selectedProject: ClaudeProject | null;
  selectedSession: ClaudeSession | null;
  onProjectSelect: (project: ClaudeProject) => void;
  onSessionSelect: (session: ClaudeSession) => void;
  isLoading: boolean;
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  projects,
  sessions,
  selectedSession,
  onProjectSelect,
  onSessionSelect,
  isLoading,
}) => {
  const [expandedProject, setExpandedProject] = useState("");

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 60) {
        return `${diffMins}분 전`;
      } else if (diffHours < 24) {
        return `${diffHours}시간 전`;
      } else if (diffDays < 7) {
        return `${diffDays}일 전`;
      } else {
        return date.toLocaleDateString("ko-KR", {
          month: "short",
          day: "numeric",
        });
      }
    } catch {
      return dateStr;
    }
  };

  const toggleProject = (projectPath: string) => {
    setExpandedProject((prev) => (prev === projectPath ? "" : projectPath));
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex flex-col h-full">
      {/* Projects List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-gray-400 dark:text-gray-600 h-full flex items-center">
            <div className="flex flex-col justify-center w-full">
              <div className="mb-2">
                <Folder className="w-8 h-8 mx-auto text-gray-500 dark:text-gray-400" />
              </div>
              <p className="text-sm">프로젝트를 찾을 수 없습니다</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => {
              const isExpanded = expandedProject === project.path;

              return (
                <div key={project.path}>
                  {/* Project Header */}
                  <button
                    onClick={() => {
                      onProjectSelect(project);
                      toggleProject(project.path);
                    }}
                    className="w-full text-left p-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      )}
                      <Folder className="w-4 h-4 text-blue-400" />
                      <div className="min-w-0 flex-1 flex items-center">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm">
                          {project.name}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Sessions for expanded project */}
                  {isExpanded && sessions.length > 0 && (
                    <div className="ml-6 space-y-1 pb-2">
                      {sessions.map((session) => {
                        const isSessionSelected =
                          selectedSession?.session_id === session.session_id;

                        return (
                          <button
                            key={session.session_id}
                            onClick={() => {
                              if (isSessionSelected) return;
                              onSessionSelect(session);
                            }}
                            className={cn(
                              "w-full text-left p-3 rounded-lg transition-colors",
                              isSessionSelected
                                ? "bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500"
                                : "hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                          >
                            <div className="flex items-start space-x-3">
                              <MessageCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <h3
                                    className="font-medium text-gray-800 dark:text-gray-200 text-xs truncate"
                                    title={
                                      session.summary ||
                                      `세션 ID: ${session.actual_session_id}`
                                    }
                                  >
                                    {session.summary ||
                                      "세션 요약을 찾을 수 없습니다."}
                                  </h3>
                                  <div className="flex items-center space-x-1">
                                    {session.has_tool_use && (
                                      <span title="도구 사용">
                                        <Wrench className="w-3 h-3 text-blue-400" />
                                      </span>
                                    )}
                                    {session.has_errors && (
                                      <span title="에러 발생">
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 text-xs text-gray-400 mt-1">
                                  <span className="whitespace-nowrap">
                                    {formatTimeAgo(session.last_modified)}
                                  </span>
                                  <span>•</span>
                                  <span className="whitespace-nowrap">
                                    {session.message_count}개 메시지
                                  </span>
                                  <span>•</span>
                                  <span className="truncate" title={`실제 세션 ID: ${session.actual_session_id}`}>
                                    ID: {session.actual_session_id.slice(0, 8)}...
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
