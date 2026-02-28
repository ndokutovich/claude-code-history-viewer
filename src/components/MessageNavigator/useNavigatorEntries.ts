import { useMemo } from "react";
import type { UIMessage } from "../../types";
import type { NavigatorEntryData } from "./types";
import { extractUIMessageContent } from "../../utils/messageUtils";

/** Types to filter out as noise in the navigator */
const NOISE_TYPES = new Set(["progress", "queue-operation", "file-history-snapshot"]);

/** Valid roles for navigator entries */
const VALID_ROLES = new Set(["user", "assistant", "system", "summary"]);

/** Strip XML tags from content for clean preview */
function stripXmlTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Truncate text to maxLength, respecting word boundaries when possible */
function truncatePreview(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  // Use string.slice for Unicode safety (CJK characters)
  const truncated = text.slice(0, maxLength);
  // Try to break at last space
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + "\u2026";
  }
  return truncated + "\u2026";
}

/**
 * Check if a UIMessage has tool use content.
 * Checks both the direct `toolUse` property and content array for tool_use blocks.
 */
function hasToolUse(message: UIMessage): boolean {
  if (message.toolUse != null && Object.keys(message.toolUse).length > 0) {
    return true;
  }
  if (Array.isArray(message.content)) {
    return message.content.some(
      (block) => typeof block === "object" && block != null && "type" in block && block.type === "tool_use"
    );
  }
  return false;
}

/**
 * Get the tool name from a UIMessage if it contains tool use.
 */
function getToolName(message: UIMessage): string | null {
  if (message.toolUse != null && typeof message.toolUse.name === "string") {
    return message.toolUse.name;
  }
  if (Array.isArray(message.content)) {
    const block = message.content.find(
      (b) => typeof b === "object" && b != null && "type" in b && b.type === "tool_use"
    );
    if (block != null && "name" in block && typeof block.name === "string") {
      return block.name;
    }
  }
  return null;
}

/**
 * Check if a UIMessage is empty (no meaningful content to display).
 */
function isEmptyUIMessage(message: UIMessage): boolean {
  // Messages with tool use or results should be shown
  if (hasToolUse(message)) return false;
  if (message.toolUseResult != null && Object.keys(message.toolUseResult).length > 0) return false;

  // Check for array content (tool results, etc.)
  if (Array.isArray(message.content) && message.content.length > 0) return false;

  const content = extractUIMessageContent(message);

  // No content at all
  if (!content) return true;

  // Non-string content that exists
  if (typeof content !== "string") return false;

  // Messages with command-name tags should be shown
  if (/<command-name>[\s\S]*?<\/command-name>/.test(content)) return false;

  // Strip system-only tags and check if anything meaningful remains
  const stripped = content
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<[^>]*(?:stdout|output)[^>]*>[\s\S]*?<\/[^>]*>/g, "")
    .replace(/<[^>]*(?:stderr|error)[^>]*>[\s\S]*?<\/[^>]*>/g, "")
    .trim();

  return stripped.length === 0;
}

export function useNavigatorEntries(messages: UIMessage[]): NavigatorEntryData[] {
  return useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const entries: NavigatorEntryData[] = [];
    let turnIndex = 0;

    for (const message of messages) {
      // Filter out noise types
      if (NOISE_TYPES.has(message.type)) continue;

      // Filter out empty messages
      if (isEmptyUIMessage(message)) continue;

      // Extract preview text
      const rawContent = extractUIMessageContent(message);
      const toolName = getToolName(message);
      let preview = "";
      if (rawContent) {
        preview = truncatePreview(stripXmlTags(rawContent));
      } else if (toolName) {
        preview = toolName;
      }

      // Determine role - map unknown types to "system"
      const role = VALID_ROLES.has(message.type)
        ? (message.type as "user" | "assistant" | "system" | "summary")
        : "system";

      turnIndex++;

      entries.push({
        uuid: message.uuid,
        role,
        preview: preview || `(${role} message)`,
        timestamp: message.timestamp || "",
        hasToolUse: hasToolUse(message),
        turnIndex,
      });
    }

    return entries;
  }, [messages]);
}
