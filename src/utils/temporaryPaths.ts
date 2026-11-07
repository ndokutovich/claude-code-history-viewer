/**
 * OS scratch locations (upstream #ccf7c19b).
 *
 * Sessions started in a temp directory — agent sandboxes, one-off translation
 * jobs, `mktemp -d` experiments — are rarely what the user is looking for and
 * would otherwise bury real projects in the explorer. They get their own
 * bucket instead of being hidden.
 */
const TEMP_PATH_PATTERNS: RegExp[] = [
  /^\/(?:private\/)?tmp(?:\/|$)/,
  /^\/(?:private\/)?var\/(?:folders|tmp)(?:\/|$)/,
  /^\/dev\/shm(?:\/|$)/,
  /^\/Users\/[^/]+\/Library\/Caches(?:\/|$)/,
  /^\/home\/[^/]+\/\.cache(?:\/|$)/,
  /^\/?[A-Za-z]:[\\/]Users[\\/][^\\/]+[\\/]AppData[\\/]Local[\\/]Temp(?:[\\/]|$)/i,
  /^\/?[A-Za-z]:[\\/]Windows[\\/]Temp(?:[\\/]|$)/i,
];

/** Whether `path` lives under an OS temporary/cache directory. */
export function isTemporaryPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return TEMP_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

/** A project whose working directory is an OS scratch location. */
export function isProjectTemporary(
  project: { actual_path?: string; path?: string } | null | undefined
): boolean {
  if (!project) return false;
  return isTemporaryPath(project.actual_path) || isTemporaryPath(project.path);
}
