/**
 * Metadata Slice (v1.9.0)
 *
 * Manages session and project metadata caching and persistence.
 * All writes go through the Rust backend (invoke) which atomically
 * persists changes to ~/.claude-history-viewer/metadata.json.
 *
 * State:
 *   sessionMetadataCache  – in-memory cache keyed by session_id
 *   projectMetadataCache  – in-memory cache keyed by project path
 *   isSavingMetadata      – true while any async write is in-flight
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types matching Rust structs in src-tauri/src/models.rs
// ============================================================================

export interface SessionMeta {
  session_id: string;
  custom_name?: string;
  starred: boolean;
  tags: string[];
  notes?: string;
  /** Whether to display the session's real Claude-generated name */
  has_claude_code_name: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectMeta {
  path: string;
  hidden: boolean;
  custom_name?: string;
  tags: string[];
  updated_at: string;
}

export interface AppMetadata {
  sessions: Record<string, SessionMeta>;
  projects: Record<string, ProjectMeta>;
  version: number;
}

// ============================================================================
// State Interface
// ============================================================================

export interface MetadataSliceState {
  /** In-memory cache of session metadata, keyed by session_id */
  sessionMetadataCache: Record<string, SessionMeta>;
  /** In-memory cache of project metadata, keyed by project path */
  projectMetadataCache: Record<string, ProjectMeta>;
  /** Whether a metadata save operation is currently in progress */
  isSavingMetadata: boolean;
}

// ============================================================================
// Actions Interface
// ============================================================================

export interface MetadataSliceActions {
  // --- Cache loading (read from backend) ---
  loadSessionMetadata: (sessionId: string) => Promise<void>;
  loadProjectMetadata: (projectPath: string) => Promise<void>;
  loadAllMetadata: () => Promise<void>;

  // --- Session writes (persisted via backend) ---
  setSessionCustomName: (sessionId: string, name: string | undefined) => Promise<void>;
  setSessionStarred: (sessionId: string, starred: boolean) => Promise<void>;
  setSessionHasClaudeCodeName: (sessionId: string, value: boolean) => Promise<void>;
  addSessionTag: (sessionId: string, tag: string) => Promise<void>;
  removeSessionTag: (sessionId: string, tag: string) => Promise<void>;
  setSessionNotes: (sessionId: string, notes: string | undefined) => Promise<void>;

  // --- Project writes (persisted via backend) ---
  setProjectHidden: (projectPath: string, hidden: boolean) => Promise<void>;
  setProjectCustomName: (projectPath: string, name: string | undefined) => Promise<void>;

  // --- Housekeeping ---
  clearMetadataCache: () => void;
  /** @deprecated Use setIsSavingMetadata */
  setSessionMetadataCache: (cache: Record<string, unknown>) => void;
  setIsSavingMetadata: (saving: boolean) => void;
}

export type MetadataSlice = MetadataSliceState & MetadataSliceActions;

// ============================================================================
// Initial State
// ============================================================================

export const initialMetadataState: MetadataSliceState = {
  sessionMetadataCache: {},
  projectMetadataCache: {},
  isSavingMetadata: false,
};

// ============================================================================
// Helper: build a default SessionMeta skeleton for a session that has no
// cached entry yet.
// ============================================================================

function defaultSessionMeta(sessionId: string): SessionMeta {
  const now = new Date().toISOString();
  return {
    session_id: sessionId,
    starred: false,
    tags: [],
    has_claude_code_name: false,
    created_at: now,
    updated_at: now,
  };
}

// ============================================================================
// Action implementations (used by useAppStore)
// ============================================================================

/**
 * Creates the metadata slice actions bound to a Zustand `set`/`get` pair.
 *
 * Usage inside useAppStore:
 *   ...createMetadataActions(set, get),
 */
