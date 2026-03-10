import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Loader2, MessageCircle, ChevronDown, ListTree, Search, X, ChevronUp } from "lucide-react";
import { useSearchState } from "../../hooks/useSearchState";
import { useTranslation } from "react-i18next";
import type { UISession, MessageBuilder } from "../../types";
import { cn } from "../../utils/cn";
import { invoke } from "@tauri-apps/api/core";
import type { ExtractMessageRangeRequest, ExtractMessageRangeResponse } from "../../types/sessionWriter";
import { adapterRegistry } from "../../adapters/registry/AdapterRegistry";
import { useAppStore } from "../../store/useAppStore";
import { MessageNavigator } from "../MessageNavigator";
import { SessionBuilderModal } from "../modals/SessionBuilderModal";
import type { MessageViewerProps } from "./types";
import { MessageNode } from "./components";
import { useMessageScrolling, useMessageTree } from "./hooks";

const DEFAULT_NAVIGATOR_WIDTH = 280;
const MIN_NAVIGATOR_WIDTH = 200;
const MAX_NAVIGATOR_WIDTH = 480;

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

  // Session Builder Modal state for extract functionality
  const [isSessionBuilderOpen, setIsSessionBuilderOpen] = useState(false);
  const [extractedMessages, setExtractedMessages] = useState<MessageBuilder[]>([]);

  // Message Navigator state
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [isNavigatorCollapsed, setIsNavigatorCollapsed] = useState(false);
  const [activeMessageUuid, setActiveMessageUuid] = useState<string | null>(null);
  const [navigatorWidth, setNavigatorWidth] = useState(DEFAULT_NAVIGATOR_WIDTH);
  const [isResizingNavigator, setIsResizingNavigator] = useState(false);

  // In-session search toolbar state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    sessionSearch,
    setSessionSearchQuery,
    setSearchFilterType,
    goToNextMatch,
    goToPrevMatch,
    clearSessionSearch,
    rebuildSearchIndex,
    isCaptureMode,
    hiddenMessageIds,
    hideMessage,
  } = useAppStore();

  const { searchQuery, isSearchPending, handleSearchInput, handleClearSearch } = useSearchState({
    onSearchChange: setSessionSearchQuery,
    sessionId: selectedSession?.session_id,
  });

  // Rebuild search index when messages change
  useEffect(() => {
    if (messages.length > 0) {
      rebuildSearchIndex();
    }
  }, [messages, rebuildSearchIndex]);

  // Scroll to current match when it changes
  useEffect(() => {
    const { matches, currentMatchIndex } = sessionSearch;
    if (currentMatchIndex >= 0 && matches[currentMatchIndex]) {
      const uuid = matches[currentMatchIndex].messageUuid;
      const el = document.getElementById(`message-${uuid}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [sessionSearch.currentMatchIndex, sessionSearch.matches]);

  // Ctrl+F / Cmd+F opens search toolbar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
        clearSessionSearch();
        handleClearSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen, clearSessionSearch, handleClearSearch]);

  // Handle navigator resize via mouse drag on the left edge
  const handleNavigatorResizeStart = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsResizingNavigator(true);
    const startX = e.clientX;
    const startWidth = navigatorWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Navigator grows to the left, so width increases as mouse moves left
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.min(MAX_NAVIGATOR_WIDTH, Math.max(MIN_NAVIGATOR_WIDTH, startWidth + delta));
      setNavigatorWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingNavigator(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [navigatorWidth]);

  // Navigate to a specific message by UUID
  const handleNavigateToMessage = useCallback((uuid: string) => {
    const element = document.getElementById(`message-${uuid}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveMessageUuid(uuid);
    }
  }, []);

  // Handle extract message range
  const handleExtractRange = useCallback(async (startIndex: number, endIndex: number, openModal: boolean) => {
    try {
      // Extract messages from the range (inclusive)
      const messagesToExtract = messages.slice(startIndex, endIndex + 1);

      if (messagesToExtract.length === 0) {
        const { toast } = await import("sonner");
        toast.error(t("messageReference.noMessagesToExtract"));
        return;
      }

      if (!selectedSession?.file_path) {
        const { toast } = await import("sonner");
        toast.error(t("messageReference.noSessionPath"));
        return;
      }

      // Get extracted messages using the backend command
      const request: ExtractMessageRangeRequest = {
        session_path: selectedSession.file_path,
        start_message_id: messagesToExtract[0]?.uuid,
        end_message_id: messagesToExtract[messagesToExtract.length - 1]?.uuid,
      };

      const response = await invoke<ExtractMessageRangeResponse>(
        "extract_message_range",
        { request }
      );

      if (openModal) {
        // Open Session Builder Modal with pre-filled messages
        // Convert MessageInput[] to MessageBuilder[] by adding IDs
        const messagesWithIds: MessageBuilder[] = response.messages.map((msg, index) => ({
          ...msg,
          id: `msg-${Date.now()}-${index}`,
        }));
        setExtractedMessages(messagesWithIds);
        setIsSessionBuilderOpen(true);
      } else {
        // Directly create session file using adapter
        if (!selectedSession.providerId) {
          const { toast } = await import("sonner");
          toast.error("Provider information not available");
          return;
        }

        const adapter = adapterRegistry.get(selectedSession.providerId);
        if (!adapter || !adapter.createSession) {
          const { toast } = await import("sonner");
          toast.error("This provider does not support session creation");
          return;
        }

        // Get project path by removing the session filename from file_path
        const projectPath = selectedSession.file_path.split(/[/\\]/).slice(0, -1).join('/');
        console.log('[MessageViewer] Creating session in project:', projectPath);

        const createResult = await adapter.createSession(projectPath, {
          messages: response.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            parent_id: msg.parent_id,
            model: msg.model,
            tool_use: msg.tool_use,
            tool_use_result: msg.tool_use_result,
            usage: msg.usage,
          })),
          summary: response.summary || undefined,
          cwd: response.cwd,
        });

        if (!createResult.success) {
          throw new Error(createResult.error?.message || 'Failed to create session');
        }

        // Small delay to ensure file system operations complete
        await new Promise(resolve => setTimeout(resolve, 200));

        // Refresh the session list directly using the Tauri command
        console.log('[MessageViewer] Refreshing session list for project:', projectPath);
        const store = useAppStore.getState();

        if (store.selectedProject) {
          try {
            const sessions = await invoke<UISession[]>(
              "load_project_sessions",
              {
                projectPath: store.selectedProject.path,
                excludeSidechain: store.excludeSidechain,
              }
            );
            console.log('[MessageViewer] Loaded', sessions.length, 'sessions from backend');

            // Update BOTH sessions and sessionsByProject (ProjectTree reads from sessionsByProject!)
            useAppStore.setState({
              sessions,
              sessionsByProject: {
                ...store.sessionsByProject,
                [store.selectedProject.path]: sessions,
              }
            });
            console.log('[MessageViewer] Updated sessionsByProject cache for:', store.selectedProject.path);
          } catch (error) {
            console.error('[MessageViewer] Failed to refresh sessions:', error);
          }
        }

        const { toast } = await import("sonner");
        toast.success(t("messageReference.sessionCreated", { count: response.messages.length }));
      }
    } catch (error) {
      console.error("Failed to extract message range:", error);
      const { toast } = await import("sonner");
      toast.error(t("messageReference.extractFailed"));
    }
  }, [messages, selectedSession, t]);

  // Scroll management hook
  const {
    scrollContainerRef,
    showScrollToBottom,
    handleScrollToBottom,
    handleLoadMoreWithScroll,
  } = useMessageScrolling({
    messages,
    selectedSession,
    pagination,
    isLoading,
    onLoadMore,
  });

  // Message tree hook
  const { rootMessages, uniqueMessages, renderMessageTree } = useMessageTree(messages);

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

  // Filter out hidden messages in capture mode (Set for O(1) lookups)
  const hiddenMessageSet = useMemo(
    () => new Set(hiddenMessageIds),
    [hiddenMessageIds]
  );
  const visibleMessages = isCaptureMode
    ? messages.filter((m) => !hiddenMessageSet.has(m.uuid))
    : messages;

  // Shared props for MessageNode (everything except message, depth, sessionFilePath)
  const messageNodeProps = {
    providerName,
    allMessages: visibleMessages,
    onExtractRange: handleExtractRange,
    isCaptureMode,
    onHideMessage: hideMessage,
  };

  return (
    <div className="relative flex-1 h-full flex">
      {/* Main message list area */}
      <div className="flex-1 overflow-hidden relative">
        {/* In-session search button */}
        <button
          onClick={() => {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 0);
          }}
          className={cn(
            "absolute top-2 right-10 z-40 p-1.5 rounded-lg transition-colors",
            "bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground",
            "border border-border/50 shadow-sm",
            isSearchOpen && "bg-accent/10 text-accent"
          )}
          title={t("messageViewer.search.button", { defaultValue: "Search in session (Ctrl+F)" })}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Navigator toggle button */}
        <button
          onClick={() => {
            if (!isNavigatorOpen) {
              setIsNavigatorOpen(true);
              setIsNavigatorCollapsed(false);
            } else {
              setIsNavigatorOpen(false);
            }
          }}
          className={cn(
            "absolute top-2 right-2 z-40 p-1.5 rounded-lg transition-colors",
            "bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground",
            "border border-border/50 shadow-sm",
            isNavigatorOpen && "bg-accent/10 text-accent"
          )}
          title={t("messageView.toggleNavigator")}
          aria-label={t("messageView.toggleNavigator")}
        >
          <ListTree className="w-4 h-4" />
        </button>

        {/* In-session search toolbar */}
        {isSearchOpen && (
          <div className="absolute top-0 left-0 right-0 z-50 bg-background border-b border-border flex items-center gap-2 px-3 py-2 shadow-sm">
            {/* Filter type toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded text-xs">
              <button
                type="button"
                onClick={() => setSearchFilterType("content")}
                className={cn(
                  "px-2 py-0.5 rounded transition-colors",
                  sessionSearch.filterType === "content"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("messageViewer.search.content", { defaultValue: "Content" })}
              </button>
              <button
                type="button"
                onClick={() => setSearchFilterType("toolId")}
                className={cn(
                  "px-2 py-0.5 rounded transition-colors",
                  sessionSearch.filterType === "toolId"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("messageViewer.search.toolId", { defaultValue: "Tool ID" })}
              </button>
            </div>
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchInput}
              placeholder={t("messageViewer.search.placeholder", { defaultValue: "Search in session..." })}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            {isSearchPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
            {sessionSearch.matches.length > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">
                {sessionSearch.currentMatchIndex + 1} / {sessionSearch.matches.length}
              </span>
            )}
            <button
              type="button"
              onClick={goToPrevMatch}
              disabled={sessionSearch.matches.length === 0}
              className="p-1 hover:bg-muted rounded disabled:opacity-40"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={goToNextMatch}
              disabled={sessionSearch.matches.length === 0}
              className="p-1 hover:bg-muted rounded disabled:opacity-40"
              title="Next match (Enter)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                clearSessionSearch();
                handleClearSearch();
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div
          ref={scrollContainerRef}
          role="log"
          aria-label={t("messageViewer.threadLabel", "Message thread")}
          aria-live="off"
          className="h-full overflow-y-auto scrollbar-thin"
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
              // In capture mode, filter out hidden messages
              const hiddenSet = isCaptureMode ? new Set(hiddenMessageIds) : null;

              if (rootMessages.length > 0) {
                // Render tree structure (filter hidden in capture mode)
                const visibleRoots = hiddenSet
                  ? rootMessages.filter((m) => !hiddenSet.has(m.uuid))
                  : rootMessages;
                return visibleRoots
                  .map((message) =>
                    renderMessageTree(
                      message,
                      0,
                      new Set(),
                      "",
                      selectedSession?.file_path,
                      MessageNode,
                      messageNodeProps
                    )
                  )
                  .flat();
              } else {
                // Render flat structure (filter hidden in capture mode)
                const visibleFlat = hiddenSet
                  ? uniqueMessages.filter((m) => !hiddenSet.has(m.uuid))
                  : uniqueMessages;
                return visibleFlat.map((message, index) => {
                  // Generate unique key: use index and timestamp if UUID is missing or duplicated
                  const uniqueKey =
                    message.uuid && message.uuid !== "unknown-session"
                      ? `${message.uuid}-${index}`
                      : `fallback-${index}-${message.timestamp}-${message.type}`;

                  return (
                    <MessageNode
                      key={uniqueKey}
                      message={message}
                      depth={0}
                      providerName={providerName}
                      sessionFilePath={selectedSession?.file_path}
                      allMessages={visibleMessages}
                      onExtractRange={handleExtractRange}
                      isCaptureMode={isCaptureMode}
                      onHideMessage={hideMessage}
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
            onClick={handleScrollToBottom}
            className={cn(
              "fixed bottom-10 p-3 rounded-full shadow-lg transition-all duration-300 z-50",
              "bg-blue-500/50 hover:bg-blue-600 text-white",
              "hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300",
              "dark:bg-blue-600/50 dark:hover:bg-blue-700 dark:focus:ring-blue-800",
              showScrollToBottom
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2"
            )}
            style={{ right: isNavigatorOpen ? `${navigatorWidth + 16}px` : '8px' }}
            title={t("messageViewer.scrollToBottom")}
            aria-label={t("messageViewer.scrollToBottom")}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        )}
        </div>
      </div>

      {/* Message Navigator Panel (right side) */}
      {isNavigatorOpen && (
        <MessageNavigator
          messages={messages}
          width={isNavigatorCollapsed ? 48 : navigatorWidth}
          isResizing={isResizingNavigator}
          onResizeStart={handleNavigatorResizeStart}
          isCollapsed={isNavigatorCollapsed}
          onToggleCollapse={() => setIsNavigatorCollapsed((prev) => !prev)}
          activeMessageUuid={activeMessageUuid ?? undefined}
          onNavigateToMessage={handleNavigateToMessage}
        />
      )}

      {/* Session Builder Modal for extracted messages */}
      <SessionBuilderModal
        isOpen={isSessionBuilderOpen}
        onClose={() => {
          setIsSessionBuilderOpen(false);
          setExtractedMessages([]);
        }}
        initialMessages={extractedMessages}
      />
    </div>
  );
};
