/**
 * Navigator Slice
 *
 * Manages the navigator panel (sidebar) state:
 * - navigatorOpen: whether the panel is visible
 * - navigatorWidth: current width of the panel in pixels
 * - navigatorActiveId: ID of the currently active navigation item
 */

// ============================================================================
// State Interface
// ============================================================================

export interface NavigatorSliceState {
  /** Whether the navigator panel is open */
  navigatorOpen: boolean;
  /** Width of the navigator panel in pixels */
  navigatorWidth: number;
  /** ID of the currently active item in the navigator, or null */
  navigatorActiveId: string | null;
}

export interface NavigatorSliceActions {
  setNavigatorOpen: (open: boolean) => void;
  setNavigatorWidth: (width: number) => void;
  setNavigatorActiveId: (id: string | null) => void;
  toggleNavigator: () => void;
}

export type NavigatorSlice = NavigatorSliceState & NavigatorSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialNavigatorState: NavigatorSliceState = {
  navigatorOpen: false,
  navigatorWidth: 280,
  navigatorActiveId: null,
};
