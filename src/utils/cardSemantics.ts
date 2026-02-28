/**
 * Card Semantics
 *
 * Computes semantic properties of a message card for rendering and brush matching.
 * Adapted from upstream to use UIMessage instead of ClaudeMessage.
 */

import type { UIMessage } from "../types";
import { getToolVariant } from "@/utils/toolIconUtils";
import { matchesBrush, type ActiveBrush } from "@/utils/brushMatchers";

export interface ToolUseBlockInfo {
  name: string;
  input: Record<string, unknown>;
}

export interface CardSemantics {
  isTool: boolean;
  variant: string | null;
  isError: boolean;
  isCancelled: boolean;
  isCommit: boolean;
  isGit: boolean;
  isShell: boolean;
  shellCommand: string | null;
  isFileEdit: boolean;
  editedMdFile: string | null;
  hasUrls: boolean;
  isMcp: boolean;
  isRawError: boolean;
  brushMatch: boolean;
}

/**
 * Extract a tool use block from a UIMessage.
 * The fork stores toolUse as Record<string, unknown> at root level.
 */
export function getToolUseBlock(
  message: UIMessage
): ToolUseBlockInfo | null {
  // Root-level toolUse
  if (message.toolUse) {
    const tu = message.toolUse;
    if (typeof tu.name === "string") {
      return {
        name: tu.name as string,
        input: (tu.input as Record<string, unknown>) ?? {},
      };
    }
  }

  // Content array may have tool_use items
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      const block = item as unknown as Record<string, unknown>;
      if (block.type === "tool_use" && typeof block.name === "string") {
        return {
          name: block.name as string,
          input: (block.input as Record<string, unknown>) ?? {},
        };
      }
    }
  }

  return null;
}

/**
 * Extract text content from a UIMessage.
 */
export function extractMessageContent(message: UIMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    const texts: string[] = [];
    for (const item of message.content) {
      const block = item as unknown as Record<string, unknown>;
      if (block.type === "text" && typeof block.text === "string") {
        texts.push(block.text as string);
      }
    }
    return texts.join("\n");
  }
  return "";
}

/**
 * Get the message role from a UIMessage.
 */
export function getMessageRole(message: UIMessage): string {
  return message.type ?? "unknown";
}

/**
 * Check if a message is a tool event (has tool use or result).
 */
