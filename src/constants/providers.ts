/**
 * Provider Configuration Constants
 *
 * Centralized configuration for different AI coding assistant providers
 */

export type ProviderId =
  | 'claude-code'
  | 'cursor'
  | 'gemini'
  | 'codex'
  | 'opencode'
  | 'copilot';

/**
 * Color class mappings for provider badges
 * Uses Tailwind CSS classes for consistent styling across light/dark modes
 */
export const PROVIDER_COLORS: Record<string, string> = {
  'claude-code': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'cursor':      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'gemini':      'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  'codex':       'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'opencode':    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'copilot':     'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

/**
 * Default color for unknown providers
 */
export const DEFAULT_PROVIDER_COLOR = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

/**
 * Get color class for a given provider ID
 * @param providerId - The provider identifier
 * @returns Tailwind CSS color classes for the provider badge
 */
export const getProviderColor = (providerId: string): string => {
  return PROVIDER_COLORS[providerId] || DEFAULT_PROVIDER_COLOR;
};
