/** Represents a single task operation parsed from tool use */
export interface TaskInfo {
  id: string;
  subject?: string;
  description?: string;
  status?: string;
  activeForm?: string;
}

/** A parsed task tool-use operation */
export interface TaskOperation {
  toolName: string;
  input: Record<string, unknown>;
  task?: TaskInfo;
}