export function createMetadataActions(
  set: (partial: Partial<MetadataSliceState>) => void,
  get: () => MetadataSliceState,
): MetadataSliceActions {
  const markSaving = (saving: boolean) => set({ isSavingMetadata: saving });

  const withSaving = async (fn: () => Promise<void>) => {
    markSaving(true);
    try {
      await fn();
    } finally {
      markSaving(false);
    }
  };

  // Merge a single session entry into the cache
  const mergeSession = (sessionId: string, patch: Partial<SessionMeta>) => {
    const state = get();
    const existing = state.sessionMetadataCache[sessionId] ?? defaultSessionMeta(sessionId);
    set({
      sessionMetadataCache: {
        ...state.sessionMetadataCache,
        [sessionId]: { ...existing, ...patch, updated_at: new Date().toISOString() },
      },
    });
  };

  // Merge a single project entry into the cache
  const mergeProject = (projectPath: string, patch: Partial<ProjectMeta>) => {
    const state = get();
    const existing = state.projectMetadataCache[projectPath] ?? {
      path: projectPath,
      hidden: false,
      tags: [],
      updated_at: new Date().toISOString(),
    };
    set({
      projectMetadataCache: {
        ...state.projectMetadataCache,
        [projectPath]: { ...existing, ...patch, updated_at: new Date().toISOString() },
      },
    });
  };

  return {
    // ---- Load helpers ----

    loadSessionMetadata: async (sessionId: string) => {
      try {
        const meta = await invoke<SessionMeta | null>("get_session_metadata", { sessionId });
        if (meta) {
          const state = get();
          set({
            sessionMetadataCache: { ...state.sessionMetadataCache, [sessionId]: meta },
          });
        }
      } catch {
        // Metadata is best-effort; silently ignore errors
      }
    },

    loadProjectMetadata: async (projectPath: string) => {
      try {
        const meta = await invoke<ProjectMeta | null>("get_project_metadata", { projectPath });
        if (meta) {
          const state = get();
          set({
            projectMetadataCache: { ...state.projectMetadataCache, [projectPath]: meta },
          });
        }
      } catch {
        // Best-effort
      }
    },

    loadAllMetadata: async () => {
      try {
        const all = await invoke<AppMetadata>("get_all_metadata");
        set({
          sessionMetadataCache: all.sessions,
          projectMetadataCache: all.projects,
        });
      } catch {
        // Best-effort
      }
    },

    // ---- Session writes ----

    setSessionCustomName: async (sessionId, name) => {
      await withSaving(async () => {
        await invoke("set_session_custom_name", { sessionId, name: name ?? null });
        mergeSession(sessionId, { custom_name: name });
      });
    },

    setSessionStarred: async (sessionId, starred) => {
      await withSaving(async () => {
        await invoke("set_session_starred", { sessionId, starred });
        mergeSession(sessionId, { starred });
      });
    },

    setSessionHasClaudeCodeName: async (sessionId, value) => {
      await withSaving(async () => {
        await invoke("set_session_has_claude_code_name", { sessionId, value });
        mergeSession(sessionId, { has_claude_code_name: value });
      });
    },

    addSessionTag: async (sessionId, tag) => {
      await withSaving(async () => {
        await invoke("add_session_tag", { sessionId, tag });
        const state = get();
        const existing = state.sessionMetadataCache[sessionId];
        const oldTags = existing?.tags ?? [];
        if (!oldTags.includes(tag)) {
          mergeSession(sessionId, { tags: [...oldTags, tag] });
        }
      });
    },

    removeSessionTag: async (sessionId, tag) => {
      await withSaving(async () => {
        await invoke("remove_session_tag", { sessionId, tag });
        const state = get();
        const existing = state.sessionMetadataCache[sessionId];
        const tags = (existing?.tags ?? []).filter((t) => t !== tag);
        mergeSession(sessionId, { tags });
      });
    },

    setSessionNotes: async (sessionId, notes) => {
      await withSaving(async () => {
        await invoke("set_session_notes", { sessionId, notes: notes ?? null });
        mergeSession(sessionId, { notes });
      });
    },

    // ---- Project writes ----

    setProjectHidden: async (projectPath, hidden) => {
      await withSaving(async () => {
        await invoke("set_project_hidden", { projectPath, hidden });
        mergeProject(projectPath, { hidden });
      });
    },

    setProjectCustomName: async (projectPath, name) => {
      await withSaving(async () => {
        await invoke("set_project_custom_name", { projectPath, name: name ?? null });
        mergeProject(projectPath, { custom_name: name });
      });
    },

    // ---- Housekeeping ----

    clearMetadataCache: () =>
      set({ sessionMetadataCache: {}, projectMetadataCache: {} }),

    /** @deprecated Kept for backward-compatibility with old slice shape */
    setSessionMetadataCache: (cache) =>
      set({ sessionMetadataCache: cache as Record<string, SessionMeta> }),

    setIsSavingMetadata: (saving) => set({ isSavingMetadata: saving }),
  };
}
