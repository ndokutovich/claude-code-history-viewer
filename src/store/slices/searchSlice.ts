/**
 * Search Slice
 *
 * Handles two distinct search features:
 *
 * 1. **Global search** (searchQuery / searchResults / searchFilters):
 *    Cross-project full-text search via backend invoke commands.
 *
 * 2. **Session search** (sessionSearch):
 *    KakaoTalk-style in-session message navigation using FlexSearch index.
 *    Supports next/prev/jump-to-index navigation with match highlighting.
 */

import type { UIMessage, SearchFilters } from "../../types";
import type { SearchState, SearchFilterType, SearchMatch } from "./types";
import { createEmptySearchState } from "./types";

// ============================================================================
// State Interface
// ============================================================================

/**
 * Search slice state.
 *
 * Note: `searchQuery`, `searchResults`, and `searchFilters` are also declared
 * in `AppState` (types/index.ts). They are listed here for documentation
 * completeness and to define the initial values.
 *
 * `sessionSearch` is NEW state not in `AppState`.
 */
export interface SearchSliceState {
  /** Global search query string */
  searchQuery: string;
  /** Global search results from backend */
  searchResults: UIMessage[];
  /** Global search filter configuration */
  searchFilters: SearchFilters;
  /** In-session search state (KakaoTalk-style navigation) */
  sessionSearch: SearchState;
}

/**
 * New state introduced by the search slice (not in AppState).
 * Use this type when you need only the novel fields.
 */
export interface SearchSliceNewState {
  /** In-session search state (KakaoTalk-style navigation) */
  sessionSearch: SearchState;
}

export interface SearchSliceActions {
  /** Set global search filter config */
  setSearchFilters: (filters: SearchFilters) => void;
  /** Run in-session search and build match list */
  setSessionSearchQuery: (query: string) => void;
  /** Change the in-session search filter type (content | toolId) */
  setSearchFilterType: (filterType: SearchFilterType) => void;
  /** Navigate to the next match in session search */
  goToNextMatch: () => void;
  /** Navigate to the previous match in session search */
  goToPrevMatch: () => void;
  /** Jump directly to a specific match index */
  goToMatchIndex: (index: number) => void;
  /** Clear session search state */
  clearSessionSearch: () => void;
  /** Rebuild the FlexSearch index from the current message list */
  rebuildSearchIndex: () => void;
}

export type SearchSlice = SearchSliceState & SearchSliceActions;

// ============================================================================
// Exported helpers (re-exported for convenience)
// ============================================================================

export type { SearchState, SearchFilterType, SearchMatch };
export { createEmptySearchState };

// ============================================================================
// Initial State
// ============================================================================

export const initialSearchState: SearchSliceState = {
  searchQuery: "",
  searchResults: [],
  searchFilters: {},
  sessionSearch: createEmptySearchState(),
};
