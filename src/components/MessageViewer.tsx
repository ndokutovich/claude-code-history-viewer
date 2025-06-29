import React, { useEffect, useRef, useCallback } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import type { ClaudeMessage, ClaudeSession, PaginationState } from "../types";
import { ClaudeContentArrayRenderer } from "./contentRenderer";
import {
  ClaudeToolUseDisplay,
  ToolExecutionResultRouter,
  MessageContentDisplay,
  AssistantMessageDetails,
} from "./messageRenderer";
import { formatTime, extractClaudeMessageContent } from "../utils/messageUtils";
import { cn } from "../utils/cn";

interface MessageViewerProps {
  messages: ClaudeMessage[];
  pagination: PaginationState;
  isLoading: boolean;
  selectedSession: ClaudeSession | null;
  onLoadMore: () => void;
}

interface MessageNodeProps {
  message: ClaudeMessage;
  depth: number;
}

const ClaudeMessageNode = ({ message, depth }: MessageNodeProps) => {
  // depth에 따른 왼쪽 margin 적용
  const leftMargin = depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : "";

  return (
    <div
      className={cn(
        "w-full px-4 py-2",
        leftMargin,
        message.isSidechain && "bg-gray-100"
      )}
    >
      <div className="max-w-4xl mx-auto">
        {/* depth 표시 (개발 모드에서만) */}
        {import.meta.env.DEV && depth > 0 && (
          <div className="text-xs text-gray-400 mb-1">
            └─ 답글 (depth: {depth})
          </div>
        )}

        {/* 메시지 헤더 */}
        <div
          className={`flex items-center space-x-2 mb-1 text-md text-gray-500 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div className="w-full h-0.5 bg-gray-100 rounded-full" />
          <span className="font-medium whitespace-nowrap">
            {message.type === "user"
              ? "사용자"
              : message.type === "assistant"
              ? "Claude"
              : "시스템"}
          </span>
          <span className="whitespace-nowrap">
            {formatTime(message.timestamp)}
          </span>
          {message.isSidechain && (
            <span className="px-2 py-1 whitespace-nowrap text-xs bg-orange-100 text-orange-800 rounded-full">
              분기
            </span>
          )}
        </div>

        {/* 메시지 내용 */}
        <div className="w-full">
          {/* Message Content */}
          <MessageContentDisplay
            content={extractClaudeMessageContent(message)}
            messageType={message.type}
          />

          {/* Claude API Content Array */}
          {message.content &&
            typeof message.content === "object" &&
            Array.isArray(message.content) &&
            (message.type !== "assistant" ||
              (message.type === "assistant" &&
                !extractClaudeMessageContent(message))) && (
              <div className="mb-2">
                <ClaudeContentArrayRenderer content={message.content} />
              </div>
            )}

          {/* Special case: when content is null but toolUseResult exists */}
          {!extractClaudeMessageContent(message) &&
            message.toolUseResult &&
            typeof message.toolUseResult === "object" &&
            Array.isArray(message.toolUseResult.content) && (
              <div className="text-sm text-gray-600 mb-2">
                <span className="italic">도구 실행 결과:</span>
              </div>
            )}

          {/* Tool Use */}
          {message.toolUse && (
            <ClaudeToolUseDisplay toolUse={message.toolUse} />
          )}

          {/* Tool Result */}
          {message.toolUseResult && (
            <ToolExecutionResultRouter
              toolResult={message.toolUseResult}
              depth={depth}
            />
          )}

          {/* Assistant Metadata */}
          <AssistantMessageDetails message={message} />
        </div>
      </div>
    </div>
  );
};

export const MessageViewer: React.FC<MessageViewerProps> = ({
  messages,
  pagination,
  isLoading,
  selectedSession,
  onLoadMore,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  // 메시지 변화 감지 및 디버깅
  useEffect(() => {
    if (prevMessagesLength.current !== messages.length) {
      console.log(
        `메시지 개수 변화: ${prevMessagesLength.current} -> ${messages.length}`
      );
      console.log("페이지네이션 상태:", pagination);
      prevMessagesLength.current = messages.length;
    }
  }, [messages.length, pagination]);

  // Intersection Observer for infinite scrolling
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      if (
        entry &&
        entry.isIntersecting &&
        pagination.hasMore &&
        !pagination.isLoadingMore &&
        !isLoading
      ) {
        console.log("무한 스크롤 트리거됨");
        onLoadMore();
      }
    },
    [pagination.hasMore, pagination.isLoadingMore, isLoading, onLoadMore]
  );

  // Set up intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: "200px",
      threshold: 0.1,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleIntersection, pagination.hasMore]); // pagination.hasMore 의존성 추가

  // 메시지를 트리 구조로 변환
  const buildMessageTree = (messages: ClaudeMessage[]) => {
    const messageMap = new Map<string, ClaudeMessage>();
    const roots: ClaudeMessage[] = [];

    // 모든 메시지를 맵에 저장
    messages.forEach((msg) => messageMap.set(msg.uuid, msg));

    // 루트 메시지들과 자식 메시지들 구분
    messages.forEach((msg) => {
      if (!msg.parentUuid || msg.parentUuid === null) {
        roots.push(msg);
      }
    });

    return roots;
  };

  // 이전 세션 ID를 추적
  const prevSessionIdRef = useRef<string | null>(null);

  // 새로운 세션 선택 시 스크롤을 맨 위로 이동
  useEffect(() => {
    // 세션이 실제로 변경되었고, 메시지가 로드된 경우에만 실행
    if (
      selectedSession &&
      prevSessionIdRef.current !== selectedSession.session_id &&
      messages.length > 0 &&
      !isLoading
    ) {
      console.log(
        "새로운 세션 선택됨, 스크롤을 맨 위로 이동:",
        selectedSession.session_id
      );

      // 이전 세션 ID 업데이트
      prevSessionIdRef.current = selectedSession.session_id;

      // DOM이 업데이트된 후 스크롤 실행
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
          console.log("스크롤 위치 리셋 완료");
        }
      });
    }
  }, [selectedSession, messages.length, isLoading]);

  // 페이지네이션이 리셋될 때 (새 세션 or 새로고침) 스크롤 위로
  useEffect(() => {
    if (pagination.currentOffset === 0 && messages.length > 0 && !isLoading) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      });
    }
  }, [pagination.currentOffset, messages.length, isLoading]);

  // 메시지 로딩 완료 시 스크롤 위치 조정 (새로운 메시지 추가 후)
  useEffect(() => {
    if (pagination.isLoadingMore === false && messages.length > 20) {
      // 로딩이 완료되고 새로운 메시지가 추가되었을 때
      // 약간의 지연 후 observer를 다시 설정하여 확실히 감지되도록 함
      setTimeout(() => {
        if (loadMoreRef.current) {
          // 강제로 observer 다시 설정
          const observer = new IntersectionObserver(handleIntersection, {
            root: null,
            rootMargin: "200px",
            threshold: 0.1,
          });
          observer.observe(loadMoreRef.current);

          setTimeout(() => observer.disconnect(), 1000);
        }
      }, 100);
    }
  }, [pagination.isLoadingMore, messages.length, handleIntersection]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>메시지를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full">
        <div className="mb-4">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-400" />
        </div>
        <h3 className="text-lg font-medium mb-2">메시지가 없습니다</h3>
        <p className="text-sm text-center">
          왼쪽에서 프로젝트와 세션을 선택하여
          <br />
          대화 내용을 확인하세요.
        </p>
      </div>
    );
  }

  const renderMessageTree = (
    message: ClaudeMessage,
    depth = 0,
    visitedIds = new Set<string>()
  ): React.ReactNode[] => {
    // 순환 참조 방지
    if (visitedIds.has(message.uuid)) {
      console.warn(`Circular reference detected for message: ${message.uuid}`);
      return [];
    }

    visitedIds.add(message.uuid);
    const children = messages.filter((m) => m.parentUuid === message.uuid);

    // 현재 메시지를 먼저 추가하고, 자식 메시지들을 이어서 추가
    const result: React.ReactNode[] = [
      <ClaudeMessageNode key={message.uuid} message={message} depth={depth} />,
    ];

    // 자식 메시지들을 재귀적으로 추가 (depth 증가)
    children.forEach((child) => {
      const childNodes = renderMessageTree(
        child,
        depth + 1,
        new Set(visitedIds)
      );
      result.push(...childNodes);
    });

    return result;
  };

  const rootMessages = buildMessageTree(messages);

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 h-full overflow-y-auto scrollbar-thin"
    >
      {/* 디버깅 정보 */}
      {import.meta.env.DEV && (
        <div className="bg-yellow-50 p-2 text-xs text-yellow-800 border-b">
          메시지: {messages.length} / {pagination.totalCount} | 오프셋:{" "}
          {pagination.currentOffset} | 더 있음: {pagination.hasMore ? "O" : "X"}{" "}
          | 로딩중: {pagination.isLoadingMore ? "O" : "X"}
        </div>
      )}
      <div className="max-w-4xl mx-auto">
        {/* 메시지 목록 */}
        {rootMessages.map((message) => renderMessageTree(message)).flat()}

        {/* 무한 스크롤 트리거 */}
        {pagination.hasMore && (
          <div
            ref={loadMoreRef}
            className="flex items-center justify-center py-4"
            style={{ minHeight: "60px" }} // 최소 높이 보장
          >
            {pagination.isLoadingMore ? (
              <div className="flex items-center space-x-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  더 많은 메시지를 불러오는 중... ({messages.length}/
                  {pagination.totalCount})
                </span>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">
                스크롤하여 더 많은 메시지를 불러오세요 ({messages.length}/
                {pagination.totalCount})
              </div>
            )}
          </div>
        )}

        {/* 로딩 완료 메시지 */}
        {!pagination.hasMore && messages.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <div className="text-gray-400 text-sm">
              모든 메시지를 불러왔습니다 ({pagination.totalCount}개)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
