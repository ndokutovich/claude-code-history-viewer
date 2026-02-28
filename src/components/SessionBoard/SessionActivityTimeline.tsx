/**
 * Session Activity Timeline
 *
 * Expandable timeline showing daily activity via a ContributionGrid.
 */

import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Flame,
  Calendar,
  X,
} from "lucide-react";
import { ContributionGrid } from "./ContributionGrid";
import { useActivityData, toDateString } from "./useActivityData";
import type { BoardSessionData, DateFilter } from "../../types/board.types";

interface SessionActivityTimelineProps {
  boardSessions: Record<string, BoardSessionData>;
  allSortedSessionIds: string[];
  dateFilter: DateFilter;
  setDateFilter: (filter: DateFilter) => void;
  clearDateFilter: () => void;
  isExpanded: boolean;
  onToggle: () => void;
  projectName?: string;
}

export const SessionActivityTimeline: React.FC<
  SessionActivityTimelineProps
> = ({
  boardSessions,
  allSortedSessionIds,
  dateFilter,
  setDateFilter,
  clearDateFilter,
  isExpanded,
  onToggle,
  projectName,
}) => {
  const { t } = useTranslation("components");
  const activityData = useActivityData(
    boardSessions,
    allSortedSessionIds,
    dateFilter
  );

  const selectedDate = useMemo(() => {
    if (!dateFilter?.start || !dateFilter?.end) return null;
    const startStr = toDateString(dateFilter.start);
    const endStr = toDateString(dateFilter.end);
    if (startStr === endStr) return startStr;
    return null;
  }, [dateFilter]);

  const handleDateClick = useCallback(
    (date: string) => {
      const d = new Date(date + "T00:00:00");
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      setDateFilter({ start, end });
    },
    [setDateFilter]
  );

  const handleDateClear = useCallback(() => {
    clearDateFilter();
  }, [clearDateFilter]);

  if (allSortedSessionIds.length === 0) return null;

  const {
    totalActiveDays,
    currentStreak,
    longestStreak,
    totalSessions,
  } = activityData;

  return (
    <div className="border-b border-border/50 bg-card/20 shrink-0">
      {/* Header / Collapsed view */}
      <button
        onClick={onToggle}
        className="w-full h-8 px-3 flex items-center gap-2 text-xs hover:bg-muted/30 transition-colors"
        aria-expanded={isExpanded}
        aria-label={t("analytics.activityHeatmapTitle", {
          defaultValue: "Activity Timeline",
        })}
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}

        <span className="text-[11px] font-medium text-foreground/80 truncate">
          {projectName ??
            t("analytics.activityHeatmapTitle", {
              defaultValue: "Activity Timeline",
            })}
        </span>

        <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" aria-hidden="true" />
            {totalActiveDays}{" "}
            {totalActiveDays === 1
              ? t("time.day", { defaultValue: "day" })
              : t("time.days", { defaultValue: "days" })}
          </span>
          {currentStreak > 0 && (
            <span className="flex items-center gap-1 text-orange-500/80">
              <Flame className="w-3 h-3" aria-hidden="true" />
              {currentStreak}{" "}
              {currentStreak === 1
                ? t("time.day", { defaultValue: "day" })
                : t("time.days", { defaultValue: "days" })}
            </span>
          )}
          <span>
            {totalSessions}{" "}
            {totalSessions === 1
              ? t("session.title", { defaultValue: "session" })
              : t("analytics.sessionsUnit", {
                  defaultValue: "sessions",
                })}
          </span>
        </div>
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2.5 py-0.5 text-[10px]">
              <Flame
                className="w-3 h-3 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-muted-foreground">
                {t("analytics.longestStreak", {
                  defaultValue: "Longest",
                })}
              </span>
              <span className="font-medium text-foreground">
                {longestStreak}{" "}
                {longestStreak === 1
                  ? t("time.day", { defaultValue: "day" })
                  : t("time.days", { defaultValue: "days" })}
              </span>
            </span>
            {selectedDate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDateClear();
                }}
                className="inline-flex items-center gap-0.5 bg-primary/10 rounded-full px-2.5 py-0.5 text-[10px] text-primary/80 hover:text-primary hover:bg-primary/15 transition-colors"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                {t("analytics.clearFilter", {
                  defaultValue: "Clear filter",
                })}
              </button>
            )}
          </div>

          {/* Activity Bar Chart */}
          <ContributionGrid
            dailyBars={activityData.dailyBars}
            onDateClick={handleDateClick}
            onDateClear={handleDateClear}
            selectedDate={selectedDate}
          />
        </div>
      )}
    </div>
  );
};

SessionActivityTimeline.displayName = "SessionActivityTimeline";
