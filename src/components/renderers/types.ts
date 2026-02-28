/**
 * Shared types for all renderer components
 *
 * Centralized type definitions for consistent styling across renderers.
 */

/**
 * Semantic categories for renderer styling
 */
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

/**
 * Tool name to variant mapping
 * Each tool is mapped to its semantic category for consistent styling
 */
export const TOOL_VARIANTS: Record<string, RendererVariant> = {
  // Code operations (Blue)
  Read: "code",
  Write: "code",
  Edit: "code",
  MultiEdit: "code",
  NotebookEdit: "code",
  LSP: "code",

  // File operations (Teal)
  Glob: "file",
  LS: "file",

  // Search operations (Violet)
  Grep: "search",

  // Web operations (Sky Blue)
  WebSearch: "web",
  WebFetch: "web",
  web_search: "web",

  // Task management (Amber)
  Task: "task",
  TodoWrite: "task",
  TodoRead: "task",

  // Terminal/Shell operations
  Bash: "terminal",
  KillShell: "terminal",

  // Git operations (Cyan)
  git: "git",

  // MCP/Server operations (Magenta)
  mcp: "mcp",

  // Default
  default: "info",
} as const;
