// src/components/ProjectTree.tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Folder,
  Wrench,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  X,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UIProject, UISession } from "../types";
import { cn } from "../utils/cn";
import { getLocale } from "../utils/time";
import { getSessionTitle } from "../utils/sessionUtils";
import { ProjectListControls } from "./ProjectListControls";
import { useAppStore } from "../store/useAppStore";
import { ProviderIcon, getProviderColorClass } from "./icons/ProviderIcons";

interface ProjectTreeProps {
  projects: UIProject[];
  sessions: UISession[]; // Sessions for selected project only (backward compatibility)
  sessionsByProject: Record<string, UISession[]>; // NEW: Cache sessions per-project for multi-expansion
  selectedProject: UIProject | null;
  selectedSession: UISession | null;
  onProjectSelect: (project: UIProject | null) => void;
  onSessionSelect: (session: UISession | null) => void;
  onClearSelection: () => void;
  isLoading: boolean;
}

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
  const { t, i18n } = useTranslation('components');
  const { projectListPreferences, loadProjectSessions } = useAppStore();

  // Save expanded projects to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('expandedProjects', JSON.stringify(Array.from(expandedProjects)));
    } catch (e) {
      console.error('Failed to save expanded projects:', e);
    }
  }, [expandedProjects]);

  // Load all sessions when search query is entered (with debouncing)
  useEffect(() => {
    // Debounce: wait 300ms after user stops typing
    const debounceTimer = setTimeout(async () => {
      if (projectListPreferences.sessionSearchQuery.trim() && !isLoadingAllSessions) {
        setIsLoadingAllSessions(true);

        // Load sessions for all projects that don't have them loaded yet
        const projectsToLoad = projects.filter(
          (project) => !sessionsByProject[project.path] || sessionsByProject[project.path].length === 0
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
  }, [projectListPreferences.sessionSearchQuery, projects, sessionsByProject, loadProjectSessions, t]);

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

  // Apply filtering to sessions (global filter only - per-project filtering happens in render)
  const filteredSessions = useMemo(() => {
    let result = sessions;

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
  }, [sessions, projectListPreferences.hideEmptySessions, projectListPreferences.hideAgentSessions, projectListPreferences.sessionSearchQuery]);

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
  }, [projectListPreferences.groupBy, filteredAndSortedProjects]);

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

  const toggleProject = (projectPath: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectPath)) {
        newSet.delete(projectPath);
      } else {
        newSet.add(projectPath);
      }
      return newSet;
    });
  };

  // Load sessions for multiple projects in parallel (without selecting them)
  const loadSessionsForProjects = async (projectPaths: string[]) => {
    console.log(`📥 Loading sessions for ${projectPaths.length} projects in parallel...`);

    // Mark projects as loading
    setLoadingProjects((prev) => {
      const newSet = new Set(prev);
      projectPaths.forEach((path) => newSet.add(path));
      return newSet;
    });

    // Load all projects' sessions in parallel
    // Use loadProjectSessions directly to avoid changing selectedProject
    const loadPromises = projectPaths.map(async (path) => {
      try {
        await loadProjectSessions(path);
        console.log(`  ✅ Loaded sessions for ${path}`);
      } catch (error) {
        console.error(`  ❌ Failed to load sessions for ${path}:`, error);
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
    console.log(`✅ Finished loading sessions for ${projectPaths.length} projects`);
  };

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
  }, [filteredAndSortedProjects]);

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
      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
            {allSessionsFlat.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t("components:session.noSessions", "No sessions found")}</p>
              </div>
            ) : (
              allSessionsFlat.map((session) => {
                const isSelected = selectedSession?.session_id === session.session_id;

                return (
                  <button
                    key={session.session_id}
                    onClick={() => {
                      // Find the project for this session
                      const project = filteredAndSortedProjects.find(p => p.path === session.projectPath);
                      if (project) {
                        onProjectSelect(project);
                      }
                      onSessionSelect(session);
                    }}
                    className={cn(
                      "text-left w-full p-2 rounded transition-colors flex items-start space-x-2",
                      isSelected
                        ? "bg-blue-100 dark:bg-blue-900/40 border-l-2 border-blue-500"
                        : "hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                  >
                    {/* Provider Icon */}
                    <ProviderIcon
                      providerId={session.providerId || ""}
                      className={cn("w-4 h-4 mt-0.5 flex-shrink-0", getProviderColorClass(session.providerId))}
                    />

                    {/* Session Info */}
                    <div className="flex-1 min-w-0">
                      {/* Session Title */}
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
                          {getSessionTitle(session)}
                        </p>
                      </div>

                      {/* Project Name (subdued) */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {session.projectName}
                      </p>

                      {/* Metadata row */}
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="whitespace-nowrap">{t("message.count", { count: session.message_count })}</span>
                        <span>•</span>
                        <span className="whitespace-nowrap">{formatTimeAgo(session.last_modified)}</span>
                        {session.has_tool_use && (
                          <Wrench className="w-3 h-3 flex-shrink-0" />
                        )}
                        {session.has_errors && (
                          <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                        )}
                        {session.is_problematic && (
                          <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          // NORMAL PROJECT TREE VIEW
          <div className="space-y-2">
            {Object.entries(groupedProjects).map(([groupName, groupProjects]) => (
              <div key={groupName}>
                {/* Group Header (only if grouped by source) */}
                {projectListPreferences.groupBy === "source" && (
                  <div className="px-3 py-2 bg-gray-200 dark:bg-gray-750 border-b border-gray-300 dark:border-gray-600">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      {groupName}
                    </p>
                  </div>
                )}

                {/* Projects in this group */}
                {groupProjects.map((project) => {
                  const isExpanded = expandedProjects.has(project.path);
                  const isLoadingProject = loadingProjects.has(project.path);

                  return (
                    <div key={project.path}>
                      {/* Project Header */}
                      <div className="flex items-center w-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        {/* Expand/Collapse Chevron - Separate clickable area */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation(); // Don't trigger project selection

                            const willBeExpanded = !isExpanded;

                            // Toggle expansion state
                            toggleProject(project.path);

                            // If expanding, load sessions for this project (without selecting it)
                            if (willBeExpanded) {
                              await loadSessionsForProjects([project.path]);
                            }
                          }}
                          className="p-3 pr-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-l transition-colors"
                          title={isExpanded ? "Collapse" : "Expand"}
                          disabled={isLoadingProject}
                        >
                          {isLoadingProject ? (
                            <Loader2 className="w-4 h-4 text-blue-500 dark:text-blue-400 animate-spin" />
                          ) : isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>

                        {/* Project Name - Clickable area for selection */}
                        <button
                          onClick={() => {
                            // Select project and expand if collapsed
                            onProjectSelect(project);

                            // Auto-expand when selecting a project (if not already expanded)
                            if (!isExpanded) {
                              toggleProject(project.path);
                            }
                          }}
                          className="flex-1 text-left p-3 pl-1 flex items-center space-x-2"
                        >
                          <ProviderIcon
                            providerId={project.providerId || ""}
                            className={cn("w-4 h-4", getProviderColorClass(project.providerId))}
                          />
                          <div className="min-w-0 flex-1 flex items-center">
                            <p
                              className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm"
                              title={project.name}
                            >
                              {project.name}
                            </p>
                          </div>
                        </button>
                      </div>

                  {/* Sessions for expanded project */}
                  {isExpanded && !isLoading && (() => {
                    const projectSessions = getSessionsForProject(project.path);
                    if (projectSessions.length === 0) {
                      return null;
                    }
                    return (
                      <div className="ml-6 space-y-1">
                        {projectSessions.map((session) => {
                        const isSessionSelected =
                          selectedSession?.session_id === session.session_id;

                        return (
                          <button
                            key={session.session_id}
                            onClick={() => {
                              // Toggle: click selected session to deselect
                              if (isSessionSelected) {
                                onSessionSelect(null);
                              } else {
                                onSessionSelect(session);
                              }
                            }}
                            className={cn(
                              "w-full text-left p-3 rounded-lg transition-colors",
                              isSessionSelected
                                ? "bg-blue-100 dark:bg-blue-900 border-l-4 border-blue-400 dark:border-blue-500"
                                : "hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                          >
                            <div className="flex items-start space-x-3">
                              <MessageCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <h3
                                    className="font-medium text-gray-800 dark:text-gray-200 text-xs truncate flex-1 min-w-0"
                                    title={getSessionTitle(session)}
                                  >
                                    {getSessionTitle(session)}
                                  </h3>
                                  <div className="flex items-center space-x-1 flex-shrink-0">
                                    {session.has_tool_use && (
                                      <span
                                        title={t(
                                          "components:tools.toolUsed",
                                          "Tool used"
                                        )}
                                      >
                                        <Wrench className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                      </span>
                                    )}
                                    {session.has_errors && (
                                      <span
                                        title={t(
                                          "components:tools.errorOccurred",
                                          "Error occurred"
                                        )}
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                      </span>
                                    )}
                                    {session.is_problematic && (
                                      <span
                                        title={t(
                                          "components:tools.sessionProblematic",
                                          "Session not resumable (fix available)"
                                        )}
                                      >
                                        <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 text-xs text-gray-400 mt-1 overflow-hidden">
                                  <span className="whitespace-nowrap">
                                    {formatTimeAgo(session.last_modified)}
                                  </span>
                                  <span>•</span>
                                  <span className="whitespace-nowrap">
                                    {t(
                                      "components:message.count",
                                      "{{count}} messages",
                                      {
                                        count: session.message_count,
                                      }
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span
                                    className="truncate"
                                    title={`${t(
                                      "components:session.actualId",
                                      "Actual ID"
                                    )}: ${session.actual_session_id}`}
                                  >
                                    ID: {session.actual_session_id}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ))}
          </div>
        )}
      </div>
    </div>
  );
};
