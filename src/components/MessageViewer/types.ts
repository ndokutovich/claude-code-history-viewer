/**
 * MessageViewer Types
 *
 * Shared type definitions for MessageViewer components.
 */

import type { UIMessage, UISession, PaginationState } from "../../types";

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
}
