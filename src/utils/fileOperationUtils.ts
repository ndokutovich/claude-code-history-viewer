/**
 * Utility functions for file operations (colors, icons, etc.)
 */

import { COLORS } from "../constants/colors";

/**
 * Get semantic color scheme for a file operation
 * @param operation - The file operation type (read, write, edit, etc.)
 * @returns Color scheme object with bg, text, icon, and border classes
 */
export function getOperationColor(operation: string) {
  switch (operation.toLowerCase()) {
    case "read":
      return COLORS.semantic.info;
    case "write":
    case "create":
      return COLORS.semantic.success;
    case "edit":
    case "multiedit":
      return COLORS.tools.code;
    case "glob":
      return COLORS.tools.search;
    case "delete":
      return COLORS.semantic.error;
    default:
      return COLORS.tools.system;
  }
}
