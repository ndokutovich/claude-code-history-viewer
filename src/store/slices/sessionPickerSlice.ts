/**
 * Session Picker Slice
 *
 * Backs the disambiguation modal used by the CLI session-launch feature
 * (`--session <uuid>`). When a UUID prefix resolves to more than one session,
 * the candidates are stashed here and the SessionPickerModal renders them so
 * the user can choose one.
 */

/**
 * A session located by the backend `resolve_session_by_id` command. Field
 * names mirror the Rust `ResolvedSession` struct (serde camelCase).
 */
export interface ResolvedSessionMatch {
  providerId: string;
  sourceId: string;
  projectPath: string;
  projectName: string;
  sessionId: string;
  filePath: string;
  title: string;
  lastMessageAt: string;
  messageCount: number;
}

// ============================================================================
// State Interface
// ============================================================================

export interface SessionPickerSliceState {
  /** Candidate sessions when a CLI hint matched more than one; null = closed. */
  sessionPickerCandidates: ResolvedSessionMatch[] | null;
  /** The raw CLI value that produced the candidates (used in the modal header). */
  sessionPickerHintValue: string | null;
}

export interface SessionPickerSliceActions {
  openSessionPicker: (
    candidates: ResolvedSessionMatch[],
    hintValue: string
  ) => void;
  closeSessionPicker: () => void;
}

export type SessionPickerSlice = SessionPickerSliceState &
  SessionPickerSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialSessionPickerState: SessionPickerSliceState = {
  sessionPickerCandidates: null,
  sessionPickerHintValue: null,
};
