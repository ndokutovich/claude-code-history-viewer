/**
 * Session Analytics
 *
 * Analyzes UIMessage arrays to produce session-level statistics.
 * Adapted from upstream to use UIMessage instead of ClaudeMessage.
 */

import type { UIMessage } from "../types";
import { getToolVariant } from "@/utils/toolIconUtils";
import { getToolUseBlock, isAssistantMessage } from "@/utils/cardSemantics";

export interface SessionStats {
  fileEditCount: number;
  shellCount: number;
  commitCount: number;
  errorCount: number;
  filesTouched: Set<string>;
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

export function analyzeSessionMessages(messages: UIMessage[]): SessionStats {
  const stats: SessionStats = {
    fileEditCount: 0,
    shellCount: 0,
    commitCount: 0,
    errorCount: 0,
    filesTouched: new Set(),
    hasMarkdownEdits: false,
    markdownEditCount: 0,
    toolBreakdown: {},
    searchCount: 0,
    webCount: 0,
    mcpCount: 0,
    fileToolCount: 0,
    codeReadCount: 0,
    gitToolCount: 0,
  };

  messages.forEach((msg) => {
    // 1. Check for Errors
    let isError = false;

    const stopReasonSystem = (msg as unknown as Record<string, unknown>)
      .stopReasonSystem;
    if (
      msg.type === "system" &&
      typeof stopReasonSystem === "string" &&
      stopReasonSystem.toLowerCase().includes("error")
    ) {
      isError = true;
    }

    if (msg.type === "user" && msg.toolUseResult) {
      const result = msg.toolUseResult;
      if (typeof result === "object" && result != null) {
        const res = result as Record<string, unknown>;
        if (
          res.is_error === true ||
          (typeof res.stderr === "string" &&
            (res.stderr as string).trim().length > 0)
        ) {
          isError = true;
        }
      }
    }

    if (isError) {
      stats.errorCount++;
    }

    // 2. Scan Tool Usage
    if (isAssistantMessage(msg)) {
      const toolBlock = getToolUseBlock(msg);
      if (toolBlock) {
        const name = toolBlock.name;
        const input = toolBlock.input;

        // Track tool name in breakdown
        stats.toolBreakdown[name] = (stats.toolBreakdown[name] || 0) + 1;

        const variant = getToolVariant(name);

        // 1. Terminal / Shell
        if (variant === "terminal") {
          const cmd = input.CommandLine || input.command;
          const isGitCmd =
            typeof cmd === "string" && cmd.trim().startsWith("git");

          if (isGitCmd) {
            stats.gitToolCount++;
            if (cmd.trim().includes("git commit")) {
              stats.commitCount++;
            }
          } else {
            stats.shellCount++;
          }
        }

        // 2. Search
        if (variant === "search") {
          stats.searchCount++;
        }

        // 3. Web
        if (variant === "web") {
          stats.webCount++;
        }

        // 4. MCP
        if (variant === "mcp") {
          stats.mcpCount++;
        }

        // 5. Git Tools
        if (variant === "git") {
          stats.gitToolCount++;
        }

        // 6. File Tools
        if (variant === "file") {
          stats.fileToolCount++;
        }

        // 7. Detect File Edits
        const isEdit =
          [
            "write_to_file",
            "replace_file_content",
            "multi_replace_file_content",
            "create_file",
            "edit_file",
            "Edit",
            "Replace",
          ].includes(name) || /write|edit|replace|patch/i.test(name);

        if (isEdit) {
          stats.fileEditCount++;

          const path = input.path || input.file_path || input.TargetFile || input.key;
          if (typeof path === "string" && path.trim().length > 0) {
            stats.filesTouched.add(path);

            if (
              path.toLowerCase().endsWith(".md") ||
              path.toLowerCase().endsWith(".markdown")
            ) {
              stats.hasMarkdownEdits = true;
              stats.markdownEditCount++;
            }
          }
        } else if (variant === "code") {
          stats.codeReadCount++;
        }
      }
    }
  });

  return stats;
}
