/**
 * SessionRow
 *
 * Renders a single session row inside the project tree.
 * Displays session title, message count, relative time, and status icons.
 */

import React from "react";
import {
  Check,
  Wrench,
  AlertTriangle,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { UISession } from "../../../types";
import { cn } from "../../../utils/cn";
import { getSessionTitle } from "../../../utils/sessionUtils";

export interface SessionRowProps {
  session: UISession;
  selectedSession: UISession | null;
  onSessionSelect: (session: UISession | null) => void;
  onContextMenu: (e: React.MouseEvent, session: UISession) => void;
  formatTimeAgo: (dateStr: string) => string;
  t: TFunction;
  /** aria-level for the treeitem (defaults to 2 for nested project sessions) */
  ariaLevel?: number;
  /** Multi-select mode (upstream #456): clicking a row toggles selection. */
  selectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (filePath: string) => void;
}

export const SessionRow: React.FC<SessionRowProps> = ({
  session,
  selectedSession,
  onSessionSelect,
  onContextMenu,
  formatTimeAgo,
  t,
  ariaLevel = 2,
  selectionMode = false,
  isChecked = false,
  onToggleCheck,
}) => {
  const isSessionSelected = selectedSession?.session_id === session.session_id;
  const title = getSessionTitle(session);

  return (
    <button
      key={session.session_id}
      role="treeitem"
      aria-level={ariaLevel}
      aria-selected={selectionMode ? isChecked : isSessionSelected}
      tabIndex={-1}
      onClick={() => {
        if (selectionMode) {
          // Multi-select: the row toggles membership instead of navigating.
          onToggleCheck?.(session.file_path);
          return;
        }
        // Toggle: click selected session to deselect
        if (isSessionSelected) {
          onSessionSelect(null);
        } else {
          onSessionSelect(session);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, session)}
      className={cn(
        "w-full text-left p-3 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
        isSessionSelected
          ? "bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500"
          : "hover:bg-gray-200 dark:hover:bg-gray-700",
        selectionMode && isChecked && "bg-blue-50 dark:bg-blue-900/40 ring-1 ring-inset ring-blue-400"
      )}
    >
      <div className="flex items-start space-x-3">
        {selectionMode && (
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              isChecked
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-gray-400 dark:border-gray-500"
            )}
          >
            {isChecked && <Check className="w-3 h-3" />}
          </span>
        )}
        <MessageCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className="font-medium text-gray-800 dark:text-gray-200 text-xs whitespace-nowrap flex-1"
              title={title}
            >
              {title}
            </h3>
            <div className="flex items-center space-x-1 flex-shrink-0">
              {session.has_tool_use && (
                <span title={t("components:tools.toolUsed", "Tool used")}>
                  <Wrench className="w-3 h-3 text-blue-400 flex-shrink-0" />
                </span>
              )}
              {session.has_errors && (
                <span
                  title={t(
                    "components:tools.errorOccurred",
                    "Error occurred"
                  )}
                >
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                </span>
              )}
              {session.is_problematic && (
                <span
                  title={t(
                    "components:tools.sessionProblematic",
                    "Session not resumable (fix available)"
                  )}
                >
                  <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 text-xs text-gray-400 mt-1 overflow-hidden">
            <span className="whitespace-nowrap">
              {formatTimeAgo(session.last_modified)}
            </span>
            <span>•</span>
            <span className="whitespace-nowrap">
              {t("components:message.count", "{{count}} messages", {
                count: session.message_count,
              })}
            </span>
            <span>•</span>
            <span
              className="truncate"
              title={`${t("components:session.actualId", "Actual ID")}: ${session.actual_session_id}`}
            >
              ID: {session.actual_session_id}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};
