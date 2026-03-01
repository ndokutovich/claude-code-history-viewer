/**
 * Shared types for store slices.
 * Extracted so that renderers/registry can import SearchFilterType
 * without a circular dependency on the full store.
 */

import type { UIMessage } from "../../types";

/** Filter scope for in-session search */
export type SearchFilterType = "content" | "toolId";

/** A single match within a message */
export interface SearchMatch {
  messageUuid: string;
  messageIndex: number;
  matchIndex: number;
  matchCount: number;
}

/** Full session search state */
export interface SearchState {
  query: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  isSearching: boolean;
  filterType: SearchFilterType;
  /** @deprecated use matches instead */
  results: UIMessage[];
}

/** Factory to create an empty search state with a given filter type */
export const createEmptySearchState = (
  filterType: SearchFilterType = "content"
): SearchState => ({
  query: "",
  matches: [],
  currentMatchIndex: -1,
  isSearching: false,
  filterType,
  results: [],
});
