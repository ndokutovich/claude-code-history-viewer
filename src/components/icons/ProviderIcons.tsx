import React from "react";
import { Code2, Sparkles, Zap } from "lucide-react";

interface ProviderIconProps {
  providerId: string;
  className?: string;
}

/**
 * Claude Code Icon - Blue color scheme
 */
export const ClaudeCodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
      fill="currentColor"
      fillOpacity="0.1"
    />
    <path
      d="M12 6V18M8 10L12 6L16 10M8 14L12 18L16 14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Cursor IDE Icon - Black/Purple color scheme
 */
export const CursorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4 4L20 12L4 20V4Z"
      fill="currentColor"
      fillOpacity="0.2"
    />
    <path
      d="M4 4L20 12L4 20V4Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12H15"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Gemini CLI Icon - Teal/Green color scheme
 */
export const GeminiIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Sparkles className={className} />
);

/**
 * Codex CLI Icon - Orange/Amber color scheme
 */
export const CodexIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Zap className={className} />
);

/**
 * Generic provider icon (fallback)
 */
export const GenericProviderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <Code2 className={className} />
);

/**
 * Provider Icon Selector - Returns the appropriate icon based on provider ID
 */
export const ProviderIcon: React.FC<ProviderIconProps> = ({ providerId, className }) => {
  switch (providerId) {
    case "claude-code":
      return <ClaudeCodeIcon className={className} />;
    case "cursor":
      return <CursorIcon className={className} />;
    case "gemini":
      return <GeminiIcon className={className} />;
    case "codex":
      return <CodexIcon className={className} />;
    default:
      return <GenericProviderIcon className={className} />;
  }
};

/**
 * Provider-specific color classes
 */
export const getProviderColorClass = (providerId?: string): string => {
  switch (providerId) {
    case "claude-code":
      return "text-blue-500";
    case "cursor":
      return "text-purple-500";
    case "gemini":
      return "text-teal-500";
    case "codex":
      return "text-orange-500";
    default:
      return "text-gray-500";
  }
};
