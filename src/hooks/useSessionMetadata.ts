/**
 * Session Metadata Hook (v1.9.0)
 *
 * Provides reactive access to per-session custom names, starred status,
 * tags and notes.  Writes are persisted to disk via the Rust backend.
 *
 * Usage:
 *   const { starred, toggleStarred, customName, setCustomName } =
 *     useSessionMetadata(session.session_id);
 */

import { useEffect, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";

export interface SessionMetadataState {
  customName: string | undefined;
  starred: boolean;
  tags: string[];
  notes: string | undefined;
  /** true once the metadata entry has been fetched from the backend */
  isLoaded: boolean;
  hasClaudeCodeName: boolean;
  setCustomName: (name: string | undefined) => Promise<void>;
  setHasClaudeCodeName: (value: boolean) => Promise<void>;
  toggleStarred: () => Promise<void>;
  addTag: (tag: string) => Promise<void>;
  removeTag: (tag: string) => Promise<void>;
  setNotes: (notes: string | undefined) => Promise<void>;
}

export const useSessionMetadata = (sessionId: string): SessionMetadataState => {
  const sessionMetadataCache = useAppStore((s) => s.sessionMetadataCache);
  const loadSessionMetadata = useAppStore((s) => s.loadSessionMetadata);
  const setSessionCustomName = useAppStore((s) => s.setSessionCustomName);
  const setSessionStarred = useAppStore((s) => s.setSessionStarred);
  const setSessionHasClaudeCodeName = useAppStore((s) => s.setSessionHasClaudeCodeName);
  const addSessionTag = useAppStore((s) => s.addSessionTag);
  const removeSessionTag = useAppStore((s) => s.removeSessionTag);
  const setSessionNotes = useAppStore((s) => s.setSessionNotes);

  // Eagerly load metadata for this session when the hook mounts or sessionId changes
  useEffect(() => {
    if (sessionId) {
      void loadSessionMetadata(sessionId);
    }
  }, [sessionId, loadSessionMetadata]);

  const meta = sessionId ? sessionMetadataCache[sessionId] : undefined;

  const setCustomName = useCallback(
    (name: string | undefined) => setSessionCustomName(sessionId, name),
    [sessionId, setSessionCustomName],
  );

  const setHasClaudeCodeName = useCallback(
    (value: boolean) => setSessionHasClaudeCodeName(sessionId, value),
    [sessionId, setSessionHasClaudeCodeName],
  );

  const toggleStarred = useCallback(
    () => setSessionStarred(sessionId, !(meta?.starred ?? false)),
    [sessionId, setSessionStarred, meta?.starred],
  );

  const addTag = useCallback(
    (tag: string) => addSessionTag(sessionId, tag),
    [sessionId, addSessionTag],
  );

  const removeTag = useCallback(
    (tag: string) => removeSessionTag(sessionId, tag),
    [sessionId, removeSessionTag],
  );

  const setNotes = useCallback(
    (notes: string | undefined) => setSessionNotes(sessionId, notes),
    [sessionId, setSessionNotes],
  );

  return {
    customName: meta?.custom_name,
    starred: meta?.starred ?? false,
    tags: meta?.tags ?? [],
    notes: meta?.notes,
    isLoaded: meta !== undefined,
    hasClaudeCodeName: meta?.has_claude_code_name ?? false,
    setCustomName,
    setHasClaudeCodeName,
    toggleStarred,
    addTag,
    removeTag,
    setNotes,
  };
};

/**
 * Returns the effective display name for a session:
 *   1. custom_name if set and has_claude_code_name is false
 *   2. fallback (usually the session summary) otherwise
 */
export const useSessionDisplayName = (
  sessionId: string,
  fallback?: string,
): string | undefined => {
  const meta = useAppStore((s) => s.sessionMetadataCache[sessionId]);

  if (meta?.custom_name && !meta.has_claude_code_name) {
    return meta.custom_name;
  }
  return fallback;
};
