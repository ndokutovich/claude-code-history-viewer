/**
 * Cross-platform path utilities for handling file paths
 * Works with both Unix-style (/) and Windows-style (\) path separators
 */

/**
 * Get the filename from a path, handling both / and \ separators
 * @param path - File path (e.g., "C:\Users\file.txt" or "/home/user/file.txt")
 * @returns The filename (e.g., "file.txt")
 */
export function getFileName(path: string): string {
  // Split by both / and \ to handle cross-platform paths
  const parts = path.split(/[/\]/);
  return parts[parts.length - 1] || "";
}

/**
 * Get all path parts, handling both / and \ separators
 * @param path - File path
 * @returns Array of path segments
 */
export function getPathParts(path: string): string[] {
  return path.split(/[/\]/).filter(Boolean);
}

/**
 * Get the parent directory path parts
 * @param path - File path
 * @returns Array of directory segments (without filename)
 */
export function getDirectoryParts(path: string): string[] {
  const parts = getPathParts(path);
  return parts.slice(0, -1);
}
