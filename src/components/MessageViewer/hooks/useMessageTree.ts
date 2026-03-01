import React, { useMemo, useCallback } from "react";
import type { UIMessage } from "../../../types";
import type { MessageNodeProps } from "../types";

// Type-safe parent UUID extraction function
const getParentUuid = (message: UIMessage): string | null | undefined => {
  const msgWithParent = message as UIMessage & {
    parentUuid?: string;
    parent_uuid?: string;
  };
  return msgWithParent.parentUuid || msgWithParent.parent_uuid;
};

interface UseMessageTreeResult {
  rootMessages: UIMessage[];
  uniqueMessages: UIMessage[];
  renderMessageTree: (
    message: UIMessage,
    depth: number,
    visitedIds: Set<string>,
    keyPrefix: string,
    sessionFilePath: string | undefined,
    NodeComponent: React.ComponentType<MessageNodeProps>,
    nodeProps: Omit<MessageNodeProps, "message" | "depth" | "sessionFilePath">
  ) => React.ReactNode[];
}

export const useMessageTree = (messages: UIMessage[]): UseMessageTreeResult => {
  // Memoize message tree structure (performance optimization)
  const { rootMessages, uniqueMessages } = useMemo(() => {
    if (messages.length === 0) {
      return { rootMessages: [], uniqueMessages: [] };
    }

    // Remove duplicates
    const uniqueMessages = Array.from(
      new Map(messages.map((msg) => [msg.uuid, msg])).values()
    );

    // Find root messages
    const roots: UIMessage[] = [];
    uniqueMessages.forEach((msg) => {
      const parentUuid = getParentUuid(msg);
      if (!parentUuid) {
        roots.push(msg);
      }
    });

    return { rootMessages: roots, uniqueMessages };
  }, [messages]);

  const renderMessageTree = useCallback(
    (
      message: UIMessage,
      depth = 0,
      visitedIds = new Set<string>(),
      keyPrefix = "",
      sessionFilePath: string | undefined,
      NodeComponent: React.ComponentType<MessageNodeProps>,
      nodeProps: Omit<MessageNodeProps, "message" | "depth" | "sessionFilePath">
    ): React.ReactNode[] => {
      // Prevent circular references
      if (visitedIds.has(message.uuid)) {
        console.warn(`Circular reference detected for message: ${message.uuid}`);
        return [];
      }

      visitedIds.add(message.uuid);
      const children = messages.filter((m) => {
        const parentUuid = getParentUuid(m);
        return parentUuid === message.uuid;
      });

      // Generate unique key
      const uniqueKey = keyPrefix ? `${keyPrefix}-${message.uuid}` : message.uuid;

      // Add current message first, then child messages
      const result: React.ReactNode[] = [
        React.createElement(NodeComponent, {
          key: uniqueKey,
          message,
          depth,
          sessionFilePath,
          ...nodeProps,
        }),
      ];

      // Recursively add child messages (increase depth)
      children.forEach((child, index) => {
        const childNodes = renderMessageTree(
          child,
          depth + 1,
          new Set(visitedIds),
          `${uniqueKey}-child-${index}`,
          sessionFilePath,
          NodeComponent,
          nodeProps
        );
        result.push(...childNodes);
      });

      return result;
    },
    [messages]
  );

  return { rootMessages, uniqueMessages, renderMessageTree };
};
