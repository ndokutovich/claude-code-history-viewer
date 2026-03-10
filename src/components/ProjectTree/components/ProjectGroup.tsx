/**
 * ProjectGroup
 *
 * Renders a group section containing a header (when grouped by source) and
 * all the project rows (with their expanded session rows) within that group.
 */

import React from "react";
import { EyeOff } from "lucide-react";
import type { TFunction } from "i18next";
import type { UIProject, UISession } from "../../../types";
import { cn } from "../../../utils/cn";
import { ProjectRow } from "./ProjectRow";
import { SessionRow } from "./SessionRow";

export interface ProjectGroupProps {
  groupName: string;
  projects: UIProject[];
  /** Whether to render the group header (true when groupBy === "source") */
  showGroupHeader: boolean;
  expandedProjects: Set<string>;
  loadingProjects: Set<string>;
  selectedProject: UIProject | null;
  selectedSession: UISession | null;
  isLoading: boolean;
  getSessionsForProject: (projectPath: string) => UISession[];
  onToggle: (projectPath: string) => void;
  onProjectSelect: (project: UIProject | null) => void;
  onSessionSelect: (session: UISession | null) => void;
  onProjectContextMenu: (e: React.MouseEvent, project: UIProject) => void;
  onSessionContextMenu: (e: React.MouseEvent, session: UISession) => void;
  onExpandRequest: (projectPath: string) => Promise<void>;
  formatTimeAgo: (dateStr: string) => string;
  t: TFunction;
  /** Capture mode props */
  isCaptureMode?: boolean;
  hiddenProjectPaths?: Set<string>;
  hiddenSessionIds?: Set<string>;
  onHideProject?: (projectPath: string) => void;
  onHideSession?: (sessionId: string) => void;
}

export const ProjectGroup: React.FC<ProjectGroupProps> = ({
  groupName,
  projects,
  showGroupHeader,
  expandedProjects,
  loadingProjects,
  selectedProject,
  selectedSession,
  isLoading,
  getSessionsForProject,
  onToggle,
  onProjectSelect,
  onSessionSelect,
  onProjectContextMenu,
  onSessionContextMenu,
  onExpandRequest,
  formatTimeAgo,
  t,
  isCaptureMode,
  hiddenProjectPaths,
  hiddenSessionIds,
  onHideProject,
  onHideSession,
}) => {
  // Filter hidden projects in capture mode
  const visibleProjects = isCaptureMode && hiddenProjectPaths
    ? projects.filter((p) => !hiddenProjectPaths.has(p.path))
    : projects;

  return (
    <div key={groupName}>
      {/* Group Header (only if grouped by source) */}
      {showGroupHeader && (
        <div className="px-3 py-2 bg-gray-200 dark:bg-gray-750 border-b border-gray-300 dark:border-gray-600">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            {groupName}
          </p>
        </div>
      )}

      {/* Projects in this group */}
      {visibleProjects.map((project) => {
        const isExpanded = expandedProjects.has(project.path);
        const isLoadingProject = loadingProjects.has(project.path);

        return (
          <div key={project.path} className="relative group/project">
            <ProjectRow
              project={project}
              isExpanded={isExpanded}
              isLoading={isLoadingProject}
              selectedProject={selectedProject}
              onToggle={onToggle}
              onProjectSelect={onProjectSelect}
              onContextMenu={onProjectContextMenu}
              onExpandRequest={onExpandRequest}
            />

            {/* Hide Project Button (Capture Mode) */}
            {isCaptureMode && onHideProject && (
              <button
                onClick={(e) => { e.stopPropagation(); onHideProject(project.path); }}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded",
                  "opacity-0 group-hover/project:opacity-100 transition-opacity",
                  "text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                )}
                title={t("renderers:captureMode.hideProject", "Hide project")}
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Sessions for expanded project */}
            {isExpanded && !isLoading && (() => {
              const projectSessions = getSessionsForProject(project.path);
              // Filter hidden sessions in capture mode
              const visibleSessions = isCaptureMode && hiddenSessionIds
                ? projectSessions.filter((s) => !hiddenSessionIds.has(s.session_id))
                : projectSessions;
              if (visibleSessions.length === 0) {
                return null;
              }
              return (
                <div className="ml-6 space-y-1">
                  {visibleSessions.map((session) => (
                    <div key={session.session_id} className="relative group/session">
                      <SessionRow
                        session={session}
                        selectedSession={selectedSession}
                        onSessionSelect={onSessionSelect}
                        onContextMenu={onSessionContextMenu}
                        formatTimeAgo={formatTimeAgo}
                        t={t}
                        ariaLevel={2}
                      />
                      {/* Hide Session Button (Capture Mode) */}
                      {isCaptureMode && onHideSession && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onHideSession(session.session_id); }}
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded",
                            "opacity-0 group-hover/session:opacity-100 transition-opacity",
                            "text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                          )}
                          title={t("renderers:captureMode.hideSession", "Hide session")}
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
};
