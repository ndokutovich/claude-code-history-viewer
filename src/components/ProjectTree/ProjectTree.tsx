// src/components/ProjectTree/ProjectTree.tsx
import React, { useEffect, useMemo, useCallback, useRef, useState } from "react";
import {
  Folder,
  X,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UIProject, UISession } from "../../types";
import { cn } from "../../utils/cn";
import { getLocale } from "../../utils/time";
import { getSessionTitle } from "../../utils/sessionUtils";
import { ProjectListControls } from "../ProjectListControls";
import { ProjectContextMenu } from "../ProjectContextMenu";
import { NativeRenameDialog } from "../NativeRenameDialog";
import { useAppStore } from "../../store/useAppStore";
import type { ProjectTreeProps } from "./types";
import { useProjectTreeState } from "./hooks/useProjectTreeState";
import {
  buildTreeItemAnnouncement,
  findTypeaheadMatchIndex,
  getNextTreeItemIndex,
  type TreeNavigationKey,
} from "../../utils/treeKeyboard";
import { FlatSessionsList, ProjectGroup } from "./components";

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  projects,
  sessions,
  sessionsByProject,
  selectedProject,
  selectedSession,
  onProjectSelect,
  onSessionSelect,
  onClearSelection,
  isLoading,
}) => {
  const {
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
    setIsLoadingAllSessions,
    setContextMenu,
    setSessionContextMenu,
    setRenameTarget,
  } = useProjectTreeState();

  const { t, i18n } = useTranslation('components');
  const {
    projectListPreferences,
    loadProjectSessions,
    isCaptureMode,
    hiddenSessionIds,
    hiddenProjectPaths,
    hideSession,
    hideProject,
  } = useAppStore();

  // Capture mode: memoized Sets for efficient lookup
  const hiddenSessionIdsSet = useMemo(() => new Set(hiddenSessionIds), [hiddenSessionIds]);
  const hiddenProjectPathsSet = useMemo(() => new Set(hiddenProjectPaths), [hiddenProjectPaths]);

  // Load all sessions when search query is entered (with debouncing)
  useEffect(() => {
    // Debounce: wait 300ms after user stops typing
    const debounceTimer = setTimeout(async () => {
      if (projectListPreferences.sessionSearchQuery.trim() && !isLoadingAllSessions) {
        setIsLoadingAllSessions(true);

        // Load sessions for all projects that don't have them loaded yet
        const projectsToLoad = projects.filter(
          (project) => !sessionsByProject[project.path] || sessionsByProject[project.path]?.length === 0
        );

        // Expand all projects to show search results
        const allProjectPaths = new Set(projects.map(p => p.path));
        setExpandedProjects(allProjectPaths);

        // Load sessions with concurrent limit (5 at a time)
        const CONCURRENT_LIMIT = 5;
        const errors: string[] = [];

        for (let i = 0; i < projectsToLoad.length; i += CONCURRENT_LIMIT) {
          const batch = projectsToLoad.slice(i, i + CONCURRENT_LIMIT);
          await Promise.all(
            batch.map(async (project) => {
              try {
                await loadProjectSessions(project.path);
              } catch (error) {
                const errorMsg = `${project.name}: ${error}`;
                console.error(`Failed to load sessions for project ${project.name}:`, error);
                errors.push(errorMsg);
              }
            })
          );
        }

        // Show error toast if any loads failed
        if (errors.length > 0) {
          const { toast } = await import('sonner');
          toast.error(t('projectListControls.searchLoadFailed', 'Failed to load some projects'), {
            description: `${errors.length} project(s) failed to load`,
          });
        }

        setIsLoadingAllSessions(false);
      }
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [projectListPreferences.sessionSearchQuery, projects, sessionsByProject, loadProjectSessions, t, isLoadingAllSessions, setExpandedProjects, setIsLoadingAllSessions]);

  // Helper to check if a project has any visible sessions after filtering
  const hasVisibleSessions = useCallback((project: UIProject): boolean => {
    const projectSessions = sessionsByProject[project.path] || [];

    // If sessions haven't been loaded yet for this project, show it (we don't know yet)
    // Only hide if we've loaded sessions and they're all filtered out
    if (projectSessions.length === 0 && selectedProject?.path !== project.path) {
      // Sessions not loaded yet - assume project should be visible
      return true;
    }

    // Use sessions array if this is the selected project
    let visibleSessions = selectedProject?.path === project.path ? sessions : projectSessions;

    // If no sessions at all after loading, hide only if hideEmptyProjects is enabled
    if (visibleSessions.length === 0) {
      return false;
    }

    // Apply same filters as getSessionsForProject
    if (projectListPreferences.hideEmptySessions) {
      visibleSessions = visibleSessions.filter((s) => s.message_count > 0);
    }

    if (projectListPreferences.hideAgentSessions) {
      visibleSessions = visibleSessions.filter((s) => {
        const actualId = s.actual_session_id || s.session_id;
        // Extract filename from path (handle both / and \ separators)
        const filename = actualId.split(/[/\\]/).pop() || '';
        // Remove .jsonl extension
        const sessionName = filename.replace(/\.jsonl$/i, '');
        const isAgent = sessionName.startsWith('agent-');
        return !isAgent;
      });
    }

    if (projectListPreferences.sessionSearchQuery.trim()) {
      const query = projectListPreferences.sessionSearchQuery.toLowerCase();
      visibleSessions = visibleSessions.filter((session) => {
        const title = getSessionTitle(session).toLowerCase();
        const sessionId = session.session_id.toLowerCase();
        const actualSessionId = session.actual_session_id?.toLowerCase() || '';
        return title.includes(query) || sessionId.includes(query) || actualSessionId.includes(query);
      });
    }

    return visibleSessions.length > 0;
  }, [sessionsByProject, selectedProject, sessions, projectListPreferences]);

  // Apply filtering and sorting to projects
  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects];

    // Filter: Hide empty projects
    if (projectListPreferences.hideEmptyProjects) {
      result = result.filter((p) => p.session_count > 0);
    }

    // Filter: Hide projects where all sessions are filtered out
    result = result.filter((p) => hasVisibleSessions(p));

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (projectListPreferences.sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else {
        // Sort by date (lastModified)
        const dateA = new Date(a.lastModified).getTime();
        const dateB = new Date(b.lastModified).getTime();
        comparison = dateA - dateB;
      }

      // Apply sort order
      return projectListPreferences.sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [projects, projectListPreferences, sessionsByProject, sessions, hasVisibleSessions]);

  // Helper function to get sessions for a specific project
  const getSessionsForProject = (projectPath: string): UISession[] => {
    // Try cache first (new multi-project architecture)
    const cachedSessions = sessionsByProject[projectPath];

    let sessionsToFilter: UISession[] = [];

    if (cachedSessions && cachedSessions.length > 0) {
      sessionsToFilter = cachedSessions;
    } else if (selectedProject?.path === projectPath) {
      // Fallback to selected project behavior for backward compatibility
      sessionsToFilter = sessions;
    } else {
      // No sessions loaded for this project yet
      return [];
    }

    // Apply filters
    let result = sessionsToFilter;

    // Filter: Hide empty sessions
    if (projectListPreferences.hideEmptySessions) {
      result = result.filter((s) => s.message_count > 0);
    }

    // Filter: Hide agent sessions (sessions starting with "agent-")
    if (projectListPreferences.hideAgentSessions) {
      result = result.filter((s) => {
        const actualId = s.actual_session_id || s.session_id;
        // Extract filename from path (handle both / and \ separators)
        const filename = actualId.split(/[/\\]/).pop() || '';
        // Remove .jsonl extension
        const sessionName = filename.replace(/\.jsonl$/i, '');
        const isAgent = sessionName.startsWith('agent-');
        if (isAgent) {
          console.log('Filtering out agent session:', sessionName);
        }
        return !isAgent;
      });
    }

    // Filter: Search query
    if (projectListPreferences.sessionSearchQuery.trim()) {
      const query = projectListPreferences.sessionSearchQuery.toLowerCase();
      result = result.filter((session) => {
        const title = getSessionTitle(session).toLowerCase();
        const sessionId = session.session_id.toLowerCase();
        const actualSessionId = session.actual_session_id?.toLowerCase() || '';
        return title.includes(query) || sessionId.includes(query) || actualSessionId.includes(query);
      });
    }

    return result;
  };

  // Group projects by source if needed
  const groupedProjects = useMemo(() => {
    if (projectListPreferences.groupBy !== "source") {
      return { ungrouped: filteredAndSortedProjects };
    }

    const groups: Record<string, UIProject[]> = {};
    filteredAndSortedProjects.forEach((project) => {
      const groupName = project.providerName || "Unknown";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(project);
    });

    // Sort groups: Claude Code first, Cursor second, others after
    const sortedGroups: Record<string, UIProject[]> = {};
    const sourceOrder = [t('projectTree.sources.claudeCode'), t('projectTree.sources.cursor')];

    // Add sources in preferred order
    sourceOrder.forEach(sourceName => {
      if (groups[sourceName]) {
        sortedGroups[sourceName] = groups[sourceName];
      }
    });

    // Add any remaining sources
    Object.keys(groups).forEach(sourceName => {
      if (!sourceOrder.includes(sourceName) && groups[sourceName]) {
        sortedGroups[sourceName] = groups[sourceName];
      }
    });

    return sortedGroups;
  }, [filteredAndSortedProjects, projectListPreferences.groupBy]);

  // Collect all sessions from all projects for flat view mode
  const allSessionsFlat = useMemo(() => {
    if (projectListPreferences.groupBy !== 'sessions') {
      return [];
    }

    // Collect all sessions from sessionsByProject cache
    const allSessions: (UISession & { projectPath: string; projectName: string; providerId?: string })[] = [];

    filteredAndSortedProjects.forEach((project) => {
      const projectSessions = sessionsByProject[project.path] || [];
      projectSessions.forEach((session) => {
        allSessions.push({
          ...session,
          projectPath: project.path,
          projectName: project.name,
          providerId: project.providerId,
        });
      });
    });

    // Sort by last_modified (most recent first)
    allSessions.sort((a, b) => {
      const dateA = new Date(a.last_modified).getTime();
      const dateB = new Date(b.last_modified).getTime();
      return dateB - dateA; // Descending (newest first)
    });

    return allSessions;
  }, [projectListPreferences.groupBy, sessionsByProject, filteredAndSortedProjects]);

  // Auto-load all sessions when switching to flat view
  useEffect(() => {
    if (projectListPreferences.groupBy === 'sessions') {
      const projectPaths = filteredAndSortedProjects.map(p => p.path);
      loadSessionsForProjects(projectPaths);
    }
  }, [projectListPreferences.groupBy, filteredAndSortedProjects, loadSessionsForProjects]);

  // ESC key to clear selection
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClearSelection]);

  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 60) {
        return t("common:time.minutesAgo", "{{count}} minutes ago", {
          count: diffMins,
        });
      } else if (diffHours < 24) {
        return t("common:time.hoursAgo", "{{count}} hours ago", {
          count: diffHours,
        });
      } else if (diffDays < 7) {
        return t("common:time.daysAgo", "{{count}} days ago", {
          count: diffDays,
        });
      } else {
        return date.toLocaleDateString(getLocale(i18n.language || "en"), {
          month: "short",
          day: "numeric",
        });
      }
    } catch {
      return dateStr;
    }
  };

  // Close session context menu on outside click or Escape
  useEffect(() => {
    if (!sessionContextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        sessionContextMenuRef.current &&
        !sessionContextMenuRef.current.contains(e.target as Node)
      ) {
        setSessionContextMenu(null);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSessionContextMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [sessionContextMenu, sessionContextMenuRef, setSessionContextMenu]);

  const handleProjectContextMenu = useCallback(
    (e: React.MouseEvent, project: UIProject) => {
      e.preventDefault();
      e.stopPropagation();
      setSessionContextMenu(null);
      setContextMenu({
        project,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [setSessionContextMenu, setContextMenu]
  );

  const handleSessionContextMenu = useCallback(
    (e: React.MouseEvent, session: UISession) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu(null);
      setSessionContextMenu({
        session,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    [setContextMenu, setSessionContextMenu]
  );

  const handleRenameSession = useCallback(
    (session: UISession) => {
      setSessionContextMenu(null);
      setRenameTarget({
        filePath: session.file_path,
        currentName: getSessionTitle(session),
      });
    },
    [setSessionContextMenu, setRenameTarget]
  );

  // --- Keyboard navigation (ARIA tree) ---
  const treeRef = useRef<HTMLDivElement>(null);
  const typeaheadQueryRef = useRef("");
  const typeaheadTimeoutRef = useRef<number | null>(null);
  const [treeAnnouncement, setTreeAnnouncement] = useState("");

  const announceTree = useCallback((message: string) => {
    if (!message) return;
    setTreeAnnouncement((prev) => (prev === message ? `${message} ` : message));
  }, []);

  const describeTreeItem = useCallback((item: HTMLElement): string => {
    const rawLabel = item.getAttribute("aria-label") || item.textContent || "";
    return buildTreeItemAnnouncement(
      rawLabel,
      {
        ariaExpanded: item.getAttribute("aria-expanded") as "true" | "false" | null,
        ariaSelected: item.getAttribute("aria-selected") as "true" | "false" | null,
      },
      {
        expanded: t("project.a11y.expandedState", "expanded"),
        collapsed: t("project.a11y.collapsedState", "collapsed"),
        selected: t("project.a11y.selectedState", "selected"),
      },
      t("project.explorer", "Project Explorer")
    );
  }, [t]);

  const syncRovingTabIndex = useCallback((preferredItem?: HTMLElement) => {
    const tree = treeRef.current;
    if (!tree) return;

    const treeItems = Array.from(
      tree.querySelectorAll<HTMLElement>('[role="treeitem"]')
    );
    if (treeItems.length === 0) return;

    const activeElement = document.activeElement;
    const focusedItem =
      activeElement instanceof HTMLElement
        ? activeElement.closest<HTMLElement>('[role="treeitem"]')
        : null;

    const selectedItem = treeItems.find(
      (item) => item.getAttribute("aria-selected") === "true"
    );
    const fallbackItem = selectedItem ?? treeItems[0];
    const nextTabStop = preferredItem ?? focusedItem ?? fallbackItem;

    for (const item of treeItems) {
      item.tabIndex = item === nextTabStop ? 0 : -1;
    }
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => syncRovingTabIndex());
    return () => cancelAnimationFrame(frameId);
  }, [
    syncRovingTabIndex,
    filteredAndSortedProjects.length,
    selectedProject?.path,
    selectedSession?.session_id,
  ]);

  useEffect(() => () => {
    if (typeaheadTimeoutRef.current) {
      window.clearTimeout(typeaheadTimeoutRef.current);
    }
  }, []);

  const handleTreeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const treeItems = Array.from(
        event.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]')
      );
      if (treeItems.length === 0) return;

      const currentItem = (event.target as HTMLElement).closest<HTMLElement>(
        '[role="treeitem"]'
      );
      const currentIndex = currentItem ? treeItems.indexOf(currentItem) : -1;
      if (currentIndex < 0) return;

      // Typeahead: single printable character (no modifiers)
      if (
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const nextQuery = `${typeaheadQueryRef.current}${event.key.toLowerCase()}`;
        typeaheadQueryRef.current = nextQuery;
        if (typeaheadTimeoutRef.current) {
          window.clearTimeout(typeaheadTimeoutRef.current);
        }
        typeaheadTimeoutRef.current = window.setTimeout(() => {
          typeaheadQueryRef.current = "";
          typeaheadTimeoutRef.current = null;
        }, 500);

        const labels = treeItems.map((item) => item.textContent ?? "");
        const matchIndex = findTypeaheadMatchIndex(labels, currentIndex, nextQuery);
        if (matchIndex >= 0) {
          event.preventDefault();
          const nextItem = treeItems[matchIndex];
          syncRovingTabIndex(nextItem);
          nextItem?.focus();
          if (nextItem) announceTree(describeTreeItem(nextItem));
        }
        return;
      }

      // Arrow Left on a non-expandable (level-2) item: move focus to parent
      if (event.key === "ArrowLeft") {
        const level = currentItem?.getAttribute("aria-level");
        if (level === "2") {
          event.preventDefault();
          const parentItem = treeItems
            .slice(0, currentIndex)
            .reverse()
            .find((item) => item.getAttribute("aria-level") === "1");
          if (parentItem) {
            syncRovingTabIndex(parentItem);
            parentItem.focus();
            announceTree(describeTreeItem(parentItem));
          }
          return;
        }
        // For level-1 expandable items, the onKeyDown on the button handles it
        return;
      }

      // Enter / Space: activate current item
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        currentItem?.click();
        return;
      }

      // Arrow Up/Down, Home, End
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      const nextIndex = getNextTreeItemIndex(
        currentIndex,
        treeItems.length,
        event.key as TreeNavigationKey
      );
      if (nextIndex === currentIndex || nextIndex < 0) return;

      event.preventDefault();
      const nextItem = treeItems[nextIndex];
      if (!nextItem) return;
      syncRovingTabIndex(nextItem);
      nextItem.focus();
      announceTree(describeTreeItem(nextItem));
    },
    [announceTree, describeTreeItem, syncRovingTabIndex]
  );

  // Expose expand/collapse functions via custom event for ProjectListControls
  useEffect(() => {
    const handleExpandAll = async () => {
      const allPaths = new Set(filteredAndSortedProjects.map(p => p.path));
      setExpandedProjects(allPaths);

      // Load sessions for all projects
      await loadSessionsForProjects(Array.from(allPaths));
    };

    const handleCollapseAll = () => {
      setExpandedProjects(new Set());
    };

    const handleExpandProject = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { path } = customEvent.detail;

      setExpandedProjects(prev => {
        const newSet = new Set(prev);
        newSet.add(path);
        return newSet;
      });

      // Load sessions for this project
      await loadSessionsForProjects([path]);
    };

    window.addEventListener('expandAllProjects', handleExpandAll);
    window.addEventListener('collapseAllProjects', handleCollapseAll);
    window.addEventListener('expandProject', handleExpandProject as EventListener);

    return () => {
      window.removeEventListener('expandAllProjects', handleExpandAll);
      window.removeEventListener('collapseAllProjects', handleCollapseAll);
      window.removeEventListener('expandProject', handleExpandProject as EventListener);
    };
  }, [filteredAndSortedProjects, loadSessionsForProjects, setExpandedProjects]);

  return (
    <div className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex flex-col h-full">
      {/* Project List Controls */}
      <ProjectListControls isLoadingSearch={isLoadingAllSessions} />

      {/* Selection Header with Clear Button */}
      {(selectedProject || selectedSession) && (
        <div className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-750 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {selectedSession
                ? t("components:session.selected", "Selected session")
                : t("components:project.selected", "Selected project")}
            </p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
              {selectedSession
                ? getSessionTitle(selectedSession)
                : selectedProject?.name}
            </p>
          </div>
          <button
            onClick={onClearSelection}
            className="ml-2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title={t("components:selection.clear", "Clear selection (ESC)")}
          >
            <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Projects List */}
      <div
        ref={treeRef}
        role="tree"
        aria-label={t("projectTree.ariaLabel", "Project explorer")}
        onKeyDown={handleTreeKeyDown}
        onFocusCapture={(event) => {
          const target = event.target as HTMLElement;
          const treeItem = target.closest<HTMLElement>('[role="treeitem"]');
          if (treeItem) {
            syncRovingTabIndex(treeItem);
            announceTree(describeTreeItem(treeItem));
          }
        }}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {/* Screen-reader live region for keyboard navigation announcements */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {treeAnnouncement}
        </div>

        {filteredAndSortedProjects.length === 0 ? (
          <div className="p-4 text-center text-gray-400 dark:text-gray-600 h-full flex items-center">
            <div className="flex flex-col justify-center w-full">
              <div className="mb-2">
                <Folder className="w-8 h-8 mx-auto text-gray-500 dark:text-gray-400" />
              </div>
              <p className="text-sm">
                {t("components:project.notFound", "No projects found")}
              </p>
            </div>
          </div>
        ) : projectListPreferences.groupBy === 'sessions' ? (
          // FLAT SESSIONS VIEW (no projects, just all sessions mixed)
          <div className="space-y-1 p-2">
            <FlatSessionsList
              sessions={allSessionsFlat}
              selectedSession={selectedSession}
              projects={filteredAndSortedProjects}
              onSessionSelect={onSessionSelect}
              onProjectSelect={onProjectSelect}
              onContextMenu={handleSessionContextMenu}
              formatTimeAgo={formatTimeAgo}
              t={t}
              isCaptureMode={isCaptureMode}
              hiddenSessionIds={hiddenSessionIdsSet}
              onHideSession={hideSession}
            />
          </div>
        ) : (
          // NORMAL PROJECT TREE VIEW
          <div className="space-y-2">
            {Object.entries(groupedProjects).map(([groupName, groupProjects]) => (
              <ProjectGroup
                key={groupName}
                groupName={groupName}
                projects={groupProjects}
                showGroupHeader={projectListPreferences.groupBy === "source"}
                expandedProjects={expandedProjects}
                loadingProjects={loadingProjects}
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                isLoading={isLoading}
                getSessionsForProject={getSessionsForProject}
                onToggle={toggleProject}
                onProjectSelect={onProjectSelect}
                onSessionSelect={onSessionSelect}
                onProjectContextMenu={handleProjectContextMenu}
                onSessionContextMenu={handleSessionContextMenu}
                onExpandRequest={(path) => loadSessionsForProjects([path])}
                formatTimeAgo={formatTimeAgo}
                t={t}
                isCaptureMode={isCaptureMode}
                hiddenProjectPaths={hiddenProjectPathsSet}
                hiddenSessionIds={hiddenSessionIdsSet}
                onHideProject={hideProject}
                onHideSession={hideSession}
              />
            ))}
          </div>
        )}
      </div>

      {/* Project Context Menu */}
      {contextMenu && (
        <ProjectContextMenu
          project={contextMenu.project}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onHide={(path) => {
            console.log("Hide project:", path);
            setContextMenu(null);
          }}
          onUnhide={(path) => {
            console.log("Unhide project:", path);
            setContextMenu(null);
          }}
          isHidden={false}
        />
      )}

      {/* Session Context Menu */}
      {sessionContextMenu && (
        <div
          ref={sessionContextMenuRef}
          className={cn(
            "fixed z-50 min-w-[160px] rounded-lg border shadow-lg",
            "bg-popover border-border",
            "animate-in fade-in-0 zoom-in-95 duration-100"
          )}
          style={{
            left: sessionContextMenu.position.x,
            top: sessionContextMenu.position.y,
          }}
        >
          <div className="p-1">
            {/* Session name header */}
            <div className="px-2 py-1.5 text-xs text-muted-foreground truncate border-b border-border mb-1">
              {getSessionTitle(sessionContextMenu.session)}
            </div>

            {/* Rename option */}
            <button
              onClick={() => handleRenameSession(sessionContextMenu.session)}
              aria-label={t("session.contextMenu.rename", "Rename session")}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                "transition-colors cursor-pointer"
              )}
            >
              <Pencil className="w-4 h-4" />
              <span>{t("session.contextMenu.rename", "Rename")}</span>
            </button>
          </div>
        </div>
      )}

      {/* Native Rename Dialog */}
      <NativeRenameDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        filePath={renameTarget?.filePath ?? ""}
        currentName={renameTarget?.currentName ?? ""}
        onSuccess={(newTitle) => {
          setRenameTarget(null);
          // Force refresh sessions for the currently selected project
          if (selectedProject) {
            loadProjectSessions(selectedProject.path, undefined, true);
          }
          console.log("Session renamed to:", newTitle);
        }}
      />
    </div>
  );
};
