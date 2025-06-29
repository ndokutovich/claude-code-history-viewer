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
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
      {showSessionId && (
        <div className="flex items-center space-x-2 mb-3">
          <Hash className="w-4 h-4 text-blue-600" />
          <code className="text-sm text-blue-800 font-mono bg-blue-100 px-2 py-1 rounded">
            {stats.session_id.substring(0, 8)}...
          </code>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-3 rounded border">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-600 font-medium">입력 토큰</span>
          </div>
          <div className="text-lg font-bold text-green-700">
            {stats.total_input_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <div className="flex items-center space-x-2 mb-1">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-600 font-medium">출력 토큰</span>
          </div>
          <div className="text-lg font-bold text-blue-700">
            {stats.total_output_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <div className="flex items-center space-x-2 mb-1">
            <Database className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-600 font-medium">캐시 생성</span>
          </div>
          <div className="text-lg font-bold text-purple-700">
            {stats.total_cache_creation_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <div className="flex items-center space-x-2 mb-1">
            <Eye className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-gray-600 font-medium">캐시 읽기</span>
          </div>
          <div className="text-lg font-bold text-orange-700">
            {stats.total_cache_read_tokens.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-indigo-100 to-blue-100 p-3 rounded border border-indigo-200">
          <div className="flex items-center space-x-2 mb-1">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span className="text-xs text-indigo-800 font-medium">총 토큰</span>
          </div>
          <div className="text-xl font-bold text-indigo-900">
            {stats.total_tokens.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <div className="flex items-center space-x-2 mb-1">
            <MessageSquare className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-600 font-medium">메시지 수</span>
          </div>
          <div className="text-lg font-bold text-gray-700">
            {stats.message_count.toLocaleString()}
          </div>
        </div>

        <div className="bg-white p-3 rounded border">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-600 font-medium">
              평균 토큰/메시지
            </span>
          </div>
          <div className="text-lg font-bold text-gray-700">
            {stats.message_count > 0
              ? Math.round(
                  stats.total_tokens / stats.message_count
                ).toLocaleString()
              : "0"}
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-gray-500 flex items-center justify-between">
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
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>프로젝트 전체 통계 ({projectStats.length}개 세션)</span>
          </h3>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-3 rounded border text-center">
              <div className="text-2xl font-bold text-green-700">
                {totalStats.total_tokens.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">총 토큰</div>
            </div>
            <div className="bg-white p-3 rounded border text-center">
              <div className="text-lg font-bold text-blue-700">
                {totalStats.total_input_tokens.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">입력 토큰</div>
            </div>
            <div className="bg-white p-3 rounded border text-center">
              <div className="text-lg font-bold text-purple-700">
                {totalStats.total_output_tokens.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">출력 토큰</div>
            </div>
            <div className="bg-white p-3 rounded border text-center">
              <div className="text-lg font-bold text-orange-700">
                {totalStats.total_cache_creation_tokens.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">캐시 생성</div>
            </div>
            <div className="bg-white p-3 rounded border text-center">
              <div className="text-lg font-bold text-gray-700">
                {totalStats.message_count.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">총 메시지</div>
            </div>
          </div>
        </div>

        {/* 개별 세션 통계 */}
        <div className="space-y-3">
          <h4 className="text-md font-medium text-gray-700">
            세션별 상세 통계
          </h4>
          {projectStats.slice(0, 10).map((stats, index) => (
            <div
              key={stats.session_id}
              className="border-l-4 border-blue-300 pl-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  #{index + 1} 세션
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(stats.last_message_time)}
                </span>
              </div>
              {renderSessionStats(stats, true)}
            </div>
          ))}
          {projectStats.length > 10 && (
            <div className="text-center text-sm text-gray-500 py-2">
              ... 그리고 {projectStats.length - 10}개 세션 더
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!sessionStats && !projectStats.length) {
    return (
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
        <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">토큰 사용량 데이터가 없습니다</p>
        <p className="text-sm text-gray-500 mt-1">
          세션을 선택하거나 프로젝트 통계를 로드해보세요
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <BarChart3 className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      </div>

      {sessionStats && (
        <div>
          <h3 className="text-lg font-medium text-gray-700 mb-3">현재 세션</h3>
          {renderSessionStats(sessionStats)}
        </div>
      )}

      {projectStats.length > 0 && renderProjectStats()}
    </div>
  );
};
