import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { Loader2, MessageCircle, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClaudeMessage, ClaudeSession, PaginationState } from "../types";
import { ClaudeContentArrayRenderer } from "./contentRenderer";
import {
  ClaudeToolUseDisplay,
  ToolExecutionResultRouter,
  MessageContentDisplay,
  AssistantMessageDetails,
} from "./messageRenderer";
import { extractClaudeMessageContent } from "../utils/messageUtils";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import { formatTime } from "../utils/time";

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
  const { t } = useTranslation("components");

  if (message.isSidechain) {
    return null;
  }
  // depth에 따른 왼쪽 margin 적용
  const leftMargin = depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : "";

  return (
    <div
      className={cn(
        "w-full px-4 py-2",
        leftMargin,
        message.isSidechain && "bg-gray-100 dark:bg-gray-800"
      )}
    >
      <div className="max-w-4xl mx-auto">
        {/* depth 표시 (개발 모드에서만) */}
        {import.meta.env.DEV && depth > 0 && (
          <div className="text-xs text-gray-400 dark:text-gray-600 mb-1">
            └─ {t("messageViewer.reply", { depth })}
          </div>
        )}

        {/* 메시지 헤더 */}
        <div
          className={`flex items-center space-x-2 mb-1 text-md text-gray-500 dark:text-gray-400 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {message.type === "user" && (
            <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full" />
          )}
          <span className="font-medium whitespace-nowrap">
            {message.type === "user"
              ? t("messageViewer.user")
              : message.type === "assistant"
              ? t("messageViewer.claude")
              : t("messageViewer.system")}
          </span>
          <span className="whitespace-nowrap">
            {formatTime(message.timestamp)}
          </span>
          {message.isSidechain && (
            <span className="px-2 py-1 whitespace-nowrap text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 rounded-full">
              {t("messageViewer.branch")}
            </span>
          )}
          {message.type === "assistant" && (
            <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full" />
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
              <div className={cn("text-sm mb-2", COLORS.ui.text.tertiary)}>
                <span className="italic">:</span>
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

// 타입 안전한 parent UUID 추출 함수
const getParentUuid = (message: ClaudeMessage): string | null | undefined => {
  const msgWithParent = message as ClaudeMessage & {
    parentUuid?: string;
    parent_uuid?: string;
  };
  return msgWithParent.parentUuid || msgWithParent.parent_uuid;
};

export const MessageViewer: React.FC<MessageViewerProps> = ({
  messages,
  pagination,
  isLoading,
  selectedSession,
  onLoadMore,
}) => {
  const { t } = useTranslation("components");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  // 무한 렌더링 방지를 위한 ref
  const isProcessingLoadMore = useRef(false);
  const lastPaginationCall = useRef<number>(0);

  // 메시지 변화 감지 및 스크롤 위치 조정 (최적화됨)
  useEffect(() => {
    const prevLength = prevMessagesLength.current;
    const currentLength = messages.length;

    // 메시지 길이가 변했고, 처리 중이 아닐 때만 실행
    if (prevLength !== currentLength && !isProcessingLoadMore.current) {
      // 더보기로 인한 메시지 추가인 경우만 스크롤 조정
      if (prevLength > 0 && currentLength > prevLength) {
        isProcessingLoadMore.current = true;

        if (scrollContainerRef.current) {
          const scrollElement = scrollContainerRef.current;
          const currentScrollHeight = scrollElement.scrollHeight;
          const heightDifference =
            currentScrollHeight - prevScrollHeight.current;

          if (heightDifference > 0 && prevScrollTop.current >= 0) {
            const newScrollTop = prevScrollTop.current + heightDifference;
            scrollElement.scrollTop = newScrollTop;
          }

          prevScrollHeight.current = currentScrollHeight;

          // 처리 완료
          requestAnimationFrame(() => {
            if (scrollElement.style.overflow === "hidden") {
              scrollElement.style.overflow = "auto";
            }
            isProcessingLoadMore.current = false;
          });
        } else {
          isProcessingLoadMore.current = false;
        }
      }

      prevMessagesLength.current = currentLength;
    }
  }, [messages.length]);

  // 메시지 트리 구조 메모이제이션 (성능 최적화)
  const { rootMessages, uniqueMessages } = useMemo(() => {
    if (messages.length === 0) {
      return { rootMessages: [], uniqueMessages: [] };
    }

    // 중복 제거
    const uniqueMessages = Array.from(
      new Map(messages.map((msg) => [msg.uuid, msg])).values()
    );

    // 디버깅: 중복 제거 전후 비교
    if (messages.length !== uniqueMessages.length) {
      console.log("🚨 Duplicates found:", {
        originalCount: messages.length,
        uniqueCount: uniqueMessages.length,
        duplicates: messages.length - uniqueMessages.length,
      });
    }

    // 루트 메시지 찾기
    const roots: ClaudeMessage[] = [];
    uniqueMessages.forEach((msg) => {
      const parentUuid = getParentUuid(msg);
      if (!parentUuid) {
        roots.push(msg);
      }
    });

    return { rootMessages: roots, uniqueMessages };
  }, [messages]);

  // 이전 세션 ID를 추적
  const prevSessionIdRef = useRef<string | null>(null);

  // 맨 아래로 스크롤하는 함수
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      const element = scrollContainerRef.current;
      // 여러 번 시도하여 확실히 맨 아래로 이동
      const attemptScroll = (attempts = 0) => {
        element.scrollTop = element.scrollHeight;
        if (
          attempts < 3 &&
          element.scrollTop < element.scrollHeight - element.clientHeight - 10
        ) {
          setTimeout(() => attemptScroll(attempts + 1), 50);
        }
      };
      attemptScroll();
    }
  }, []);

  // 새로운 세션 선택 시 스크롤을 맨 아래로 이동 (채팅 스타일)
  useEffect(() => {
    // 세션이 실제로 변경되었고, 메시지가 로드된 경우에만 실행
    if (
      selectedSession &&
      prevSessionIdRef.current !== selectedSession.session_id &&
      messages.length > 0 &&
      !isLoading
    ) {
      // 이전 세션 ID 업데이트
      prevSessionIdRef.current = selectedSession.session_id;

      // DOM이 완전히 업데이트된 후 스크롤 실행
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [selectedSession, messages.length, isLoading, scrollToBottom]);

  // 페이지네이션이 리셋될 때 (새 세션 or 새로고침) 스크롤을 맨 아래로
  useEffect(() => {
    if (pagination.currentOffset === 0 && messages.length > 0 && !isLoading) {
      setTimeout(() => scrollToBottom(), 50);
    }
  }, [pagination.currentOffset, messages.length, isLoading, scrollToBottom]);

  // 채팅 스타일: 이전 메시지 로드 후 스크롤 위치 유지
  const prevScrollHeight = useRef<number>(0);
  const prevScrollTop = useRef<number>(0);

  // 더보기 버튼 최적화 (중복 호출 방지)
  const handleLoadMoreWithScroll = useCallback(() => {
    const now = Date.now();

    // 중복 클릭 방지 (1초 내 중복 호출 차단)
    if (
      !pagination.hasMore ||
      pagination.isLoadingMore ||
      isLoading ||
      isProcessingLoadMore.current ||
      now - lastPaginationCall.current < 1000
    ) {
      return;
    }

    lastPaginationCall.current = now;

    if (scrollContainerRef.current) {
      const scrollElement = scrollContainerRef.current;
      prevScrollTop.current = scrollElement.scrollTop;
      prevScrollHeight.current = scrollElement.scrollHeight;
      scrollElement.style.overflow = "hidden";
    }

    try {
      onLoadMore();
    } catch (error) {
      console.error("Load more execution error:", error);
      isProcessingLoadMore.current = false;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.overflow = "auto";
      }
    }
  }, [pagination.hasMore, pagination.isLoadingMore, isLoading, onLoadMore]);

  // 스크롤 위치 상태 추가
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // 스크롤 이벤트 최적화 (쓰로틀링 적용)
  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        try {
          if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } =
              scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShowScrollToBottom(!isNearBottom && messages.length > 5);
          }
        } catch (error) {
          console.error("Scroll handler error:", error);
        }
        throttleTimer = null;
      }, 100);
    };

    const scrollElement = scrollContainerRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();

      return () => {
        if (throttleTimer) {
          clearTimeout(throttleTimer);
        }
        scrollElement.removeEventListener("scroll", handleScroll);
      };
    }
  }, [messages.length]);

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{t("messageViewer.loadingMessages")}</span>
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
        <h3 className="text-lg font-medium mb-2">
          {t("messageViewer.noMessages")}
        </h3>
        <p className="text-sm text-center whitespace-pre-line">
          {t("messageViewer.noMessagesDescription")}
        </p>
      </div>
    );
  }

  const renderMessageTree = (
    message: ClaudeMessage,
    depth = 0,
    visitedIds = new Set<string>(),
    keyPrefix = ""
  ): React.ReactNode[] => {
    // 순환 참조 방지
    if (visitedIds.has(message.uuid)) {
      console.warn(`Circular reference detected for message: ${message.uuid}`);
      return [];
    }

    visitedIds.add(message.uuid);
    const children = messages.filter((m) => {
      const parentUuid = getParentUuid(m);
      return parentUuid === message.uuid;
    });

    // 고유한 키 생성
    const uniqueKey = keyPrefix ? `${keyPrefix}-${message.uuid}` : message.uuid;

    // 현재 메시지를 먼저 추가하고, 자식 메시지들을 이어서 추가
    const result: React.ReactNode[] = [
      <ClaudeMessageNode key={uniqueKey} message={message} depth={depth} />,
    ];

    // 자식 메시지들을 재귀적으로 추가 (depth 증가)
    children.forEach((child, index) => {
      const childNodes = renderMessageTree(
        child,
        depth + 1,
        new Set(visitedIds),
        `${uniqueKey}-child-${index}`
      );
      result.push(...childNodes);
    });

    return result;
  };

  return (
    <div className="relative flex-1 h-full">
      <div
        ref={scrollContainerRef}
        className="flex-1 h-full overflow-y-auto scrollbar-thin"
        style={{ scrollBehavior: "auto" }} // smooth 대신 auto로 즉각적인 스크롤
      >
        {/* 디버깅 정보 */}
        {import.meta.env.DEV && (
          <div className="bg-yellow-50 p-2 text-xs text-yellow-800 border-b space-y-1">
            <div>
              {t("messageViewer.debugInfo.messages", {
                current: messages.length,
                total: pagination.totalCount,
              })}{" "}
              |{" "}
              {t("messageViewer.debugInfo.offset", {
                offset: pagination.currentOffset,
              })}{" "}
              |{" "}
              {t("messageViewer.debugInfo.hasMore", {
                hasMore: pagination.hasMore ? "O" : "X",
              })}{" "}
              |{" "}
              {t("messageViewer.debugInfo.loading", {
                loading: pagination.isLoadingMore ? "O" : "X",
              })}
            </div>
            <div>
              {t("messageViewer.debugInfo.session", {
                sessionId: selectedSession?.session_id?.slice(-8),
              })}{" "}
              |{" "}
              {t("messageViewer.debugInfo.file", {
                fileName: selectedSession?.file_path
                  ?.split("/")
                  .pop()
                  ?.slice(0, 20),
              })}
            </div>
            {messages.length > 0 && (
              <div>
                {t("messageViewer.debugInfo.firstMessage", {
                  timestamp: messages[0]?.timestamp,
                })}{" "}
                |{" "}
                {t("messageViewer.debugInfo.lastMessage", {
                  timestamp: messages[messages.length - 1]?.timestamp,
                })}
              </div>
            )}
          </div>
        )}
        <div className="max-w-4xl mx-auto">
          {/* 이전 메시지 로드 버튼 (상단) - 채팅 스타일 */}
          {pagination.hasMore && (
            <div className="flex items-center justify-center py-4">
              {pagination.isLoadingMore ? (
                <div className="flex items-center space-x-2 text-gray-500 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {t("messageViewer.loadingPreviousMessages", {
                      current: messages.length,
                      total: pagination.totalCount,
                    })}
                  </span>
                </div>
              ) : (
                <button
                  onClick={handleLoadMoreWithScroll}
                  className="flex items-center space-x-2 py-2 px-4 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {t("messageViewer.loadMoreMessages", {
                      count: (() => {
                        const remainingMessages =
                          pagination.totalCount - messages.length;
                        const messagesToLoad = Math.min(
                          pagination.pageSize,
                          remainingMessages
                        );
                        return messagesToLoad;
                      })(),
                      current: messages.length,
                      total: pagination.totalCount,
                    })}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* 로딩 완료 메시지 (상단) */}
          {!pagination.hasMore && messages.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="text-gray-400 text-sm">
                {t("messageViewer.allMessagesLoaded", {
                  count: pagination.totalCount,
                })}
              </div>
            </div>
          )}

          {/* 메시지 목록 */}
          {(() => {
            try {
              if (rootMessages.length > 0) {
                // 트리 구조 렌더링
                return rootMessages
                  .map((message) => renderMessageTree(message, 0, new Set()))
                  .flat();
              } else {
                // 평면 구조 렌더링

                return uniqueMessages.map((message, index) => {
                  // 고유 키 생성: UUID가 없거나 중복될 경우 인덱스와 타임스탬프 사용
                  const uniqueKey =
                    message.uuid && message.uuid !== "unknown-session"
                      ? `${message.uuid}-${index}`
                      : `fallback-${index}-${message.timestamp}-${message.type}`;

                  return (
                    <ClaudeMessageNode
                      key={uniqueKey}
                      message={message}
                      depth={0}
                    />
                  );
                });
              }
            } catch (error) {
              console.error("Message rendering error:", error);
              console.error("Message state when error occurred:", {
                messagesLength: messages.length,
                rootMessagesLength: rootMessages.length,
                pagination,
                firstMessage: messages[0],
                lastMessage: messages[messages.length - 1],
              });

              // 에러 발생 시 안전한 fallback 렌더링
              return (
                <div
                  key="error-fallback"
                  className="flex items-center justify-center p-8"
                >
                  <div className="text-center text-red-600">
                    <div className="text-lg font-semibold mb-2">
                      {t("messageViewer.renderError")}
                    </div>
                    <div className="text-sm">
                      {t("messageViewer.checkConsole")}
                    </div>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      {t("messageViewer.refresh")}
                    </button>
                  </div>
                </div>
              );
            }
          })()}
        </div>

        {/* 플로팅 맨 아래로 버튼 */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className={cn(
              "fixed bottom-10 right-2 p-3 rounded-full shadow-lg transition-all duration-300 z-50",
              "bg-blue-500/50 hover:bg-blue-600 text-white",
              "hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300",
              "dark:bg-blue-600/50 dark:hover:bg-blue-700 dark:focus:ring-blue-800",
              showScrollToBottom
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            )}
            title={t("messageViewer.scrollToBottom")}
            aria-label={t("messageViewer.scrollToBottom")}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
