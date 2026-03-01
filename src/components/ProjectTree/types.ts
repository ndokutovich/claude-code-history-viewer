/**
 * ProjectTree Types
 *
 * Shared type definitions for ProjectTree components.
 */

import type { UIProject, UISession } from "../../types";

export interface ProjectTreeProps {
  projects: UIProject[];
  sessions: UISession[]; // Sessions for selected project only (backward compatibility)
  sessionsByProject: Record<string, UISession[]>; // Cache sessions per-project for multi-expansion
  selectedProject: UIProject | null;
  selectedSession: UISession | null;
  onProjectSelect: (project: UIProject | null) => void;
  onSessionSelect: (session: UISession | null) => void;
  onClearSelection: () => void;
  isLoading: boolean;
}
