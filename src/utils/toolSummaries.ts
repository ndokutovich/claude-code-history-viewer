/**
 * Tool Summaries Utility
 *
 * Generates human-readable natural language summaries for tool invocations,
 * used in collapsed tool-use cards and session timelines.
 */

/**
 * Returns a short natural-language description of a tool call.
 *
 * @param toolName - The tool name (e.g. "read_file", "bash", "TodoWrite")
 * @param input    - The tool input object (may be null/undefined)
 */
export const getNaturalLanguageSummary = (
  toolName: string,
  input: Record<string, unknown> | null | undefined
): string => {
  const name = toolName.toLowerCase();

  // Normalize path helper
  const getPath = (obj: Record<string, unknown> | null | undefined): string => {
    const p =
      obj?.path ||
      obj?.file_path ||
      obj?.filename ||
      obj?.TargetFile ||
      obj?.AbsolutePath ||
      "";
    // Return only the filename if path is long
    const parts = String(p).split(/[/\\]/);
    return parts.length > 2 ? `.../${parts[parts.length - 1]}` : String(p);
  };

  // Helper for command truncation
  const getCommand = (cmd: string): string => {
    if (!cmd) return "";
    return cmd.length > 50 ? cmd.substring(0, 47) + "..." : cmd;
  };

  if (name.includes("read") || name === "read_resource") {
    const p = getPath(input) || (input?.Uri as string);
    return p ? `Read ${p}` : "Read file";
  }

  if (
    name.includes("write") ||
    name.includes("edit") ||
    name === "replace_file_content" ||
    name === "multi_replace_file_content"
  ) {
    const p = getPath(input);
    return p ? `Edit ${p}` : "Edit file";
  }

  if (name === "list_dir" || name === "ls" || name === "list_files") {
    const p = (input?.DirectoryPath || input?.path || input?.SearchDirectory) as string;
    const shortPath = p ? String(p).split(/[/\\]/).pop() : "";
    return shortPath ? `List ${shortPath}/` : "List files";
  }

  if (name === "run_command" || name === "bash" || name === "execute_command") {
    const cmd = (input?.CommandLine || input?.command || input?.cmd) as string;
    if (cmd) {
      if (cmd.startsWith("git commit")) return "Git Commit";
      if (cmd.startsWith("git status")) return "Git Status";
      if (cmd.startsWith("git diff")) return "Git Diff";
      if (cmd.startsWith("npm run")) return `Run ${cmd.replace("npm run", "").trim()}`;
      return `Run: ${getCommand(cmd)}`;
    }
    return "Run command";
  }

  if (
    name === "grep_search" ||
    name === "glob_search" ||
    name === "find_by_name"
  ) {
    const query = (input?.Query || input?.query || input?.Pattern) as string;
    const path = (getPath(input) ||
      input?.SearchPath ||
      input?.SearchDirectory) as string;
    if (query && path) return `Search "${query}" in ${path}`;
    if (query) return `Search "${query}"`;
    return "Search files";
  }

  if (name === "search_web" || name === "google_search") {
    const q = (input?.query || input?.q) as string;
    return q ? `Web search: "${q}"` : "Web search";
  }

  if (name === "browser_subagent") {
    const task = (input?.TaskName || input?.Task) as string;
    return task ? `Browser: ${task}` : "Browser Task";
  }

  if (name === "view_file_outline") {
    const p = getPath(input);
    return p ? `Outline ${p}` : "View Outline";
  }

  // Fallback: prettify name + key params if possible
  return name.replace(/_/g, " ");
};

/**
 * Returns a display name for the agent that ran a tool.
 *
 * @param toolName - The tool name
 * @param input    - The tool input object (may be null/undefined)
 */
export const getAgentName = (
  toolName: string,
  input: Record<string, unknown> | null | undefined
): string => {
  const name = toolName.toLowerCase();

  if (name === "browser_subagent") return "Browser";
  if (name.includes("subagent")) {
    if (input?.TaskName) return input.TaskName as string;
    return "Subagent";
  }

  return "General Purpose";
};
