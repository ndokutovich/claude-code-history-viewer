import { useEffect } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { MessageRowDescriptor } from "../types";
import { findPromptJumpIndex } from "../helpers/promptJump";

interface UsePromptJumpArgs {
  rows: MessageRowDescriptor[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  /** Scroll a row index into view (viewer's own jump helper). */
  scrollToIndex: (index: number, align: "center" | "start" | "end") => void;
}

/**
 * Alt+ArrowUp / Alt+ArrowDown (Option on macOS) move the message list to
 * the previous or next turn start among the loaded rows (upstream #629).
 * Acts on the top visible row so the jump feels anchored to what the user
 * is reading.
 */
export function usePromptJump({ rows, virtualizer, scrollToIndex }: UsePromptJumpArgs): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

      const direction: -1 | 1 = event.key === "ArrowUp" ? -1 : 1;
      const visibleStart = virtualizer.range?.startIndex ?? 0;
      const target = findPromptJumpIndex(rows, visibleStart, direction);
      if (target === null) return;

      event.preventDefault();
      scrollToIndex(target, direction === -1 ? "start" : "center");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, virtualizer, scrollToIndex]);
}
