/**
 * Navigation Slice
 *
 * Handles view state and view-switching logic:
 * - currentView: which main view is displayed (messages, analytics, tokenStats, etc.)
 * - viewPreferences: persistence configuration for view selection
 *
 * DESIGN PRINCIPLE: Only explicit user actions (switchView) should change
 * currentView. selectProject / selectSession deliberately do NOT change it,
 * preserving the user's last-chosen view across navigation.
 */

import type { AppView } from "../../types";

// ============================================================================
// Local Types
// ============================================================================

export interface ViewPreferences {
  /** Last view the user explicitly selected */
  lastSelectedView: AppView;
  /** Whether to preserve view when switching projects (default: true) */
  preserveViewOnProjectSwitch: boolean;
  /** Whether to preserve view when switching sessions (default: true) */
  preserveViewOnSessionSwitch: boolean;
}

// ============================================================================
// State Interface
// ============================================================================

/**
 * Navigation slice state.
 * Note: `currentView` is already declared in AppState (types/index.ts).
 * This slice declares only the viewPreferences extension.
 */
export interface NavigationSliceState {
  /** User's persisted view preferences (NOT the same as currentView) */
  viewPreferences: ViewPreferences;
}

export interface NavigationSliceActions {
  setViewPreferences: (preferences: Partial<ViewPreferences>) => void;
}

export type NavigationSlice = NavigationSliceState & NavigationSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialNavigationState: NavigationSliceState & { currentView: AppView } = {
  currentView: "messages",
  viewPreferences: {
    lastSelectedView: "messages",
    preserveViewOnProjectSwitch: true,
    preserveViewOnSessionSwitch: true,
  },
};
