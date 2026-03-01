/**
 * Tool name categorization and display utilities.
 */

export type ToolCategory = 'read' | 'write' | 'execute' | 'search' | 'task' | 'other';

const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'BashOutput']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);
const EXECUTE_TOOLS = new Set(['Bash', 'KillShell']);
const SEARCH_TOOLS = new Set(['WebSearch', 'WebFetch', 'ToolSearch']);
const TASK_TOOLS = new Set(['Task', 'TaskOutput', 'TaskStop', 'TodoWrite', 'TodoRead']);

export function getToolCategory(toolName: string): ToolCategory {
  if (READ_TOOLS.has(toolName)) return 'read';
  if (WRITE_TOOLS.has(toolName)) return 'write';
  if (EXECUTE_TOOLS.has(toolName)) return 'execute';
  if (SEARCH_TOOLS.has(toolName)) return 'search';
  if (TASK_TOOLS.has(toolName)) return 'task';
  return 'other';
}

export function getToolDisplayName(toolName: string): string {
  // Convert CamelCase to "Camel Case"
  return toolName.replace(/([A-Z])/g, ' $1').trim();
}

export function isReadOnlyTool(toolName: string): boolean {
  return getToolCategory(toolName) === 'read' || getToolCategory(toolName) === 'search';
}

export function isWriteTool(toolName: string): boolean {
  return getToolCategory(toolName) === 'write';
}
