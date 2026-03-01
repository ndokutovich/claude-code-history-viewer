import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isAbsolutePath } from "@/utils/pathUtils";

export interface NativeRenameResult {
  success: boolean;
  previous_title: string;
  new_title: string;
  file_path: string;
}

export interface UseNativeRenameReturn {
  isRenaming: boolean;
  error: string | null;
  renameNative: (
    filePath: string,
    newTitle: string
  ) => Promise<NativeRenameResult>;
  resetNativeName: (filePath: string) => Promise<NativeRenameResult>;
}

/**
 * Hook for native Claude Code session renaming operations.
 *
 * This hook provides functionality to rename sessions at the file level,
 * making the rename visible in Claude Code CLI.
 *
 * @example
 * ```tsx
 * const { renameNative, isRenaming, error } = useNativeRename();
 *
 * const handleRename = async () => {
 *   try {
 *     const result = await renameNative(session.file_path, "My New Title");
 *     toast.success(`Renamed: ${result.new_title}`);
 *   } catch (err) {
 *     toast.error(`Failed: ${err}`);
 *   }
 * };
 * ```
 */
export const useNativeRename = (): UseNativeRenameReturn => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renameNative = useCallback(
    async (
      filePath: string,
      newTitle: string
    ): Promise<NativeRenameResult> => {
      const normalizedTitle = newTitle.trim();

      // Validate absolute path before calling backend command
      if (!filePath || !isAbsolutePath(filePath)) {
        const errorMessage = "Invalid file path: must be an absolute path";
        setError(errorMessage);
        throw new Error(errorMessage);
      }

      setIsRenaming(true);
      setError(null);

      try {
        // Dispatch to correct backend command based on file type:
        // - .json inside storage/session/ → OpenCode session (JSON file with "title" field)
        // - .jsonl → Claude Code session (JSONL file with bracketed prefix)
        const isOpenCode = filePath.endsWith('.json') &&
          (filePath.includes('/storage/session/') || filePath.includes('\\storage\\session\\'));
        const command = isOpenCode
          ? "rename_opencode_session_native"
          : "rename_session_native";

        const result = await invoke<NativeRenameResult>(command, {
          filePath,
          newTitle: normalizedTitle,
        });
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsRenaming(false);
      }
    },
    []
  );

  const resetNativeName = useCallback(
    async (filePath: string): Promise<NativeRenameResult> => {
      return renameNative(filePath, "");
    },
    [renameNative]
  );

  return {
    isRenaming,
    error,
    renameNative,
    resetNativeName,
  };
};
