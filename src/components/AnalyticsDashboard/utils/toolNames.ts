/**
 * Tool Names Utility
 *
 * Maps tool names to display names.
 */

import type { TFunction } from "i18next";

/**
 * Get display name for a tool
 */
export const getToolDisplayName = (toolName: string, t: TFunction): string => {
  const toolMap: Record<string, string> = {
    Bash: t("tools:tools.terminal"),
    Read: t("tools:tools.readFile"),
    Edit: t("tools:tools.editFile"),
    Write: t("tools:tools.createFile"),
    MultiEdit: t("tools:tools.multiEdit"),
    Glob: t("tools:tools.findFiles"),
    Grep: t("tools:tools.searchText"),
    LS: t("tools:tools.browseDirectory"),
    Task: t("tools:tools.executeTask"),
    WebFetch: t("tools:tools.webFetch"),
    WebSearch: t("tools:tools.webSearch"),
    NotebookRead: t("tools:tools.notebookRead"),
    NotebookEdit: t("tools:tools.notebookEdit"),
    TodoRead: t("tools:tools.todoRead"),
    TodoWrite: t("tools:tools.todoWrite"),
    exit_plan_mode: t("tools:tools.exitPlanMode"),
  };

  return toolMap[toolName] || toolName;
};
