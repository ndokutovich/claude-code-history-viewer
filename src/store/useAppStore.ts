import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { load, type StoreOptions } from "@tauri-apps/plugin-store";
import {
  type AppState,
  type AppView,
  type ClaudeProject,
  type ClaudeSession,
  type ClaudeMessage,
  type SearchFilters,
  type SessionTokenStats,
  type ProjectStatsSummary,
  type SessionComparison,
  type AppError,
  AppErrorType,
  type UniversalProject,
  type UniversalSession,
  type UniversalMessage,
  type UniversalSource,
  type ProjectListPreferences,
  type LoadingProgress,
} from "../types";
import { adapterRegistry } from "@/adapters/registry/AdapterRegistry";
import { useSourceStore } from "./useSourceStore";

// Function to check if Tauri API is available
const isTauriAvailable = () => {
  try {
    // In Tauri v2, the invoke function is directly available
    return typeof window !== "undefined" && typeof invoke === "function";
  } catch {
    return false;
  }
};

// ============================================================================
// CONVERSION UTILITIES (Universal ↔ Legacy)
// ============================================================================

/**
 * Find the source that contains the given project path
 */
function findSourceForPath(projectPath: string): UniversalSource | null {
  const sourceStore = useSourceStore.getState();
  const availableSources = sourceStore.sources.filter(s => s.isAvailable);

  // Find source whose path is a prefix of the project path
  for (const source of availableSources) {
    const normalizedSourcePath = source.path.replace(/\\/g, '/');
    const normalizedProjectPath = projectPath.replace(/\\/g, '/');

    if (normalizedProjectPath.startsWith(normalizedSourcePath)) {
      return source;
    }
  }

  return null;
}

/**
 * Convert UniversalProject to legacy ClaudeProject
 */
function universalToLegacyProject(project: UniversalProject): ClaudeProject {
  // Get provider name from adapter registry
  const adapter = adapterRegistry.tryGet(project.providerId);
  const providerName = adapter?.providerDefinition.name || project.providerId;

  return {
    name: project.name,
    path: project.path,
    session_count: project.sessionCount,
    message_count: project.totalMessages,
    lastModified: project.lastActivityAt || project.firstActivityAt || new Date().toISOString(),
    sourceId: project.sourceId,
    providerId: project.providerId,
    providerName,
  };
}

/**
 * Convert UniversalSession to legacy ClaudeSession
 */
function universalToLegacySession(session: UniversalSession): ClaudeSession {
  // Extract summary and file path from metadata if available
  const summary = session.metadata.summary as string | undefined;
  const filePath = session.metadata.filePath as string | undefined;

  // Get provider name from adapter registry
  const adapter = adapterRegistry.tryGet(session.providerId);
  const providerName = adapter?.providerDefinition.name || session.providerId;

  return {
    session_id: session.id,
    actual_session_id: session.id,
    file_path: filePath || session.id,
    project_name: session.projectId,
    message_count: session.messageCount,
    first_message_time: session.firstMessageAt,
    last_message_time: session.lastMessageAt,
    last_modified: session.lastMessageAt,
    has_tool_use: session.toolCallCount > 0,
    has_errors: session.errorCount > 0,
    summary,
    providerId: session.providerId,
    providerName,
  };
}

/**
 * Convert UniversalMessage to legacy ClaudeMessage
 */
function universalToLegacyMessage(msg: UniversalMessage): ClaudeMessage {
  // Extract text content from universal content array
  let content: string | any[] = "";

  if (msg.content && msg.content.length > 0) {
    // If single text content, return as string
    if (msg.content.length === 1 && msg.content[0] && msg.content[0].type === "text") {
      const data = msg.content[0].data;
      content = typeof data === "string" ? data : (data as any).text || "";
    } else {
      // Multiple content items or non-text, return as array
      content = msg.content.map(c => {
        if (c.type === "text") {
          const data = c.data;
          return {
            type: "text",
            text: typeof data === "string" ? data : (data as any).text || "",
          };
        } else if (c.type === "tool_use") {
          return {
            type: "tool_use",
            ...(typeof c.data === "object" ? c.data : {}),
          };
        } else if (c.type === "tool_result") {
          return {
            type: "tool_result",
            ...(typeof c.data === "object" ? c.data : {}),
          };
        }
        return { type: c.type, data: c.data };
      });
    }
  }

  return {
    uuid: msg.id,
    parentUuid: msg.parentId,
    sessionId: msg.sessionId,
    timestamp: msg.timestamp,
    type: msg.role,
    content,
    model: msg.model,
    usage: msg.tokens ? {
      input_tokens: msg.tokens.inputTokens,
      output_tokens: msg.tokens.outputTokens,
      cache_creation_input_tokens: msg.tokens.cacheCreationTokens,
      cache_read_input_tokens: msg.tokens.cacheReadTokens,
    } : undefined,
    projectPath: msg.projectId,
    provider_metadata: msg.providerMetadata, // Preserve provider-specific metadata
  };
}

