/**
 * File Activity Slice
 *
 * Manages file activity tracking state (files touched during sessions).
 */

import { invoke } from "@tauri-apps/api/core";
import type { StateCreator } from "zustand";
import type { FullAppStore } from "./types";
import type { FileActivity, FileActivityFilters } from "../../types";

// ============================================================================
// State Interface
// ============================================================================

export interface FileActivitySliceState {
  fileActivities: FileActivity[];
  fileActivityFilters: FileActivityFilters;
  isLoadingFileActivities: boolean;
  fileActivityError: string | null;
}

export interface FileActivitySliceActions {
  loadFileActivities: (sessionId: string, projectPath: string) => Promise<void>;
  setFileActivityFilters: (filters: Partial<FileActivityFilters>) => void;
  clearFileActivities: () => void;
}

export type FileActivitySlice = FileActivitySliceState & FileActivitySliceActions;

// ============================================================================
// Initial State
// ============================================================================

const initialFileActivityState: FileActivitySliceState = {
  fileActivities: [],
  fileActivityFilters: {},
  isLoadingFileActivities: false,
  fileActivityError: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createFileActivitySlice: StateCreator<
  FullAppStore,
  [],
  [],
  FileActivitySlice
> = (set) => ({
  ...initialFileActivityState,

  loadFileActivities: async (sessionId: string, projectPath: string) => {
    set({ isLoadingFileActivities: true, fileActivityError: null });
    try {
      const activities = await invoke<FileActivity[]>("get_file_activities", {
        sessionId,
        projectPath,
      });
      set({ fileActivities: activities });
    } catch (error) {
      console.error("Failed to load file activities:", error);
      set({ fileActivityError: String(error) });
    } finally {
      set({ isLoadingFileActivities: false });
    }
  },

  setFileActivityFilters: (filters) =>
    set((state) => ({
      fileActivityFilters: { ...state.fileActivityFilters, ...filters },
    })),

  clearFileActivities: () => set(initialFileActivityState),
});
