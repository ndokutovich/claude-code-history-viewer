"use client";

import React, { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  MessageCircle,
  Activity,
  Wrench,
  Zap,
  Database,
  Eye,
  Hash,
  Target,
  Users,
  Award,
  Timer,
} from "lucide-react";
import type {
  SessionTokenStats,
  ProjectStatsSummary,
  ToolUsageStats,
  ActivityHeatmap,
  SessionComparison,
} from "../types";
import { formatTime, formatDuration } from "../utils/time";
import { COLORS } from "../constants/colors";
import { cn } from "../utils/cn";

interface AnalyticsDashboardProps {
  selectedProject?: string | null;
  selectedSession?: string | null;
  sessionStats?: SessionTokenStats | null;
  projectStats?: SessionTokenStats[];
  projectSummary?: ProjectStatsSummary | null;
  sessionComparison?: SessionComparison | null;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  selectedProject,
  selectedSession,
  sessionStats,
  projectSummary,
  sessionComparison,
}) => {
  const [activeTab, setActiveTab] = useState<"project" | "session">("project");
  // Calculate growth rates
  const calculateGrowthRate = (current: number, previous: number): number => {
    if (previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // 7일간의 일별 데이터 생성 (누락된 날짜 채우기)
  const generateDailyData = () => {
    if (!projectSummary?.daily_stats) return [];

    // 최근 7일 날짜 배열 생성
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return date.toISOString().split("T")[0];
    });

    // 날짜별 데이터 집계
    const dailyData = last7Days.map((date) => {
      const dayStats = projectSummary.daily_stats.find(
        (stat) => stat.date === date
      );

      return {
        date,
        total_tokens: dayStats?.total_tokens || 0,
        message_count: dayStats?.message_count || 0,
        session_count: dayStats?.session_count || 0,
        active_hours: dayStats?.active_hours || 0,
      };
    });

    return dailyData;
  };

  // Activity heatmap component
  const ActivityHeatmapComponent = ({ data }: { data: ActivityHeatmap[] }) => {
    const maxActivity = Math.max(...data.map((d) => d.activity_count), 1);
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const days = ["일", "월", "화", "수", "목", "금", "토"];

    return (
      <div className="overflow-x-auto">
        <div className="inline-block min-w-max">
          {/* Hour labels */}
          <div className="flex gap-1 mb-1 ml-10">
            {hours.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "w-6 h-6 flex items-center justify-center text-xs",
                  COLORS.ui.text.muted
                )}
              >
                {hour % 3 === 0 ? hour : ""}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {days.map((day, dayIndex) => (
            <div key={day} className="flex gap-1 mb-1">
              <div
                className={cn(
                  "w-10 flex items-center justify-end pr-2 text-xs",
                  COLORS.ui.text.muted
                )}
              >
                {day}
              </div>
              {hours.map((hour) => {
                const activity = data.find(
                  (d) => d.hour === hour && d.day === dayIndex
                );
                const intensity = activity
                  ? activity.activity_count / maxActivity
                  : 0;
                const tokens = activity?.tokens_used || 0;

                return (
                  <div
                    key={`${day}-${hour}`}
                    className={cn(
                      "w-6 h-6 rounded-sm transition-all hover:scale-125 hover:ring-2 hover:ring-white/50 cursor-pointer",
                      intensity > 0.8
                        ? "bg-emerald-500"
                        : intensity > 0.6
                        ? "bg-emerald-600"
                        : intensity > 0.4
                        ? "bg-emerald-700"
                        : intensity > 0.2
                        ? "bg-emerald-800"
                        : intensity > 0
                        ? "bg-emerald-900"
                        : "bg-gray-800 dark:bg-gray-900"
                    )}
                    title={`${day}요일 ${hour}시\n활동: ${
                      activity?.activity_count || 0
                    }회\n토큰: ${formatNumber(tokens)}`}
                  />
                );
              })}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 ml-10">
            <span className={cn("text-xs", COLORS.ui.text.muted)}>Less</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 bg-gray-800 dark:bg-gray-900 rounded-sm" />
              <div className="w-4 h-4 bg-emerald-900 rounded-sm" />
              <div className="w-4 h-4 bg-emerald-700 rounded-sm" />
              <div className="w-4 h-4 bg-emerald-600 rounded-sm" />
              <div className="w-4 h-4 bg-emerald-500 rounded-sm" />
            </div>
            <span className={cn("text-xs", COLORS.ui.text.muted)}>More</span>
          </div>
        </div>
      </div>
    );
  };

  // Tool name mapping for better display
  const getToolDisplayName = (toolName: string): string => {
    const toolMap: Record<string, string> = {
      Bash: "🐚 터미널",
      Read: "📖 파일 읽기",
      Edit: "✏️ 파일 편집",
      Write: "📝 파일 생성",
      MultiEdit: "🔧 다중 편집",
      Glob: "🔍 파일 찾기",
      Grep: "🔎 텍스트 검색",
      LS: "📁 디렉토리 탐색",
      Task: "🎯 작업 실행",
      WebFetch: "🌐 웹 가져오기",
      WebSearch: "🔍 웹 검색",
      NotebookRead: "📚 노트북 읽기",
      NotebookEdit: "📝 노트북 편집",
      TodoRead: "📋 할일 읽기",
      TodoWrite: "✅ 할일 작성",
      exit_plan_mode: "🚪 계획 모드 종료",
    };

    return toolMap[toolName] || `🔧 ${toolName}`;
  };

  // Tool usage chart
  const ToolUsageChart = ({ tools }: { tools: ToolUsageStats[] }) => {
    const topTools = tools.slice(0, 6);
    const maxUsage = Math.max(...topTools.map((t) => t.usage_count), 1);

    if (topTools.length === 0) {
      return (
        <div className={cn("text-center py-8", COLORS.ui.text.muted)}>
          <Wrench
            className={cn("w-12 h-12 mx-auto mb-2", COLORS.ui.text.disabled)}
          />
          <p>도구 사용 데이터가 없습니다</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {topTools.map((tool, index) => {
          const colors = [
            {
              bg: "bg-blue-500",
              border: "border-blue-200",
              text: "text-blue-700",
            },
            {
              bg: "bg-green-500",
              border: "border-green-200",
              text: "text-green-700",
            },
            {
              bg: "bg-purple-500",
              border: "border-purple-200",
              text: "text-purple-700",
            },
            {
              bg: "bg-orange-500",
              border: "border-orange-200",
              text: "text-orange-700",
            },
            {
              bg: "bg-pink-500",
              border: "border-pink-200",
              text: "text-pink-700",
            },
            {
              bg: "bg-indigo-500",
              border: "border-indigo-200",
              text: "text-indigo-700",
            },
          ];
          const color = colors[index] || colors[colors.length - 1];

          return (
            <div key={tool.tool_name} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className={cn("w-3 h-3 rounded-full", color?.bg)} />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      COLORS.ui.text.secondary
                    )}
                  >
                    {getToolDisplayName(tool.tool_name)}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={cn("text-sm font-bold", COLORS.ui.text.primary)}
                  >
                    {tool.usage_count}회
                  </span>
                  <div className={cn("text-xs", COLORS.ui.text.muted)}>
                    성공률 {Math.round(tool.success_rate)}%
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={cn(
                      "h-3 rounded-full transition-all duration-500",
                      color?.bg
                    )}
                    style={{ width: `${(tool.usage_count / maxUsage) * 100}%` }}
                  />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white mix-blend-difference">
                    {(
                      (tool.usage_count /
                        topTools.reduce((sum, t) => sum + t.usage_count, 0)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Project Statistics View
  const ProjectStatsView = () => {
    if (!projectSummary) return null;

    const lastDayStats =
      projectSummary.daily_stats[projectSummary.daily_stats.length - 1];
    const prevDayStats =
      projectSummary.daily_stats[projectSummary.daily_stats.length - 2];

    const tokenGrowth =
      lastDayStats && prevDayStats
        ? calculateGrowthRate(
            lastDayStats.total_tokens,
            prevDayStats.total_tokens
          )
        : 0;

    return (
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className={cn(
              "p-6 rounded-lg border",
              "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950",
              COLORS.semantic.info.border
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <MessageCircle
                className={cn("w-8 h-8", COLORS.semantic.info.icon)}
              />
              <span
                className={cn(
                  "text-xs px-2 py-1 rounded",
                  tokenGrowth > 0
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : tokenGrowth < 0
                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                )}
              >
                {tokenGrowth > 0 ? "+" : ""}
                {tokenGrowth}%
              </span>
            </div>
            <div className={cn("text-2xl font-bold", COLORS.ui.text.primary)}>
              {formatNumber(projectSummary.total_messages)}
            </div>
            <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
              Total Messages
            </div>
          </div>

          <div
            className={cn(
              "p-6 rounded-lg border",
              "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950",
              COLORS.tools.search.border
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <Activity className={cn("w-8 h-8", COLORS.tools.search.icon)} />
              <span className={cn("text-xs", COLORS.ui.text.muted)}>
                {projectSummary.total_sessions} sessions
              </span>
            </div>
            <div className={cn("text-2xl font-bold", COLORS.ui.text.primary)}>
              {formatNumber(projectSummary.total_tokens)}
            </div>
            <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
              Total Tokens
            </div>
          </div>

          <div
            className={cn(
              "p-6 rounded-lg border",
              "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950",
              COLORS.semantic.success.border
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className={cn("w-8 h-8", COLORS.semantic.success.icon)} />
            </div>
            <div className={cn("text-2xl font-bold", COLORS.ui.text.primary)}>
              {formatDuration(projectSummary.avg_session_duration)}
            </div>
            <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
              Avg Session Time
            </div>
          </div>

          <div
            className={cn(
              "p-6 rounded-lg border",
              "bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950",
              COLORS.semantic.warning.border
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <Wrench className={cn("w-8 h-8", COLORS.semantic.warning.icon)} />
            </div>
            <div className={cn("text-2xl font-bold", COLORS.ui.text.primary)}>
              {projectSummary.most_used_tools.length}
            </div>
            <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
              Tools Used
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Heatmap */}
          <div
            className={cn(
              "p-6 rounded-lg border",
              COLORS.ui.background.white,
              COLORS.ui.border.medium
            )}
          >
            <h3
              className={cn(
                "text-lg font-semibold mb-4",
                COLORS.ui.text.primary
              )}
            >
              Activity Heatmap
            </h3>
            {projectSummary.activity_heatmap.length > 0 ? (
              <ActivityHeatmapComponent
                data={projectSummary.activity_heatmap}
              />
            ) : (
              <div className={cn("text-center py-8", COLORS.ui.text.muted)}>
                No activity data available
              </div>
            )}
          </div>

          {/* Tool Usage */}
          <div
            className={cn(
              "p-6 rounded-lg border",
              COLORS.ui.background.white,
              COLORS.ui.border.medium
            )}
          >
            <h3
              className={cn(
                "text-lg font-semibold mb-4",
                COLORS.ui.text.primary
              )}
            >
              Most Used Tools
            </h3>
            {projectSummary.most_used_tools.length > 0 ? (
              <ToolUsageChart tools={projectSummary.most_used_tools} />
            ) : (
              <div className={cn("text-center py-8", COLORS.ui.text.muted)}>
                No tool usage data available
              </div>
            )}
          </div>
        </div>

        {/* Daily Trend Chart */}
        {projectSummary.daily_stats.length > 0 && (
          <div
            className={cn(
              "p-6 rounded-lg border",
              COLORS.ui.background.white,
              COLORS.ui.border.medium
            )}
          >
            <h3
              className={cn(
                "text-lg font-semibold mb-4 flex items-center space-x-2",
                COLORS.ui.text.primary
              )}
            >
              <TrendingUp className="w-4 h-4" />
              <span>최근 7일 활동 추이</span>
            </h3>
            <div className="space-y-4">
              {/* Enhanced bar chart */}
              <div className="relative h-48">
                <div className="absolute  inset-0 flex items-end justify-between gap-1">
                  {generateDailyData().map((stat) => {
                    const dailyData = generateDailyData();
                    const maxTokens = Math.max(
                      ...dailyData.map((s) => s.total_tokens),
                      1
                    );
                    const height = Math.max(
                      0,
                      (stat.total_tokens / maxTokens) * 100
                    );

                    const isWeekend =
                      new Date(stat.date || "").getDay() === 0 ||
                      new Date(stat.date || "").getDay() === 6;
                    const isToday =
                      stat.date === new Date().toISOString().split("T")[0];

                    return (
                      <div
                        key={stat.date}
                        className="flex-1 flex flex-col items-center justify-end group relative h-full"
                      >
                        <div
                          className={cn(
                            "w-full rounded-t transition-all duration-300 cursor-pointer",
                            "hover:scale-105 hover:shadow-lg ",
                            isToday
                              ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                              : isWeekend
                              ? "bg-gradient-to-t from-purple-600 to-purple-400"
                              : stat.total_tokens > maxTokens * 0.7
                              ? "bg-gradient-to-t from-blue-600 to-blue-400"
                              : stat.total_tokens > maxTokens * 0.3
                              ? "bg-gradient-to-t from-indigo-600 to-indigo-400"
                              : "bg-gradient-to-t from-gray-500 to-gray-400"
                          )}
                          style={{ height: `${height}%`, minHeight: "4px" }}
                          title={`${stat.date}\n📊 토큰: ${formatNumber(
                            stat.total_tokens
                          )}\n💬 메시지: ${stat.message_count}\n🎯 세션: ${
                            stat.session_count
                          }`}
                        >
                          {/* 사용 토큰수 */}
                          {stat.total_tokens > 0 && (
                            <div className="text-xs text-center absolute left-0 mb-4 right-0  flex items-center justify-center text-white">
                              {formatNumber(stat.total_tokens)}
                            </div>
                          )}
                        </div>

                        {/* Date labels for all days */}
                        <div
                          className={cn(
                            "text-xs text-center absolute -bottom-4 left-0 right-0",
                            isToday
                              ? "font-bold text-emerald-600"
                              : "text-gray-500"
                          )}
                        >
                          {stat.date?.slice(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div
                    className={cn("text-lg font-bold", COLORS.ui.text.primary)}
                  >
                    {generateDailyData().reduce(
                      (sum, s) => sum + s.total_tokens,
                      0
                    ) > 0
                      ? formatNumber(
                          Math.round(
                            generateDailyData().reduce(
                              (sum, s) => sum + s.total_tokens,
                              0
                            ) / 7
                          )
                        )
                      : "0"}
                  </div>
                  <div className={cn("text-xs", COLORS.ui.text.muted)}>
                    일평균 토큰
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={cn("text-lg font-bold", COLORS.ui.text.primary)}
                  >
                    {Math.round(
                      generateDailyData().reduce(
                        (sum, s) => sum + s.message_count,
                        0
                      ) / 7
                    )}
                  </div>
                  <div className={cn("text-xs", COLORS.ui.text.muted)}>
                    일평균 메시지
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className={cn("text-lg font-bold", COLORS.ui.text.primary)}
                  >
                    {
                      generateDailyData().filter((s) => s.total_tokens > 0)
                        .length
                    }
                  </div>
                  <div className={cn("text-xs", COLORS.ui.text.muted)}>
                    주간 활동일
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-4 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded" />
                  <span className={cn(COLORS.ui.text.muted)}>오늘</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-gradient-to-t from-blue-600 to-blue-400 rounded" />
                  <span className={cn(COLORS.ui.text.muted)}>높은 활동</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-gradient-to-t from-purple-600 to-purple-400 rounded" />
                  <span className={cn(COLORS.ui.text.muted)}>주말</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Token Distribution */}
        <div
          className={cn(
            "p-6 rounded-lg border",
            COLORS.ui.background.white,
            COLORS.ui.border.medium
          )}
        >
          <h3
            className={cn("text-lg font-semibold mb-4", COLORS.ui.text.primary)}
          >
            토큰 유형별 분포
          </h3>
          <div className="space-y-4">
            {/* Token type bars */}
            <div className="space-y-3">
              {[
                {
                  label: "Input",
                  value: projectSummary.token_distribution.input,
                  color: COLORS.semantic.success.textDark,
                  bgColor: "bg-green-800 dark:bg-green-300",
                },
                {
                  label: "Output",
                  value: projectSummary.token_distribution.output,
                  color: COLORS.semantic.info.textDark,
                  bgColor: "bg-blue-800 dark:bg-blue-300",
                },
                {
                  label: "Cache Creation",
                  value: projectSummary.token_distribution.cache_creation,
                  color: COLORS.tools.search.text,
                  bgColor: "bg-purple-800 dark:bg-purple-300",
                },
                {
                  label: "Cache Read",
                  value: projectSummary.token_distribution.cache_read,
                  color: COLORS.tools.task.text,
                  bgColor: "bg-orange-800 dark:bg-orange-300",
                },
              ].map((item) => {
                const percentage =
                  (item.value / projectSummary.total_tokens) * 100;

                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className={cn("text-sm", COLORS.ui.text.secondary)}>
                        {item.label}
                      </span>
                      <span className={cn("text-sm font-medium", item.color)}>
                        {formatNumber(item.value)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full transition-all",
                          item.bgColor
                        )}
                        style={{
                          width: `${percentage}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div
              className={cn(
                "pt-3 border-t text-center",
                COLORS.ui.border.light
              )}
            >
              <div className={cn("text-3xl font-bold", COLORS.ui.text.primary)}>
                {formatNumber(projectSummary.total_tokens)}
              </div>
              <div className={cn("text-sm", COLORS.ui.text.muted)}>
                총 토큰 사용량
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Session Statistics View
  const SessionStatsView = () => {
    if (!sessionStats || !sessionComparison) return null;

    const avgTokensPerMessage =
      sessionStats.message_count > 0
        ? Math.round(sessionStats.total_tokens / sessionStats.message_count)
        : 0;

    const sessionDuration =
      new Date(sessionStats.last_message_time).getTime() -
      new Date(sessionStats.first_message_time).getTime();
    const durationMinutes = Math.round(sessionDuration / (1000 * 60));

    return (
      <div className="space-y-6">
        {/* Performance Insights */}
        <div
          className={cn(
            "p-6 rounded-lg border",
            sessionComparison.is_above_average
              ? "bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950"
              : "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
            sessionComparison.is_above_average
              ? COLORS.semantic.success.border
              : COLORS.semantic.warning.border
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn("text-lg font-semibold", COLORS.ui.text.primary)}>
              🎯 성능 인사이트
            </h3>
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                sessionComparison.is_above_average
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              )}
            >
              {sessionComparison.is_above_average ? "평균 이상" : "평균 이하"}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div
                className={cn(
                  "text-3xl font-bold mb-1",
                  COLORS.ui.text.primary
                )}
              >
                #{sessionComparison.rank_by_tokens}
              </div>
              <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
                토큰 순위
              </div>
              <div className={cn("text-xs mt-1", COLORS.ui.text.muted)}>
                상위{" "}
                {(
                  (sessionComparison.rank_by_tokens /
                    (projectSummary?.total_sessions || 1)) *
                  100
                ).toFixed(0)}
                %
              </div>
            </div>

            <div className="text-center">
              <div
                className={cn(
                  "text-3xl font-bold mb-1",
                  COLORS.ui.text.primary
                )}
              >
                {sessionComparison.percentage_of_project_tokens.toFixed(1)}%
              </div>
              <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
                프로젝트 비중
              </div>
              <div className={cn("text-xs mt-1", COLORS.ui.text.muted)}>
                총 {formatNumber(sessionStats.total_tokens)} 토큰
              </div>
            </div>

            <div className="text-center">
              <div
                className={cn(
                  "text-3xl font-bold mb-1",
                  COLORS.ui.text.primary
                )}
              >
                {avgTokensPerMessage.toLocaleString()}
              </div>
              <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
                메시지당 토큰
              </div>
              <div className={cn("text-xs mt-1", COLORS.ui.text.muted)}>
                총 {sessionStats.message_count}개 메시지
              </div>
            </div>

            <div className="text-center">
              <div
                className={cn(
                  "text-3xl font-bold mb-1",
                  COLORS.ui.text.primary
                )}
              >
                {durationMinutes}분
              </div>
              <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
                세션 시간
              </div>
              <div className={cn("text-xs mt-1", COLORS.ui.text.muted)}>
                #{sessionComparison.rank_by_duration} 순위
              </div>
            </div>
          </div>
        </div>

        {/* Token Breakdown */}
        <div
          className={cn(
            "p-6 rounded-lg border",
            COLORS.ui.background.white,
            COLORS.ui.border.medium
          )}
        >
          <h3
            className={cn("text-lg font-semibold mb-4", COLORS.ui.text.primary)}
          >
            💾 토큰 사용 분석
          </h3>

          <div className="space-y-4">
            {[
              {
                label: "Input",
                value: sessionStats.total_input_tokens,
                icon: TrendingUp,
                color: COLORS.semantic.success.textDark,
                bgColor: "bg-green-500",
              },
              {
                label: "Output",
                value: sessionStats.total_output_tokens,
                icon: Zap,
                color: COLORS.semantic.info.textDark,
                bgColor: "bg-blue-500",
              },
              {
                label: "Cache Creation",
                value: sessionStats.total_cache_creation_tokens,
                icon: Database,
                color: COLORS.tools.search.text,
                bgColor: "bg-purple-500",
              },
              {
                label: "Cache Read",
                value: sessionStats.total_cache_read_tokens,
                icon: Eye,
                color: COLORS.tools.task.text,
                bgColor: "bg-orange-500",
              },
            ].map((item) => {
              const percentage = (item.value / sessionStats.total_tokens) * 100;
              const Icon = item.icon;

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Icon className={cn("w-4 h-4", item.color)} />
                      <span
                        className={cn(
                          "text-sm font-medium",
                          COLORS.ui.text.secondary
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={cn("text-sm font-bold", item.color)}>
                        {formatNumber(item.value)}
                      </span>
                      <span
                        className={cn("text-xs ml-2", COLORS.ui.text.muted)}
                      >
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full transition-all",
                        item.bgColor
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={cn(
              "mt-6 pt-4 border-t text-center",
              COLORS.ui.border.light
            )}
          >
            <div
              className={cn("text-2xl font-bold mb-1", COLORS.ui.text.primary)}
            >
              {formatNumber(sessionStats.total_tokens)}
            </div>
            <div className={cn("text-sm", COLORS.ui.text.muted)}>
              총 토큰 사용량
            </div>
          </div>
        </div>

        {/* Session Timeline */}
        <div
          className={cn(
            "p-6 rounded-lg border",
            COLORS.ui.background.white,
            COLORS.ui.border.medium
          )}
        >
          <h3
            className={cn("text-lg font-semibold mb-4", COLORS.ui.text.primary)}
          >
            ⏱️ 세션 타임라인
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    COLORS.ui.text.secondary
                  )}
                >
                  시작 시간
                </div>
                <div className={cn("text-xs", COLORS.ui.text.muted)}>
                  {formatTime(sessionStats.first_message_time)}
                </div>
              </div>
              <div className="text-center">
                <div
                  className={cn(
                    "text-sm font-medium",
                    COLORS.ui.text.secondary
                  )}
                >
                  지속 시간
                </div>
                <div className={cn("text-xs", COLORS.ui.text.muted)}>
                  {durationMinutes}분
                </div>
              </div>
              <div className="text-right">
                <div
                  className={cn(
                    "text-sm font-medium",
                    COLORS.ui.text.secondary
                  )}
                >
                  종료 시간
                </div>
                <div className={cn("text-xs", COLORS.ui.text.muted)}>
                  {formatTime(sessionStats.last_message_time)}
                </div>
              </div>
            </div>

            <div className="text-center">
              <code
                className={cn(
                  "inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono",
                  COLORS.ui.text.tertiary
                )}
              >
                Session ID: {sessionStats.session_id.substring(0, 16)}...
              </code>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Quick Stats Bar Component
  const QuickStatsBar = () => {
    if (!projectSummary) return null;

    const sessionRank = sessionComparison?.rank_by_tokens || null;
    const sessionPercentage =
      sessionComparison?.percentage_of_project_tokens || 0;

    return (
      <div
        className={cn(
          "p-4 rounded-lg border mb-6",
          "bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50",
          "dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950",
          COLORS.semantic.info.border
        )}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Target
                className={cn("w-4 h-4 mr-1", COLORS.semantic.info.icon)}
              />
              <span
                className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
              >
                총 토큰
              </span>
            </div>
            <div className={cn("text-xl font-bold", COLORS.ui.text.primary)}>
              {formatNumber(projectSummary.total_tokens)}
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Users
                className={cn("w-4 h-4 mr-1", COLORS.semantic.success.icon)}
              />
              <span
                className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
              >
                총 세션
              </span>
            </div>
            <div className={cn("text-xl font-bold", COLORS.ui.text.primary)}>
              {projectSummary.total_sessions}개
            </div>
          </div>

          {selectedSession && sessionStats && (
            <>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Award
                    className={cn("w-4 h-4 mr-1", COLORS.semantic.warning.icon)}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      COLORS.ui.text.tertiary
                    )}
                  >
                    세션 순위
                  </span>
                </div>
                <div
                  className={cn("text-xl font-bold", COLORS.ui.text.primary)}
                >
                  #{sessionRank || "-"}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Timer
                    className={cn("w-4 h-4 mr-1", COLORS.tools.search.icon)}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      COLORS.ui.text.tertiary
                    )}
                  >
                    프로젝트 비중
                  </span>
                </div>
                <div
                  className={cn("text-xl font-bold", COLORS.ui.text.primary)}
                >
                  {sessionPercentage.toFixed(1)}%
                </div>
              </div>
            </>
          )}

          {!selectedSession && (
            <>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Clock
                    className={cn("w-4 h-4 mr-1", COLORS.semantic.warning.icon)}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      COLORS.ui.text.tertiary
                    )}
                  >
                    평균 세션
                  </span>
                </div>
                <div
                  className={cn("text-xl font-bold", COLORS.ui.text.primary)}
                >
                  {formatDuration(projectSummary.avg_session_duration)}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Activity
                    className={cn("w-4 h-4 mr-1", COLORS.tools.search.icon)}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      COLORS.ui.text.tertiary
                    )}
                  >
                    활발한 시간
                  </span>
                </div>
                <div
                  className={cn("text-xl font-bold", COLORS.ui.text.primary)}
                >
                  {projectSummary.most_active_hour}시
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Tab Navigation Component
  const TabNavigation = () => {
    const hasSessionData = selectedSession && sessionStats && sessionComparison;

    return (
      <div className="flex mb-6">
        <div
          className={cn("flex rounded-lg p-1", "bg-gray-100 dark:bg-gray-800")}
        >
          <button
            onClick={() => setActiveTab("project")}
            className={cn(
              "px-4 py-2 rounded-md font-medium transition-all",
              "flex items-center space-x-2",
              activeTab === "project"
                ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            <span>프로젝트 개요</span>
          </button>

          {hasSessionData && (
            <button
              onClick={() => setActiveTab("session")}
              className={cn(
                "px-4 py-2 rounded-md font-medium transition-all",
                "flex items-center space-x-2",
                activeTab === "session"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              )}
            >
              <Target className="w-4 h-4" />
              <span>세션 상세</span>
            </button>
          )}
        </div>

        {hasSessionData && (
          <div className="ml-auto flex items-center space-x-2 text-sm text-gray-500">
            <Hash className="w-4 h-4" />
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {selectedSession.substring(0, 8)}...
            </code>
          </div>
        )}
      </div>
    );
  };

  // Auto-switch to session tab when session is selected
  React.useEffect(() => {
    if (selectedSession && sessionStats && sessionComparison) {
      setActiveTab("session");
    }
  }, [selectedSession, sessionStats, sessionComparison]);

  // Main render logic
  if (!selectedProject) {
    return (
      <div
        className={cn(
          "flex-1 p-6 flex items-center justify-center",
          COLORS.ui.background.primary
        )}
      >
        <div className="text-center">
          <BarChart3
            className={cn("w-16 h-16 mx-auto mb-4", COLORS.ui.text.disabled)}
          />
          <h2
            className={cn("text-xl font-semibold mb-2", COLORS.ui.text.primary)}
          >
            Analytics Dashboard
          </h2>
          <p className={cn("text-sm", COLORS.ui.text.tertiary)}>
            Select a project to view analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <h2 className={cn("text-2xl font-bold mb-2", COLORS.ui.text.primary)}>
          📊 Analytics Dashboard
        </h2>
        <p className={cn(COLORS.ui.text.tertiary)}>
          {selectedProject}
          {selectedSession && " • Session Analysis"}
        </p>
      </div>

      <QuickStatsBar />
      <TabNavigation />

      {activeTab === "project" ? <ProjectStatsView /> : <SessionStatsView />}
    </div>
  );
};
