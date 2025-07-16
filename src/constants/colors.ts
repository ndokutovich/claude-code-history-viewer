/**
 * Standardized color palette for Claude Code History Viewer
 * All colors should be referenced from this file to maintain consistency
 * Supports both light and dark themes
 */

// Base color tokens
export const COLORS = {
  // Brand colors from tailwind.config.js
  brand: {
    claudeBlue: "claude-blue",
    claudeBlueLight: "claude-blue-light",
    claudeOrange: "claude-orange",
  },

  // Semantic color mappings
  semantic: {
    // Error states
    error: {
      bg: "bg-red-50 dark:bg-red-950",
      bgDark: "bg-red-100 dark:bg-red-900",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-600 dark:text-red-400",
      textDark: "text-red-800 dark:text-red-300",
      icon: "text-red-500 dark:text-red-400",
    },

    // Success states
    success: {
      bg: "bg-green-50 dark:bg-green-950",
      bgDark: "bg-green-100 dark:bg-green-900",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-600 dark:text-green-400",
      textDark: "text-green-800 dark:text-green-300",
      icon: "text-green-500 dark:text-green-400",
    },

    // Warning states
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-950",
      bgDark: "bg-amber-100 dark:bg-amber-900",
      border: "border-yellow-200 dark:border-yellow-800",
      text: "text-yellow-600 dark:text-yellow-400",
      textDark: "text-yellow-800 dark:text-yellow-300",
      icon: "text-yellow-500 dark:text-yellow-400",
    },

    // Info/Primary states
    info: {
      bg: "bg-blue-50 dark:bg-blue-950",
      bgDark: "bg-blue-100 dark:bg-blue-900",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-600 dark:text-blue-400",
      textDark: "text-blue-800 dark:text-blue-300",
      icon: "text-blue-500 dark:text-blue-400",
    },
  },

  // Tool-specific colors
  tools: {
    // Code/Edit tools
    code: {
      bg: "bg-blue-50 dark:bg-blue-950",
      bgDark: "bg-blue-100 dark:bg-blue-900",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-800 dark:text-blue-300",
      icon: "text-blue-600 dark:text-blue-400",
    },

    // File system tools
    file: {
      bg: "bg-green-50 dark:bg-green-950",
      bgDark: "bg-green-100 dark:bg-green-900",
      border: "border-green-200 dark:border-green-800",
      text: "text-green-800 dark:text-green-300",
      icon: "text-green-600 dark:text-green-400",
    },

    // Search/Analysis tools
    search: {
      bg: "bg-purple-50 dark:bg-purple-950",
      bgDark: "bg-purple-100 dark:bg-purple-900",
      border: "border-purple-200 dark:border-purple-800",
      text: "text-purple-800 dark:text-purple-300",
      icon: "text-purple-600 dark:text-purple-400",
    },

    // Task/Todo tools
    task: {
      bg: "bg-orange-50 dark:bg-orange-950",
      bgDark: "bg-orange-100 dark:bg-orange-900",
      border: "border-orange-200 dark:border-orange-800",
      text: "text-orange-800 dark:text-orange-300",
      icon: "text-orange-600 dark:text-orange-400",
    },

    // System/Command tools
    system: {
      bg: "bg-indigo-50 dark:bg-indigo-950",
      bgDark: "bg-indigo-100 dark:bg-indigo-900",
      border: "border-indigo-200 dark:border-indigo-800",
      text: "text-indigo-800 dark:text-indigo-300",
      icon: "text-indigo-600 dark:text-indigo-400",
    },
  },

  // UI element colors
  ui: {
    // Background colors
    background: {
      primary: "bg-gray-50 dark:bg-gray-900",
      secondary: "bg-gray-100 dark:bg-gray-800",
      white: "bg-white dark:bg-gray-800",
      dark: "bg-gray-800 dark:bg-gray-200",
      darker: "bg-gray-900 dark:bg-gray-100",
      darkest: "bg-gray-950 dark:bg-gray-50",
      error: "bg-red-50 dark:bg-red-950",
    },

    // Border colors
    border: {
      light: "border-gray-200 dark:border-gray-700",
      medium: "border-gray-300 dark:border-gray-600",
      dark: "border-gray-700 dark:border-gray-300",
      error: "border-red-200 dark:border-red-800",
    },

    // Text colors
    text: {
      primary: "text-gray-900 dark:text-gray-100",
      secondary: "text-gray-700 dark:text-gray-300",
      tertiary: "text-gray-600 dark:text-gray-400",
      muted: "text-gray-500 dark:text-gray-500",
      disabled: "text-gray-400 dark:text-gray-600",
      disabledDark: "text-gray-300 dark:text-gray-600",
      inverse: "text-gray-100 dark:text-gray-900",
      error: "text-red-600 dark:text-red-400",
    },

    // Interactive states
    interactive: {
      hover: "hover:bg-gray-200 dark:hover:bg-gray-700",
      hoverDark: "hover:bg-gray-700 dark:hover:bg-gray-200",
      active: "bg-gray-300 dark:bg-gray-600",
      focus: "focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400",
    },
  },

  // Message-specific colors
  message: {
    user: {
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-800 dark:text-gray-200",
    },
    assistant: {
      bg: "bg-gray-50 dark:bg-gray-900",
      text: "text-gray-800 dark:text-gray-100",
    },
    system: {
      bg: "bg-blue-50 dark:bg-blue-950",
      text: "text-blue-800 dark:text-blue-300",
    },
    thinking: {
      bg: "bg-purple-50 dark:bg-purple-950",
      text: "text-purple-800 dark:text-purple-300",
      border: "border-purple-200 dark:border-purple-800",
    },
  },
} as const;

// CSS/Hex color values for special cases
export const HEX_COLORS = {
  light: {
    // Code block backgrounds
    codeBackground: "#f3f4f6",
    codeBorder: "#e5e7eb",

    // Tool use specific
    successLight: "#f0fdf4",
    successBorder: "#bbf7d0",
    errorLight: "#fef2f2",
    errorBorder: "#fecaca",

    // Scrollbar colors
    scrollbarThumb: "rgb(156 163 175)", // gray-400
    scrollbarThumbHover: "rgb(107 114 128)", // gray-500
  },
  dark: {
    // Code block backgrounds
    codeBackground: "#1f2937", // gray-800
    codeBorder: "#374151", // gray-700

    // Tool use specific
    successLight: "#052e16", // green-950
    successBorder: "#166534", // green-800
    errorLight: "#450a0a", // red-950
    errorBorder: "#991b1b", // red-800

    // Scrollbar colors
    scrollbarThumb: "rgb(75 85 99)", // gray-600
    scrollbarThumbHover: "rgb(107 114 128)", // gray-500
  },
} as const;

// Utility function to combine color classes
export function getColorClasses(
  ...classes: (string | undefined | false)[]
): string {
  return classes.filter(Boolean).join(" ");
}

// Type helpers for TypeScript
export type ColorKey = keyof typeof COLORS;
export type SemanticColorKey = keyof typeof COLORS.semantic;
export type ToolColorKey = keyof typeof COLORS.tools;
export type UIColorKey = keyof typeof COLORS.ui;
export type MessageColorKey = keyof typeof COLORS.message;

// Theme type
export type Theme = "light" | "dark";
