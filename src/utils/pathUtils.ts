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
  // Split by both / and \\ to handle cross-platform paths
  const parts = path.split(/[/\\\\]/);
  return parts[parts.length - 1] || "";
}

/**
 * Get all path parts, handling both / and \ separators
 * @param path - File path
 * @returns Array of path segments
 */
export function getPathParts(path: string): string[] {
  return path.split(/[/\\\\]/).filter(Boolean);
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

/**
 * Check if a path is absolute
 * Handles both Unix-style (starts with /) and Windows-style (starts with drive letter like C:\)
 * @param path - File path to check
 * @returns true if the path is absolute
 */
export function isAbsolutePath(path: string): boolean {
  // Unix absolute path
  if (path.startsWith("/")) return true;
  // Windows absolute path (e.g., C:\, D:\, C:/)
  if (/^[A-Za-z]:[/\\]/.test(path)) return true;
  return false;
}

/**
 * Detect home directory from paths (infer from /Users/xxx, /home/xxx, or C:\Users\xxx patterns)
 */
export function detectHomeDir(paths: string[]): string | null {
  for (const path of paths) {
    // macOS: /Users/username/...
    const macMatch = path.match(/^(\/Users\/[^/]+)/);
    if (macMatch?.[1]) return macMatch[1];

    // Linux: /home/username/...
    const linuxMatch = path.match(/^(\/home\/[^/]+)/);
    if (linuxMatch?.[1]) return linuxMatch[1];

    // Windows: C:\Users\username\... (case-insensitive)
    const windowsMatch = path.match(/^([A-Za-z]:\\Users\\[^\\]+)/i);
    if (windowsMatch?.[1]) return windowsMatch[1];
  }
  return null;
}

/**
 * Format path for display (replace home dir with ~/)
 */
export function formatDisplayPath(path: string, homeDir: string | null): string {
  if (homeDir && path.startsWith(homeDir)) {
    const relativePath = path.slice(homeDir.length);
    return relativePath ? `~${relativePath}` : "~";
  }
  return path;
}

/**
 * Format path with automatic home directory detection
 */
export function formatPathWithTilde(path: string, allPaths?: string[]): string {
  const homeDir = allPaths ? detectHomeDir(allPaths) : detectHomeDir([path]);
  return formatDisplayPath(path, homeDir);
}
