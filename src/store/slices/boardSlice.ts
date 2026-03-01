/**
 * Board Slice
 *
 * Manages the board view state:
 * - boardViewMode: layout style for the board (timeline, grid, compact)
 * - boardSelectedSessionId: which session card is currently selected
 * - boardExpandedCards: list of card IDs that are expanded
 */

// ============================================================================
// State Interface
// ============================================================================

export interface BoardSliceState {
  /** Layout style for the board view */
  boardViewMode: 'timeline' | 'grid' | 'compact';
  /** ID of the currently selected session card, or null */
  boardSelectedSessionId: string | null;
  /** IDs of cards that are currently expanded */
  boardExpandedCards: string[];
}

export interface BoardSliceActions {
  setBoardViewMode: (mode: 'timeline' | 'grid' | 'compact') => void;
  setBoardSelectedSessionId: (id: string | null) => void;
  setBoardExpandedCards: (ids: string[]) => void;
}

export type BoardSlice = BoardSliceState & BoardSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialBoardState: BoardSliceState = {
  boardViewMode: 'timeline',
  boardSelectedSessionId: null,
  boardExpandedCards: [],
};
