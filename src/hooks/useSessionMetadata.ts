/**
 * Session Metadata Hook (stub)
 *
 * Provides access to session custom names, starred status, tags, and notes.
 * Currently returns no-op implementations until the metadata store is wired.
 */

import { useCallback, useMemo } from "react";

export interface SessionMetadataState {
  customName: string | undefined;
  starred: boolean;
  tags: string[];
  notes: string | undefined;
  isLoaded: boolean;
  hasClaudeCodeName: boolean;
  setCustomName: (name: string | undefined) => Promise<void>;
  setHasClaudeCodeName: (value: boolean) => Promise<void>;
  toggleStarred: () => Promise<void>;
  addTag: (tag: string) => Promise<void>;
  removeTag: (tag: string) => Promise<void>;
  setNotes: (notes: string | undefined) => Promise<void>;
}

const noop = async () => {};

export const useSessionMetadata = (_sessionId: string): SessionMetadataState => {
  const setCustomName = useCallback(noop, []);
  const setHasClaudeCodeName = useCallback(noop, []);
  const toggleStarred = useCallback(noop, []);
  const addTag = useCallback(noop, []);
  const removeTag = useCallback(noop, []);
  const setNotes = useCallback(noop, []);

  return useMemo(() => ({
    customName: undefined,
    starred: false,
    tags: [],
    notes: undefined,
    isLoaded: true,
    hasClaudeCodeName: false,
    setCustomName,
    setHasClaudeCodeName,
    toggleStarred,
    addTag,
    removeTag,
    setNotes,
  }), [setCustomName, setHasClaudeCodeName, toggleStarred, addTag, removeTag, setNotes]);
};

export const useSessionDisplayName = (
  _sessionId: string,
  fallback?: string
): string | undefined => fallback;
