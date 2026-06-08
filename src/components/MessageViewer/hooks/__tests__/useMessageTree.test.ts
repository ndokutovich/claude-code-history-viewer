import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMessageTree } from "../useMessageTree";
import type { UIMessage } from "../../../../types";

// Minimal UIMessage factory — only the fields flattenRows touches.
const msg = (uuid: string, parentUuid?: string, type = "assistant"): UIMessage =>
  ({
    uuid,
    parentUuid,
    type,
    role: type === "user" ? "user" : "assistant",
    timestamp: "2025-01-01T00:00:00.000Z",
    content: `c-${uuid}`,
  }) as unknown as UIMessage;

const keys = (rows: { message: UIMessage }[]) => rows.map((r) => r.message.uuid);

describe("useMessageTree.flattenRows — paginated window (parents off-page)", () => {
  it("does not orphan messages whose parent is not in the loaded page", () => {
    // Reproduces the blank-session bug: a paginated page (e.g. the last 100
    // messages of a huge session) contains ONE rootless message (a system /
    // compact_boundary entry) plus messages whose parents live earlier in the
    // session (off-page). The old logic switched to tree mode because a root
    // existed, then the DFS only reached the root's subtree — orphaning every
    // off-page-parented message → a near-blank list.
    const messages: UIMessage[] = [
      msg("boundary", undefined, "system"), // lone in-page root
      msg("a", "off-page-1"), // parent not in page
      msg("b", "off-page-2"), // parent not in page
      msg("c", "boundary"), // in-page child of the root
      msg("d", "a"), // in-page child of an off-page-parented msg
    ];

    const { result } = renderHook(() => useMessageTree(messages));
    const rows = result.current.flattenRows(null);

    // EVERY loaded message must appear exactly once — none orphaned.
    expect(new Set(keys(rows))).toEqual(
      new Set(["boundary", "a", "b", "c", "d"])
    );
    expect(rows).toHaveLength(5);
  });

  it("preserves in-page parent→child nesting depth", () => {
    const messages: UIMessage[] = [
      msg("boundary", undefined, "system"),
      msg("a", "off-page-1"),
      msg("c", "boundary"),
      msg("d", "a"),
    ];
    const { result } = renderHook(() => useMessageTree(messages));
    const rows = result.current.flattenRows(null);
    const depthByUuid = new Map(rows.map((r) => [r.message.uuid, r.depth]));

    // Roots (rootless OR off-page parent) sit at depth 0; their in-page
    // children nest one level deeper.
    expect(depthByUuid.get("boundary")).toBe(0);
    expect(depthByUuid.get("a")).toBe(0); // off-page parent → treated as root
    expect(depthByUuid.get("c")).toBe(1); // child of boundary
    expect(depthByUuid.get("d")).toBe(1); // child of a
  });

  it("still renders a fully in-page tree as a tree (no regression)", () => {
    const messages: UIMessage[] = [
      msg("root", undefined, "user"),
      msg("child", "root"),
      msg("grandchild", "child"),
    ];
    const { result } = renderHook(() => useMessageTree(messages));
    const rows = result.current.flattenRows(null);
    expect(keys(rows)).toEqual(["root", "child", "grandchild"]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2]);
  });
});