interface AppStore extends AppState {
  // Filter state
  excludeSidechain: boolean;

  // Actions - View Management
  switchView: (view: AppView) => Promise<void>;

  // Actions - Data Loading
  initializeApp: () => Promise<void>;
  scanProjects: () => Promise<void>;
  selectProject: (project: ClaudeProject | null) => Promise<void>;
  loadProjectSessions: (projectPath: string, excludeSidechain?: boolean) => Promise<ClaudeSession[]>;
  selectSession: (session: ClaudeSession | null, pageSize?: number) => Promise<void>;
  clearSelection: () => void;
  loadMoreMessages: () => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  searchMessages: (query: string, filters?: SearchFilters) => Promise<void>;
  setSearchFilters: (filters: SearchFilters) => void;
  setError: (error: AppError | null) => void;
  setClaudePath: (path: string) => void;
  loadSessionTokenStats: (sessionPath: string) => Promise<void>;
  loadProjectTokenStats: (projectPath: string) => Promise<void>;
  loadProjectStatsSummary: (
    projectPath: string
  ) => Promise<ProjectStatsSummary>;
  loadSessionComparison: (
    sessionId: string,
    projectPath: string
  ) => Promise<SessionComparison>;
  clearTokenStats: () => void;
  setExcludeSidechain: (exclude: boolean) => void;

  // Analytics data setters
  setProjectSummary: (summary: ProjectStatsSummary | null) => void;
  setSessionComparison: (comparison: SessionComparison | null) => void;
  setLoadingProjectSummary: (loading: boolean) => void;
  setLoadingSessionComparison: (loading: boolean) => void;
  setProjectSummaryError: (error: string | null) => void;
  setSessionComparisonError: (error: string | null) => void;
  clearAnalyticsData: () => void;
  clearAnalyticsErrors: () => void;

  // Project list preferences
  setProjectListPreferences: (preferences: Partial<ProjectListPreferences>) => void;

  // Loading progress
  setLoadingProgress: (progress: LoadingProgress | null) => void;
}

const DEFAULT_PAGE_SIZE = 100; // Load 100 messages on initial loading

