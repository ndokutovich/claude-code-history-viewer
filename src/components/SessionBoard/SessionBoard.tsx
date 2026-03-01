/**
 * Session Board
 *
 * Main board component with horizontally-virtualized session lanes.
 * Uses a standalone useSessionBoard store for board-specific state.
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSessionBoard } from "../../hooks/useSessionBoard";
import { useAppStore } from "../../store/useAppStore";
import { SessionLane } from "./SessionLane";
import { BoardControls } from "./BoardControls";
import { SessionActivityTimeline } from "./SessionActivityTimeline";
import { getFilterEndMs } from "./useActivityData";
import { LoadingSpinner } from "../ui/loading";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import type { ActiveBrush } from "../../types/board.types";
import { getToolUseBlock } from "../../utils/cardSemantics";
import { getToolVariant } from "@/utils/toolIconUtils";

export const SessionBoard = () => {
  const boardSessions = useSessionBoard((s) => s.boardSessions);
  const allSortedSessionIds = useSessionBoard(
    (s) => s.allSortedSessionIds
  );
  const isLoadingBoard = useSessionBoard(
    (s) => s.isLoadingBoard
  );
  const zoomLevel = useSessionBoard((s) => s.zoomLevel);
  const activeBrush = useSessionBoard((s) => s.activeBrush);
  const stickyBrush = useSessionBoard((s) => s.stickyBrush);
  const dateFilter = useSessionBoard((s) => s.dateFilter);
  const isTimelineExpanded = useSessionBoard(
    (s) => s.isTimelineExpanded
  );

  const setActiveBrush = useSessionBoard(
    (s) => s.setActiveBrush
  );
  const setStickyBrush = useSessionBoard(
    (s) => s.setStickyBrush
  );
  const setZoomLevel = useSessionBoard((s) => s.setZoomLevel);
  const setSelectedMessageId = useSessionBoard(
    (s) => s.setSelectedMessageId
  );
  const setDateFilter = useSessionBoard(
    (s) => s.setDateFilter
  );
  const clearDateFilter = useSessionBoard(
    (s) => s.clearDateFilter
  );
  const toggleTimeline = useSessionBoard(
    (s) => s.toggleTimeline
  );

  const selectedSession = useAppStore(
    (s) => s.selectedSession
  );
  const selectedProject = useAppStore(
    (s) => s.selectedProject
  );

  // Clear brush on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveBrush(null);
        setStickyBrush(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveBrush, setStickyBrush]);

  // Compute visible session IDs with date filter
  const visibleSessionIds = useMemo(() => {
    if (!dateFilter?.start && !dateFilter?.end) {
      return allSortedSessionIds;
    }

    const startMs = dateFilter.start
      ? dateFilter.start.getTime()
      : 0;
    const endMs = dateFilter.end
      ? getFilterEndMs(dateFilter.end)
      : Infinity;

    const filtered = allSortedSessionIds.filter((id) => {
      const session = boardSessions[id];
      if (!session) return false;
      const timeStr =
        session.session.last_message_time ||
        session.session.last_modified;
      const sessionDate = new Date(timeStr).getTime();
      return sessionDate >= startMs && sessionDate < endMs;
    });

    return Array.from(new Set(filtered));
  }, [allSortedSessionIds, boardSessions, dateFilter]);

  // Compute brush options
  const getBrushOptions = useCallback(
    (sessionIds: string[]) => {
      const tools = new Set<string>();
      const files = new Set<string>();
      const mcpServers = new Set<string>();
      const commandFrecency = new Map<
        string,
        { count: number; lastTimestamp: number }
      >();

      const now = Date.now();

      sessionIds.forEach((id) => {
        const data = boardSessions[id];
        if (!data) return;

        data.messages.forEach((msg) => {
          const msgTimestamp = new Date(
            msg.timestamp
          ).getTime();

          const toolBlock = getToolUseBlock(msg);
          if (toolBlock) {
            const variant = getToolVariant(toolBlock.name);

            if (variant === "terminal") {
              const cmd =
                toolBlock.input?.CommandLine ||
                toolBlock.input?.command;
              if (typeof cmd === "string") {
                const existing =
                  commandFrecency.get(cmd) || {
                    count: 0,
                    lastTimestamp: 0,
                  };
                commandFrecency.set(cmd, {
                  count: existing.count + 1,
                  lastTimestamp: Math.max(
                    existing.lastTimestamp,
                    msgTimestamp
                  ),
                });

                if (cmd.trim().startsWith("git")) {
                  tools.add("git");
                }
              }
            }

            if (
              variant !== "neutral" &&
              variant !== "info"
            ) {
              tools.add(variant);
            }

            const path =
              toolBlock.input?.path ||
              toolBlock.input?.file_path ||
              toolBlock.input?.TargetFile;
            if (path && typeof path === "string") {
              files.add(path);
            }
          }
        });
      });

      const commandsWithFrecency = Array.from(
        commandFrecency.entries()
      ).map(([cmd, data]) => {
        const ageInDays =
          (now - data.lastTimestamp) /
          (1000 * 60 * 60 * 24);
        const recencyWeight = 1 / (1 + ageInDays);
        const frecencyScore = data.count * recencyWeight;
        return { cmd, score: frecencyScore };
      });

      const topCommands = commandsWithFrecency
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((item) => item.cmd);

      return {
        tools: Array.from(tools).sort(),
        files: Array.from(files).sort(),
        mcpServers: Array.from(mcpServers).sort(),
        shellCommands: topCommands,
      };
    },
    [boardSessions]
  );

  const visibleBrushOptions = useMemo(
    () => getBrushOptions(visibleSessionIds),
    [getBrushOptions, visibleSessionIds]
  );
  const allBrushOptions = useMemo(
    () => getBrushOptions(allSortedSessionIds),
    [getBrushOptions, allSortedSessionIds]
  );

  const { t } = useTranslation("components");
  const parentRef = useRef<HTMLDivElement>(null);

  const visibleSessionIdsRef = useRef(visibleSessionIds);
  useEffect(() => {
    visibleSessionIdsRef.current = visibleSessionIds;
  }, [visibleSessionIds]);

  // Panning state
  const [isMetaPressed, setIsMetaPressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control")
        setIsMetaPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setIsMetaPressed(false);
        setIsDragging(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMetaPressed || !parentRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - parentRef.current.offsetLeft);
    setScrollLeft(parentRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !parentRef.current) return;
    e.preventDefault();

    const x = e.pageX - parentRef.current.offsetLeft;
    const walkX = (x - startX) * 2;
    parentRef.current.scrollLeft = scrollLeft - walkX;

    const lanes =
      parentRef.current.getElementsByClassName(
        "session-lane-scroll"
      );
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i] as HTMLElement;
      lane.scrollTop = lane.scrollTop - e.movementY * 1.5;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Lane heights for container sizing
  const [laneHeights, setLaneHeights] = useState<
    Record<string, number>
  >({});

  const handleLaneHeightChange = useCallback(
    (sessionId: string, height: number) => {
      setLaneHeights((prev) => {
        if (prev[sessionId] === height) return prev;
        return { ...prev, [sessionId]: height };
      });
    },
    []
  );

  const maxContentHeight = useMemo(() => {
    const h = Math.max(0, ...Object.values(laneHeights));
    return h + 40;
  }, [laneHeights]);

  const handleBoardHover = useCallback(
    (type: ActiveBrush["type"], value: string) => {
      setActiveBrush({ type, value });
    },
    [setActiveBrush]
  );

  const handleBoardLeave = useCallback(() => {
    if (!stickyBrush) {
      setActiveBrush(null);
    }
  }, [stickyBrush, setActiveBrush]);

  const handleToggleSticky = useCallback(() => {
    setStickyBrush(!stickyBrush);
  }, [stickyBrush, setStickyBrush]);

  const selectedMessageIdRef = useRef(
    useSessionBoard.getState().selectedMessageId
  );

  const handleInteractionClick = useCallback(
    (id: string) => {
      setSelectedMessageId(
        selectedMessageIdRef.current === id ? null : id
      );
      selectedMessageIdRef.current =
        selectedMessageIdRef.current === id ? null : id;
    },
    [setSelectedMessageId]
  );

  const columnVirtualizer = useVirtualizer({
    count: visibleSessionIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (zoomLevel === 0) return 80;

      const sessionId = visibleSessionIds[index];
      if (!sessionId) return 320;
      const data = boardSessions[sessionId];

      if (data?.depth === "deep") return 380;
      return 320;
    },
    horizontal: true,
    overscan: 5,
  });

  // Force re-measure on zoom change
  useEffect(() => {
    if (visibleSessionIds.length > 0) {
      columnVirtualizer.measure();
    }
  }, [zoomLevel, visibleSessionIds, columnVirtualizer]);

  // Scroll active session into view
  useEffect(() => {
    if (
      selectedSession &&
      visibleSessionIdsRef.current.length > 0
    ) {
      const index = visibleSessionIdsRef.current.indexOf(
        selectedSession.session_id
      );
      if (index !== -1) {
        requestAnimationFrame(() => {
          columnVirtualizer.scrollToIndex(index, {
            align: "center",
            behavior: "smooth",
          });
        });
      }
    }
  }, [selectedSession?.session_id, columnVirtualizer]);

  if (isLoadingBoard) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          {t("status.loadingSessions", {
            defaultValue: "Loading...",
          })}
        </p>
      </div>
    );
  }

  if (visibleSessionIds.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-background">
        <BoardControls
          zoomLevel={zoomLevel}
          onZoomChange={setZoomLevel}
          activeBrush={activeBrush}
          onBrushChange={setActiveBrush}
          toolOptions={[]}
          fileOptions={[]}
          mcpServerOptions={[]}
          shellCommandOptions={[]}
          availableTools={[]}
          availableFiles={[]}
          availableMcpServers={[]}
          availableShellCommands={[]}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t("session.noSessions", {
                defaultValue: "No sessions found",
              })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("analytics.noDataAvailable", {
                defaultValue:
                  "Try adjusting your date filters or select more sessions.",
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Board Toolbar */}
      <BoardControls
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        activeBrush={activeBrush}
        stickyBrush={stickyBrush}
        onBrushChange={setActiveBrush}
        toolOptions={allBrushOptions.tools}
        fileOptions={allBrushOptions.files}
        mcpServerOptions={allBrushOptions.mcpServers}
        shellCommandOptions={allBrushOptions.shellCommands}
        availableTools={visibleBrushOptions.tools}
        availableFiles={visibleBrushOptions.files}
        availableMcpServers={
          visibleBrushOptions.mcpServers
        }
        availableShellCommands={
          visibleBrushOptions.shellCommands
        }
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
      />

      {/* Activity Timeline Heatmap */}
      <SessionActivityTimeline
        boardSessions={boardSessions}
        allSortedSessionIds={allSortedSessionIds}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        clearDateFilter={clearDateFilter}
        isExpanded={isTimelineExpanded}
        onToggle={toggleTimeline}
        projectName={selectedProject?.name}
      />

      {/* Virtualized Lanes Container */}
      <div
        ref={parentRef}
        className={clsx(
          "flex-1 overflow-auto scrollbar-thin select-none",
          isMetaPressed
            ? "cursor-grab"
            : "cursor-default",
          isDragging && "cursor-grabbing"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            width: `${columnVirtualizer.getTotalSize()}px`,
            height: `${Math.max(maxContentHeight, parentRef.current?.clientHeight || 0)}px`,
            position: "relative",
          }}
        >
          {columnVirtualizer
            .getVirtualItems()
            .map((virtualColumn) => {
              const sessionId =
                visibleSessionIds[virtualColumn.index];
              if (!sessionId) return null;

              const data = boardSessions[sessionId];
              if (!data) return null;

              return (
                <div
                  key={sessionId}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: "100%",
                    width: `${virtualColumn.size}px`,
                    transform: `translateX(${virtualColumn.start}px)`,
                  }}
                >
                  <SessionLane
                    data={data}
                    zoomLevel={zoomLevel}
                    activeBrush={activeBrush}
                    onHover={handleBoardHover}
                    onLeave={handleBoardLeave}
                    onToggleSticky={handleToggleSticky}
                    isSelected={
                      selectedSession?.session_id ===
                      sessionId
                    }
                    onInteractionClick={
                      handleInteractionClick
                    }
                    onNavigate={() => {
                      // Set session and messages from board cache
                      const currentMessages =
                        useAppStore.getState().messages;
                      if (
                        selectedSession?.session_id !==
                          sessionId ||
                        currentMessages.length === 0
                      ) {
                        useAppStore.setState({
                          selectedSession:
                            data.session,
                          messages: data.messages,
                          isLoadingMessages: false,
                          pagination: {
                            currentOffset:
                              data.messages.length,
                            pageSize:
                              data.messages.length,
                            totalCount:
                              data.messages.length,
                            hasMore: false,
                            isLoadingMore: false,
                          },
                        });
                      }
                      // Switch to messages view
                      useAppStore
                        .getState()
                        .switchView("messages");
                    }}
                    scrollContainerRef={
                      parentRef as React.RefObject<HTMLDivElement>
                    }
                    onHeightChange={(h) =>
                      handleLaneHeightChange(
                        sessionId,
                        h
                      )
                    }
                    onFileClick={() => {
                      // Could navigate to recent edits if available
                    }}
                  />
                </div>
              );
            })}
        </div>
      </div>

      {/* Hint for panning */}
      {isMetaPressed && !isDragging && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent text-white rounded-full text-xs font-bold shadow-2xl animate-bounce z-[100]">
          {t("analytics.dragToPan", {
            defaultValue:
              "Drag to pan horizontally and vertically",
          })}
        </div>
      )}
    </div>
  );
};
