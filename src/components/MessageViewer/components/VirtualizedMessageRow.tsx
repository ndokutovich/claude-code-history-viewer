/**
 * VirtualizedMessageRow Component
 *
 * Wrapper component for virtualized message rendering.
 * Uses forwardRef to support dynamic height measurement.
 * Handles both regular messages and hidden block placeholders.
 *
 * Adaptation note: upstream used ClaudeMessageNode with rich props;
 * adapted to use our MessageNode with compatible props signature.
 */

import { forwardRef } from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import { cn } from "../../../utils/cn";
import type { FlattenedMessage } from "../types";
import { MessageNode } from "./MessageNode";
import { HiddenBlocksIndicator } from "../../HiddenBlocksIndicator";

interface VirtualizedMessageRowProps {
  virtualRow: VirtualItem;
  item: FlattenedMessage;
  /** Provider name shown in message header */
  providerName?: string;
  /** Session file path for reference copying */
  sessionFilePath?: string;
  /** All messages in the session (for extract-above/below) */
  allMessages?: import("../../../types").UIMessage[];
  /** Callback for range extraction */
  onExtractRange?: (startIndex: number, endIndex: number, openModal: boolean) => void;
  // Capture mode
  isCaptureMode?: boolean;
  onHideMessage?: (uuid: string) => void;
  onRestoreOne?: (uuid: string) => void;
  onRestoreAll?: (uuids: string[]) => void;
}

/**
 * Row component with forwardRef for virtualizer measurement.
 */
export const VirtualizedMessageRow = forwardRef<
  HTMLDivElement,
  VirtualizedMessageRowProps
>(function VirtualizedMessageRow(
  {
    virtualRow,
    item,
    providerName = "Claude",
    sessionFilePath,
    allMessages = [],
    onExtractRange = () => undefined,
    isCaptureMode,
    onRestoreOne,
    onRestoreAll,
  },
  ref
) {
  // Handle hidden blocks placeholder
  if (item.type === "hidden-placeholder") {
    return (
      <div
        ref={ref}
        data-index={virtualRow.index}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        <HiddenBlocksIndicator
          count={item.hiddenCount}
          hiddenUuids={item.hiddenUuids}
          onRestoreOne={onRestoreOne}
          onRestoreAll={onRestoreAll}
        />
      </div>
    );
  }

  // Regular message item
  const {
    message,
    depth,
    isGroupMember,
    isProgressGroupMember,
    isTaskOperationGroupMember,
  } = item;

  // Group members render as hidden placeholders for DOM presence (search needs them)
  // but with zero height they won't affect layout
  if (isGroupMember || isProgressGroupMember || isTaskOperationGroupMember) {
    return (
      <div
        ref={ref}
        data-index={virtualRow.index}
        data-message-uuid={message.uuid}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          transform: `translateY(${virtualRow.start}px)`,
          height: 0,
          overflow: "hidden",
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={ref}
      data-index={virtualRow.index}
      className={cn(isCaptureMode && "group/capture")}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      <MessageNode
        message={message}
        depth={depth}
        providerName={providerName}
        sessionFilePath={sessionFilePath}
        allMessages={allMessages}
        onExtractRange={onExtractRange}
      />
    </div>
  );
});
