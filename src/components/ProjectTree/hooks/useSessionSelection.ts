import { useCallback, useMemo, useState } from "react";

/**
 * Session multi-select for mass deletion (upstream #456).
 *
 * Selection is keyed by the session's `file_path` — the only identifier the
 * delete command accepts — so it survives re-renders that rebuild session
 * objects. Deleting runs the existing per-session command once per file and
 * reports how many succeeded, so one locked file cannot abort the batch.
 */
export interface SessionSelection {
  selectionMode: boolean;
  selectedPaths: ReadonlySet<string>;
  selectedCount: number;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggle: (filePath: string) => void;
  clear: () => void;
  isSelected: (filePath: string) => boolean;
}

export function useSessionSelection(): SessionSelection {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  const enterSelectionMode = useCallback(() => setSelectionMode(true), []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedPaths(new Set());
  }, []);

  const toggle = useCallback((filePath: string) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedPaths(new Set()), []);

  const isSelected = useCallback(
    (filePath: string) => selectedPaths.has(filePath),
    [selectedPaths]
  );

  return useMemo(
    () => ({
      selectionMode,
      selectedPaths,
      selectedCount: selectedPaths.size,
      enterSelectionMode,
      exitSelectionMode,
      toggle,
      clear,
      isSelected,
    }),
    [
      selectionMode,
      selectedPaths,
      enterSelectionMode,
      exitSelectionMode,
      toggle,
      clear,
      isSelected,
    ]
  );
}

export interface DeleteOutcome {
  deleted: number;
  failed: Array<{ filePath: string; error: string }>;
}

/**
 * Delete each selected session file via the existing single-session command.
 * Sequential on purpose: the backend trashes a file and its sidecar folder,
 * and concurrent trashes of neighbours make failure reporting ambiguous.
 */
export async function deleteSelectedSessions(
  filePaths: Iterable<string>,
  invokeDelete: (filePath: string) => Promise<unknown>
): Promise<DeleteOutcome> {
  let deleted = 0;
  const failed: Array<{ filePath: string; error: string }> = [];

  for (const filePath of filePaths) {
    try {
      await invokeDelete(filePath);
      deleted += 1;
    } catch (error) {
      failed.push({
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { deleted, failed };
}
