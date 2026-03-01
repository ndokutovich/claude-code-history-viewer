/**
 * useProjectTreeState Hook
 *
 * Encapsulates the complex state management logic for the ProjectTree component,
 * including expanded project state persistence, loading state, and context menu state.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { UIProject, UISession } from "../../../types";
import { useAppStore } from "../../../store/useAppStore";

export interface ProjectTreeState {
  expandedProjects: Set<string>;
  loadingProjects: Set<string>;
  isLoadingAllSessions: boolean;
  contextMenu: {
    project: UIProject;
    position: { x: number; y: number };
  } | null;
  sessionContextMenu: {
    session: UISession;
    position: { x: number; y: number };
  } | null;
  renameTarget: {
    filePath: string;
    currentName: string;
  } | null;
  sessionContextMenuRef: React.RefObject<HTMLDivElement>;
}

export interface ProjectTreeActions {
  toggleProject: (projectPath: string) => void;
  loadSessionsForProjects: (projectPaths: string[]) => Promise<void>;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLoadingProjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  setIsLoadingAllSessions: React.Dispatch<React.SetStateAction<boolean>>;
  setContextMenu: React.Dispatch<React.SetStateAction<ProjectTreeState["contextMenu"]>>;
  setSessionContextMenu: React.Dispatch<React.SetStateAction<ProjectTreeState["sessionContextMenu"]>>;
  setRenameTarget: React.Dispatch<React.SetStateAction<ProjectTreeState["renameTarget"]>>;
}

export function useProjectTreeState(): ProjectTreeState & ProjectTreeActions {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    // Load expanded projects from localStorage on mount
    try {
      const stored = localStorage.getItem('expandedProjects');
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load expanded projects:', e);
    }
    return new Set();
  });

  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(new Set());
  const [isLoadingAllSessions, setIsLoadingAllSessions] = useState(false);
  const [contextMenu, setContextMenu] = useState<ProjectTreeState["contextMenu"]>(null);
  const [sessionContextMenu, setSessionContextMenu] = useState<ProjectTreeState["sessionContextMenu"]>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectTreeState["renameTarget"]>(null);
  const sessionContextMenuRef = useRef<HTMLDivElement>(null);

  const { loadProjectSessions } = useAppStore();

  // Save expanded projects to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('expandedProjects', JSON.stringify(Array.from(expandedProjects)));
    } catch (e) {
      console.error('Failed to save expanded projects:', e);
    }
  }, [expandedProjects]);

  const toggleProject = useCallback((projectPath: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectPath)) {
        newSet.delete(projectPath);
      } else {
        newSet.add(projectPath);
      }
      return newSet;
    });
  }, []);

  // Load sessions for multiple projects in parallel (without selecting them)
  const loadSessionsForProjects = useCallback(async (projectPaths: string[]) => {
    console.log(`Loading sessions for ${projectPaths.length} projects in parallel...`);

    // Mark projects as loading
    setLoadingProjects((prev) => {
      const newSet = new Set(prev);
      projectPaths.forEach((path) => newSet.add(path));
      return newSet;
    });

    // Load all projects' sessions in parallel
    const loadPromises = projectPaths.map(async (path) => {
      try {
        await loadProjectSessions(path);
        console.log(`  Loaded sessions for ${path}`);
      } catch (error) {
        console.error(`  Failed to load sessions for ${path}:`, error);
      } finally {
        // Remove from loading state when done
        setLoadingProjects((prev) => {
          const newSet = new Set(prev);
          newSet.delete(path);
          return newSet;
        });
      }
    });

    await Promise.all(loadPromises);
    console.log(`Finished loading sessions for ${projectPaths.length} projects`);
  }, [loadProjectSessions]);

  return {
    expandedProjects,
    loadingProjects,
    isLoadingAllSessions,
    contextMenu,
    sessionContextMenu,
    renameTarget,
    sessionContextMenuRef,
    toggleProject,
    loadSessionsForProjects,
    setExpandedProjects,
    setLoadingProjects,
    setIsLoadingAllSessions,
    setContextMenu,
    setSessionContextMenu,
    setRenameTarget,
  };
}
