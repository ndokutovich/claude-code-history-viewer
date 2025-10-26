import type { UIMessage, MessageFilters } from "@/types";

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
      if (message.toolUse && typeof message.toolUse === "object") {
        const toolUseObj = message.toolUse as Record<string, unknown>;
        // Check if tool name is "Bash" or contains bash-related content
        if (
          toolUseObj.name === "Bash" ||
          (Array.isArray(message.content) &&
            message.content.some(
              (item: any) => item.type === "tool_use" && item.name === "Bash"
            ))
        ) {
          return true;
        }
      }
      return false;
    }

    // Tool use only filter - show messages with any tool use
    if (filters.showToolUseOnly) {
      if (message.toolUse || message.toolUseResult) {
        return true;
      }
      if (
        Array.isArray(message.content) &&
        message.content.some(
          (item: any) => item.type === "tool_use" || item.type === "tool_result"
        )
      ) {
        return true;
      }
      return false;
    }

    // Messages only filter - show messages without tool use
    if (filters.showMessagesOnly) {
      // Has text content and no tool use
      const hasTextContent =
        (typeof message.content === "string" && message.content.length > 0) ||
        (Array.isArray(message.content) &&
          message.content.some((item: any) => item.type === "text" && item.text));

      const hasNoToolUse =
        !message.toolUse &&
        !message.toolUseResult &&
        !(
          Array.isArray(message.content) &&
          message.content.some(
            (item: any) => item.type === "tool_use" || item.type === "tool_result"
          )
        );

      return hasTextContent && hasNoToolUse;
    }

    return true;
  });
}
