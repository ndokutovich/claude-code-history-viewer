/**
 * Type Guards Utility
 *
 * Runtime type checking functions for type-safe narrowing of message and
 * content types. Adapted for our UIMessage / ClaudeMessage shape.
 *
 * @see src/utils/contentTypeGuards.ts for unknown-accepting content guards
 */

import type {
  ClaudeMessage,
  ContentItem,
  ToolUseContent,
  ToolResultContent,
  TextContent,
  ThinkingContent,
  SessionMetadata,
} from "@/types";

import type { MCPToolUseContent, MCPToolResultContent } from "@/types/mcp.types";

// ============================================================================
// Message Type Guards
// ============================================================================

/** Narrows to a user-role message */
export function isUserMessage(message: ClaudeMessage): boolean {
  return message.type === "user";
}

/** Narrows to an assistant-role message */
export function isAssistantMessage(message: ClaudeMessage): boolean {
  return message.type === "assistant";
}

/** Narrows to a system-role message */
export function isSystemMessage(message: ClaudeMessage): boolean {
  return message.type === "system";
}

/** Narrows to a summary message */
export function isSummaryMessage(message: ClaudeMessage): boolean {
  return message.type === "summary";
}

// ============================================================================
// Content Item Type Guards
// ============================================================================

export function isTextContent(item: ContentItem): item is TextContent {
  return item.type === "text";
}

export function isToolUseContent(item: ContentItem): item is ToolUseContent {
  return item.type === "tool_use";
}

export function isToolResultContent(item: ContentItem): item is ToolResultContent {
  return item.type === "tool_result";
}

export function isThinkingContent(item: ContentItem): item is ThinkingContent {
  return item.type === "thinking";
}

export function isMCPToolUseContent(item: unknown): item is MCPToolUseContent {
  return typeof item === "object" && item !== null && (item as { type?: string }).type === "mcp_tool_use";
}

export function isMCPToolResultContent(item: unknown): item is MCPToolResultContent {
  return typeof item === "object" && item !== null && (item as { type?: string }).type === "mcp_tool_result";
}

// ============================================================================
// Content Array Type Guards
// ============================================================================

export function isContentArray(content: unknown): content is ContentItem[] {
  return Array.isArray(content);
}

export function isStringContent(content: unknown): content is string {
  return typeof content === "string";
}

// ============================================================================
// Metadata Type Guards
// ============================================================================

export function isSessionMetadataEmpty(metadata: SessionMetadata): boolean {
  return (
    !metadata.customName &&
    !metadata.starred &&
    (!metadata.tags || metadata.tags.length === 0) &&
    !metadata.notes
  );
}

export function hasUserMetadata<T>(metadata: T | null): metadata is T {
  return metadata != null;
}

// ============================================================================
// Tool Use / Result Helpers
// ============================================================================

export function hasToolUse(message: ClaudeMessage): boolean {
  if (message.type !== "assistant" && message.type !== "user") {
    return false;
  }

  if ("toolUse" in message && message.toolUse != null) {
    return true;
  }

  if (isContentArray(message.content)) {
    return message.content.some((item) => isToolUseContent(item));
  }

  return false;
}

export function hasToolResult(message: ClaudeMessage): boolean {
  if (message.type !== "assistant" && message.type !== "user") {
    return false;
  }

  if ("toolUseResult" in message && message.toolUseResult != null) {
    return true;
  }

  if (isContentArray(message.content)) {
    return message.content.some((item) => isToolResultContent(item));
  }

  return false;
}

// ============================================================================
// Error Checking
// ============================================================================

export function hasError(message: ClaudeMessage): boolean {
  if (isContentArray(message.content)) {
    return message.content.some(
      (item) => isToolResultContent(item) && item.is_error === true
    );
  }

  return false;
}

// ============================================================================
// MCP Helpers
// ============================================================================

export function hasMCPContent(message: ClaudeMessage): boolean {
  if (!isContentArray(message.content)) {
    return false;
  }

  return message.content.some(
    (item) => isMCPToolUseContent(item) || isMCPToolResultContent(item)
  );
}
