/**
 * Model name utility
 *
 * Helpers for normalizing AI model name strings into short human-readable labels.
 */

/**
 * Returns a short display name for an AI model identifier.
 *
 * Handles Claude versioning schemes:
 *   claude-opus-4-5-20251101   → opus-4.5
 *   claude-sonnet-4-20250514   → sonnet-4
 *   claude-3-5-sonnet-20241022 → sonnet-3.5
 *
 * Non-Claude models (gpt-4.1, gemini-2.5-pro, etc.) are returned as-is.
 */
export const getShortModelName = (model: string): string => {
  if (!model) return "";

  // Format: claude-<variant>-<major>-<minor?>-<date>
  const newFormat = model.match(/^claude-(\w+)-(\d+)(?:-(\d+))?-\d{8}/);
  if (newFormat) {
    const [, variant, major, minor] = newFormat;
    return minor ? `${variant}-${major}.${minor}` : `${variant}-${major}`;
  }

  // Format: claude-<major>-<minor>-<variant>-<date> (older format)
  const oldFormat = model.match(/^claude-(\d+)-(\d+)-(\w+)-\d{8}/);
  if (oldFormat) {
    const [, major, minor, variant] = oldFormat;
    return `${variant}-${major}.${minor}`;
  }

  // Non-Claude models (OpenAI, Google, etc.) - already human-readable
  // e.g., "gpt-4.1", "o4-mini", "codex-mini", "gemini-2.5-pro"
  if (!model.startsWith("claude")) {
    return model;
  }

  // Fallback: remove date suffix
  return model.replace(/-\d{8}$/, "");
};
