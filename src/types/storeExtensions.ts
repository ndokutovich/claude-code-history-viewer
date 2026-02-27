// ============================================================================
// STORE EXTENSION TYPES (Fork-specific)
// ============================================================================
// Type definitions for store properties that exist at runtime but are not
// declared in the base useAppStore type. Used with `as unknown as ExtendedAppStore`
// pattern to avoid `@typescript-eslint/no-explicit-any`.

import type { MessageFilters, UISession } from '@/types';

/**
 * Extended store properties available at runtime.
 * These may come from fork-specific store slices or middleware.
 */
export interface ExtendedAppStore {
  messageViewMode?: 'formatted' | 'raw';
  messageFilters?: MessageFilters;
  loadAllMessages?: () => Promise<void>;
  setMessageViewMode?: (mode: string) => void;
  setMessageFilters?: (filters: Partial<MessageFilters>) => void;
  loadFileActivities?: (projectPath: string, filters?: Record<string, unknown>) => Promise<void>;
  loadProjectSessions?: (projectPath: string, excludeSidechain?: boolean) => Promise<UISession[]>;
  projectListPreferences?: ProjectListPrefs;
  setProjectListPreferences?: (prefs: Partial<ProjectListPrefs>) => void;
}

/**
 * Project list preferences shape.
 */
export interface ProjectListPrefs {
  groupBy: 'source' | 'none' | 'sessions';
  sortBy: 'name' | 'date';
  sortOrder: 'asc' | 'desc';
  hideEmptyProjects: boolean;
  hideEmptySessions: boolean;
  hideAgentSessions: boolean;
  sessionSearchQuery: string;
}

/**
 * Extended UISession properties that may exist at runtime.
 */
export interface ExtendedUISession {
  providerId?: string;
  provider?: string;
  is_problematic?: boolean;
}

/**
 * Extended UIMessage properties that may exist at runtime.
 */
export interface ExtendedUIMessage {
  toolUse?: unknown;
  toolUseResult?: unknown;
  model?: string;
  usage?: Record<string, unknown>;
  projectPath?: string;
}
