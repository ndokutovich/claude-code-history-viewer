/**
 * Watcher Slice
 *
 * Manages file system watcher state:
 * - isWatchingEnabled: whether the file watcher is active
 * - watcherError: error message from the last watcher failure, or null
 * - lastWatcherSyncTime: epoch timestamp of the last successful sync event
 */

// ============================================================================
// State Interface
// ============================================================================

export interface WatcherSliceState {
  /** Whether the file system watcher is currently enabled */
  isWatchingEnabled: boolean;
  /** Error message from the last watcher failure, or null */
  watcherError: string | null;
  /** Epoch timestamp (ms) of the last successful sync, or null if never synced */
  lastWatcherSyncTime: number | null;
}

export interface WatcherSliceActions {
  setIsWatchingEnabled: (enabled: boolean) => void;
  setWatcherError: (error: string | null) => void;
  setLastWatcherSyncTime: (time: number | null) => void;
}

export type WatcherSlice = WatcherSliceState & WatcherSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialWatcherState: WatcherSliceState = {
  isWatchingEnabled: false,
  watcherError: null,
  lastWatcherSyncTime: null,
};
