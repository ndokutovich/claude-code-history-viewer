/**
 * useSmartUpdater Hook
 *
 * Wraps the base useUpdater hook with smart scheduling logic.
 * Provides a convenience API for components that need update functionality.
 */

import { useCallback } from "react";
import { useUpdater, type UseUpdaterReturn } from "./useUpdater";

export interface UseSmartUpdaterReturn extends UseUpdaterReturn {
  /** Check for updates with optional force flag to bypass cooldown */
  smartCheckForUpdates: (force?: boolean) => Promise<void>;
}

export function useSmartUpdater(): UseSmartUpdaterReturn {
  const updater = useUpdater();

  const smartCheckForUpdates = useCallback(
    async (force?: boolean) => {
      if (!force && updater.state.isChecking) {
        return;
      }
      await updater.checkForUpdates();
    },
    [updater]
  );

  return {
    ...updater,
    smartCheckForUpdates,
  };
}
