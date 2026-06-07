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
  /**
   * Absolute paths to additional/alternate Claude configuration directories
   * (in addition to the default ~/.claude). Persisted in settings storage and
   * included in project scanning/aggregation.
   */
  customClaudeDirs: string[];
}

export interface SettingsSliceActions {
  /** Update the font scale (percent) and persist to storage */
  setFontScale: (scale: number) => void;
  /** Toggle high-contrast mode and persist to storage */
  setHighContrast: (value: boolean) => void;
  /** Load persisted custom Claude directories from storage into state */
  loadCustomClaudeDirs: () => Promise<void>;
  /** Add a custom Claude configuration directory (deduplicated) and persist */
  addCustomClaudeDir: (path: string) => Promise<void>;
  /** Remove a custom Claude configuration directory and persist */
  removeCustomClaudeDir: (path: string) => Promise<void>;
}

export type SettingsSlice = SettingsSliceState & SettingsSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialSettingsState: SettingsSliceState = {
  fontScale: 100,
  highContrast: false,
  customClaudeDirs: [],
};

/** Storage key (settings.json) for persisted custom Claude directories. */
export const CUSTOM_CLAUDE_DIRS_KEY = "customClaudeDirs";
