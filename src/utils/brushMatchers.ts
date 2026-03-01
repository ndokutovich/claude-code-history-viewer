/**
 * Brush Matchers
 *
 * Functions to match board cards against active brush filters.
 */

export type { ActiveBrush, BrushableCard } from "@/types/board.types";
import type { ActiveBrush, BrushableCard } from "@/types/board.types";

export function matchesBrush(
  brush: ActiveBrush | null,
  card: BrushableCard
): boolean {
  if (!brush) return true;

  switch (brush.type) {
    case "model":
      return !!card.model && card.model.includes(brush.value);
    case "tool": {
      const match = (() => {
        if (brush.value === "document") {
          return (
            card.variant === "document" ||
            card.editedFiles.some(
              (f) =>
                f.toLowerCase().endsWith(".md") ||
                f.toLowerCase().endsWith(".markdown")
            )
          );
        }
        if (brush.value === "code") {
          return card.variant === "code" || card.isFileEdit;
        }
        if (brush.value === "git") {
          return card.variant === "git" || card.isGit;
        }
        return card.variant === brush.value;
      })();
      return match;
    }
    case "status":
      switch (brush.value) {
        case "error":
          return card.isError;
        case "cancelled":
          return card.isCancelled;
        case "commit":
          return card.isCommit;
        default:
          return false;
      }
    case "file":
      return card.editedFiles.some(
        (f) => f === brush.value || f.endsWith(brush.value)
      );
    case "hook":
      return card.hasHook;
    case "command":
      return card.shellCommands.some((cmd) => cmd === brush.value);
    case "mcp":
      if (brush.value === "all") {
        return card.mcpServers.length > 0;
      }
      return card.mcpServers.includes(brush.value);
    default:
      return false;
  }
}
