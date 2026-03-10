/**
 * Session Board Store Hook
 *
 * Standalone Zustand store for Session Board state management.
 * Separated from the main app store because the Session Board has its own
 * complex state that is independent of the main app flow.
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { UISession, UIMessage, GitCommit, UniversalMessage } from "@/types";
import type {
  BoardSessionData,
  BoardSessionStats,
  ZoomLevel,
  SessionFileEdit,
  SessionDepth,
  ActiveBrush,
  DateFilter,
} from "@/types/board.types";
import { analyzeSessionMessages } from "@/utils/sessionAnalytics";
import { isAbsolutePath } from "@/utils/pathUtils";
import {
  getToolUseBlock,
  isAssistantMessage,
} from "@/utils/cardSemantics";
import { universalToUIMessage } from "@/store/useAppStore";

const TIMELINE_STORAGE_KEY = "timeline-expanded";

// ---------------------------------------------------------------------------
// Helper: load messages from the correct backend command based on provider
// ---------------------------------------------------------------------------

async function loadSessionMessages(session: UISession): Promise<UIMessage[]> {
  const provider = session.providerId ?? "claude";
  let raw: UniversalMessage[];
  switch (provider) {
    case "cursor":
      raw = await invoke<UniversalMessage[]>("load_cursor_messages", {
        sessionPath: session.file_path,
      });
      break;
    case "gemini":
      raw = await invoke<UniversalMessage[]>("load_gemini_messages", {
        sessionPath: session.file_path,
      });
      break;
    case "codex":
      raw = await invoke<UniversalMessage[]>("load_codex_messages", {
        sessionPath: session.file_path,
      });
      break;
    default:
      raw = await invoke<UniversalMessage[]>("load_session_messages", {
        sessionPath: session.file_path,
      });
      break;
  }
  return raw.map(universalToUIMessage);
}

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

function getSessionRelevance(
  messages: UIMessage[],
  stats: BoardSessionStats
): number {
  if (messages.length < 3) return 0.2;

  let score = 0.5;
  if (stats.toolCount > 5) score += 0.3;
  if (stats.errorCount > 0) score += 0.2;

  const hasDocWork = messages.some((m) => {
    if (m.type !== "assistant") return false;
    const toolBlock = getToolUseBlock(m);
    if (!toolBlock) return false;
    const path =
      toolBlock.input?.path || toolBlock.input?.file_path || "";
    return typeof path === "string" && path.toLowerCase().endsWith(".md");
  });
  if (hasDocWork) score += 0.2;
  if (stats.commitCount > 0) score += 0.3;

  return Math.min(score, 1.0);
}

function getSessionDepth(
  messages: UIMessage[],
  stats: BoardSessionStats
): SessionDepth {
  if (messages.length > 15 || stats.toolCount > 5) return "deep";
  return "shallow";
}

// ---------------------------------------------------------------------------
// Store Types
// ---------------------------------------------------------------------------

interface SessionBoardState {
  boardSessions: Record<string, BoardSessionData>;
  visibleSessionIds: string[];
  allSortedSessionIds: string[];
  isLoadingBoard: boolean;
  zoomLevel: ZoomLevel;
  activeBrush: ActiveBrush | null;
  stickyBrush: boolean;
  selectedMessageId: string | null;
  isMarkdownPretty: boolean;
  boardLoadError: string | null;
  isTimelineExpanded: boolean;
  dateFilter: DateFilter;
}

interface SessionBoardActions {
  loadBoardSessions: (
    sessions: UISession[],
    projectActualPath?: string
  ) => Promise<void>;
  setZoomLevel: (level: ZoomLevel) => void;
  setActiveBrush: (brush: ActiveBrush | null) => void;
  setStickyBrush: (sticky: boolean) => void;
  setSelectedMessageId: (id: string | null) => void;
  setMarkdownPretty: (pretty: boolean) => void;
  clearBoard: () => void;
  toggleTimeline: () => void;
  setDateFilter: (filter: DateFilter) => void;
  clearDateFilter: () => void;
}

// ---------------------------------------------------------------------------
// Initial state factory
// ---------------------------------------------------------------------------

function getInitialTimelineExpanded(): boolean {
  try {
    const stored = localStorage.getItem(TIMELINE_STORAGE_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

const initialState: SessionBoardState = {
  boardSessions: {},
  visibleSessionIds: [],
  allSortedSessionIds: [],
  isLoadingBoard: false,
  zoomLevel: 1, // Default to SKIM
  activeBrush: null,
  stickyBrush: false,
  selectedMessageId: null,
  isMarkdownPretty: true,
  boardLoadError: null,
  isTimelineExpanded: getInitialTimelineExpanded(),
  dateFilter: { start: null, end: null },
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionBoard = create<SessionBoardState & SessionBoardActions>(
  (set, get) => ({
    ...initialState,

    loadBoardSessions: async (
      sessions: UISession[],
      projectActualPath?: string
    ) => {
      set({ isLoadingBoard: true, boardLoadError: null });

      try {
        let projectCommits: GitCommit[] = [];

        if (projectActualPath) {
          if (!isAbsolutePath(projectActualPath)) {
            set({
              isLoadingBoard: false,
              boardLoadError: "Invalid project path",
            });
            return;
          }
          try {
            projectCommits = await invoke<GitCommit[]>("get_git_log", {
              actualPath: projectActualPath,
              limit: 1000,
            });
          } catch (e) {
            console.error("Failed to fetch git log:", e);
            set({
              isLoadingBoard: false,
              boardLoadError: "Failed to fetch git log",
            });
            return;
          }
        }

        const loadPromises = sessions.map(async (session) => {
          try {
            if (!isAbsolutePath(session.file_path)) {
              return null;
            }
            const messages = await loadSessionMessages(session);

            // 1. Run derived analytics
            const derivedStats = analyzeSessionMessages(messages);

            // 2. Calculate stats
            const stats: BoardSessionStats = {
              totalTokens: 0,
              inputTokens: 0,
              outputTokens: 0,
              errorCount: derivedStats.errorCount,
              durationMs: 0,
              toolCount: 0,
              fileEditCount: derivedStats.fileEditCount,
              shellCount: derivedStats.shellCount,
              commitCount: derivedStats.commitCount,
              filesTouchedCount: derivedStats.filesTouched.size,
              hasMarkdownEdits: derivedStats.hasMarkdownEdits,
              markdownEditCount: derivedStats.markdownEditCount,
              toolBreakdown: derivedStats.toolBreakdown,
              searchCount: derivedStats.searchCount,
              webCount: derivedStats.webCount,
              mcpCount: derivedStats.mcpCount,
              fileToolCount: derivedStats.fileToolCount,
              codeReadCount: derivedStats.codeReadCount,
              gitToolCount: derivedStats.gitToolCount,
            };

            const fileEdits: SessionFileEdit[] = [];

            messages.forEach((msg) => {
              if (msg.type === "assistant" && msg.usage) {
                const usage = msg.usage;
                stats.inputTokens += usage.input_tokens || 0;
                stats.outputTokens += usage.output_tokens || 0;
                stats.totalTokens +=
                  (usage.input_tokens || 0) + (usage.output_tokens || 0);
              }

              const durationMs = (msg as unknown as Record<string, unknown>)
                .durationMs;
              if (msg.type === "assistant" && typeof durationMs === "number") {
                stats.durationMs += durationMs;
              }

              if (isAssistantMessage(msg)) {
                const toolBlock = getToolUseBlock(msg);
                if (toolBlock) {
                  stats.toolCount++;
                  const name = toolBlock.name;
                  const input = toolBlock.input;

                  if (
                    [
                      "write_to_file",
                      "replace_file_content",
                      "multi_replace_file_content",
                      "create_file",
                      "edit_file",
                      "Edit",
                      "Replace",
                    ].includes(name) ||
                    /write|edit|replace|patch/i.test(name)
                  ) {
                    const path = (input?.path ||
                      input?.file_path ||
                      input?.TargetFile ||
                      "") as string;
                    if (path) {
                      fileEdits.push({
                        path,
                        timestamp: msg.timestamp,
                        messageId: msg.uuid,
                        type: name === "create_file" ? "create" : "edit",
                      });
                    }
                  }
                }
              }
            });

            // 3. Correlate with git commits
            const startTime = new Date(session.first_message_time).getTime();
            const endTime = new Date(session.last_modified).getTime();
            const buffer = 5 * 60 * 1000;

            const gitCommits = projectCommits.filter((c) => {
              const commitTime = c.timestamp * 1000;
              return (
                commitTime >= startTime - buffer &&
                commitTime <= endTime + buffer
              );
            });

            const relevance = getSessionRelevance(messages, stats);
            const depth = getSessionDepth(messages, stats);

            return {
              sessionId: session.session_id,
              data: {
                session: { ...session, relevance } as UISession & {
                  relevance: number;
                },
                messages,
                stats,
                fileEdits,
                gitCommits,
                depth,
              } as BoardSessionData,
            };
          } catch (err) {
            console.error(
              `Failed to load session ${session.session_id}:`,
              err
            );
            return null;
          }
        });

        const results = await Promise.all(loadPromises);

        const boardSessions: Record<string, BoardSessionData> = {};
        const allSortedSessionIds: string[] = [];

        // Sort by relevance then recency
        const sortedResults = results
          .filter(
            (r): r is NonNullable<typeof r> => r !== null
          )
          .sort((a, b) => {
            const relA =
              ((a.data.session as unknown as Record<string, unknown>)
                .relevance as number) || 0;
            const relB =
              ((b.data.session as unknown as Record<string, unknown>)
                .relevance as number) || 0;
            if (relA !== relB) return relB - relA;
            return (
              new Date(b.data.session.last_message_time).getTime() -
              new Date(a.data.session.last_message_time).getTime()
            );
          });

        sortedResults.forEach((res) => {
          boardSessions[res.sessionId] = res.data;
          allSortedSessionIds.push(res.sessionId);
        });

        set({
          boardSessions,
          allSortedSessionIds,
          visibleSessionIds: allSortedSessionIds,
          isLoadingBoard: false,
        });
      } catch (error) {
        console.error("Failed to load board sessions:", error);
        set({
          isLoadingBoard: false,
          boardLoadError: "Failed to load board sessions",
        });
      }
    },

    setZoomLevel: (zoomLevel: ZoomLevel) => set({ zoomLevel }),
    setActiveBrush: (activeBrush) => set({ activeBrush }),
    setStickyBrush: (stickyBrush) => set({ stickyBrush }),
    setSelectedMessageId: (id) => set({ selectedMessageId: id }),
    setMarkdownPretty: (isMarkdownPretty) => set({ isMarkdownPretty }),

    setDateFilter: (dateFilter: DateFilter) => set({ dateFilter }),

    clearDateFilter: () =>
      set({ dateFilter: { start: null, end: null } }),

    toggleTimeline: () =>
      set((state) => {
        const next = !state.isTimelineExpanded;
        try {
          localStorage.setItem(TIMELINE_STORAGE_KEY, String(next));
        } catch {
          // localStorage write failure is non-critical
        }
        return { isTimelineExpanded: next };
      }),

    clearBoard: () => {
      const current = get();
      set({
        ...initialState,
        isTimelineExpanded: current.isTimelineExpanded,
      });
    },
  })
);
