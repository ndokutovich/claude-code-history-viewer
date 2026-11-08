/**
 * Claude Code's hook shape, and the shapes the settings UI can edit.
 *
 * `settings.json` stores each event as an array of matcher groups:
 *
 *   "Stop": [
 *     { "matcher": "", "hooks": [{ "type": "command", "command": "…", "timeout": 600 }] }
 *   ]
 *
 * Older builds and hand-written configs also carry a flat command array. The
 * UI has always read `entry.command` from the group itself, which is undefined,
 * so every row rendered as an empty bar.
 */
import type { HookCommand } from "@/types";

export interface HookCommandView extends HookCommand {
  /** Matcher of the group this command came from, when there is one. */
  matcher?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Flattens one event's stored array into the commands a row can display. */
export function readHookCommands(entries: unknown): HookCommandView[] {
  if (!Array.isArray(entries)) return [];

  const commands: HookCommandView[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    const matcher = typeof entry.matcher === "string" ? entry.matcher : undefined;

    if (Array.isArray(entry.hooks)) {
      for (const inner of entry.hooks) {
        if (!isRecord(inner)) continue;
        if (typeof inner.command !== "string" || inner.command === "") continue;
        commands.push({
          command: inner.command,
          timeout: typeof inner.timeout === "number" ? inner.timeout : undefined,
          matcher,
        });
      }
      continue;
    }

    // Flat shape: { command, args?, timeout? }
    if (typeof entry.command === "string" && entry.command !== "") {
      commands.push({
        command: entry.command,
        args: Array.isArray(entry.args) ? entry.args.map(String) : undefined,
        timeout: typeof entry.timeout === "number" ? entry.timeout : undefined,
      });
    }
  }

  return commands;
}

/**
 * Removes the command at `index` of the flattened view, keeping every other
 * group and its matcher exactly as written. Groups left without commands are
 * dropped.
 */
export function removeHookCommand(entries: unknown, index: number): unknown[] {
  const raw = Array.isArray(entries) ? entries : [];
  const remaining: unknown[] = [];
  let flattened = 0;

  for (const entry of raw) {
    if (!isRecord(entry)) {
      if (flattened === index) {
        flattened += 1;
      } else {
        flattened += 1;
        remaining.push(entry);
      }
      continue;
    }

    if (!Array.isArray(entry.hooks)) {
      if (flattened !== index) remaining.push(entry);
      flattened += 1;
      continue;
    }

    const kept = entry.hooks.filter(() => {
      const isTarget = flattened === index;
      flattened += 1;
      return !isTarget;
    });

    if (kept.length > 0) {
      remaining.push({ ...entry, hooks: kept });
    }
  }

  return remaining;
}

/** Appends a command as a new matcher group, the shape Claude Code writes. */
export function appendHookCommand(
  entries: unknown,
  command: string,
  timeout?: number
): unknown[] {
  const raw = Array.isArray(entries) ? entries : [];
  const inner: Record<string, unknown> = { type: "command", command };
  if (typeof timeout === "number") inner.timeout = timeout;
  return [...raw, { hooks: [inner] }];
}
