import type { UIMessage, MessageFilters, ContentItem, ToolResultContent } from "@/types";

/**
 * Default message filters — all messages visible, no exclusive filter active.
 * Single source of truth shared by the store initializer and the "Clear" action.
 */
export const DEFAULT_MESSAGE_FILTERS: MessageFilters = {
  showBashOnly: false,
  showToolUseOnly: false,
  showMessagesOnly: false,
  showCommandOnly: false,
  showNoiseMessages: false,
  showSubagentMessages: false,
  roleUser: true,
  roleAssistant: true,
  roleSystem: true,
  contentText: true,
  contentToolUse: true,
  contentToolResult: true,
  contentThinking: true,
};

/**
 * Whether any non-default filter is currently active.
 * Role/content-type toggles are "active" when a type is hidden (set to false).
 */
export function hasActiveMessageFilters(filters: MessageFilters): boolean {
  return (
    filters.showBashOnly ||
    filters.showToolUseOnly ||
    filters.showMessagesOnly ||
    filters.showCommandOnly ||
    filters.showNoiseMessages ||
    !filters.roleUser ||
    !filters.roleAssistant ||
    !filters.roleSystem ||
    !filters.contentText ||
    !filters.contentToolUse ||
    !filters.contentToolResult ||
    !filters.contentThinking
  );
}

/**
 * Map a message's raw `type` to a coarse role bucket used by the role filter.
 * Anything that is not "user"/"assistant" (system, summary, etc.) is "system".
 */
function getRoleBucket(message: UIMessage): "user" | "assistant" | "system" {
  if (message.type === "user") return "user";
  if (message.type === "assistant") return "assistant";
  return "system";
}

/**
 * Collect the set of advanced content-types present in a message.
 */
function getContentTypes(message: UIMessage): Set<string> {
  const types = new Set<string>();

  if (typeof message.content === "string") {
    if (message.content.length > 0) types.add("text");
  } else if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (item.type === "text") types.add("text");
      else if (item.type === "tool_use") types.add("tool_use");
      else if (item.type === "tool_result") types.add("tool_result");
      else if (item.type === "thinking") types.add("thinking");
    }
  }

  if (message.toolUse && Object.keys(message.toolUse).length > 0) types.add("tool_use");
  if (message.toolUseResult && Object.keys(message.toolUseResult).length > 0) {
    types.add("tool_result");
  }

  return types;
}

/**
 * Role filter predicate — message passes if its role bucket is enabled.
 */
function passesRoleFilter(message: UIMessage, filters: MessageFilters): boolean {
  switch (getRoleBucket(message)) {
    case "user":
      return filters.roleUser;
    case "assistant":
      return filters.roleAssistant;
    default:
      return filters.roleSystem;
  }
}

/**
 * Content-type filter predicate — message passes if it contains at least one
 * enabled content-type. Messages with no recognizable content-type are kept so
 * that summaries / special messages are never hidden by content toggles.
 */
function passesContentTypeFilter(message: UIMessage, filters: MessageFilters): boolean {
  // Fast path: all content types enabled → no content filtering.
  if (
    filters.contentText &&
    filters.contentToolUse &&
    filters.contentToolResult &&
    filters.contentThinking
  ) {
    return true;
  }

  const present = getContentTypes(message);
  if (present.size === 0) return true;

  if (present.has("text") && filters.contentText) return true;
  if (present.has("tool_use") && filters.contentToolUse) return true;
  if (present.has("tool_result") && filters.contentToolResult) return true;
  if (present.has("thinking") && filters.contentThinking) return true;

  return false;
}

/**
 * Check if a content item is a tool use item with proper typing
 */
function isToolUseContent(item: ContentItem): item is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } {
  return item.type === "tool_use" && "name" in item;
}

/**
 * Check if a content item is a tool result item with proper typing
 */
function isToolResultContent(item: ContentItem): item is ToolResultContent {
  return item.type === "tool_result";
}

/**
 * Extract Bash command text from a message (for command-only display)
 * Returns the command string or null if no Bash command found
 */
export function extractBashCommand(message: UIMessage): string | null {
  // Check content array for Bash tool use
  if (Array.isArray(message.content)) {
    for (const item of message.content) {
      if (isToolUseContent(item) && item.name === "Bash") {
        const input = item.input as { command?: string; description?: string };
        if (input.command) {
          return input.command;
        }
      }
    }
  }

  // Check legacy toolUse field
  if (message.toolUse && typeof message.toolUse === "object") {
    const toolUseObj = message.toolUse as { name?: string; input?: { command?: string } };
    if (toolUseObj.name === "Bash" && toolUseObj.input?.command) {
      return toolUseObj.input.command;
    }
  }

  return null;
}

/**
 * Filter messages based on user-selected filters
 */
export function filterMessages(
  messages: UIMessage[],
  filters: MessageFilters
): UIMessage[] {
  return messages.filter(
    (message) =>
      passesRoleFilter(message, filters) &&
      passesContentTypeFilter(message, filters) &&
      passesExclusiveFilter(message, filters)
  );
}

/**
 * Existing mutually-exclusive "only" filters (Bash / Tool use / Messages / Command).
 * Returns true (message visible) when none of these filters are active.
 */
function passesExclusiveFilter(message: UIMessage, filters: MessageFilters): boolean {
  if (
    !filters.showBashOnly &&
    !filters.showToolUseOnly &&
    !filters.showMessagesOnly &&
    !filters.showCommandOnly
  ) {
    return true;
  }

  {
    // Bash only filter (Command only is a subset of this, so check both)
    if (filters.showBashOnly || filters.showCommandOnly) {
      // Check content array for Bash tool use
      if (Array.isArray(message.content)) {
        const hasBashInContent = message.content.some((item) => {
          return isToolUseContent(item) && item.name === "Bash";
        });
        if (hasBashInContent) {
          return true;
        }
      }

      // Also check legacy toolUse field
      if (message.toolUse && typeof message.toolUse === "object") {
        const toolUseObj = message.toolUse as Record<string, unknown>;
        if (toolUseObj.name === "Bash") {
          return true;
        }
      }

      return false;
    }

    // Tool use only filter - show messages with any tool use
    if (filters.showToolUseOnly) {
      // Check content array for tool use or tool result
      if (Array.isArray(message.content)) {
        const hasToolInContent = message.content.some((item) => {
          return isToolUseContent(item) || isToolResultContent(item);
        });
        if (hasToolInContent) {
          return true;
        }
      }

      // Also check legacy fields
      if (message.toolUse || message.toolUseResult) {
        return true;
      }

      return false;
    }

    // Messages only filter - show messages without tool use
    if (filters.showMessagesOnly) {
      // Has text content
      const hasTextContent =
        (typeof message.content === "string" && message.content.length > 0) ||
        (Array.isArray(message.content) &&
          message.content.some((item) => item.type === "text" && "text" in item));

      // Check for no tool use in content array
      const hasNoToolUseInContent = Array.isArray(message.content)
        ? !message.content.some((item) => isToolUseContent(item) || isToolResultContent(item))
        : true;

      // Check legacy fields
      const hasNoToolUse =
        !message.toolUse &&
        !message.toolUseResult &&
        hasNoToolUseInContent;

      return hasTextContent && hasNoToolUse;
    }

    return true;
  }
}
