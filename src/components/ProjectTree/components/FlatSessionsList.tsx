/**
 * FlatSessionsList
 *
 * Renders the flat all-sessions view, which shows sessions from all projects
 * chronologically without project grouping.
 */

import React from "react";
import {
  Wrench,
  AlertTriangle,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { UIProject, UISession } from "../../../types";
import { cn } from "../../../utils/cn";
import { getSessionTitle } from "../../../utils/sessionUtils";
import { ProviderIcon, getProviderColorClass } from "../../icons/ProviderIcons";

/** Extended session type used in flat view (includes project metadata) */
export interface FlatSession extends UISession {
  projectPath: string;
  projectName: string;
}

export interface FlatSessionsListProps {
  sessions: FlatSession[];
  selectedSession: UISession | null;
  projects: UIProject[];
  onSessionSelect: (session: UISession | null) => void;
  onProjectSelect: (project: UIProject | null) => void;
  onContextMenu: (e: React.MouseEvent, session: UISession) => void;
  formatTimeAgo: (dateStr: string) => string;
  t: TFunction;
}

export const FlatSessionsList: React.FC<FlatSessionsListProps> = ({
  sessions,
  selectedSession,
  projects,
  onSessionSelect,
  onProjectSelect,
  onContextMenu,
  formatTimeAgo,
  t,
}) => {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          {t("components:session.noSessions", "No sessions found")}
        </p>
      </div>
    );
  }

  return (
    <>
      {sessions.map((session) => {
        const isSelected = selectedSession?.session_id === session.session_id;

        return (
          <button
            key={session.session_id}
            role="treeitem"
            aria-level={1}
            aria-selected={isSelected}
            tabIndex={-1}
            onClick={() => {
              // Find the project for this session
              const project = projects.find(
                (p) => p.path === session.projectPath
              );
              if (project) {
                onProjectSelect(project);
              }
              onSessionSelect(session);
            }}
            onContextMenu={(e) => onContextMenu(e, session)}
            className={cn(
              "text-left w-full p-2 rounded transition-colors flex items-start space-x-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
              isSelected
                ? "bg-blue-100 dark:bg-blue-900/40 border-l-2 border-blue-500"
                : "hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            {/* Provider Icon */}
            <ProviderIcon
              providerId={session.providerId || ""}
              className={cn(
                "w-4 h-4 mt-0.5 flex-shrink-0",
                getProviderColorClass(session.providerId)
              )}
            />

            {/* Session Info */}
            <div className="flex-1 min-w-0">
              {/* Session Title */}
              <div className="flex items-center space-x-1">
                <MessageCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
                  {getSessionTitle(session)}
                </p>
              </div>

              {/* Project Name (subdued) */}
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {session.projectName}
              </p>

              {/* Metadata row */}
              <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                <span className="whitespace-nowrap">
                  {t("message.count", { count: session.message_count })}
                </span>
                <span>•</span>
                <span className="whitespace-nowrap">
                  {formatTimeAgo(session.last_modified)}
                </span>
                {session.has_tool_use && (
                  <Wrench className="w-3 h-3 flex-shrink-0" />
                )}
                {session.has_errors && (
                  <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                )}
                {session.is_problematic && (
                  <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-500 flex-shrink-0" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
};
