/**
 * Normalize smart quotes to regular quotes
 * Converts curly quotes ("")  to straight quotes (")
 * Converts curly single quotes ('') to straight single quotes (')
 */
export function normalizeQuotes(str: string): string {
  return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}
