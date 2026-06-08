/**
 * Settings Slice
 *
 * Handles user-configurable accessibility and display settings:
 * - fontScale: text size percentage (90 | 100 | 110 | 120 | 130)
 * - highContrast: accessibility high-contrast mode
 *
 * These settings are applied globally via CSS custom properties on the
 * document root. Persistence (localStorage / Tauri store) is handled
 * in the actions defined in useAppStore.
 */

// ============================================================================
// State Interface
// ============================================================================

export interface SettingsSliceState {
  /** Font scale in percent: 90 | 100 | 110 | 120 | 130 */
  fontScale: number;
  /** Whether high-contrast accessibility mode is enabled */
  highContrast: boolean;
}

export interface SettingsSliceActions {
  /** Update the font scale (percent) and persist to storage */
  setFontScale: (scale: number) => void;
  /** Toggle high-contrast mode and persist to storage */
  setHighContrast: (value: boolean) => void;
}

export type SettingsSlice = SettingsSliceState & SettingsSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialSettingsState: SettingsSliceState = {
  fontScale: 100,
  highContrast: false,
};
