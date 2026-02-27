/**
 * Export Slice
 *
 * Manages conversation export state (Markdown, HTML, DOCX).
 */

import type { StateCreator } from "zustand";
import type { FullAppStore } from "./types";

// ============================================================================
// State Interface
// ============================================================================

export interface ExportSliceState {
  isExporting: boolean;
  exportError: string | null;
  lastExportFormat: "markdown" | "html" | "docx" | null;
}

export interface ExportSliceActions {
  setIsExporting: (value: boolean) => void;
  setExportError: (error: string | null) => void;
  setLastExportFormat: (format: "markdown" | "html" | "docx") => void;
  clearExportState: () => void;
}

export type ExportSlice = ExportSliceState & ExportSliceActions;

// ============================================================================
// Initial State
// ============================================================================

const initialExportState: ExportSliceState = {
  isExporting: false,
  exportError: null,
  lastExportFormat: null,
};

// ============================================================================
// Slice Creator
// ============================================================================

export const createExportSlice: StateCreator<
  FullAppStore,
  [],
  [],
  ExportSlice
> = (set) => ({
  ...initialExportState,

  setIsExporting: (value) => set({ isExporting: value }),
  setExportError: (error) => set({ exportError: error }),
  setLastExportFormat: (format) => set({ lastExportFormat: format }),
  clearExportState: () => set(initialExportState),
});
