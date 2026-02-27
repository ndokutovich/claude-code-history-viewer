/**
 * Update Diagnostics Utility
 *
 * Builds a structured diagnostic string from update state for error reporting.
 * Used when surfacing update errors to users or sending bug reports.
 */

import type { UpdateState } from "@/hooks/useUpdater";

interface BuildUpdateDiagnosticsInput {
  error: string;
  state: UpdateState;
}

/**
 * Formats update state into a human-readable diagnostic block suitable
 * for bug reports or error overlays.
 */
export function buildUpdateDiagnostics({
  error,
  state,
}: BuildUpdateDiagnosticsInput): string {
  const timestamp = new Date().toISOString();
  const info = {
    timestamp,
    error,
    hasUpdate: state.hasUpdate,
    isDownloading: state.isDownloading,
    isInstalling: state.isInstalling,
    isRestarting: state.isRestarting,
    requiresManualRestart: state.requiresManualRestart,
    downloadProgress: state.downloadProgress,
    userAgent:
      typeof navigator !== "undefined" && navigator.userAgent
        ? navigator.userAgent
        : "unknown",
  };

  return [
    "[Updater Diagnostics]",
    `timestamp=${info.timestamp}`,
    `error=${info.error}`,
    `hasUpdate=${info.hasUpdate}`,
    `isDownloading=${info.isDownloading}`,
    `isInstalling=${info.isInstalling}`,
    `isRestarting=${info.isRestarting}`,
    `requiresManualRestart=${info.requiresManualRestart}`,
    `downloadProgress=${info.downloadProgress}`,
    `userAgent=${info.userAgent}`,
  ].join("\n");
}
