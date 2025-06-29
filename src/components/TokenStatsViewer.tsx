"use client";

import React from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  MessageSquare,
  Database,
  Zap,
  Eye,
  Hash,
} from "lucide-react";
import type { SessionTokenStats } from "../types";
import { formatTime } from "../utils/time";
import { COLORS } from "../constants/colors";
import { cn } from "../utils/cn";

interface TokenStatsViewerProps {
  sessionStats?: SessionTokenStats | null;
  projectStats?: SessionTokenStats[];
  title?: string;
}

export const TokenStatsViewer: React.FC<TokenStatsViewerProps> = ({
  sessionStats,
  projectStats = [],
  title = "토큰 사용량 통계",
}) => {
  // 단일 세션 통계 표시
  const renderSessionStats = (
    stats: SessionTokenStats,
    showSessionId = false
  ) => (
    <div
      className={cn(
        "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-4 rounded-lg border",
        COLORS.semantic.info.border
      )}
    >
      {showSessionId && (
        <div className="flex items-center space-x-2 mb-3">
          <Hash className={cn("w-4 h-4", COLORS.semantic.info.icon)} />
          <code
            className={cn(
              "text-sm font-mono px-2 py-1 rounded",
              COLORS.semantic.info.textDark,
              COLORS.semantic.info.bgDark
            )}
          >
            {stats.session_id.substring(0, 8)}...
          </code>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp
              className={cn("w-4 h-4", COLORS.semantic.success.icon)}
            />
            <span
              className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
            >
              입력 토큰
            </span>
          </div>
          <div
            className={cn(
              "text-lg font-bold",
              COLORS.semantic.success.textDark
            )}
          >
            {stats.total_input_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <Zap className={cn("w-4 h-4", COLORS.semantic.info.icon)} />
            <span
              className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
            >
              출력 토큰
            </span>
          </div>
          <div
            className={cn("text-lg font-bold", COLORS.semantic.info.textDark)}
          >
            {stats.total_output_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <Database className={cn("w-4 h-4", COLORS.tools.search.icon)} />
            <span
              className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
            >
              캐시 생성
            </span>
          </div>
          <div className={cn("text-lg font-bold", COLORS.tools.search.text)}>
            {stats.total_cache_creation_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <Eye className={cn("w-4 h-4", COLORS.tools.task.icon)} />
            <span
              className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
            >
              캐시 읽기
            </span>
          </div>
          <div className={cn("text-lg font-bold", COLORS.tools.task.text)}>
            {stats.total_cache_read_tokens.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className={cn(
            "bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-900 p-3 rounded border",
            COLORS.tools.system.border
          )}
        >
          <div className="flex items-center space-x-2 mb-1">
            <BarChart3 className={cn("w-4 h-4", COLORS.tools.system.icon)} />
            <span
              className={cn("text-xs font-medium", COLORS.tools.system.text)}
            >
              총 토큰
            </span>
          </div>
          <div className={cn("text-xl font-bold", COLORS.tools.system.text)}>
            {stats.total_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <MessageSquare className={cn("w-4 h-4", COLORS.ui.text.tertiary)} />
            <span
              className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
            >
              메시지 수
            </span>
          </div>
          <div className={cn("text-lg font-bold", COLORS.ui.text.secondary)}>
            {stats.message_count.toLocaleString()}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className={cn("w-4 h-4", COLORS.ui.text.tertiary)} />
            <span
              className={cn("text-xs font-medium", COLORS.ui.text.tertiary)}
            >
              평균 토큰/메시지
            </span>
          </div>
          <div className={cn("text-lg font-bold", COLORS.ui.text.secondary)}>
            {stats.message_count > 0
              ? Math.round(
                  stats.total_tokens / stats.message_count
                ).toLocaleString()
              : "0"}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 text-xs flex items-center justify-between",
          COLORS.ui.text.muted
        )}
      >
        <span>시작: {formatTime(stats.first_message_time)}</span>
        <span>종료: {formatTime(stats.last_message_time)}</span>
      </div>
    </div>
  );

  // 프로젝트 전체 통계 표시
  const renderProjectStats = () => {
    if (!projectStats.length) return null;

    const totalStats = projectStats.reduce(
      (acc, stats) => ({
        total_input_tokens: acc.total_input_tokens + stats.total_input_tokens,
        total_output_tokens:
          acc.total_output_tokens + stats.total_output_tokens,
        total_cache_creation_tokens:
          acc.total_cache_creation_tokens + stats.total_cache_creation_tokens,
        total_cache_read_tokens:
          acc.total_cache_read_tokens + stats.total_cache_read_tokens,
        total_tokens: acc.total_tokens + stats.total_tokens,
        message_count: acc.message_count + stats.message_count,
      }),
      {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cache_creation_tokens: 0,
        total_cache_read_tokens: 0,
        total_tokens: 0,
        message_count: 0,
      }
    );

    return (
      <div className="space-y-4">
        {/* 프로젝트 전체 요약 */}
        <div
          className={cn(
            "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 rounded-lg border",
            COLORS.semantic.success.border
          )}
        >
          <h3
            className={cn(
              "text-lg font-semibold mb-3 flex items-center space-x-2",
              COLORS.semantic.success.textDark
            )}
          >
            <BarChart3 className="w-5 h-5" />
            <span>프로젝트 전체 통계 ({projectStats.length}개 세션)</span>
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div
              className={cn(
                "p-3 rounded border text-center",
                COLORS.ui.background.white,
                COLORS.ui.border.medium
              )}
            >
              <div
                className={cn(
                  "text-2xl font-bold",
                  COLORS.semantic.success.textDark
                )}
              >
                {totalStats.total_tokens.toLocaleString()}
              </div>
              <div className={cn("text-xs", COLORS.ui.text.tertiary)}>
                총 토큰
              </div>
            </div>
            <div
              className={cn(
                "p-3 rounded border text-center",
                COLORS.ui.background.white,
                COLORS.ui.border.medium
              )}
            >
              <div
                className={cn(
                  "text-lg font-bold",
                  COLORS.semantic.info.textDark
                )}
              >
                {totalStats.total_input_tokens.toLocaleString()}
              </div>
              <div className={cn("text-xs", COLORS.ui.text.tertiary)}>
                입력 토큰
              </div>
            </div>
            <div
              className={cn(
                "p-3 rounded border text-center",
                COLORS.ui.background.white,
                COLORS.ui.border.medium
              )}
            >
              <div
                className={cn("text-lg font-bold", COLORS.tools.search.text)}
              >
                {totalStats.total_output_tokens.toLocaleString()}
              </div>
              <div className={cn("text-xs", COLORS.ui.text.tertiary)}>
                출력 토큰
              </div>
            </div>
            <div
              className={cn(
                "p-3 rounded border text-center",
                COLORS.ui.background.white,
                COLORS.ui.border.medium
              )}
            >
              <div className={cn("text-lg font-bold", COLORS.tools.task.text)}>
                {totalStats.total_cache_creation_tokens.toLocaleString()}
              </div>
              <div className={cn("text-xs", COLORS.ui.text.tertiary)}>
                캐시 생성
              </div>
            </div>
            <div
              className={cn(
                "p-3 rounded border text-center",
                COLORS.ui.background.white,
                COLORS.ui.border.medium
              )}
            >
              <div
                className={cn("text-lg font-bold", COLORS.ui.text.secondary)}
              >
                {totalStats.message_count.toLocaleString()}
              </div>
              <div className={cn("text-xs", COLORS.ui.text.tertiary)}>
                총 메시지
              </div>
            </div>
          </div>
        </div>

        {/* 개별 세션 통계 */}
        <div className="space-y-3">
          <h4 className={cn("text-md font-medium", COLORS.ui.text.secondary)}>
            세션별 상세 통계
          </h4>
          {projectStats.slice(0, 10).map((stats, index) => (
            <div
              key={stats.session_id}
              className={cn(
                "border-l-4 pl-3",
                "border-blue-300 dark:border-blue-600"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    COLORS.ui.text.secondary
                  )}
                >
                  #{index + 1} 세션
                </span>
                <span className={cn("text-xs", COLORS.ui.text.muted)}>
                  {formatTime(stats.last_message_time)}
                </span>
              </div>
              {renderSessionStats(stats, true)}
            </div>
          ))}
          {projectStats.length > 10 && (
            <div
              className={cn("text-center text-sm py-2", COLORS.ui.text.muted)}
            >
              ... 그리고 {projectStats.length - 10}개 세션 더
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!sessionStats && !projectStats.length) {
    return (
      <div
        className={cn(
          "p-6 rounded-lg border text-center",
          COLORS.ui.background.primary,
          COLORS.ui.border.light
        )}
      >
        <BarChart3
          className={cn("w-12 h-12 mx-auto mb-2", COLORS.ui.text.disabled)}
        />
        <p className={cn(COLORS.ui.text.tertiary)}>
          토큰 사용량 데이터가 없습니다
        </p>
        <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
          세션을 선택하거나 프로젝트 통계를 로드해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <BarChart3 className={cn("w-6 h-6", COLORS.semantic.info.icon)} />
        <h2 className={cn("text-xl font-semibold", COLORS.ui.text.primary)}>
          {title}
        </h2>
      </div>

      {sessionStats && (
        <div>
          <h3
            className={cn("text-lg font-medium mb-3", COLORS.ui.text.secondary)}
          >
            현재 세션
          </h3>
          {renderSessionStats(sessionStats)}
        </div>
      )}

      {projectStats.length > 0 && renderProjectStats()}
    </div>
  );
};
