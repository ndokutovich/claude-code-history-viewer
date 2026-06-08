import React, { useMemo, useCallback } from "react";
import type { UIMessage } from "../../../types";
import type { MessageNodeProps, MessageRowDescriptor } from "../types";

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
  /**
   * Produces the ordered, flattened list of rows to render (DFS order with
   * depth), suitable for virtualization. Mirrors `renderMessageTree` ordering
   * and key generation exactly so behavior is identical to the non-virtual path.
   *
   * @param hiddenSet When provided (capture mode), root-level hidden messages
   *   are skipped in tree mode and all hidden messages are filtered in flat
   *   mode — matching the legacy rendering logic.
   */
  flattenRows: (hiddenSet: Set<string> | null) => MessageRowDescriptor[];
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
      // Reuse the same visitedIds Set — no need to copy since we traverse depth-first
      children.forEach((child, index) => {
        const childNodes = renderMessageTree(
          child,
          depth + 1,
          visitedIds,
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

  // Flatten the tree into an ordered array of row descriptors (DFS order),
  // mirroring renderMessageTree's traversal and key generation exactly.
  const flattenRows = useCallback(
    (hiddenSet: Set<string> | null): MessageRowDescriptor[] => {
      const rows: MessageRowDescriptor[] = [];

      if (rootMessages.length > 0) {
        // Tree mode: filter hidden only at the root level (legacy behavior —
        // children of a visible root are never filtered for hidden).
        const visibleRoots = hiddenSet
          ? rootMessages.filter((m) => !hiddenSet.has(m.uuid))
          : rootMessages;

        const visitedIds = new Set<string>();
        const walk = (message: UIMessage, depth: number, keyPrefix: string) => {
          if (visitedIds.has(message.uuid)) {
            console.warn(`Circular reference detected for message: ${message.uuid}`);
            return;
          }
          visitedIds.add(message.uuid);

          const uniqueKey = keyPrefix ? `${keyPrefix}-${message.uuid}` : message.uuid;
          rows.push({ message, depth, key: uniqueKey });

          const children = childMap.get(message.uuid) || [];
          children.forEach((child, index) => {
            walk(child, depth + 1, `${uniqueKey}-child-${index}`);
          });
        };

        visibleRoots.forEach((root) => walk(root, 0, ""));
      } else {
        // Flat mode: filter all hidden messages (legacy behavior).
        const visibleFlat = hiddenSet
          ? uniqueMessages.filter((m) => !hiddenSet.has(m.uuid))
          : uniqueMessages;

        visibleFlat.forEach((message, index) => {
          const uniqueKey =
            message.uuid && message.uuid !== "unknown-session"
              ? `${message.uuid}-${index}`
              : `fallback-${index}-${message.timestamp}-${message.type}`;
          rows.push({ message, depth: 0, key: uniqueKey });
        });
      }

      return rows;
    },
    [rootMessages, uniqueMessages, childMap]
  );

  return { rootMessages, uniqueMessages, renderMessageTree, flattenRows };
};
