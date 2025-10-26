import type { UIMessage, MessageFilters, ContentItem } from "@/types";

/**
 * Check if a content item is a tool use item with proper typing
 */
function isToolUseContent(item: ContentItem): item is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } {
  return item.type === "tool_use" && "name" in item;
}

/**
 * Check if a content item is a tool result item with proper typing
 */
function isToolResultContent(item: ContentItem): item is { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean } {
  return item.type === "tool_result";
}

/**
 * Filter messages based on user-selected filters
 */
export function filterMessages(
  messages: UIMessage[],
  filters: MessageFilters
): UIMessage[] {
  // If no filters are active, return all messages
  if (!filters.showBashOnly && !filters.showToolUseOnly && !filters.showMessagesOnly) {
    return messages;
  }

  return messages.filter((message) => {
    // Bash only filter - show messages with Bash tool use
    if (filters.showBashOnly) {
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
  });
}
