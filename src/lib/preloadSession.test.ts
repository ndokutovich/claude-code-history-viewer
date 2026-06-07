import { describe, it, expect, vi } from "vitest";
import {
  preloadSessionFromHint,
  navigateToResolvedSession,
  type PreloadDeps,
} from "./preloadSession";
import type { ResolvedSessionMatch } from "@/store/slices/sessionPickerSlice";
import type { UIProject, UISession } from "@/types";

const project = (path: string, providerId = "claude-code"): UIProject => ({
  name: path.split(/[\\/]/).pop() ?? path,
  path,
  session_count: 1,
  message_count: 1,
  lastModified: "2026-01-01T00:00:00Z",
  providerId,
});

const session = (id: string, filePath: string): UISession => ({
  session_id: id,
  actual_session_id: id,
  file_path: filePath,
  project_name: "demo",
  message_count: 3,
  first_message_time: "2026-01-01T00:00:00Z",
  last_message_time: "2026-01-02T00:00:00Z",
  last_modified: "2026-01-02T00:00:00Z",
  has_tool_use: false,
  has_errors: false,
  is_problematic: false,
  providerId: "claude-code",
});

const match = (over: Partial<ResolvedSessionMatch> = {}): ResolvedSessionMatch => ({
  providerId: "claude-code",
  sourceId: "claude-code:/home/x/.claude",
  projectPath: "/home/x/.claude/projects/demo",
  projectName: "demo",
  sessionId: "1265cd74-caa9-472e-b343-c4f44b5cf12c",
  filePath: "/home/x/.claude/projects/demo/1265cd74.jsonl",
  title: "Auth bug",
  lastMessageAt: "2026-01-02T00:00:00Z",
  messageCount: 3,
  ...over,
});

function makeDeps(over: Partial<PreloadDeps> = {}): PreloadDeps {
  return {
    resolve: vi.fn(async () => []),
    getProjects: vi.fn(() => [project("/home/x/.claude/projects/demo")]),
    loadProjectSessions: vi.fn(async () => [
      session(
        "1265cd74-caa9-472e-b343-c4f44b5cf12c",
        "/home/x/.claude/projects/demo/1265cd74.jsonl"
      ),
    ]),
    selectProject: vi.fn(async () => {}),
    selectSession: vi.fn(async () => {}),
    openSessionPicker: vi.fn(),
    notFound: vi.fn(),
    ...over,
  };
}

describe("preloadSessionFromHint", () => {
  it("is a no-op when no hint is provided", async () => {
    const deps = makeDeps();
    await preloadSessionFromHint(null, deps);
    await preloadSessionFromHint(undefined, deps);
    await preloadSessionFromHint({ kind: "uuid", value: "" }, deps);
    expect(deps.resolve).not.toHaveBeenCalled();
    expect(deps.notFound).not.toHaveBeenCalled();
  });

  it("calls notFound when nothing matches", async () => {
    const deps = makeDeps({ resolve: vi.fn(async () => []) });
    await preloadSessionFromHint({ kind: "uuid", value: "deadbeef" }, deps);
    expect(deps.notFound).toHaveBeenCalledWith("deadbeef");
    expect(deps.selectSession).not.toHaveBeenCalled();
  });

  it("navigates on a single match", async () => {
    const m = match();
    const deps = makeDeps({ resolve: vi.fn(async () => [m]) });
    await preloadSessionFromHint(
      { kind: "uuid", value: "1265cd74" },
      deps
    );
    expect(deps.selectProject).toHaveBeenCalledTimes(1);
    expect(deps.selectSession).toHaveBeenCalledTimes(1);
    expect(deps.openSessionPicker).not.toHaveBeenCalled();
  });

  it("opens the picker on multiple matches", async () => {
    const matches = [
      match({ sessionId: "1265cd74-aaaa", sourceId: "a" }),
      match({ sessionId: "1265cd74-bbbb", sourceId: "b" }),
    ];
    const deps = makeDeps({ resolve: vi.fn(async () => matches) });
    await preloadSessionFromHint({ kind: "uuid", value: "1265cd74" }, deps);
    expect(deps.openSessionPicker).toHaveBeenCalledWith(matches, "1265cd74");
    expect(deps.selectSession).not.toHaveBeenCalled();
  });

  it("falls back to notFound when a single match cannot be navigated", async () => {
    const m = match({ sessionId: "nonexistent", filePath: "/nope.jsonl" });
    const deps = makeDeps({ resolve: vi.fn(async () => [m]) });
    await preloadSessionFromHint(
      { kind: "uuid", value: "nonexistent" },
      deps
    );
    expect(deps.notFound).toHaveBeenCalled();
  });

  it("calls notFound when resolve throws", async () => {
    const deps = makeDeps({
      resolve: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await preloadSessionFromHint({ kind: "uuid", value: "1265cd74" }, deps);
    expect(deps.notFound).toHaveBeenCalledWith("1265cd74");
  });
});

describe("navigateToResolvedSession", () => {
  it("selects the parent project and the matching session", async () => {
    const m = match();
    const deps = makeDeps();
    const ok = await navigateToResolvedSession(m, deps);
    expect(ok).toBe(true);
    expect(deps.selectProject).toHaveBeenCalledTimes(1);
    expect(deps.selectSession).toHaveBeenCalledTimes(1);
  });

  it("matches by file_path when session ids differ", async () => {
    const m = match({ sessionId: "other-id" });
    const deps = makeDeps();
    const ok = await navigateToResolvedSession(m, deps);
    expect(ok).toBe(true);
  });

  it("returns false when loadProjectSessions throws", async () => {
    const m = match();
    const deps = makeDeps({
      loadProjectSessions: vi.fn(async () => {
        throw new Error("io");
      }),
    });
    const ok = await navigateToResolvedSession(m, deps);
    expect(ok).toBe(false);
  });
});