export function isToolEvent(message: UIMessage): boolean {
  if (message.toolUse) return true;
  if (message.toolUseResult) return true;
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      const block = item as unknown as Record<string, unknown>;
      if (
        block.type === "tool_use" ||
        block.type === "tool_result"
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if a UIMessage is an assistant message.
 */
export function isAssistantMessage(message: UIMessage): boolean {
  return message.type === "assistant";
}

/**
 * Check if a UIMessage is a user message.
 */
export function isUserMessage(message: UIMessage): boolean {
  return message.type === "user";
}

/**
 * Check if a UIMessage is a system message.
 */
export function isSystemMessage(message: UIMessage): boolean {
  return message.type === "system";
}

export function getCardSemantics(
  message: UIMessage,
  content: string,
  toolUseBlock: ToolUseBlockInfo | null,
  role: string,
  activeBrush: ActiveBrush | null | undefined
): CardSemantics {
  const isTool = !!toolUseBlock;
  const variant = toolUseBlock ? getToolVariant(toolUseBlock.name) : null;

  // Error detection
  const hasToolError = (() => {
    const result = message.toolUseResult;
    if (typeof result !== "object" || result == null) return false;
    const res = result as Record<string, unknown>;
    return (
      res.is_error === true ||
      (typeof res.stderr === "string" && (res.stderr as string).length > 0)
    );
  })();

  // System stop reason error
  const stopReasonSystem = (
    message as unknown as Record<string, unknown>
  ).stopReasonSystem;
  const isError =
    (message.type === "system" &&
      typeof stopReasonSystem === "string" &&
      stopReasonSystem.toLowerCase().includes("error")) ||
    hasToolError;

  // Cancellation detection
  const stopReasonValue =
    message.type === "assistant" ? message.stop_reason : undefined;
  const isCancelled =
    String(stopReasonValue) === "customer_cancelled" ||
    (message.type === "system" && stopReasonSystem === "customer_cancelled") ||
    content.includes("request canceled by user");

  // Git commit detection
  let isCommit = false;
  if (isTool && toolUseBlock) {
    if (
      ["run_command", "bash", "execute_command"].includes(toolUseBlock.name)
    ) {
      const cmd =
        toolUseBlock.input?.CommandLine || toolUseBlock.input?.command;
      isCommit = typeof cmd === "string" && cmd.includes("git commit");
    }
  }

  // Generic Git command detection
  let isGit = false;
  if (isTool && toolUseBlock) {
    if (variant === "git") isGit = true;
    if (
      ["run_command", "bash", "execute_command"].includes(toolUseBlock.name)
    ) {
      const cmd =
        toolUseBlock.input?.CommandLine || toolUseBlock.input?.command;
      if (typeof cmd === "string" && cmd.trim().startsWith("git")) {
        isGit = true;
      }
    }
  }

  // Shell detection
  const isShell = isTool && variant === "terminal" && !isCommit && !isGit;

  // Shell command text
  const shellCommand =
    isShell && toolUseBlock
      ? ((toolUseBlock.input?.CommandLine ||
          toolUseBlock.input?.command ||
          null) as string | null)
      : null;

  // File edit detection
  const isFileEdit =
    isTool && toolUseBlock
      ? [
          "write_to_file",
          "replace_file_content",
          "multi_replace_file_content",
          "create_file",
          "edit_file",
          "Edit",
          "Replace",
        ].includes(toolUseBlock.name) ||
        /write|edit|replace|patch/i.test(toolUseBlock.name)
      : false;

  // Edited files
  const editedFiles: string[] = [];
  let editedMdFile: string | null = null;

  if (toolUseBlock) {
    const name = toolUseBlock.name;
    const input = toolUseBlock.input;
    if (
      [
        "write_to_file",
        "replace_file_content",
        "multi_replace_file_content",
        "create_file",
        "edit_file",
      ].includes(name) ||
      /write|edit|replace|patch/i.test(name)
    ) {
      const path = input?.path || input?.file_path || input?.TargetFile || "";
      if (typeof path === "string" && path) {
        editedFiles.push(path);
        if (path.toLowerCase().endsWith(".md")) {
          editedMdFile = path;
        }
      }
    }
  }
  if (!editedMdFile && role === "assistant" && content) {
    const mdMention = content.match(
      /(create|update|edit|writing|wrote).+?([a-zA-Z0-9_\-. ]+\.md)/i
    );
    if (mdMention?.[2]) {
      editedMdFile = mdMention[2];
    }
  }

  // URL detection
  const hasUrls = content ? /https?:\/\/[^\s]+/.test(content) : false;

  // MCP detection
  const isMcp = toolUseBlock
    ? toolUseBlock.name === "mcp"
    : content.includes("<command-name>/mcp") ||
      content.includes("mcp_server");

  // Raw error detection
  const isRawError =
    content.includes("<local-command-stdout>Failed") ||
    content.includes("Error:") ||
    content.includes("[ERROR]") ||
    (content.includes("<local-command-stdout>") &&
      content.toLowerCase().includes("failed"));

  // Model detection
  const model = message.type === "assistant" ? message.model : undefined;

  // Hook detection (system messages may have hookCount)
  const hookCount = (message as unknown as Record<string, unknown>)
    .hookCount;
  const hasHook = message.type === "system" && typeof hookCount === "number" && hookCount > 0;

  // Shell commands
  const shellCommands: string[] = [];
  const hookInfos = (message as unknown as Record<string, unknown>)
    .hookInfos as Array<{ command?: string }> | undefined;
  if (message.type === "system" && hookInfos) {
    hookInfos.forEach((info) => {
      if (info.command) {
        shellCommands.push(info.command);
      }
    });
  }
  if (toolUseBlock && shellCommand) {
    shellCommands.push(shellCommand);
  }

  // MCP server names
  const mcpServers: string[] = [];
  if (message.type === "user" && Array.isArray(message.content)) {
    message.content.forEach((c) => {
      const block = c as unknown as Record<string, unknown>;
      if (
        block.type === "mcp_tool_use" &&
        typeof block.server_name === "string"
      ) {
        mcpServers.push(block.server_name as string);
      }
    });
  }

  // Brush matching
  const brushMatch = matchesBrush(activeBrush || null, {
    role,
    model,
    variant: variant || "neutral",
    isError: isError || isRawError,
    isCancelled,
    isCommit,
    isGit,
    isShell,
    isFileEdit,
    editedFiles,
    hasHook,
    shellCommands,
    mcpServers,
  });

  return {
    isTool,
    variant,
    isError,
    isCancelled,
    isCommit,
    isGit,
    isShell,
    shellCommand,
    isFileEdit,
    editedMdFile,
    hasUrls,
    isMcp,
    isRawError,
    brushMatch,
  };
}
