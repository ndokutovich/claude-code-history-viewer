import { platform } from "@tauri-apps/plugin-os";

/**
 * Platform detection helpers.
 *
 * These are deliberately synchronous and safe to call outside the Tauri
 * runtime (e.g. during unit tests or a plain-browser WebUI build): every
 * Tauri-specific call is guarded and falls back to a `navigator`-based check.
 */

/** True when running inside the Tauri desktop shell. */
export const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

let cachedIsMacOS: boolean | null = null;

/** True when the host OS is macOS. */
export const isMacOS = (): boolean => {
  if (cachedIsMacOS !== null) return cachedIsMacOS;

  try {
    if (isTauri()) {
      cachedIsMacOS = platform() === "macos";
      return cachedIsMacOS;
    }
  } catch {
    // plugin-os not available — fall through to the browser heuristic.
  }

  cachedIsMacOS =
    typeof navigator !== "undefined" &&
    /mac/i.test(
      navigator.userAgent ||
        (navigator as Navigator & { platform?: string }).platform ||
        ""
    );
  return cachedIsMacOS;
};
