/**
 * JSON utilities for safe parsing and formatting
 */

/**
 * Safely stringify a value to JSON, handling circular references and bigints
 */
export const safeJsonStringify = (value: unknown, indent?: number): string => {
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      return val;
    }, indent);
  } catch {
    return String(value);
  }
};

/**
 * Safely parse a JSON string, returning null on failure
 */
export const safeJsonParse = <T = unknown>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

/**
 * Check if a value is a plain JSON object (not array, not null)
 */
export const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Format a JSON value for display (with indentation)
 */
export const formatJson = (value: unknown): string => safeJsonStringify(value, 2);

/**
 * Alias for safeJsonStringify for backward compatibility with imported renderers
 */
export const safeStringify = safeJsonStringify;