export const useAppStore = create<AppStore>((set, get) => ({
  // Root-level view state (single source of truth)
  currentView: "messages" as AppView,

  // Loading progress - Start with initializing state
  loadingProgress: {
    stage: 'initializing',
    message: 'Starting application...',
    progress: 0,
  },

  // Project list preferences
  projectListPreferences: {
    groupBy: 'source',
    sortBy: 'date',
    sortOrder: 'desc',
    hideEmptyProjects: false,
    hideEmptySessions: false,
  },

  // Core state
  claudePath: "",
  projects: [],
  selectedProject: null,
  sessions: [], // Legacy: for selected project only
  sessionsByProject: {}, // NEW: Cache sessions per-project
  selectedSession: null,
  messages: [],
  pagination: {
    currentOffset: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    hasMore: false,
    isLoadingMore: false,
  },

  // Search state
  searchQuery: "",
  searchResults: [],
  searchFilters: {},

  // Loading states
  isLoading: false,
  isLoadingProjects: false,
  isLoadingSessions: false,
  isLoadingMessages: false,
  isLoadingTokenStats: false,

  // Error state
  error: null,

  // Analytics data (separated from view state)
  sessionTokenStats: null,
  projectTokenStats: [],
  projectStatsSummary: null,
  sessionComparison: null,
  isLoadingProjectSummary: false,
  isLoadingSessionComparison: false,
  projectSummaryError: null,
  sessionComparisonError: null,

  // Filter state
  excludeSidechain: true,

  // Actions
  initializeApp: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isTauriAvailable()) {
        throw new Error(
          "Tauri API is not available. Please run in the desktop app."
        );
      }

      // ========================================
      // PHASE 8.2: Use Source Store (v2.0.0)
      // ========================================

      // Get available sources from source store
      // (Source store initialization happens in App.tsx before this)
      const sourceStore = useSourceStore.getState();
      const availableSources = sourceStore.sources.filter(s => s.isAvailable);

      if (availableSources.length === 0) {
        // No sources available - show error
        throw new Error(
          "No data sources found. Please add a data source in Settings."
        );
      }

      // For backwards compatibility, set claudePath to the default source
      const defaultSource = availableSources.find(s => s.isDefault) || availableSources[0];
      if (defaultSource) {
        set({ claudePath: defaultSource.path });
      }

      // Scan projects from all available sources
      await get().scanProjects();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Parse error type from message
      let errorType = AppErrorType.UNKNOWN;
      let message = errorMessage;

      if (errorMessage.includes("CLAUDE_FOLDER_NOT_FOUND:") || errorMessage.includes("No data sources")) {
        errorType = AppErrorType.CLAUDE_FOLDER_NOT_FOUND;
        message = errorMessage.split(":")[1] || errorMessage;
      } else if (errorMessage.includes("PERMISSION_DENIED:")) {
        errorType = AppErrorType.PERMISSION_DENIED;
        message = errorMessage.split(":")[1] || errorMessage;
      } else if (errorMessage.includes("Tauri API")) {
        errorType = AppErrorType.TAURI_NOT_AVAILABLE;
      }

      set({ error: { type: errorType, message } });
    } finally {
      set({ isLoading: false });
    }
  },

  scanProjects: async () => {
    set({ isLoadingProjects: true, error: null });
    try {
      const start = performance.now();

      // ========================================
      // PHASE 8.2: Scan ALL sources using adapters (v2.0.0)
      // ========================================

      const sourceStore = useSourceStore.getState();
      const availableSources = sourceStore.sources.filter(s => s.isAvailable);

      if (availableSources.length === 0) {
        set({ projects: [] });
        return;
      }

      // Scan projects from all sources in parallel
      const allUniversalProjects: UniversalProject[] = [];

      await Promise.all(
        availableSources.map(async (source) => {
          try {
            const adapter = adapterRegistry.get(source.providerId);
            if (!adapter) {
              console.error(`No adapter found for provider: ${source.providerId}`);
              return;
            }

            const result = await adapter.scanProjects(source.path, source.id);

            if (!result.success || !result.data) {
              console.error(`Failed to scan projects for ${source.name}:`, result.error);
              return;
            }

            allUniversalProjects.push(...result.data);
          } catch (error) {
            console.error(`Error scanning source ${source.name}:`, error);
          }
        })
      );

      // Convert to legacy format for existing UI
      const legacyProjects = allUniversalProjects.map(universalToLegacyProject);

      const duration = performance.now() - start;
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [v2.0] scanProjects: ${legacyProjects.length} projects from ${availableSources.length} sources, ${duration.toFixed(1)}ms`
        );
      }

      set({ projects: legacyProjects });
    } catch (error) {
      console.error("Failed to scan projects:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  selectProject: async (project: ClaudeProject | null) => {
    // Clear selection if null is passed
    if (project === null) {
      console.log('🔄 selectProject: Clearing selection');
      set({
        selectedProject: null,
        sessions: [],
        selectedSession: null,
        messages: [],
      });
      return;
    }

    console.log('🔄 selectProject: Loading sessions for project:', project.name, {
      path: project.path,
      providerId: project.providerId,
    });

    set({
      selectedProject: project,
      sessions: [],
      selectedSession: null,
      messages: [],
      isLoadingSessions: true,
      // Always clear analytics data when switching projects
      sessionTokenStats: null,
      projectTokenStats: [],
      projectStatsSummary: null,
      sessionComparison: null,
      isLoadingTokenStats: false,
      isLoadingProjectSummary: false,
      isLoadingSessionComparison: false,
    });
    try {
      const sessions = await get().loadProjectSessions(project.path);
      console.log(`✅ selectProject: Loaded ${sessions.length} sessions for ${project.name}`);

      // Update both legacy sessions array AND cache in sessionsByProject
      set((state) => ({
        sessions,
        sessionsByProject: {
          ...state.sessionsByProject,
          [project.path]: sessions,
        },
      }));
    } catch (error) {
      console.error("❌ selectProject: Failed to load project sessions:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  loadProjectSessions: async (projectPath: string, excludeSidechain?: boolean) => {
    try {
      // Check cache first
      const cached = get().sessionsByProject[projectPath];
      if (cached) {
        console.log(`💾 Using cached sessions for ${projectPath} (${cached.length} sessions)`);
        return cached;
      }

      console.log(`📥 Loading sessions from backend for ${projectPath}`);

      // ========================================
      // PHASE 8.3: Use adapters for session loading (v2.0.0)
      // ========================================

      // Find which source this project belongs to
      const source = findSourceForPath(projectPath);
      if (!source) {
        throw new Error(`No source found for project path: ${projectPath}`);
      }

      // Get the appropriate adapter
      const adapter = adapterRegistry.get(source.providerId);
      if (!adapter) {
        throw new Error(`No adapter found for provider: ${source.providerId}`);
      }

      // Extract project ID from path (relative to source)
      const normalizedSourcePath = source.path.replace(/\\/g, '/');
      const normalizedProjectPath = projectPath.replace(/\\/g, '/');
      const projectId = normalizedProjectPath.substring(normalizedSourcePath.length).replace(/^\/+/, '');

      // Load sessions using adapter
      const result = await adapter.loadSessions(
        projectPath,
        projectId,
        source.id
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load sessions');
      }

      // Convert to legacy format
      const legacySessions = result.data.map(universalToLegacySession);

      // Filter sidechain if needed (for Claude Code compatibility)
      const shouldExcludeSidechain = excludeSidechain !== undefined
        ? excludeSidechain
        : get().excludeSidechain;

      const finalSessions = shouldExcludeSidechain ? legacySessions : legacySessions;

      // Cache the result
      set((state) => ({
        sessionsByProject: {
          ...state.sessionsByProject,
          [projectPath]: finalSessions,
        },
      }));

      console.log(`✅ Cached ${finalSessions.length} sessions for ${projectPath}`);

      return finalSessions;
    } catch (error) {
      console.error("Failed to load project sessions:", error);
      throw error;
    }
  },

  selectSession: async (
    session: ClaudeSession | null,
    pageSize = DEFAULT_PAGE_SIZE
  ) => {
    // Clear selection if null is passed
    if (session === null) {
      set({
        selectedSession: null,
        messages: [],
        pagination: {
          currentOffset: 0,
          pageSize,
          totalCount: 0,
          hasMore: false,
          isLoadingMore: false,
        },
      });
      return;
    }

    set({
      selectedSession: session,
      messages: [],
      pagination: {
        currentOffset: 0,
        pageSize,
        totalCount: 0,
        hasMore: false,
        isLoadingMore: false,
      },
      isLoadingMessages: true,
      // Always clear analytics data when switching sessions
      sessionTokenStats: null,
      sessionComparison: null,
      isLoadingTokenStats: false,
      isLoadingSessionComparison: false,
    });

    try {
      // ========================================
      // PHASE 8.4: Use adapters for message loading (v2.0.0)
      // ========================================

      const sessionPath = session.file_path;

      // Find which source this session belongs to
      const source = findSourceForPath(sessionPath);
      if (!source) {
        throw new Error(`No source found for session path: ${sessionPath}`);
      }

      // Get the appropriate adapter
      const adapter = adapterRegistry.get(source.providerId);
      if (!adapter) {
        throw new Error(`No adapter found for provider: ${source.providerId}`);
      }

      // Load messages using adapter
      const result = await adapter.loadMessages(
        sessionPath,
        session.session_id,
        {
          offset: 0,
          limit: pageSize,
          sortOrder: 'desc', // Most recent first
          includeMetadata: true,
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load messages');
      }

      // Convert to legacy format
      const legacyMessages = result.data.map(universalToLegacyMessage);

      set({
        messages: legacyMessages,
        pagination: {
          currentOffset: result.pagination?.nextOffset || pageSize,
          pageSize,
          totalCount: result.pagination?.totalCount || legacyMessages.length,
          hasMore: result.pagination?.hasMore || false,
          isLoadingMore: false,
        },
        isLoadingMessages: false,
      });
    } catch (error) {
      console.error("Failed to load session messages:", error);
      set({
        error: { type: AppErrorType.UNKNOWN, message: String(error) },
        isLoadingMessages: false,
      });
    }
  },

  clearSelection: () => {
    set({
      selectedProject: null,
      selectedSession: null,
      sessions: [],
      messages: [],
      pagination: {
        currentOffset: 0,
        pageSize: DEFAULT_PAGE_SIZE,
        totalCount: 0,
        hasMore: false,
        isLoadingMore: false,
      },
      // Clear analytics data as well
      sessionTokenStats: null,
      projectTokenStats: [],
      projectStatsSummary: null,
      sessionComparison: null,
      isLoadingTokenStats: false,
      isLoadingProjectSummary: false,
      isLoadingSessionComparison: false,
    });
  },

  loadMoreMessages: async () => {
    const { selectedProject, selectedSession, pagination, messages } = get();

    if (
      !selectedProject ||
      !selectedSession ||
      !pagination.hasMore ||
      pagination.isLoadingMore
    ) {
      return;
    }

    set({
      pagination: {
        ...pagination,
        isLoadingMore: true,
      },
    });

    try {
      // ========================================
      // PHASE 8.4: Use adapters for pagination (v2.0.0)
      // ========================================

      const sessionPath = selectedSession.file_path;

      // Find which source this session belongs to
      const source = findSourceForPath(sessionPath);
      if (!source) {
        throw new Error(`No source found for session path: ${sessionPath}`);
      }

      // Get the appropriate adapter
      const adapter = adapterRegistry.get(source.providerId);
      if (!adapter) {
        throw new Error(`No adapter found for provider: ${source.providerId}`);
      }

      // Load next page using adapter
      const result = await adapter.loadMessages(
        sessionPath,
        selectedSession.session_id,
        {
          offset: pagination.currentOffset,
          limit: pagination.pageSize,
          sortOrder: 'desc',
          includeMetadata: true,
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load more messages');
      }

      // Convert to legacy format
      const legacyMessages = result.data.map(universalToLegacyMessage);

      set({
        messages: [...legacyMessages, ...messages], // Add older messages to the front
        pagination: {
          ...pagination,
          currentOffset: result.pagination?.nextOffset || pagination.currentOffset + pagination.pageSize,
          hasMore: result.pagination?.hasMore || false,
          isLoadingMore: false,
        },
      });
    } catch (error) {
      console.error("Failed to load more messages:", error);
      set({
        error: { type: AppErrorType.UNKNOWN, message: String(error) },
        pagination: {
          ...pagination,
          isLoadingMore: false,
        },
      });
    }
  },

  searchMessages: async (query: string, filters: SearchFilters = {}) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: "" });
      return;
    }

    set({ isLoadingMessages: true, searchQuery: query, searchFilters: filters });

    try {
      // ========================================
      // PHASE 8.5: Search across ALL sources (v2.0.0)
      // ========================================

      const sourceStore = useSourceStore.getState();
      const availableSources = sourceStore.sources.filter(s => s.isAvailable);

      if (availableSources.length === 0) {
        set({ searchResults: [], isLoadingMessages: false });
        return;
      }

      // Search all sources in parallel
      const allUniversalMessages: UniversalMessage[] = [];

      await Promise.all(
        availableSources.map(async (source) => {
          try {
            const adapter = adapterRegistry.get(source.providerId);
            if (!adapter) {
              console.error(`No adapter found for provider: ${source.providerId}`);
              return;
            }

            // Convert legacy filters to universal format
            const universalFilters = {
              dateRange: filters.dateRange,
              messageTypes: filters.messageType && filters.messageType !== 'all'
                ? [filters.messageType]
                : undefined,
              hasToolCalls: filters.hasToolCalls,
              hasErrors: filters.hasErrors,
            };

            const result = await adapter.searchMessages(
              [source.path],
              query,
              universalFilters
            );

            if (result.success && result.data) {
              allUniversalMessages.push(...result.data);
            }
          } catch (error) {
            console.error(`Error searching source ${source.name}:`, error);
          }
        })
      );

      // Sort by timestamp (most recent first)
      allUniversalMessages.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Convert to legacy format
      const legacyResults = allUniversalMessages.map(universalToLegacyMessage);

      set({ searchResults: legacyResults });
    } catch (error) {
      console.error("Failed to search messages:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  refreshCurrentSession: async () => {
    const { selectedProject, selectedSession, pagination, currentView } = get();

    if (!selectedSession) {
      console.warn("No session selected for refresh");
      return;
    }

    console.log("Refresh started:", selectedSession.session_id);

    // Set loading state (selectSession internally manages isLoadingMessages)
    set({ error: null });

    try {
      // Refresh project session list to update message_count
      if (selectedProject) {
        const sessions = await invoke<ClaudeSession[]>(
          "load_project_sessions",
          {
            projectPath: selectedProject.path,
            excludeSidechain: get().excludeSidechain,
          }
        );
        set({ sessions });
      }

      // Reload current session (from first page)
      await get().selectSession(selectedSession, pagination.pageSize);

      // Refresh analytics data when in analytics view
      if (selectedProject && (currentView === "tokenStats" || currentView === "analytics")) {
        console.log("Analytics data refresh started:", currentView);

        if (currentView === "tokenStats") {
          // Refresh token statistics
          if (selectedProject.providerId !== 'cursor') {
            // Claude Code project stats (Cursor project-level stats not yet implemented)
            await get().loadProjectTokenStats(selectedProject.path);
          }
          // Load session token stats (works for both Claude Code and Cursor)
          if (selectedSession?.file_path) {
            await get().loadSessionTokenStats(selectedSession.file_path);
          }
        } else if (currentView === "analytics") {
          // Refresh analytics dashboard
          let projectSummary: ProjectStatsSummary;

          if (selectedProject.providerId === 'cursor') {
            // Use universal command for Cursor
            const workspaceId = selectedProject.path.split(/[\/\\]/).pop() || 'unknown';

            // Get the actual Cursor base path from the source store
            const { sources } = useSourceStore.getState();
            const source = sources.find(s => s.id === selectedProject.sourceId);

            if (!source) {
              throw new Error(`Source not found for ID: ${selectedProject.sourceId}`);
            }

            const cursorBasePath = source.path;

            projectSummary = await invoke<ProjectStatsSummary>(
              "get_universal_project_stats_summary",
              {
                providerId: selectedProject.providerId,
                sourcePath: cursorBasePath,
                projectId: workspaceId,
              }
            );
          } else {
            // Use legacy command for Claude Code
            projectSummary = await invoke<ProjectStatsSummary>(
              "get_project_stats_summary",
              { projectPath: selectedProject.path }
            );
          }

          get().setProjectSummary(projectSummary);

          // Refresh session comparison data
          if (selectedSession) {
            let sessionComparison: SessionComparison;

            if (selectedProject.providerId === 'cursor') {
              // Use universal command for Cursor
              const workspaceId = selectedProject.path.split(/[\/\\]/).pop() || 'unknown';

              // Get the actual Cursor base path from the source store
              const { sources } = useSourceStore.getState();
              const source = sources.find(s => s.id === selectedProject.sourceId);

              if (!source) {
                throw new Error(`Source not found for ID: ${selectedProject.sourceId}`);
              }

              const cursorBasePath = source.path;

              sessionComparison = await invoke<SessionComparison>(
                "get_universal_session_comparison",
                {
                  providerId: selectedProject.providerId,
                  sourcePath: cursorBasePath,
                  sessionId: selectedSession.session_id,
                  projectId: workspaceId,
                }
              );
            } else {
              // Use legacy command for Claude Code
              sessionComparison = await invoke<SessionComparison>(
                "get_session_comparison",
                {
                  sessionId: selectedSession.actual_session_id,
                  projectPath: selectedProject.path
                }
              );
            }

            get().setSessionComparison(sessionComparison);
          }
        }

        console.log("Analytics data refresh completed");
      }

      console.log("Refresh completed");
    } catch (error) {
      console.error("Refresh failed:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    }
  },

  setSearchFilters: (filters: SearchFilters) => {
    set({ searchFilters: filters });
  },

  setError: (error: AppError | null) => {
    set({ error });
  },

  setClaudePath: async (path: string) => {
    set({ claudePath: path });

    // Save to persistent storage
    try {
      const store = await load("settings.json", { autoSave: false } as StoreOptions);
      await store.set("claudePath", path);
      await store.save();
    } catch (error) {
      console.error("Failed to save claude path:", error);
    }
  },

  loadSessionTokenStats: async (sessionPath: string) => {
    try {
      set({ isLoadingTokenStats: true, error: null });

      // Get selected session to determine provider
      const { selectedSession } = get();

      console.log('📊 loadSessionTokenStats called:', {
        sessionPath,
        providerId: selectedSession?.providerId,
        sessionId: selectedSession?.session_id,
      });

      if (selectedSession?.providerId === 'cursor') {
        // Use universal command for Cursor
        console.log('🎯 Calling get_universal_session_token_stats for Cursor session');
        const stats = await invoke<SessionTokenStats>("get_universal_session_token_stats", {
          providerId: selectedSession.providerId,
          sourcePath: sessionPath,
          sessionId: selectedSession.session_id,
        });
        console.log('✅ Token stats loaded for Cursor session:', stats);
        set({ sessionTokenStats: stats });
      } else {
        // Use legacy command for Claude Code
        const stats = await invoke<SessionTokenStats>("get_session_token_stats", {
          sessionPath,
        });
        set({ sessionTokenStats: stats });
      }
    } catch (error) {
      console.error("Failed to load session token stats:", error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to load token stats: ${error}`,
        },
        sessionTokenStats: null,
      });
    } finally {
      set({ isLoadingTokenStats: false });
    }
  },

  loadProjectTokenStats: async (projectPath: string) => {
    try {
      set({ isLoadingTokenStats: true, error: null });
      const stats = await invoke<SessionTokenStats[]>(
        "get_project_token_stats",
        {
          projectPath,
        }
      );
      set({ projectTokenStats: stats });
    } catch (error) {
      console.error("Failed to load project token stats:", error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to load project token stats: ${error}`,
        },
        projectTokenStats: [],
      });
    } finally {
      set({ isLoadingTokenStats: false });
    }
  },

  loadProjectStatsSummary: async (projectPath: string) => {
    try {
      const summary = await invoke("get_project_stats_summary", {
        projectPath,
      });
      return summary as ProjectStatsSummary;
    } catch (error) {
      console.error("Failed to load project stats summary:", error);
      throw error;
    }
  },

  loadSessionComparison: async (sessionId: string, projectPath: string) => {
    try {
      const comparison = await invoke("get_session_comparison", {
        sessionId,
        projectPath,
      });
      return comparison as SessionComparison;
    } catch (error) {
      console.error("Failed to load session comparison:", error);
      throw error;
    }
  },

  clearTokenStats: () => {
    set({ sessionTokenStats: null, projectTokenStats: [] });
  },

  setExcludeSidechain: (exclude: boolean) => {
    set({ excludeSidechain: exclude });
    // Refresh current project and session when filter changes
    const { selectedProject, selectedSession } = get();
    if (selectedProject) {
      // Reload project to update session list's message_count
      get().selectProject(selectedProject);
    }
    if (selectedSession) {
      get().selectSession(selectedSession);
    }
  },

  // Unified view switching
  switchView: async (view: AppView) => {
    const { currentView, selectedProject, selectedSession } = get();

    // If already on this view and it's not messages, go back to messages
    if (currentView === view && view !== 'messages') {
      set({ currentView: 'messages' });
      return;
    }

    // Set the new view
    set({ currentView: view });

    // Clear search results when leaving search view
    if (view !== 'search') {
      set({ searchQuery: "", searchResults: [] });
    }

    // Load data based on view
    try {
      switch (view) {
        case 'tokenStats':
          if (!selectedProject) {
            throw new Error("No project selected.");
          }
          // Load project token stats (only for Claude Code)
          if (selectedProject.providerId !== 'cursor') {
            await get().loadProjectTokenStats(selectedProject.path);
          }
          // Load session token stats if session selected (works for both providers)
          if (selectedSession) {
            await get().loadSessionTokenStats(selectedSession.file_path);
          }
          break;

        case 'analytics':
          if (!selectedProject) {
            throw new Error("No project selected.");
          }

          set({ isLoadingProjectSummary: true, projectSummaryError: null });
          try {
            let summary: ProjectStatsSummary;

            if (selectedProject.providerId === 'cursor') {
              // Use universal command for Cursor
              console.log('📊 Loading Cursor project summary via universal command');

              // Extract workspace ID from project path
              const workspaceId = selectedProject.path.split(/[\/\\]/).pop() || 'unknown';

              // Get the actual Cursor base path from the source store
              const { sources } = useSourceStore.getState();
              const source = sources.find(s => s.id === selectedProject.sourceId);

              if (!source) {
                throw new Error(`Source not found for ID: ${selectedProject.sourceId}`);
              }

              const cursorBasePath = source.path; // This is the actual Cursor path like C:\Users\xxx\AppData\Roaming\Cursor

              console.log('📊 Analytics parameters:', {
                providerId: selectedProject.providerId,
                cursorBasePath,
                workspaceId,
                sourceId: selectedProject.sourceId,
                fullProject: selectedProject,
              });

              summary = await invoke<ProjectStatsSummary>("get_universal_project_stats_summary", {
                providerId: selectedProject.providerId,
                sourcePath: cursorBasePath,
                projectId: workspaceId,
              });
              console.log('✅ Cursor project summary loaded:', summary);
            } else {
              // Use legacy command for Claude Code
              summary = await get().loadProjectStatsSummary(selectedProject.path);
            }

            set({ projectStatsSummary: summary });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load project summary";
            console.error('❌ Failed to load project summary:', errorMessage);
            set({ projectSummaryError: errorMessage });
            throw error;
          } finally {
            set({ isLoadingProjectSummary: false });
          }

          // Load session comparison if session selected
          if (selectedSession) {
            set({ isLoadingSessionComparison: true, sessionComparisonError: null });
            try {
              let comparison: SessionComparison;

              if (selectedProject.providerId === 'cursor') {
                // Use universal command for Cursor
                console.log('📊 Loading Cursor session comparison via universal command');

                // Extract workspace ID from project path
                const workspaceId = selectedProject.path.split(/[\/\\]/).pop() || 'unknown';

                // Get the actual Cursor base path from the source store
                const { sources } = useSourceStore.getState();
                const source = sources.find(s => s.id === selectedProject.sourceId);

                if (!source) {
                  throw new Error(`Source not found for ID: ${selectedProject.sourceId}`);
                }

                const cursorBasePath = source.path;

                comparison = await invoke<SessionComparison>("get_universal_session_comparison", {
                  providerId: selectedProject.providerId,
                  sourcePath: cursorBasePath,
                  sessionId: selectedSession.session_id,
                  projectId: workspaceId,
                });
                console.log('✅ Cursor session comparison loaded:', comparison);
              } else {
                // Use legacy command for Claude Code
                comparison = await get().loadSessionComparison(
                  selectedSession.actual_session_id,
                  selectedProject.path
                );
              }

              set({ sessionComparison: comparison });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Failed to load session comparison";
              console.error('❌ Failed to load session comparison:', errorMessage);
              set({ sessionComparisonError: errorMessage });
              // Session comparison failure is not critical
            } finally {
              set({ isLoadingSessionComparison: false });
            }
          }
          break;

        case 'search':
          // Search view doesn't need to load data on open
          break;

        case 'messages':
          // Messages view doesn't need to load data
          break;
      }
    } catch (error) {
      console.error("Failed to switch view:", error);
      // Fallback to messages view on error
      set({ currentView: 'messages' });
      throw error;
    }
  },

  // Analytics data setters
  setProjectSummary: (summary: ProjectStatsSummary | null) => {
    set({ projectStatsSummary: summary });
  },

  setSessionComparison: (comparison: SessionComparison | null) => {
    set({ sessionComparison: comparison });
  },

  setLoadingProjectSummary: (loading: boolean) => {
    set({ isLoadingProjectSummary: loading });
  },

  setLoadingSessionComparison: (loading: boolean) => {
    set({ isLoadingSessionComparison: loading });
  },

  setProjectSummaryError: (error: string | null) => {
    set({ projectSummaryError: error });
  },

  setSessionComparisonError: (error: string | null) => {
    set({ sessionComparisonError: error });
  },

  clearAnalyticsData: () => {
    set({
      sessionTokenStats: null,
      projectTokenStats: [],
      projectStatsSummary: null,
      sessionComparison: null,
    });
  },

  clearAnalyticsErrors: () => {
    set({
      projectSummaryError: null,
      sessionComparisonError: null,
    });
  },

  // Project list preferences
  setProjectListPreferences: (preferences: Partial<ProjectListPreferences>) => {
    set((state) => ({
      projectListPreferences: {
        ...state.projectListPreferences,
        ...preferences,
      },
    }));
  },

  // Loading progress
  setLoadingProgress: (progress: LoadingProgress | null) => {
    set({ loadingProgress: progress });
  },
}));
