import type { ClaudeProject } from "../types";

export interface WorktreeGroup {
  parent: ClaudeProject;
  children: ClaudeProject[];
}

export interface WorktreeGroupingResult {
  groups: WorktreeGroup[];
  ungrouped: ClaudeProject[];
}

const TMP_PREFIXES = ["/tmp/", "/private/tmp/"];

/** @deprecated Use project.actual_path instead. */
export function decodeProjectPath(sessionStoragePath: string): string {
  const marker = ".claude/projects/";
  const markerIndex = sessionStoragePath.indexOf(marker);
  if (markerIndex === -1) return sessionStoragePath;
  const encoded = sessionStoragePath.slice(markerIndex + marker.length);
  if (encoded.startsWith("-")) return encoded.replace(/-/g, "/");
  return sessionStoragePath;
}

export function extractProjectName(path: string): string {
  const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const segments = cleanPath.split("/");
  return segments[segments.length - 1] || "";
}

export function getWorktreeLabel(childPath: string): string {
  for (const prefix of TMP_PREFIXES) {
    if (childPath.startsWith(prefix)) return childPath.slice(prefix.length);
  }
  return childPath;
}

export function detectWorktreeGroupsByGit(
  projects: ClaudeProject[]
): WorktreeGroupingResult {
  const mainReposByPath = new Map<string, ClaudeProject>();

  for (const project of projects) {
    if (project.git_info?.worktree_type === "main" && project.actual_path) {
      mainReposByPath.set(project.actual_path, project);
    }
  }

  const groups = new Map<string, WorktreeGroup>();
  const groupedChildPaths = new Set<string>();

  for (const project of projects) {
    if (project.git_info?.worktree_type === "linked") {
      const mainPath = project.git_info.main_project_path;
      if (mainPath) {
        const parent = mainReposByPath.get(mainPath);
        if (parent) {
          if (!groups.has(parent.path)) {
            groups.set(parent.path, { parent, children: [] });
          }
          groups.get(parent.path)!.children.push(project);
          groupedChildPaths.add(project.path);
        }
      }
    }
  }

  const groupedParentPaths = new Set(groups.keys());
  const ungrouped = projects.filter(
    (p) => !groupedParentPaths.has(p.path) && !groupedChildPaths.has(p.path)
  );

  return { groups: Array.from(groups.values()), ungrouped };
}

export function detectWorktreeGroupsHybrid(
  projects: ClaudeProject[]
): WorktreeGroupingResult {
  const withGitInfo: ClaudeProject[] = [];
  const withoutGitInfo: ClaudeProject[] = [];

  for (const project of projects) {
    if (
      project.git_info?.worktree_type &&
      project.git_info.worktree_type !== "not_git"
    ) {
      withGitInfo.push(project);
    } else {
      withoutGitInfo.push(project);
    }
  }

  const gitResult = detectWorktreeGroupsByGit(withGitInfo);
  return {
    groups: gitResult.groups,
    ungrouped: [...gitResult.ungrouped, ...withoutGitInfo],
  };
}

export interface DirectoryGroup {
  name: string;
  path: string;
  displayPath: string;
  projects: ClaudeProject[];
}

export interface DirectoryGroupingResult {
  groups: DirectoryGroup[];
  ungrouped: ClaudeProject[];
}

export function getParentDirectory(actualPath: string): string {
  const segments = actualPath.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  return "/" + segments.slice(0, -1).join("/");
}

export function toDisplayPath(fullPath: string, homePath?: string): string {
  const home = homePath || detectHomePath(fullPath);
  if (home && fullPath.startsWith(home)) return "~" + fullPath.slice(home.length);
  return fullPath;
}

function detectHomePath(path: string): string | null {
  const macMatch = path.match(/^(\/Users\/[^/]+)/);
  if (macMatch?.[1]) return macMatch[1];
  const linuxMatch = path.match(/^(\/home\/[^/]+)/);
  if (linuxMatch?.[1]) return linuxMatch[1];
  return null;
}

export function groupProjectsByDirectory(
  projects: ClaudeProject[]
): DirectoryGroupingResult {
  const directoryMap = new Map<string, ClaudeProject[]>();

  for (const project of projects) {
    const actualPath = project.actual_path || project.path;
    const parentDir = getParentDirectory(actualPath);
    if (!directoryMap.has(parentDir)) directoryMap.set(parentDir, []);
    directoryMap.get(parentDir)!.push(project);
  }

  const groups: DirectoryGroup[] = [];
  for (const [dirPath, dirProjects] of directoryMap) {
    const segments = dirPath.split("/").filter(Boolean);
    const name = segments[segments.length - 1] || "/";
    groups.push({
      name,
      path: dirPath,
      displayPath: toDisplayPath(dirPath),
      projects: dirProjects.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  groups.sort((a, b) => a.path.localeCompare(b.path));
  return { groups, ungrouped: [] };
}
