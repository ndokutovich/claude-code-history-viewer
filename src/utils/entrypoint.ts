/**
 * Entrypoint normalization for Claude Code sessions.
 *
 * Claude Code writes a top-level `entrypoint` field into each JSONL line
 * (e.g. "cli", "claude-vscode", "claude-desktop"). This module maps the raw
 * value to a stable category, a display label (i18n key + English fallback),
 * and badge styling for the session list. Non-Claude providers leave the
 * entrypoint undefined and resolve to the "unknown" category.
 */

export type EntrypointCategory = "cli" | "vscode" | "desktop" | "unknown";

export interface EntrypointDescriptor {
  category: EntrypointCategory;
  /** i18n key for the short label (resolved in the `session` namespace). */
  labelKey: string;
  /** English fallback label, used when the i18n key is missing. */
  fallbackLabel: string;
  /** Tailwind classes for the badge pill. */
  badgeClassName: string;
}

/**
 * Normalize a raw entrypoint value into a stable category.
 * Tolerant of casing, whitespace, and known aliases.
 */
export function normalizeEntrypoint(
  raw: string | null | undefined
): EntrypointCategory {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  if (v === "cli" || v === "claude-cli") return "cli";
  if (v.includes("vscode") || v.includes("vs-code") || v === "code") {
    return "vscode";
  }
  if (v.includes("desktop")) return "desktop";
  return "unknown";
}

const DESCRIPTORS: Record<EntrypointCategory, EntrypointDescriptor> = {
  cli: {
    category: "cli",
    labelKey: "session.item.entrypoint.cli",
    fallbackLabel: "CLI",
    badgeClassName:
      "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  vscode: {
    category: "vscode",
    labelKey: "session.item.entrypoint.vscode",
    fallbackLabel: "VS Code",
    badgeClassName:
      "border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10",
  },
  desktop: {
    category: "desktop",
    labelKey: "session.item.entrypoint.desktop",
    fallbackLabel: "Desktop",
    badgeClassName:
      "border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/10",
  },
  unknown: {
    category: "unknown",
    labelKey: "session.item.entrypoint.unknown",
    fallbackLabel: "Unknown",
    badgeClassName:
      "border-muted-foreground/30 text-muted-foreground bg-muted/40",
  },
};

/** Resolve the full descriptor for a raw entrypoint value. */
export function getEntrypointDescriptor(
  raw: string | null | undefined
): EntrypointDescriptor {
  return DESCRIPTORS[normalizeEntrypoint(raw)];
}

/** Whether the entrypoint is a known source worth surfacing as a badge. */
export function hasKnownEntrypoint(raw: string | null | undefined): boolean {
  return normalizeEntrypoint(raw) !== "unknown";
}
