/**
 * Board Types
 *
 * Types for the session board / kanban-style view.
 */

import type { UIMessage, UISession, GitCommit } from './index';

// Re-export GitCommit from main types for consistency
export type { GitCommit };

// ============================================================================
// Renderer Variant (inline for fork compatibility -- no renderers/types.ts yet)
// ============================================================================

export type RendererVariant =
  | "success"
  | "info"
  | "warning"
  | "error"
  | "neutral"
  | "code"
  | "file"
  | "search"
  | "task"
  | "system"
  | "thinking"
  | "git"
  | "web"
  | "mcp"
  | "document"
  | "terminal";

// ============================================================================
// Board Session Stats
// ============================================================================

export interface BoardSessionStats {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  errorCount: number;
  durationMs: number;
  toolCount: number;

  // Derived Metrics
  fileEditCount: number;
  shellCount: number;
  commitCount: number;
  filesTouchedCount: number;
  hasMarkdownEdits: boolean;
  markdownEditCount: number;
  toolBreakdown: Record<string, number>;
  searchCount: number;
  webCount: number;
  mcpCount: number;
  fileToolCount: number;
  codeReadCount: number;
  gitToolCount: number;
}

export interface SessionFileEdit {
  path: string;
  timestamp: string;
  messageId: string;
  type: "write" | "edit" | "create";
}

export type SessionDepth = "deep" | "shallow";

export interface BoardSessionData {
  session: UISession;
  messages: UIMessage[];
  stats: BoardSessionStats;
  fileEdits: SessionFileEdit[];
  gitCommits: GitCommit[];
  depth: SessionDepth;
}

export type ZoomLevel = 0 | 1 | 2; // 0: PIXEL, 1: SKIM, 2: READ

export interface DateFilter {
  start: Date | null;
  end: Date | null;
}

export interface ActiveBrush {
  type: "model" | "status" | "tool" | "file" | "hook" | "command" | "mcp";
  value: string; // for mcp type, can be "all" or "server_name"
}

export interface BrushableCard {
  role: string;
  model?: string;
  variant: RendererVariant;
  isError: boolean;
  isCancelled: boolean;
  isCommit: boolean;
  isGit: boolean;
  isShell: boolean;
  isFileEdit: boolean;
  editedFiles: string[];
  hasHook: boolean;
  shellCommands: string[];
  mcpServers: string[];
}

export interface BoardState {
  sessions: Record<string, BoardSessionData>;
  visibleSessionIds: string[];
  isLoadingBoard: boolean;
  zoomLevel: ZoomLevel;
  activeBrush: ActiveBrush | null;
  dateFilter: DateFilter;
}
