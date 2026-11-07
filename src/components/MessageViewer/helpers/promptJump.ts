import type { UIMessage } from "../../../types";
import type { MessageRowDescriptor } from "../types";

/**
 * True when the row begins a turn: text the user typed, or a slash-command
 * invocation. Rows the user did not type (tool results, local-command
 * output, system reminders, task notifications) do not start a turn, and a
 * local command's output follows its invocation instead of starting a turn
 * of its own (upstream #629 semantics).
 */
export function isTurnStart(message: UIMessage): boolean {
  if (message.type !== "user") return false;

  const raw = message.content;
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw
            .map((item) =>
              item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
                ? ((item as { text: string }).text)
                : ""
            )
            .join("\n")
        : "";
  const trimmed = text.trim();
  if (!trimmed) return false; // tool-result-only user rows carry no prompt

  if (trimmed.startsWith("<local-command-stdout>")) return false;
  if (trimmed.startsWith("<system-reminder>")) return false;
  if (trimmed.startsWith("<task-notification>")) return false;
  if (trimmed.startsWith("[Request interrupted")) return false;

  return true; // typed prompt or slash-command invocation
}

/**
 * Index of the next turn start strictly before/after `fromIndex`, or `null`.
 */
export function findPromptJumpIndex(
  rows: MessageRowDescriptor[],
  fromIndex: number,
  direction: -1 | 1
): number | null {
  for (let i = fromIndex + direction; i >= 0 && i < rows.length; i += direction) {
    const row = rows[i];
    if (row && isTurnStart(row.message)) return i;
  }
  return null;
}

/** Platform-aware shortcut label for hints. */
export function getPromptJumpKeysLabel(): string {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  return isMac ? "⌥↑ / ⌥↓" : "Alt+↑ / Alt+↓";
}
