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
  // Memoize message tree structure + child map (O(n) instead of O(n²))
  const { rootMessages, uniqueMessages, childMap } = useMemo(() => {
    if (messages.length === 0) {
      return { rootMessages: [], uniqueMessages: [], childMap: new Map<string, UIMessage[]>() };
    }

    // Remove duplicates
    const uniqueMessages = Array.from(
      new Map(messages.map((msg) => [msg.uuid, msg])).values()
    );

    // Build child map and find roots in a single pass
    const childMap = new Map<string, UIMessage[]>();
    const roots: UIMessage[] = [];

    uniqueMessages.forEach((msg) => {
      const parentUuid = getParentUuid(msg);
      if (!parentUuid) {
        roots.push(msg);
      } else {
        const siblings = childMap.get(parentUuid);
        if (siblings) {
          siblings.push(msg);
        } else {
          childMap.set(parentUuid, [msg]);
        }
      }
    });

    return { rootMessages: roots, uniqueMessages, childMap };
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
      // O(1) child lookup via pre-built map instead of O(n) filter
      const children = childMap.get(message.uuid) || [];

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
    [childMap]
  );

  return { rootMessages, uniqueMessages, renderMessageTree };
};
