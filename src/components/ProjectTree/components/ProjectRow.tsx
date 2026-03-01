/**
 * ProjectRow
 *
 * Renders a single project header row in the project tree.
 * Includes expand/collapse chevron and the project name button.
 */

import React from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { UIProject } from "../../../types";
import { cn } from "../../../utils/cn";
import { ProviderIcon, getProviderColorClass } from "../../icons/ProviderIcons";

export interface ProjectRowProps {
  project: UIProject;
  isExpanded: boolean;
  isLoading: boolean;
  selectedProject: UIProject | null;
  onToggle: (projectPath: string) => void;
  onProjectSelect: (project: UIProject | null) => void;
  onContextMenu: (e: React.MouseEvent, project: UIProject) => void;
  /** Called when ArrowRight is pressed and the project is collapsed */
  onExpandRequest?: (projectPath: string) => Promise<void>;
  /** Called when ArrowLeft is pressed and the project is expanded */
  onCollapseRequest?: (projectPath: string) => void;
}

export const ProjectRow: React.FC<ProjectRowProps> = ({
  project,
  isExpanded,
  isLoading,
  selectedProject,
  onToggle,
  onProjectSelect,
  onContextMenu,
  onExpandRequest,
  onCollapseRequest,
}) => {
  return (
    <div
      className="flex items-center w-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      onContextMenu={(e) => onContextMenu(e, project)}
    >
      {/* Expand/Collapse Chevron - Separate clickable area */}
      <button
        onClick={async (e) => {
          e.stopPropagation(); // Don't trigger project selection

          const willBeExpanded = !isExpanded;

          // Toggle expansion state
          onToggle(project.path);

          // If expanding, load sessions for this project (without selecting it)
          if (willBeExpanded && onExpandRequest) {
            await onExpandRequest(project.path);
          }
        }}
        className="p-3 pr-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-l transition-colors"
        title={isExpanded ? "Collapse" : "Expand"}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-blue-500 dark:text-blue-400 animate-spin" />
        ) : isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Project Name - Clickable area for selection */}
      <button
        role="treeitem"
        data-tree-expandable="true"
        aria-level={1}
        aria-expanded={isExpanded}
        aria-selected={selectedProject?.path === project.path}
        tabIndex={-1}
        onClick={() => {
          // Select project and expand if collapsed
          onProjectSelect(project);

          // Auto-expand when selecting a project (if not already expanded)
          if (!isExpanded) {
            onToggle(project.path);
          }
        }}
        onKeyDown={async (e) => {
          if (e.key === "ArrowRight" && !isExpanded) {
            e.preventDefault();
            e.stopPropagation();
            onToggle(project.path);
            if (onExpandRequest) {
              await onExpandRequest(project.path);
            }
          } else if (e.key === "ArrowLeft" && isExpanded) {
            e.preventDefault();
            e.stopPropagation();
            onToggle(project.path);
            if (onCollapseRequest) {
              onCollapseRequest(project.path);
            }
          }
        }}
        className={cn(
          "flex-1 text-left p-3 pl-1 flex items-center space-x-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset rounded"
        )}
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
  );
};
