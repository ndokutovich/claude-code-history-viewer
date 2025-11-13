import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { Loader2, MessageCircle, ChevronDown, Link2, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UIMessage, UISession, PaginationState } from "../types";
import { ClaudeContentArrayRenderer } from "./contentRenderer";
import {
  ClaudeToolUseDisplay,
  ToolExecutionResultRouter,
  MessageContentDisplay,
  AssistantMessageDetails,
  ProviderMetadataDisplay,
} from "./messageRenderer";
import { extractUIMessageContent } from "../utils/messageUtils";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import { formatTime } from "../utils/time";
import {
  MAX_DEPTH_MARGIN,
  SCROLL_ADJUSTMENT_DELAY,
  SESSION_SCROLL_DELAY,
  SCROLL_BOTTOM_THRESHOLD,
  SCROLL_THROTTLE_DELAY,
  MIN_MESSAGES_FOR_SCROLL_BTN,
} from "../constants/layout";

interface MessageViewerProps {
  messages: UIMessage[];
  pagination: PaginationState;
  isLoading: boolean;
  selectedSession: UISession | null;
  onLoadMore: () => void;
}

interface MessageNodeProps {
  message: UIMessage;
  depth: number;
  providerName: string;
  sessionFilePath?: string;
}

const UIMessageNode = ({ message, depth, providerName, sessionFilePath }: MessageNodeProps) => {
  const { t } = useTranslation("components");
  const [copiedReference, setCopiedReference] = React.useState(false);

  const handleCopyReference = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Format: file_path:line_number or file_path#messageUUID
      const reference = sessionFilePath
        ? `${sessionFilePath}#${message.uuid}`
        : message.uuid;

      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(reference);
      setCopiedReference(true);

      const { toast } = await import("sonner");
      toast.success(t("messageReference.referenceCopied"));

      setTimeout(() => setCopiedReference(false), 2000);
    } catch (error) {
      console.error("Failed to copy reference:", error);
      const { toast } = await import("sonner");
      toast.error(t("messageReference.referenceCopyFailed"));
    }
  };

  // Sidechain filtering is now handled at the data loading level (adapter.loadMessages)
  // This is a defensive check to catch adapter bugs during development
  if (message.isSidechain && import.meta.env.DEV) {
    console.warn(
      '[MessageViewer] Sidechain message not filtered by adapter:',
      message.uuid,
      'This indicates an adapter bug - sidechains should be filtered during data loading.'
    );
  }

  // Apply left margin based on depth
  const leftMargin = depth > 0 ? `ml-${Math.min(depth * 4, MAX_DEPTH_MARGIN)}` : "";

  return (
    <div
      id={`message-${message.uuid}`}
      className={cn(
        "w-full px-4 py-2",
        leftMargin,
        message.isSidechain && "bg-gray-100 dark:bg-gray-800"
      )}
    >
      <div className="max-w-full mx-auto px-4">
        {/* Show depth (only in development mode) */}
        {import.meta.env.DEV && depth > 0 && (
          <div className="text-xs text-gray-400 dark:text-gray-600 mb-1">
            └─ {t("messageViewer.reply", { depth })}
          </div>
        )}

        {/* Message header */}
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
              ? providerName
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
          {/* Copy Reference Button */}
          <button
            onClick={handleCopyReference}
            className={cn(
              "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
              "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            title={t("messageReference.referenceTooltip")}
          >
            {copiedReference ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
          </button>
          {message.type === "assistant" && (
            <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full" />
          )}
        </div>

        {/* Message content */}
        <div className="w-full">
          {/* Message Content */}
          <MessageContentDisplay
            content={extractUIMessageContent(message)}
            messageType={message.type}
          />

          {/* Claude API Content Array */}
          {message.content &&
            typeof message.content === "object" &&
            Array.isArray(message.content) &&
            (message.type !== "assistant" ||
              (message.type === "assistant" &&
                !extractUIMessageContent(message))) && (
              <div className="mb-2">
                <ClaudeContentArrayRenderer content={message.content} />
              </div>
            )}

          {/* Special case: when content is null but toolUseResult exists */}
          {!extractUIMessageContent(message) &&
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

          {/* Provider-specific Metadata (file attachments, etc.) */}
          {message.provider_metadata && (
            <ProviderMetadataDisplay metadata={message.provider_metadata} />
          )}

          {/* Assistant Metadata */}
          <AssistantMessageDetails message={message} />
        </div>
      </div>
    </div>
  );
};

// Type-safe parent UUID extraction function
const getParentUuid = (message: UIMessage): string | null | undefined => {
  const msgWithParent = message as UIMessage & {
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
  // Get provider name for displaying in messages
  const providerName = selectedSession?.providerName || "Claude Code";
  const { t } = useTranslation("components");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  // Ref to prevent infinite rendering
  const isProcessingLoadMore = useRef(false);
  const lastPaginationCall = useRef<number>(0);

  // Detect message changes and adjust scroll position (optimized)
  useEffect(() => {
    const prevLength = prevMessagesLength.current;
    const currentLength = messages.length;

    // Only execute when message length changed and not currently processing
    if (prevLength !== currentLength && !isProcessingLoadMore.current) {
      // Adjust scroll only when messages are added via load more
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

          // Processing complete
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

  // Memoize message tree structure (performance optimization)
  const { rootMessages, uniqueMessages } = useMemo(() => {
    if (messages.length === 0) {
      return { rootMessages: [], uniqueMessages: [] };
    }

    // Remove duplicates
    const uniqueMessages = Array.from(
      new Map(messages.map((msg) => [msg.uuid, msg])).values()
    );

    // Find root messages
    const roots: UIMessage[] = [];
    uniqueMessages.forEach((msg) => {
      const parentUuid = getParentUuid(msg);
      if (!parentUuid) {
        roots.push(msg);
      }
    });

    return { rootMessages: roots, uniqueMessages };
  }, [messages]);

  // Track previous session ID
  const prevSessionIdRef = useRef<string | null>(null);

  // Function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      const element = scrollContainerRef.current;
      // Multiple attempts to ensure scrolling to bottom
      const attemptScroll = (attempts = 0) => {
        element.scrollTop = element.scrollHeight;
        if (
          attempts < 3 &&
          element.scrollTop < element.scrollHeight - element.clientHeight - 10
        ) {
          setTimeout(() => attemptScroll(attempts + 1), SCROLL_ADJUSTMENT_DELAY);
        }
      };
      attemptScroll();
    }
  }, []);

  // Scroll to bottom when new session is selected (chat style)
  useEffect(() => {
    // Execute only when session actually changed and messages are loaded
    if (
      selectedSession &&
      prevSessionIdRef.current !== selectedSession.session_id &&
      messages.length > 0 &&
      !isLoading
    ) {
      // Update previous session ID
      prevSessionIdRef.current = selectedSession.session_id;

      // Execute scroll after DOM is fully updated
      setTimeout(() => scrollToBottom(), SESSION_SCROLL_DELAY);
    }
  }, [selectedSession, messages.length, isLoading, scrollToBottom]);

  // Scroll to bottom when pagination is reset (new session or refresh)
  useEffect(() => {
    if (pagination.currentOffset === 0 && messages.length > 0 && !isLoading) {
      setTimeout(() => scrollToBottom(), SCROLL_ADJUSTMENT_DELAY);
    }
  }, [pagination.currentOffset, messages.length, isLoading, scrollToBottom]);

  // Chat style: maintain scroll position after loading previous messages
  const prevScrollHeight = useRef<number>(0);
  const prevScrollTop = useRef<number>(0);

  // Optimize load more button (prevent duplicate calls)
  const handleLoadMoreWithScroll = useCallback(() => {
    const now = Date.now();

    // Prevent duplicate clicks (block duplicate calls within 1 second)
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

  // Add scroll position state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Optimize scroll event (apply throttling)
  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        try {
          if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } =
              scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_THRESHOLD;
            setShowScrollToBottom(!isNearBottom && messages.length > MIN_MESSAGES_FOR_SCROLL_BTN);
          }
        } catch (error) {
          console.error("Scroll handler error:", error);
        }
        throttleTimer = null;
      }, SCROLL_THROTTLE_DELAY);
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
    message: UIMessage,
    depth = 0,
    visitedIds = new Set<string>(),
    keyPrefix = "",
    sessionFilePath?: string
  ): React.ReactNode[] => {
    // Prevent circular references
    if (visitedIds.has(message.uuid)) {
      console.warn(`Circular reference detected for message: ${message.uuid}`);
      return [];
    }

    visitedIds.add(message.uuid);
    const children = messages.filter((m) => {
      const parentUuid = getParentUuid(m);
      return parentUuid === message.uuid;
    });

    // Generate unique key
    const uniqueKey = keyPrefix ? `${keyPrefix}-${message.uuid}` : message.uuid;

    // Add current message first, then child messages
    const result: React.ReactNode[] = [
      <UIMessageNode
        key={uniqueKey}
        message={message}
        depth={depth}
        providerName={providerName}
        sessionFilePath={selectedSession?.file_path}
      />,
    ];

    // Recursively add child messages (increase depth)
    children.forEach((child, index) => {
      const childNodes = renderMessageTree(
        child,
        depth + 1,
        new Set(visitedIds),
        `${uniqueKey}-child-${index}`,
        sessionFilePath
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
        style={{ scrollBehavior: "auto" }} // Use auto instead of smooth for immediate scroll
      >
        {/* Debugging information */}
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
        <div className="max-w-full mx-auto px-4">
          {/* Load previous messages button (top) - chat style */}
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

          {/* Loading complete message (top) */}
          {!pagination.hasMore && messages.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="text-gray-400 text-sm">
                {t("messageViewer.allMessagesLoaded", {
                  count: pagination.totalCount,
                })}
              </div>
            </div>
          )}

          {/* Message list */}
          {(() => {
            try {
              if (rootMessages.length > 0) {
                // Render tree structure
                return rootMessages
                  .map((message) => renderMessageTree(message, 0, new Set(), "", selectedSession?.file_path))
                  .flat();
              } else {
                // Render flat structure

                return uniqueMessages.map((message, index) => {
                  // Generate unique key: use index and timestamp if UUID is missing or duplicated
                  const uniqueKey =
                    message.uuid && message.uuid !== "unknown-session"
                      ? `${message.uuid}-${index}`
                      : `fallback-${index}-${message.timestamp}-${message.type}`;

                  return (
                    <UIMessageNode
                      key={uniqueKey}
                      message={message}
                      depth={0}
                      providerName={providerName}
                      sessionFilePath={selectedSession?.file_path}
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

              // Safe fallback rendering on error
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

        {/* Floating scroll to bottom button */}
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
