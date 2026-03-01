/**
 * useSearchState Hook
 *
 * Manages search input state with deferred updates for performance.
 */

import { useState, useEffect, useCallback, useDeferredValue } from "react";

const SEARCH_MIN_CHARS = 2;

interface UseSearchStateOptions {
  onSearchChange: (query: string) => void;
  sessionId?: string;
}

interface UseSearchStateReturn {
  searchQuery: string;
  deferredSearchQuery: string;
  isSearchPending: boolean;
  handleSearchInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearSearch: () => void;
  setSearchQuery: (query: string) => void;
}

export const useSearchState = ({
  onSearchChange,
  sessionId,
}: UseSearchStateOptions): UseSearchStateReturn => {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearchPending = searchQuery !== deferredSearchQuery;

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  useEffect(() => {
    if (deferredSearchQuery.length === 0) {
      onSearchChange("");
      return;
    }
    if (deferredSearchQuery.length < SEARCH_MIN_CHARS) return;
    onSearchChange(deferredSearchQuery);
  }, [deferredSearchQuery, onSearchChange]);

  useEffect(() => {
    setSearchQuery("");
  }, [sessionId]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    deferredSearchQuery,
    isSearchPending,
    handleSearchInput,
    handleClearSearch,
    setSearchQuery,
  };
};
