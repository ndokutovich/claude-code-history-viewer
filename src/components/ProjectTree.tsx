// src/components/ProjectTree.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Folder,
  Wrench,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ClaudeProject, ClaudeSession } from "../types";
import { cn } from "../utils/cn";
import { getLocale } from "../utils/time";
import { getSessionTitle } from "../utils/sessionUtils";
import { ProjectListControls } from "./ProjectListControls";
import { useAppStore } from "../store/useAppStore";
import { ProviderIcon, getProviderColorClass } from "./icons/ProviderIcons";

interface ProjectTreeProps {
  projects: ClaudeProject[];
  sessions: ClaudeSession[]; // Legacy: sessions for selected project only
  sessionsByProject: Record<string, ClaudeSession[]>; // NEW: Cache sessions per-project for multi-expansion
  selectedProject: ClaudeProject | null;
  selectedSession: ClaudeSession | null;
  onProjectSelect: (project: ClaudeProject | null) => void;
  onSessionSelect: (session: ClaudeSession | null) => void;
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
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const { t, i18n } = useTranslation();
  const { projectListPreferences, loadProjectSessions } = useAppStore();

  // Apply filtering and sorting to projects
  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects];

    // Filter: Hide empty projects
    if (projectListPreferences.hideEmptyProjects) {
      result = result.filter((p) => p.session_count > 0);
    }

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
  }, [projects, projectListPreferences]);

  // Apply filtering to sessions (global filter only - per-project filtering happens in render)
  const filteredSessions = useMemo(() => {
    if (!projectListPreferences.hideEmptySessions) {
      return sessions;
    }

    return sessions.filter((s) => s.message_count > 0);
  }, [sessions, projectListPreferences.hideEmptySessions]);

  // Helper function to get sessions for a specific project
  const getSessionsForProject = (projectPath: string): ClaudeSession[] => {
    // Try cache first (new multi-project architecture)
    const cachedSessions = sessionsByProject[projectPath];

    if (cachedSessions && cachedSessions.length > 0) {
      // Debug logging for Cursor projects
      if (projectPath.includes('workspaceStorage')) {
        const parts = projectPath.split(/[\/\\]/);
        const wsId = parts[parts.length - 1];
        console.log(`📂 Project ${wsId}: Using ${cachedSessions.length} cached sessions`);
      }

      // Apply hide empty sessions filter
      if (projectListPreferences.hideEmptySessions) {
        return cachedSessions.filter((s) => s.message_count > 0);
      }
      return cachedSessions;
    }

    // Fallback to legacy behavior for backward compatibility
    // If this is the selected project, return filteredSessions
    if (selectedProject?.path === projectPath) {
      return filteredSessions;
    }

    // No sessions loaded for this project yet
    return [];
  };

  // Group projects by source if needed
  const groupedProjects = useMemo(() => {
    if (projectListPreferences.groupBy !== "source") {
      return { ungrouped: filteredAndSortedProjects };
    }

    const groups: Record<string, ClaudeProject[]> = {};
    filteredAndSortedProjects.forEach((project) => {
      const groupName = project.providerName || "Unknown";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(project);
    });

    return groups;
  }, [filteredAndSortedProjects, projectListPreferences.groupBy]);

  // Collect all sessions from all projects for flat view mode
  const allSessionsFlat = useMemo(() => {
    if (projectListPreferences.groupBy !== 'sessions') {
      return [];
    }

    // Collect all sessions from sessionsByProject cache
    const allSessions: (ClaudeSession & { projectPath: string; projectName: string; providerId?: string })[] = [];

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

    // Load all projects' sessions in parallel
    // Use loadProjectSessions directly to avoid changing selectedProject
    const loadPromises = projectPaths.map(async (path) => {
      try {
        await loadProjectSessions(path);
        console.log(`  ✅ Loaded sessions for ${path}`);
      } catch (error) {
        console.error(`  ❌ Failed to load sessions for ${path}:`, error);
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

    window.addEventListener('expandAllProjects', handleExpandAll);
    window.addEventListener('collapseAllProjects', handleCollapseAll);

    return () => {
      window.removeEventListener('expandAllProjects', handleExpandAll);
      window.removeEventListener('collapseAllProjects', handleCollapseAll);
    };
  }, [filteredAndSortedProjects]);

  return (
    <div className="max-w-80 w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 flex flex-col h-full">
      {/* Project List Controls */}
      <ProjectListControls />

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
                      <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{session.message_count} messages</span>
                        <span>•</span>
                        <span>{formatTimeAgo(session.last_modified)}</span>
                        {session.has_tool_use && (
                          <>
                            <Wrench className="w-3 h-3" />
                          </>
                        )}
                        {session.has_errors && (
                          <>
                            <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-500" />
                          </>
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

                  return (
                    <div key={project.path}>
                      {/* Project Header */}
                      <button
                        onClick={() => {
                          const wasExpanded = isExpanded;
                          const isAlreadySelected = selectedProject?.path === project.path;

                          console.log(`🖱️ Clicked project: ${project.name}`, {
                            path: project.path,
                            wasExpanded,
                            isAlreadySelected,
                          });

                          // Always select/load sessions for this project
                          onProjectSelect(project);

                          // Expansion logic:
                          // - If already selected and expanded, allow toggle (collapse)
                          // - If not expanded, expand to show sessions
                          // - If expanded but not selected, keep expanded (we just selected it)
                          if (isAlreadySelected && wasExpanded) {
                            // Clicking selected project again: toggle collapse
                            console.log(`  🔽 Toggling collapse (already selected)`);
                            toggleProject(project.path);
                          } else if (!wasExpanded) {
                            // Collapsed project: expand it
                            console.log(`  🔼 Expanding (was collapsed)`);
                            toggleProject(project.path);
                          } else {
                            console.log(`  ✅ Keeping expanded (newly selected)`);
                          }
                          // else: already expanded, newly selected - keep expanded
                        }}
                        className="text-left w-full p-3 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                      >
                    <div className="flex items-center space-x-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      )}
                      <ProviderIcon
                        providerId={project.providerId || ""}
                        className={cn("w-4 h-4", getProviderColorClass(project.providerId))}
                      />
                      <div className="min-w-0 flex-1 flex items-center">
                        <p className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm max-w-56">
                          {project.name}
                        </p>
                      </div>
                    </div>
                  </button>

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
                                <div className="flex items-center justify-between">
                                  <h3
                                    className="font-medium text-gray-800 dark:text-gray-200 text-xs truncate"
                                    title={getSessionTitle(session)}
                                  >
                                    {getSessionTitle(session)}
                                  </h3>
                                  <div className="flex items-center space-x-1">
                                    {session.has_tool_use && (
                                      <span
                                        title={t(
                                          "components:tools.toolUsed",
                                          "Tool used"
                                        )}
                                      >
                                        <Wrench className="w-3 h-3 text-blue-400" />
                                      </span>
                                    )}
                                    {session.has_errors && (
                                      <span
                                        title={t(
                                          "components:tools.errorOccurred",
                                          "Error occurred"
                                        )}
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center space-x-1 text-xs text-gray-400 mt-1">
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
                                    ID: {session.actual_session_id.slice(0, 8)}
                                    ...
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
