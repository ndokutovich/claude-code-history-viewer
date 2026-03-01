/**
 * ProjectGroup
 *
 * Renders a group section containing a header (when grouped by source) and
 * all the project rows (with their expanded session rows) within that group.
 */

import React from "react";
import type { TFunction } from "i18next";
import type { UIProject, UISession } from "../../../types";
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
}) => {
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
      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.path);
        const isLoadingProject = loadingProjects.has(project.path);

        return (
          <div key={project.path}>
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

            {/* Sessions for expanded project */}
            {isExpanded && !isLoading && (() => {
              const projectSessions = getSessionsForProject(project.path);
              if (projectSessions.length === 0) {
                return null;
              }
              return (
                <div className="ml-6 space-y-1">
                  {projectSessions.map((session) => (
                    <SessionRow
                      key={session.session_id}
                      session={session}
                      selectedSession={selectedSession}
                      onSessionSelect={onSessionSelect}
                      onContextMenu={onSessionContextMenu}
                      formatTimeAgo={formatTimeAgo}
                      t={t}
                      ariaLevel={2}
                    />
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
