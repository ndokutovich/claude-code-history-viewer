/**
 * Contribution Grid
 *
 * GitHub-style bar chart showing daily session activity.
 */

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipTrigger } from "../ui/tooltip";
import { ChartTooltip } from "../ui/chart-tooltip";
import { cn } from "@/utils/cn";
import type { DailyBar } from "./useActivityData";

interface ContributionGridProps {
  dailyBars: DailyBar[];
  onDateClick: (date: string) => void;
  onDateClear: () => void;
  selectedDate: string | null;
}

// Layout constants
const BAR_WIDTH = 14;
const BAR_GAP = 3;
const SLOT_WIDTH = BAR_WIDTH + BAR_GAP;
const CHART_HEIGHT = 80;
const AXIS_HEIGHT = 18;
const GRID_LINES = 4;
const MIN_LABEL_GAP_PX = 44;

function getBarColor(intensity: number, isSelected: boolean): string {
  if (isSelected) return "var(--chart-1, hsl(var(--primary)))";
  if (intensity === 0) return "var(--heatmap-empty, hsl(var(--muted)))";
  if (intensity <= 0.33) return "var(--heatmap-low, hsl(220 60% 70%))";
  if (intensity <= 0.66) return "var(--heatmap-medium, hsl(220 70% 55%))";
  return "var(--heatmap-high, hsl(220 80% 40%))";
}

function formatShortLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function selectLabelIndices(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [0];

  const minSlots = Math.ceil(MIN_LABEL_GAP_PX / SLOT_WIDTH);
  const indices: number[] = [0];

  for (let i = 1; i < count - 1; i++) {
    const last = indices[indices.length - 1] ?? 0;
    if (i - last >= minSlots) {
      indices.push(i);
    }
  }

  const last = indices[indices.length - 1] ?? 0;
  const lastIdx = count - 1;
  if (
    lastIdx > last &&
    lastIdx - last >= Math.max(2, Math.floor(minSlots * 0.55))
  ) {
    indices.push(lastIdx);
  }

  return indices;
}

export const ContributionGrid: React.FC<ContributionGridProps> = ({
  dailyBars,
  onDateClick,
  onDateClear,
  selectedDate,
}) => {
  const { t } = useTranslation("components");

  const maxCount = useMemo(() => {
    let max = 0;
    for (const bar of dailyBars) {
      if (bar.sessionCount > max) max = bar.sessionCount;
    }
    return max;
  }, [dailyBars]);

  const labelIndices = useMemo(
    () => selectLabelIndices(dailyBars.length),
    [dailyBars.length]
  );

  if (dailyBars.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2 text-center">
        {t("analytics.noActivity", { defaultValue: "No activity data" })}
      </div>
    );
  }

  const handleBarClick = (bar: DailyBar) => {
    if (bar.sessionCount === 0) return;
    if (selectedDate === bar.date) {
      onDateClear();
    } else {
      onDateClick(bar.date);
    }
  };

  const handleBarKeyDown = (e: React.KeyboardEvent, bar: DailyBar) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBarClick(bar);
    }
  };

  const totalWidth = dailyBars.length * SLOT_WIDTH - BAR_GAP;
  const svgHeight = CHART_HEIGHT + AXIS_HEIGHT;

  const gridYPositions = Array.from({ length: GRID_LINES }, (_, i) =>
    Math.round(CHART_HEIGHT - (CHART_HEIGHT * (i + 1)) / (GRID_LINES + 1))
  );

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto scrollbar-thin">
        <svg
          width={totalWidth}
          height={svgHeight}
          aria-label={t("analytics.activityHeatmapTitle", {
            defaultValue: "Activity Chart",
          })}
          style={{ display: "block", overflow: "visible" }}
        >
          {/* Horizontal grid lines */}
          {gridYPositions.map((y) => (
            <line
              key={y}
              x1={0}
              y1={y}
              x2={totalWidth}
              y2={y}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeOpacity={0.45}
              strokeDasharray="2 3"
            />
          ))}

          {/* Baseline */}
          <line
            x1={0}
            y1={CHART_HEIGHT}
            x2={totalWidth}
            y2={CHART_HEIGHT}
            stroke="var(--border)"
            strokeWidth={0.75}
            strokeOpacity={0.6}
          />

          {/* Bars */}
          {dailyBars.map((bar, idx) => {
            const intensity =
              maxCount > 0 ? bar.sessionCount / maxCount : 0;
            const barPixelHeight =
              bar.sessionCount > 0
                ? Math.max(
                    3,
                    Math.round(intensity * (CHART_HEIGHT - 4))
                  )
                : 2;
            const x = idx * SLOT_WIDTH;
            const y = CHART_HEIGHT - barPixelHeight;
            const isSelected = selectedDate === bar.date;
            const isClickable = bar.sessionCount > 0;
            const fillColor = getBarColor(intensity, isSelected);

            return (
              <Tooltip key={bar.date}>
                <TooltipTrigger asChild>
                  <foreignObject
                    x={x}
                    y={y}
                    width={BAR_WIDTH}
                    height={barPixelHeight}
                    style={{ overflow: "visible" }}
                  >
                    <div
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : -1}
                      aria-hidden={!isClickable ? true : undefined}
                      aria-label={
                        isClickable
                          ? `${formatDateLabel(bar.date)}: ${bar.sessionCount} sessions`
                          : undefined
                      }
                      aria-pressed={
                        isSelected ? true : undefined
                      }
                      className={cn(
                        "w-full h-full rounded-t-[2px]",
                        "transition-opacity duration-100",
                        isClickable &&
                          "cursor-pointer hover:opacity-75",
                        isSelected &&
                          "ring-1 ring-offset-[1px] ring-offset-background ring-[var(--chart-1)]"
                      )}
                      style={{
                        backgroundColor: fillColor,
                        opacity:
                          bar.sessionCount === 0 ? 0.3 : 1,
                        boxShadow: isSelected
                          ? "0 0 6px var(--chart-1)"
                          : undefined,
                      }}
                      onClick={
                        isClickable
                          ? () => handleBarClick(bar)
                          : undefined
                      }
                      onKeyDown={
                        isClickable
                          ? (e) => handleBarKeyDown(e, bar)
                          : undefined
                      }
                    />
                  </foreignObject>
                </TooltipTrigger>
                <ChartTooltip
                  title={formatDateLabel(bar.date)}
                  rows={
                    bar.sessionCount > 0
                      ? [
                          {
                            label: t("analytics.tooltipSessions", {
                              defaultValue: "Sessions:",
                            }),
                            value: bar.sessionCount,
                          },
                        ]
                      : undefined
                  }
                  subtitle={
                    bar.sessionCount === 0
                      ? t("analytics.noActivity", {
                          defaultValue: "No activity",
                        })
                      : undefined
                  }
                />
              </Tooltip>
            );
          })}

          {/* Axis labels */}
          {labelIndices.map((idx) => {
            const bar = dailyBars[idx];
            if (!bar) return null;
            const cx = idx * SLOT_WIDTH + BAR_WIDTH / 2;
            return (
              <text
                key={bar.date}
                x={cx}
                y={CHART_HEIGHT + AXIS_HEIGHT - 3}
                textAnchor="middle"
                fontSize={9}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fill="var(--muted-foreground)"
                opacity={0.6}
                aria-hidden="true"
              >
                {formatShortLabel(bar.date)}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

ContributionGrid.displayName = "ContributionGrid";
