import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionSelection, deleteSelectedSessions } from "../components/ProjectTree/hooks/useSessionSelection";

describe("useSessionSelection (upstream #456)", () => {
  it("starts outside selection mode with nothing selected", () => {
    const { result } = renderHook(() => useSessionSelection());
    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it("toggles selection per file path", () => {
    const { result } = renderHook(() => useSessionSelection());

    act(() => result.current.enterSelectionMode());
    act(() => result.current.toggle("C:/a.jsonl"));
    act(() => result.current.toggle("C:/b.jsonl"));

    expect(result.current.selectionMode).toBe(true);
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected("C:/a.jsonl")).toBe(true);

    act(() => result.current.toggle("C:/a.jsonl"));
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected("C:/a.jsonl")).toBe(false);
  });

  it("clears selection when leaving selection mode", () => {
    const { result } = renderHook(() => useSessionSelection());

    act(() => result.current.enterSelectionMode());
    act(() => result.current.toggle("C:/a.jsonl"));
    act(() => result.current.exitSelectionMode());

    expect(result.current.selectionMode).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it("clear() keeps selection mode but empties the set", () => {
    const { result } = renderHook(() => useSessionSelection());

    act(() => result.current.enterSelectionMode());
    act(() => result.current.toggle("C:/a.jsonl"));
    act(() => result.current.clear());

    expect(result.current.selectionMode).toBe(true);
    expect(result.current.selectedCount).toBe(0);
  });
});

describe("deleteSelectedSessions", () => {
  it("deletes every path and reports the count", async () => {
    const invokeDelete = vi.fn().mockResolvedValue(undefined);

    const outcome = await deleteSelectedSessions(
      ["C:/a.jsonl", "C:/b.jsonl"],
      invokeDelete
    );

    expect(outcome.deleted).toBe(2);
    expect(outcome.failed).toEqual([]);
    expect(invokeDelete).toHaveBeenCalledTimes(2);
  });

  it("keeps going when one file fails and reports the failure", async () => {
    const invokeDelete = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("file is locked"))
      .mockResolvedValueOnce(undefined);

    const outcome = await deleteSelectedSessions(
      ["C:/a.jsonl", "C:/locked.jsonl", "C:/c.jsonl"],
      invokeDelete
    );

    expect(outcome.deleted).toBe(2);
    expect(outcome.failed).toEqual([
      { filePath: "C:/locked.jsonl", error: "file is locked" },
    ]);
  });

  it("survives a non-Error rejection", async () => {
    const invokeDelete = vi.fn().mockRejectedValueOnce("boom");

    const outcome = await deleteSelectedSessions(["C:/a.jsonl"], invokeDelete);

    expect(outcome.deleted).toBe(0);
    expect(outcome.failed[0]?.error).toBe("boom");
  });
});
