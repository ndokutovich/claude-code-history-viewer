/**
 * Capture Mode Slice
 *
 * Manages the screenshot/capture mode feature:
 * - isCaptureMode: whether capture mode is active
 * - hiddenMessageIds: messages hidden during capture (by UUID)
 * - hiddenSessionIds: sessions hidden during capture (by session ID)
 * - hiddenProjectPaths: projects hidden during capture (by path)
 *
 * In capture mode users can selectively hide messages, sessions, and
 * projects before taking a screenshot. Hidden items are tracked and
 * can be restored individually or all at once.
 */

// ============================================================================
// State Interface
// ============================================================================

export interface CaptureModeSliceState {
  /** Whether capture mode is currently active */
  isCaptureMode: boolean;
  /** UUIDs of messages hidden during capture mode */
  hiddenMessageIds: string[];
  /** Session IDs hidden during capture mode */
  hiddenSessionIds: string[];
  /** Project paths hidden during capture mode */
  hiddenProjectPaths: string[];
}

export interface CaptureModeSliceActions {
  enterCaptureMode: () => void;
  exitCaptureMode: () => void;
  hideMessage: (uuid: string) => void;
  showMessage: (uuid: string) => void;
  restoreMessages: (uuids: string[]) => void;
  restoreAllMessages: () => void;
  isMessageHidden: (uuid: string) => boolean;
  getHiddenMessageCount: () => number;
  hideSession: (sessionId: string) => void;
  showSession: (sessionId: string) => void;
  hideProject: (projectPath: string) => void;
  showProject: (projectPath: string) => void;
  restoreAll: () => void;
  getTotalHiddenCount: () => number;
}

export type CaptureModeSlice = CaptureModeSliceState & CaptureModeSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialCaptureModeState: CaptureModeSliceState = {
  isCaptureMode: false,
  hiddenMessageIds: [],
  hiddenSessionIds: [],
  hiddenProjectPaths: [],
};
