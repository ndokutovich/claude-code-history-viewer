/**
 * CLI session-launch resolution (frontend side).
 *
 * Given a {@link SessionHint} delivered by the backend (either at startup via
 * `get_startup_session_hint` or on a single-instance re-invocation via the
 * `cli-session-hint` event), resolve it to a concrete session and navigate
 * there. When a UUID prefix matches more than one session, open the picker
 * modal instead.
 *
 * All side effects are injected via {@link PreloadDeps} so the logic is unit
 * testable without Tauri or the Zustand store.
 */

import type { UIProject, UISession } from "@/types";
import type { ResolvedSessionMatch } from "@/store/slices/sessionPickerSlice";

/** A CLI hint mirroring the Rust `SessionHint` (serde camelCase). */
export interface SessionHint {
  kind: "uuid" | "path";
  value: string;
}

export interface PreloadDeps {
  /** Resolve a hint value to candidate sessions (calls `resolve_session_by_id`). */
  resolve: (value: string) => Promise<ResolvedSessionMatch[]>;
  /** Current projects from the store. */
  getProjects: () => UIProject[];
  /** Load (and cache) the sessions for a project path. */
  loadProjectSessions: (projectPath: string) => Promise<UISession[]>;
  /** Select a project. */
  selectProject: (project: UIProject) => Promise<void>;
  /** Select a session. */
  selectSession: (session: UISession) => Promise<void>;
  /** Open the disambiguation picker for multiple matches. */
  openSessionPicker: (
    candidates: ResolvedSessionMatch[],
    hintValue: string
  ) => void;
  /** Notify the user that nothing matched the hint. */
  notFound: (value: string) => void;
}

/**
 * Navigate to a single resolved session: select its parent project (if known),
 * load that project's sessions, find the concrete UISession, and select it.
 *
 * Returns `true` when navigation succeeded, `false` when the session could not
 * be located (stale resolve, project filtered out, etc.).
 */
export async function navigateToResolvedSession(
  match: ResolvedSessionMatch,
  deps: Pick<
    PreloadDeps,
    "getProjects" | "loadProjectSessions" | "selectProject" | "selectSession"
  >
): Promise<boolean> {
  const project = deps
    .getProjects()
    .find(
      (p) =>
        p.path === match.projectPath &&
        (p.providerId === undefined || p.providerId === match.providerId)
    );

  if (project) {
    await deps.selectProject(project);
  }

  let sessions: UISession[];
  try {
    sessions = await deps.loadProjectSessions(match.projectPath);
  } catch {
    return false;
  }

  const target = sessions.find(
    (s) =>
      s.session_id === match.sessionId ||
      s.actual_session_id === match.sessionId ||
      s.file_path === match.filePath
  );

  if (!target) {
    return false;
  }

  await deps.selectSession(target);
  return true;
}

/**
 * Resolve and act on a CLI session hint.
 *
 * - 0 matches → `notFound`
 * - 1 match   → navigate (falls back to `notFound` if navigation fails)
 * - >1 match  → open the picker modal
 */
export async function preloadSessionFromHint(
  hint: SessionHint | null | undefined,
  deps: PreloadDeps
): Promise<void> {
  if (!hint || !hint.value) {
    return;
  }

  let matches: ResolvedSessionMatch[];
  try {
    matches = await deps.resolve(hint.value);
  } catch (error) {
    console.error("[preloadSession] resolve failed:", error);
    deps.notFound(hint.value);
    return;
  }

  if (matches.length === 0) {
    deps.notFound(hint.value);
    return;
  }

  if (matches.length === 1) {
    const ok = await navigateToResolvedSession(matches[0]!, deps);
    if (!ok) {
      deps.notFound(hint.value);
    }
    return;
  }

  deps.openSessionPicker(matches, hint.value);
}
