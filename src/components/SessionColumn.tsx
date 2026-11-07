/**
 * Sessions column (upstream #4bc63da2).
 *
 * An optional middle pane listing the selected project's sessions, so the
 * transcript can be switched without collapsing the tree. Off by default:
 * the tree already nests sessions, and this pane is for people who keep one
 * project open all day.
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import type { UIProject, UISession } from "../types";
import { cn } from "../utils/cn";
import { getSessionTitle } from "../utils/sessionUtils";

const relativeTime = (timestamp: string): string => {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMinutes = Math.round((then - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
  let value = diffMinutes;
  for (const [unit, span] of steps) {
    if (Math.abs(value) < span) return formatter.format(value, unit);
    value = Math.round(value / span);
  }
  return formatter.format(value, "year");
};

export interface SessionColumnProps {
  project: UIProject | null;
  sessions: UISession[];
  selectedSession: UISession | null;
  onSessionSelect: (session: UISession) => void;
}

export const SessionColumn: React.FC<SessionColumnProps> = ({
  project,
  sessions,
  selectedSession,
  onSessionSelect,
}) => {
  const { t } = useTranslation("components");

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700">
      <div className="px-3 py-2 border-b border-gray-300 dark:border-gray-700">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("sessionColumn.title", "Sessions")}
        </p>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {project?.name ?? "—"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-1 space-y-0.5">
        {sessions.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 dark:text-gray-400">
            {t("sessionColumn.empty", "No sessions in this project")}
          </p>
        ) : (
          sessions.map((session) => {
            const isSelected = selectedSession?.session_id === session.session_id;
            return (
              <button
                key={session.session_id}
                type="button"
                onClick={() => onSessionSelect(session)}
                aria-current={isSelected ? "true" : undefined}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded transition-colors",
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/40 text-gray-900 dark:text-gray-100"
                    : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="w-3 h-3 shrink-0 opacity-60" />
                  <span className="text-xs font-medium truncate">
                    {getSessionTitle(session)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{t("message.count", { count: session.message_count })}</span>
                  <span>•</span>
                  <span>{relativeTime(session.last_modified)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
