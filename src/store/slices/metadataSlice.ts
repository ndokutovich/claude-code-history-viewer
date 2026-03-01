/**
 * Metadata Slice
 *
 * Manages session metadata caching and persistence state:
 * - sessionMetadataCache: in-memory cache keyed by session ID
 * - isSavingMetadata: whether a metadata save is in progress
 */

// ============================================================================
// State Interface
// ============================================================================

export interface MetadataSliceState {
  /** In-memory cache of session metadata, keyed by session ID */
  sessionMetadataCache: Record<string, unknown>;
  /** Whether a metadata save operation is currently in progress */
  isSavingMetadata: boolean;
}

export interface MetadataSliceActions {
  setSessionMetadataCache: (cache: Record<string, unknown>) => void;
  setIsSavingMetadata: (saving: boolean) => void;
  clearMetadataCache: () => void;
}

export type MetadataSlice = MetadataSliceState & MetadataSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialMetadataState: MetadataSliceState = {
  sessionMetadataCache: {},
  isSavingMetadata: false,
};
