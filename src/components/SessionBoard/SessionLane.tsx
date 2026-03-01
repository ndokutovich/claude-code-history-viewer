/**
 * Session Lane
 *
 * A single vertical lane in the Session Board representing one session.
 * Contains a header with stats and a virtualized list of interaction cards.
 */

import { useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { BoardSessionData, ZoomLevel } from "../../types/board.types";
import type { ActiveBrush } from "@/utils/brushMatchers";
import type { UIMessage } from "../../types";
import { InteractionCard } from "./InteractionCard";
import {
  Terminal,
  FilePlus,
  FileText,
  Book,
  TrendingUp,
  Zap,
  GitCommit,
  Search,
  Globe,
  Plug,
  Eye,
} from "lucide-react";
import { clsx } from "clsx";
import {
  extractMessageContent,
  isToolEvent,
  getMessageRole,
  isAssistantMessage,
  getToolUseBlock,
  getCardSemantics,
} from "../../utils/cardSemantics";
import { formatDuration } from "@/utils/time";
import { formatNumber } from "@/components/AnalyticsDashboard/utils/calculations";
import { useSessionBoard } from "../../hooks/useSessionBoard";
import { useTranslation } from "react-i18next";

interface SessionLaneProps {
  data: BoardSessionData;
  zoomLevel: ZoomLevel;
  activeBrush?: ActiveBrush | null;
  onHover?: (type: ActiveBrush["type"], value: string) => void;
  onLeave?: () => void;
  onToggleSticky?: () => void;
  onInteractionClick?: (messageUuid: string) => void;
  onFileClick?: (file: string) => void;
  isSelected?: boolean;
  onNavigate?: (messageId: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  onHeightChange?: (height: number) => void;
}

export const SessionLane = ({
  data,
  zoomLevel,
  activeBrush,
  onHover,
  onToggleSticky,
  onInteractionClick,
  onFileClick,
  isSelected,
  onNavigate,
  scrollContainerRef,
  onHeightChange,
}: SessionLaneProps) => {
  const { t } = useTranslation("components");
  const { session, messages, stats, depth } = data;
  const selectedMessageId = useSessionBoard(
    (state) => state.selectedMessageId
  );

  // Filter and group messages
  const visibleItems = useMemo(() => {
    const filtered = messages.filter((msg) => {
      const content = extractMessageContent(msg) || "";
      const isTool = isToolEvent(msg);
      return content.trim().length > 0 || isTool;
    });

    const grouped: {
      head: UIMessage;
      siblings: UIMessage[];
    }[] = [];
    let currentGroup: {
      head: UIMessage;
      siblings: UIMessage[];
    } | null = null;

    filtered.forEach((msg) => {
      const role = getMessageRole(msg);
      const isTool = isToolEvent(msg);

      if (currentGroup) {
        const headRole = getMessageRole(currentGroup.head);
        const headIsTool = isToolEvent(currentGroup.head);

        if (zoomLevel === 0) {
          const bothAreAssistant =
            role === "assistant" && headRole === "assistant";
          const bothAreUser =
            role === "user" && headRole === "user";

          if (
            (bothAreAssistant || bothAreUser) &&
            isTool === headIsTool
          ) {
            currentGroup.siblings.push(msg);
            return;
          }
        } else {
          const bothAreTools = isTool && headIsTool;
          const textToTool =
            isTool &&
            headRole === "assistant" &&
            role === "assistant";

          if (bothAreTools || textToTool) {
            currentGroup.siblings.push(msg);
            return;
          }
        }

        grouped.push(currentGroup);
        currentGroup = { head: msg, siblings: [] };
      } else {
        currentGroup = { head: msg, siblings: [] };
      }
    });

    if (currentGroup) {
      grouped.push(currentGroup);
    }
    return grouped;
  }, [messages, zoomLevel]);

  // Match statistics for brush
  const matchStats = useMemo(() => {
    if (!activeBrush) return null;

    let matched = 0;
    let total = 0;

    visibleItems.forEach((item) => {
      const allMessages = [item.head, ...item.siblings];

      allMessages.forEach((msg) => {
        total++;
        const content = extractMessageContent(msg) || "";
        const toolBlock = getToolUseBlock(msg);
        const role = getMessageRole(msg);

        const semantics = getCardSemantics(
          msg,
          content,
          toolBlock,
          role,
          activeBrush
        );
        if (semantics.brushMatch) matched++;
      });
    });

    return { matched, total };
  }, [activeBrush, visibleItems]);

  const rowVirtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const item = visibleItems[index];
      if (!item) return 80;
      const msg = item.head;
      if (!msg) return 80;

      if (zoomLevel === 0) {
        let totalTokens = 0;
        const allMsgs = [msg, ...item.siblings];

        let hasUsageParams = false;
        for (const m of allMsgs) {
          if (isAssistantMessage(m) && m.usage) {
            totalTokens +=
              (m.usage.input_tokens || 0) +
              (m.usage.output_tokens || 0);
            hasUsageParams = true;
          }
        }

        if (!hasUsageParams) {
          const totalLen = allMsgs.reduce(
            (acc, m) =>
              acc +
              (extractMessageContent(m)?.length || 0),
            0
          );
          totalTokens = Math.floor(totalLen / 4);
        }

        return Math.min(Math.max(totalTokens / 50, 4), 20);
      }

      const content = extractMessageContent(msg) || "";
      const isTool = isToolEvent(msg);
      const len = content.length;

      if (zoomLevel === 1) {
        if (isTool) {
          return 80 + (item.siblings.length > 0 ? 12 : 0);
        }
        if (len < 100) return 60;
        return 90;
      }

      if (isTool) return 140;
      if (len < 50) return 70;
      if (len < 200) return 120;
      if (len < 500) return 180;
      return 250;
    },
    overscan: 10,
  });

  const totalSize = rowVirtualizer.getTotalSize();

  useEffect(() => {
    if (onHeightChange) {
      onHeightChange(totalSize);
    }
  }, [totalSize, onHeightChange]);

  const getDepthStyles = () => {
    if (zoomLevel === 0) {
      return clsx(
        "w-[80px] min-w-[80px] border-r border-border/30",
        "bg-transparent",
        isSelected &&
          "bg-accent/5 ring-1 ring-inset ring-accent/40"
      );
    }

    switch (depth) {
      case "deep":
        return clsx(
          "w-[380px] min-w-[380px] border-slate-200/50 dark:border-slate-800/50",
          "bg-transparent",
          isSelected &&
            "ring-2 ring-inset ring-accent/50 bg-accent/5 shadow-xl shadow-accent/5"
        );
      default:
        return clsx(
          "w-[320px] min-w-[320px]",
          "bg-transparent",
          isSelected &&
            "ring-2 ring-inset ring-accent/50 bg-accent/5 shadow-xl shadow-accent/5"
        );
    }
  };

  const durationMinutes = stats.durationMs
    ? stats.durationMs / (1000 * 60)
    : 0;

  return (
    <div
      className={clsx(
        "flex flex-col h-full border-r transition-all relative group",
        getDepthStyles()
      )}
    >
      {zoomLevel !== 0 && (
        <div
          className={clsx(
            "absolute left-6 top-0 bottom-0 w-px z-0 pointer-events-none transition-colors",
            isSelected ? "bg-accent/40" : "bg-border/40"
          )}
        />
      )}

      {/* Lane Header */}
      <div
        className={clsx(
          "border-b border-border/50 shrink-0 z-10 backdrop-blur-sm sticky top-0 px-4 py-3 flex flex-col",
          zoomLevel === 0
            ? "h-[110px] bg-background/90"
            : "bg-card/40"
        )}
      >
        {zoomLevel === 0 ? (
          <div className="flex flex-col items-center gap-1.5 text-center h-full justify-between">
            <div className="flex gap-1">
              {stats?.commitCount > 0 && (
                <span title={t("sessionBoard.gitCommits")}>
                  <GitCommit className="w-2.5 h-2.5 text-indigo-500" />
                </span>
              )}
            </div>
            <div className="text-[10px] font-bold text-muted-foreground">
              {new Date(
                session.last_modified
              ).toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
              })}
            </div>
            <div className="mt-auto text-[8px] font-mono text-muted-foreground">
              {Math.round(
                (stats?.totalTokens || 0) / 1000
              )}
              k
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">
                  {new Date(
                    session.last_modified
                  ).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  &bull;{" "}
                  {new Date(
                    session.last_modified
                  ).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex gap-3 items-center">
                {stats.commitCount > 0 && (
                  <div
                    className="flex items-center gap-1 text-indigo-500"
                    title={t("sessionBoard.gitCommits")}
                  >
                    <GitCommit className="w-3 h-3" />
                    <span className="text-[10px] font-bold">
                      {stats.commitCount}
                    </span>
                  </div>
                )}

                <div
                  className="flex items-center gap-1 text-emerald-500"
                  title={t("analytics.inputTokens", {
                    defaultValue: "Input Tokens",
                  })}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-[10px] font-mono">
                    {formatNumber(stats.inputTokens || 0)}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1 text-purple-500"
                  title={t("analytics.outputTokens", {
                    defaultValue: "Output Tokens",
                  })}
                >
                  <Zap className="w-3 h-3" />
                  <span className="text-[10px] font-mono">
                    {formatNumber(stats.outputTokens || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-baseline gap-2 pb-1 border-b border-border/20">
              <div className="text-xl font-bold font-mono text-foreground">
                {formatNumber(stats.totalTokens)}
                <span className="text-[10px] text-muted-foreground font-normal ml-1">
                  {t("analytics.tokens", {
                    defaultValue: "tokens",
                  })}
                </span>
              </div>
              <div className="ml-auto text-[10px] text-muted-foreground flex items-center gap-3">
                {matchStats && (
                  <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-accent/10 text-accent rounded-sm border border-accent/20 animate-in fade-in slide-in-from-right-1">
                    <span className="font-bold">
                      {matchStats.matched}/
                      {matchStats.total}
                    </span>
                    <div className="flex gap-px opacity-60">
                      {Array.from({ length: 8 }).map(
                        (_, i) => (
                          <span
                            key={i}
                            className={clsx(
                              "w-1 h-3 rounded-[1px]",
                              i <
                                (matchStats.matched /
                                  matchStats.total) *
                                  8
                                ? "bg-accent"
                                : "bg-accent/20"
                            )}
                          />
                        )
                      )}
                    </div>
                  </div>
                )}
                <span>
                  {messages.length}{" "}
                  {t("message.count", {
                    count: messages.length,
                    defaultValue: "messages",
                  })}
                </span>
                <span>{formatDuration(durationMinutes)}</span>
              </div>
            </div>

            {/* Tool breakdown */}
            <div className="flex flex-col gap-1.5 py-1">
              <div className="flex items-center gap-2 pt-1 border-t border-border/10">
                {stats.shellCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-sky-500",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "terminal" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.shellCommands")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "terminal");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "terminal");
                      }
                    }}
                  >
                    <Terminal className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.shellCount}
                    </span>
                  </button>
                )}

                {(() => {
                  const createdCount =
                    data.fileEdits.filter(
                      (e) => e.type === "create"
                    ).length;
                  if (createdCount > 0) {
                    return (
                      <button
                        className={clsx(
                          "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          "text-emerald-500",
                          activeBrush?.type === "tool" &&
                            activeBrush.value ===
                              "file" &&
                            "brush-match bg-accent/10"
                        )}
                        title={t("sessionBoard.filesCreated", { count: createdCount })}
                        onClick={(e) => {
                          e.stopPropagation();
                          onHover?.("tool", "file");
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" ||
                            e.key === " "
                          ) {
                            e.preventDefault();
                            e.stopPropagation();
                            onHover?.("tool", "file");
                          }
                        }}
                      >
                        <FilePlus className="w-3 h-3" />
                        <span className="text-[10px] font-bold font-mono">
                          {createdCount}
                        </span>
                      </button>
                    );
                  } else if (stats.fileToolCount > 0) {
                    return (
                      <button
                        className={clsx(
                          "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          "text-blue-500",
                          activeBrush?.type === "tool" &&
                            activeBrush.value ===
                              "file" &&
                            "brush-match bg-accent/10"
                        )}
                        title={t("sessionBoard.fileOperations")}
                        onClick={(e) => {
                          e.stopPropagation();
                          onHover?.("tool", "file");
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" ||
                            e.key === " "
                          ) {
                            e.preventDefault();
                            e.stopPropagation();
                            onHover?.("tool", "file");
                          }
                        }}
                      >
                        <FilePlus className="w-3 h-3" />
                        <span className="text-[10px] font-bold font-mono">
                          {stats.fileToolCount}
                        </span>
                      </button>
                    );
                  }
                  return null;
                })()}

                {stats.searchCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-amber-500",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "search" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.codeSearch")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "search");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "search");
                      }
                    }}
                  >
                    <Search className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.searchCount}
                    </span>
                  </button>
                )}

                {stats.webCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-sky-400",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "web" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.webSearchFetch")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "web");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "web");
                      }
                    }}
                  >
                    <Globe className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.webCount}
                    </span>
                  </button>
                )}

                {stats.mcpCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-purple-500",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "mcp" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.mcpTools")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "mcp");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "mcp");
                      }
                    }}
                  >
                    <Plug className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.mcpCount}
                    </span>
                  </button>
                )}

                {stats.gitToolCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-orange-500",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "git" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.gitTools")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "git");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "git");
                      }
                    }}
                  >
                    <GitCommit className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.gitToolCount}
                    </span>
                  </button>
                )}

                {stats.hasMarkdownEdits && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-amber-500",
                      activeBrush?.type === "tool" &&
                        activeBrush.value ===
                          "document" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.documentationUpdates")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "document");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "document");
                      }
                    }}
                  >
                    <Book className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.markdownEditCount}
                    </span>
                  </button>
                )}

                {stats.fileEditCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-foreground/70",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "code" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.fileEdits")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "code");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "code");
                      }
                    }}
                  >
                    <FileText className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.fileEditCount}
                    </span>
                  </button>
                )}

                {stats.codeReadCount > 0 && (
                  <button
                    className={clsx(
                      "flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -ml-1 transition-colors border border-transparent outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "text-sky-500/70",
                      activeBrush?.type === "tool" &&
                        activeBrush.value === "code" &&
                        "brush-match bg-accent/10"
                    )}
                    title={t("sessionBoard.filesRead")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHover?.("tool", "code");
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " "
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                        onHover?.("tool", "code");
                      }
                    }}
                  >
                    <Eye className="w-3 h-3" />
                    <span className="text-[10px] font-bold font-mono">
                      {stats.codeReadCount}
                    </span>
                  </button>
                )}
              </div>

              {/* Git Commits */}
              {data.gitCommits && data.gitCommits.length > 0 && (
                <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 pt-1 border-t border-border/10">
                  <div className="text-[8px] uppercase font-bold text-blue-500/70 tracking-tighter w-full">
                    {t("sessionBoard.gitCommits")}
                  </div>
                  {data.gitCommits
                    .slice(0, 2)
                    .map((commit) => (
                      <div
                        key={commit.hash}
                        className="flex items-center gap-1.5 text-[9px] text-blue-600/80 font-mono bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10 max-w-full overflow-hidden"
                        title={commit.message}
                      >
                        <GitCommit className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">
                          {commit.message}
                        </span>
                        <code className="text-[8px] opacity-40 shrink-0">
                          {commit.hash.substring(0, 7)}
                        </code>
                      </div>
                    ))}
                  {data.gitCommits.length > 2 && (
                    <span className="text-[9px] text-muted-foreground/40 self-center">
                      {t("sessionBoard.moreCommits", { count: data.gitCommits.length - 2 })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Virtualized Cards */}
      <div
        className={clsx(
          "session-lane-scroll flex-1 relative",
          zoomLevel === 0 ? "px-0.5 py-2" : "px-1 py-4"
        )}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = visibleItems[virtualRow.index];
            if (!item) return null;
            const message = item.head;
            const isDynamic = zoomLevel !== 0;
            const nextItem =
              visibleItems[virtualRow.index + 1];
            const prevItem =
              visibleItems[virtualRow.index - 1];

            const role = getMessageRole(message);
            const prevRole = prevItem
              ? getMessageRole(prevItem.head)
              : null;

            const marginTop =
              prevRole && prevRole !== role && zoomLevel !== 0
                ? 12
                : 2;

            const isAssistant = role === "assistant";

            let paddingLeft = "0px";
            let paddingRight = "0px";

            if (zoomLevel !== 0) {
              if (isAssistant) {
                paddingLeft = "24px";
                paddingRight = "4px";
              } else {
                paddingLeft = "4px";
                paddingRight = "24px";
              }
            }

            return (
              <div
                key={message.uuid}
                data-index={virtualRow.index}
                ref={
                  isDynamic
                    ? rowVirtualizer.measureElement
                    : undefined
                }
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingTop: `${marginTop}px`,
                  paddingLeft,
                  paddingRight,
                }}
              >
                <InteractionCard
                  message={message}
                  zoomLevel={zoomLevel}
                  isExpanded={
                    selectedMessageId === message.uuid
                  }
                  activeBrush={activeBrush}
                  gitCommits={data.gitCommits}
                  onToggleSticky={onToggleSticky}
                  onClick={() =>
                    onInteractionClick?.(message.uuid)
                  }
                  onNext={
                    nextItem
                      ? () =>
                          onInteractionClick?.(
                            nextItem.head.uuid
                          )
                      : undefined
                  }
                  onPrev={
                    prevItem
                      ? () =>
                          onInteractionClick?.(
                            prevItem.head.uuid
                          )
                      : undefined
                  }
                  onFileClick={onFileClick}
                  onNavigate={() =>
                    onNavigate?.(message.uuid)
                  }
                  siblings={item.siblings}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
