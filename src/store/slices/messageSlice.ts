/**
 * Message Slice
 *
 * Manages message-level UI state beyond the core message list:
 * - messageScrollPosition: the current scroll offset in the message viewer
 * - messageHighlightIds: UUIDs of messages that should be visually highlighted
 */

// ============================================================================
// State Interface
// ============================================================================

export interface MessageSliceState {
  /** Current scroll position (pixel offset) in the message viewer */
  messageScrollPosition: number;
  /** UUIDs of messages that should be highlighted in the viewer */
  messageHighlightIds: string[];
}

export interface MessageSliceActions {
  setMessageScrollPosition: (position: number) => void;
  setMessageHighlightIds: (ids: string[]) => void;
  clearMessageHighlights: () => void;
}

export type MessageSlice = MessageSliceState & MessageSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialMessageState: MessageSliceState = {
  messageScrollPosition: 0,
  messageHighlightIds: [],
};
