/**
 * MessageViewer Types
 *
 * Shared type definitions for MessageViewer components.
 */

import type { UIMessage, UISession, PaginationState } from "../../types";
import type { ProgressData } from "../../types/core/message";
import type { AgentTask } from "../toolResultRenderer";
import type { TaskOperation, TaskInfo } from "./helpers/taskOperationHelpers";

// ============================================================================
// Props Interfaces
// ============================================================================

export interface MessageViewerProps {
  messages: UIMessage[];
  pagination: PaginationState;
  isLoading: boolean;
  selectedSession: UISession | null;
  onLoadMore: () => void;
}

export interface MessageNodeProps {
  message: UIMessage;
  depth: number;
  providerName: string;
  sessionFilePath?: string;
  allMessages: UIMessage[];
  onExtractRange: (startIndex: number, endIndex: number, openModal: boolean) => void;
  /** Capture mode: when true, show hide button on each message */
  isCaptureMode?: boolean;
  /** Callback to hide a message in capture mode */
  onHideMessage?: (uuid: string) => void;
}

export interface MessageHeaderProps {
  message: UIMessage;
}

export interface SummaryMessageProps {
  content: string;
  timestamp: string;
}

// ============================================================================
// Agent Progress Types
// ============================================================================

export interface AgentProgressEntry {
  data: ProgressData;
  timestamp: string;
  uuid: string;
}

export interface AgentProgressGroup {
  entries: AgentProgressEntry[];
  agentId: string;
}

// ============================================================================
// Grouping Result Types
// ============================================================================

export interface AgentTaskGroupResult {
  tasks: AgentTask[];
  messageUuids: Set<string>;
}

export interface AgentProgressGroupResult {
  entries: AgentProgressEntry[];
  messageUuids: Set<string>;
}

export type { TaskOperation, TaskOperationGroupResult, TaskInfo } from "./helpers/taskOperationHelpers";

// ============================================================================
// Search Configuration
// ============================================================================

export const SEARCH_MIN_CHARS = 2;
export const SCROLL_HIGHLIGHT_DELAY_MS = 100;

// ============================================================================
// Virtual Scrolling Types
// ============================================================================

/** Regular message item in flattened list */
export interface FlattenedMessageItem {
  type: "message";
  message: UIMessage;
  depth: number;
  originalIndex: number;
  /** True if this message is the first (leader) of an agent task group */
  isGroupLeader: boolean;
  /** True if this message is a non-leader member of an agent task group */
  isGroupMember: boolean;
  /** True if this message is the first (leader) of an agent progress group */
  isProgressGroupLeader: boolean;
  /** True if this message is a non-leader member of an agent progress group */
  isProgressGroupMember: boolean;
  /** Agent tasks for group leader */
  agentTaskGroup?: AgentTask[];
  /** Agent progress data for group leader */
  agentProgressGroup?: AgentProgressGroup;
  /** True if this message is the first (leader) of a task operation group */
  isTaskOperationGroupLeader: boolean;
  /** True if this message is a non-leader member of a task operation group */
  isTaskOperationGroupMember: boolean;
  /** Task operations for group leader */
  taskOperationGroup?: TaskOperation[];
  /** Global task registry for resolving task info */
  taskRegistry?: Map<string, TaskInfo>;
}

/** Placeholder indicating hidden blocks in capture mode */
export interface HiddenBlocksPlaceholder {
  type: "hidden-placeholder";
  /** Number of consecutive hidden blocks */
  hiddenCount: number;
  /** UUIDs of hidden messages (for potential restore) */
  hiddenUuids: string[];
}

/** Union type for all items in the flattened list */
export type FlattenedMessage = FlattenedMessageItem | HiddenBlocksPlaceholder;
