import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { load, type StoreOptions } from "@tauri-apps/plugin-store";
import {
  type AppState,
  type AppView,
  type UIProject,
  type UISession,
  type UIMessage,
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
  type FileActivity,
  type FileActivityFilters,
  type MessageViewMode,
  type MessageFilters,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type CreateSessionRequest,
  type CreateSessionResponse,
  type MessageInput,
} from "../types";
import { adapterRegistry } from "@/adapters/registry/AdapterRegistry";
import { useSourceStore } from "./useSourceStore";

// ============================================================================
// VIEW MANAGEMENT SYSTEM (v1.5.1+)
// ============================================================================
/**
 * Comprehensive View State Management
 *
 * DESIGN PRINCIPLES:
 * 1. **User Intent is Paramount**: Only explicit user actions (clicking view buttons)
 *    should change the currentView. System operations (selecting projects/sessions)
 *    preserve the user's view choice.
 *
 * 2. **View Persistence**: The user's view selection persists across:
 *    - Project switches (controlled by viewPreferences.preserveViewOnProjectSwitch)
 *    - Session switches (controlled by viewPreferences.preserveViewOnSessionSwitch)
 *    - Application restarts (future: localStorage persistence)
 *
 * 3. **Extensibility**: New views can be added easily:
 *    - Add to AppView type in types/index.ts
 *    - Add case in switchView() function
 *    - Add UI button in Header/navigation
 *    - System automatically preserves user preference
 *
 * KEY FUNCTIONS:
 * - switchView(view): ONLY function that should change currentView (except errors)
 * - selectProject(): Does NOT change view - preserves user preference
 * - selectSession(): Does NOT change view - preserves user preference
 * - setViewPreferences(): Configure view persistence behavior
 *
 * CURRENT VIEWS:
 * - messages: Conversation messages (default)
 * - search: Global search across all conversations
 * - tokenStats: Token usage statistics
 * - analytics: Analytics dashboard
 * - files: File activity viewer (v1.5.0+)
 *
 * ADDING NEW VIEWS:
 * 1. Add type to AppView union
 * 2. Add case in switchView() with data loading logic
 * 3. Add view component to App.tsx
 * 4. Add navigation button to Header
 * 5. Document here
 */
// ============================================================================

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
// CONVERSION UTILITIES (Universal ↔ UI Display Format)
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
 * Convert UniversalProject to UI display format
 */
function universalToUIProject(project: UniversalProject): UIProject {
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
 * Convert UniversalSession to UI display format
 */
function universalToUISession(session: UniversalSession): UISession {
  // Extract summary and file path from metadata if available
  const summary = session.metadata.summary as string | undefined;
  const filePath = session.metadata.filePath as string | undefined;
  const isProblematic = session.metadata.isProblematic as boolean | undefined;
  const gitBranch = session.metadata.gitBranch as string | undefined;
  const gitCommit = session.metadata.gitCommit as string | undefined;

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
    has_tool_use: session.toolCallCount > 0 || session.toolCallCount === -1, // -1 means "has but count unknown"
    has_errors: session.errorCount > 0 || session.errorCount === -1,
    is_problematic: isProblematic ?? false, // Extract from metadata, default false for non-Claude sources
    summary,
    providerId: session.providerId,
    providerName,
    git_branch: gitBranch, // Extract git branch from metadata
    git_commit: gitCommit, // Extract git commit from metadata
  };
}

/**
 * Convert UniversalMessage to UI display format
 */
function universalToUIMessage(msg: UniversalMessage): UIMessage {
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

/**
 * View Preferences - Preserves user's view selection across navigation
 *
 * Design principles:
 * 1. User's view selection should persist when switching projects/sessions
 * 2. Only explicit user actions (clicking view buttons) should change views
 * 3. System should remember the last view the user was in
 * 4. Extensible for future views
 */
interface ViewPreferences {
  /** Last view the user explicitly selected */
  lastSelectedView: AppView;
  /** Whether to preserve view when switching projects (default: true) */
  preserveViewOnProjectSwitch: boolean;
  /** Whether to preserve view when switching sessions (default: true) */
  preserveViewOnSessionSwitch: boolean;
}

interface AppStore extends AppState {
  // Filter state
  excludeSidechain: boolean;
  sessionExcludeSidechain: boolean; // Per-session filter state (persists during pagination)

  // View preferences
  viewPreferences: ViewPreferences;

  // Actions - View Management
  switchView: (view: AppView) => Promise<void>;
  setViewPreferences: (preferences: Partial<ViewPreferences>) => void;

  // Actions - Data Loading
  initializeApp: () => Promise<void>;
  scanProjects: () => Promise<void>;
  selectProject: (project: UIProject | null) => Promise<void>;
  loadProjectSessions: (projectPath: string, excludeSidechain?: boolean, forceRefresh?: boolean) => Promise<UISession[]>;
  selectSession: (session: UISession | null, pageSize?: number, excludeSidechain?: boolean) => Promise<void>;
  clearSelection: () => void;
  loadMoreMessages: () => Promise<void>;
  loadAllMessages: () => Promise<void>;
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

  // Message view preferences
  setMessageViewMode: (mode: MessageViewMode) => void;
  setMessageFilters: (filters: Partial<MessageFilters>) => void;

  // Loading progress
  setLoadingProgress: (progress: LoadingProgress | null) => void;

  // File activities actions (v1.5.0+)
  loadFileActivities: (projectPath: string, filters?: FileActivityFilters) => Promise<void>;
  setFileActivityFilters: (filters: FileActivityFilters) => void;
  clearFileActivities: () => void;

  // Session writer actions (v1.6.0+)
  createProject: (request: CreateProjectRequest) => Promise<CreateProjectResponse>;
  createSession: (request: CreateSessionRequest) => Promise<CreateSessionResponse>;
  appendToSession: (sessionPath: string, messages: MessageInput[]) => Promise<number>;
}

const DEFAULT_PAGE_SIZE = 100; // Load 100 messages on initial loading

export const useAppStore = create<AppStore>((set, get) => ({
  // Root-level view state (single source of truth)
  currentView: "messages" as AppView,

  // View preferences - Controls view persistence behavior
  viewPreferences: {
    lastSelectedView: "messages",
    preserveViewOnProjectSwitch: true,
    preserveViewOnSessionSwitch: true,
  },

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
    hideEmptyProjects: true,
    hideEmptySessions: true,
    hideAgentSessions: true, // Hide agent sessions by default
    sessionSearchQuery: '',
  },

  // Message view preferences
  messageViewMode: "formatted" as MessageViewMode,
  messageFilters: {
    showBashOnly: false,
    showToolUseOnly: false,
    showMessagesOnly: false,
    showCommandOnly: false,
  },

  // Core state
  claudePath: "",
  projects: [],
  selectedProject: null,
  sessions: [], // For selected project only (backward compatibility)
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

  // File activities state (v1.5.0+)
  fileActivities: [],
  fileActivityFilters: {},
  isLoadingFileActivities: false,

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
  sessionExcludeSidechain: true, // Initialize to match global default

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

      // Clear session cache to force refresh from filesystem
      console.log('🔄 Clearing session cache for fresh filesystem scan');
      set({ sessionsByProject: {} });

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

      // Convert to UI display format
      const uiProjects = allUniversalProjects.map(universalToUIProject);

      const duration = performance.now() - start;
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [v2.0] scanProjects: ${uiProjects.length} projects from ${availableSources.length} sources, ${duration.toFixed(1)}ms`
        );
      }

      set({ projects: uiProjects });
    } catch (error) {
      console.error("Failed to scan projects:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  selectProject: async (project: UIProject | null) => {
    // ============================================================================
    // VIEW PRESERVATION BEHAVIOR
    // ============================================================================
    // This function does NOT change currentView - it preserves the user's view
    // selection as per viewPreferences.preserveViewOnProjectSwitch
    // ============================================================================

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

    // Note: currentView is intentionally NOT set here to preserve user's view preference
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
      // Always use cached sessions when selecting a project
      // (Cache is cleared on refresh, so this is safe)
      const sessions = await get().loadProjectSessions(project.path);
      console.log(`✅ selectProject: Loaded ${sessions.length} sessions for ${project.name}`);

      // Update both sessions array AND cache in sessionsByProject
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

  loadProjectSessions: async (projectPath: string, excludeSidechain?: boolean, forceRefresh = false) => {
    try {
      // Check cache first (unless force refresh is requested)
      const cached = get().sessionsByProject[projectPath];
      if (cached && !forceRefresh) {
        console.log(`💾 Using cached sessions for ${projectPath} (${cached.length} sessions)`);
        return cached;
      }

      if (forceRefresh) {
        console.log(`🔄 Force refreshing sessions from filesystem for ${projectPath}`);
      } else {
        console.log(`📥 Loading sessions from backend for ${projectPath}`);
      }

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

      // Convert to UI display format
      const uiSessions = result.data.map(universalToUISession);

      // Filter sidechain if needed (for Claude Code compatibility)
      const shouldExcludeSidechain = excludeSidechain !== undefined
        ? excludeSidechain
        : get().excludeSidechain;

      const finalSessions = shouldExcludeSidechain ? uiSessions : uiSessions;

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
    session: UISession | null,
    pageSize = DEFAULT_PAGE_SIZE,
    excludeSidechain?: boolean
  ) => {
    // ============================================================================
    // VIEW PRESERVATION BEHAVIOR
    // ============================================================================
    // This function does NOT change currentView - it preserves the user's view
    // selection as per viewPreferences.preserveViewOnSessionSwitch
    // ============================================================================

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

    // Auto-select parent project when session is selected directly
    // (e.g., from search results or jump-to-message)
    const currentState = get();
    // Extract project path (directory containing the session file)
    // Handle both forward and backward slashes for cross-platform compatibility
    const lastSlashIndex = Math.max(
      session.file_path.lastIndexOf('/'),
      session.file_path.lastIndexOf('\\')
    );
    const projectPath = session.file_path.substring(0, lastSlashIndex);
    const matchingProject = currentState.projects.find(p => p.path === projectPath);

    if (matchingProject && currentState.selectedProject?.path !== projectPath) {
      console.log(`🔄 selectSession: Auto-selecting parent project: ${matchingProject.name}`);
      // Don't await - let selectProject run in parallel to avoid blocking
      get().selectProject(matchingProject);
    }

    // Note: currentView is intentionally NOT set here to preserve user's view preference
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

      // Determine whether to exclude sidechains:
      // - Use provided parameter if explicitly set
      // - Otherwise fall back to global store setting
      const shouldExcludeSidechain = excludeSidechain !== undefined
        ? excludeSidechain
        : get().excludeSidechain;

      // Load messages using adapter
      const result = await adapter.loadMessages(
        sessionPath,
        session.session_id,
        {
          offset: 0,
          limit: pageSize,
          sortOrder: 'desc', // Most recent first
          includeMetadata: true,
          excludeSidechain: shouldExcludeSidechain,
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load messages');
      }

      // Convert to UI display format
      const uiMessages = result.data.map(universalToUIMessage);

      set({
        messages: uiMessages,
        sessionExcludeSidechain: shouldExcludeSidechain, // Store for pagination consistency
        pagination: {
          currentOffset: result.pagination?.nextOffset || pageSize,
          pageSize,
          totalCount: result.pagination?.totalCount || uiMessages.length,
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
          excludeSidechain: get().sessionExcludeSidechain, // Use session-specific setting for consistency
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load more messages');
      }

      // Convert to UI display format
      const uiMessages = result.data.map(universalToUIMessage);

      set({
        messages: [...uiMessages, ...messages], // Add older messages to the front
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

  loadAllMessages: async () => {
    const { selectedSession, pagination, messages } = get();

    if (!selectedSession || pagination.isLoadingMore) {
      return;
    }

    // If already loaded all, do nothing
    if (!pagination.hasMore) {
      console.log("✓ All messages already loaded");
      return;
    }

    set({
      pagination: {
        ...pagination,
        isLoadingMore: true,
      },
    });

    try {
      const sessionPath = selectedSession.file_path;
      const source = findSourceForPath(sessionPath);
      if (!source) {
        throw new Error(`No source found for session path: ${sessionPath}`);
      }

      const adapter = adapterRegistry.get(source.providerId);
      if (!adapter) {
        throw new Error(`No adapter found for provider: ${source.providerId}`);
      }

      // Load ALL remaining messages by requesting a very large limit
      // Most sessions have < 10,000 messages, so 100,000 is safe
      const result = await adapter.loadMessages(
        sessionPath,
        selectedSession.session_id,
        {
          offset: pagination.currentOffset,
          limit: 100000, // Load all remaining
          sortOrder: 'desc',
          includeMetadata: true,
          excludeSidechain: get().sessionExcludeSidechain, // Use session-specific setting for consistency
        }
      );

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to load all messages');
      }

      const uiMessages = result.data.map(universalToUIMessage);
      const allMessages = [...uiMessages, ...messages];

      console.log(`✓ Loaded ALL messages: ${allMessages.length} total`);

      set({
        messages: allMessages,
        pagination: {
          ...pagination,
          currentOffset: result.pagination?.nextOffset || pagination.currentOffset + uiMessages.length,
          hasMore: false, // All loaded
          totalCount: allMessages.length,
          isLoadingMore: false,
        },
      });
    } catch (error) {
      console.error("Failed to load all messages:", error);
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

            // Convert UI filters to universal format
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

      // Convert to UI display format
      const uiResults = allUniversalMessages.map(universalToUIMessage);

      set({ searchResults: uiResults });
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
        const sessions = await invoke<UISession[]>(
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
            // Use Tauri command for Claude Code
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
              // Use Tauri command for Claude Code
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

      if (selectedSession?.providerId === 'cursor') {
        // Use universal command for Cursor
        const stats = await invoke<SessionTokenStats>("get_universal_session_token_stats", {
          providerId: selectedSession.providerId,
          sourcePath: sessionPath,
          sessionId: selectedSession.session_id,
        });
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

  // Set view preferences
  setViewPreferences: (preferences: Partial<ViewPreferences>) => {
    set((state) => ({
      viewPreferences: {
        ...state.viewPreferences,
        ...preferences,
      }
    }));
  },

  // Unified view switching
  switchView: async (view: AppView) => {
    const { currentView, selectedProject, selectedSession } = get();

    console.log(`🔀 Switching view: ${currentView} → ${view}`);

    // If already on this view and it's not messages, go back to messages
    if (currentView === view && view !== 'messages') {
      set({
        currentView: 'messages',
        viewPreferences: {
          ...get().viewPreferences,
          lastSelectedView: 'messages',
        }
      });
      return;
    }

    // Set the new view and remember user's preference
    set({
      currentView: view,
      viewPreferences: {
        ...get().viewPreferences,
        lastSelectedView: view,
      }
    });

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
              // Extract workspace ID from project path
              const workspaceId = selectedProject.path.split(/[\/\\]/).pop() || 'unknown';

              // Get the actual Cursor base path from the source store
              const { sources } = useSourceStore.getState();
              const source = sources.find(s => s.id === selectedProject.sourceId);

              if (!source) {
                throw new Error(`Source not found for ID: ${selectedProject.sourceId}`);
              }

              const cursorBasePath = source.path;

              summary = await invoke<ProjectStatsSummary>("get_universal_project_stats_summary", {
                providerId: selectedProject.providerId,
                sourcePath: cursorBasePath,
                projectId: workspaceId,
              });
            } else {
              // Use Tauri command for Claude Code
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
              } else {
                // Use Tauri command for Claude Code
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

  // Message view preferences
  setMessageViewMode: (mode: MessageViewMode) => {
    set({ messageViewMode: mode });
  },

  setMessageFilters: (filters: Partial<MessageFilters>) => {
    set((state) => ({
      messageFilters: {
        ...state.messageFilters,
        ...filters,
      },
    }));
  },

  // Loading progress
  setLoadingProgress: (progress: LoadingProgress | null) => {
    set({ loadingProgress: progress });
  },

  // ============================================================================
  // FILE ACTIVITIES ACTIONS (v1.5.0+)
  // ============================================================================

  loadFileActivities: async (projectPath: string, filters?: FileActivityFilters) => {
    set({ isLoadingFileActivities: true, error: null });
    try {
      const state = get();
      const effectiveFilters = filters || state.fileActivityFilters;

      let fileActivities: FileActivity[];

      if (projectPath === "*") {
        // Load from all available sources and aggregate results
        const { sources } = useSourceStore.getState();
        const availableSources = sources.filter(s => s.isAvailable);

        if (availableSources.length === 0) {
          throw new Error("No available sources found");
        }

        // Fetch from all sources in parallel
        const results = await Promise.allSettled(
          availableSources.map(source =>
            invoke<FileActivity[]>("get_file_activities", {
              projectPath: "*",
              sourcePath: source.path,
              filters: effectiveFilters,
            })
          )
        );

        // Merge successful results
        fileActivities = results.flatMap(r =>
          r.status === "fulfilled" ? r.value : []
        );
      } else {
        // Load from specific project's source
        const source = findSourceForPath(projectPath);
        if (!source) {
          throw new Error(`No source found for project path: ${projectPath}`);
        }

        fileActivities = await invoke<FileActivity[]>("get_file_activities", {
          projectPath,
          sourcePath: source.path,
          filters: effectiveFilters,
        });
      }

      set({
        fileActivities,
        isLoadingFileActivities: false,
      });
    } catch (error) {
      console.error("Failed to load file activities:", error);
      set({
        error: {
          type: AppErrorType.LOAD_FILE_ACTIVITIES,
          message: `Failed to load file activities: ${error}`,
        },
        isLoadingFileActivities: false,
      });
    }
  },

  setFileActivityFilters: (filters: FileActivityFilters) => {
    set({ fileActivityFilters: filters });
  },

  clearFileActivities: () => {
    set({
      fileActivities: [],
      fileActivityFilters: {},
      isLoadingFileActivities: false,
    });
  },

  // ============================================================================
  // SESSION WRITER ACTIONS (v1.6.0+)
  // ============================================================================

  /**
   * Create a new Claude Code project folder
   *
   * @param request - Project creation request with name and optional parent path
   * @returns Response with created project path and name
   * @throws Error if project creation fails
   */
  createProject: async (request: CreateProjectRequest): Promise<CreateProjectResponse> => {
    try {
      if (!isTauriAvailable()) {
        throw new Error("Tauri API is not available. Please run in the desktop app.");
      }

      const response = await invoke<CreateProjectResponse>("create_claude_project", {
        request,
      });

      console.log(`✅ Created project: ${response.project_name} at ${response.project_path}`);

      // Refresh project list to show the new project
      await get().scanProjects();

      return response;
    } catch (error) {
      console.error("Failed to create project:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to create project: ${errorMessage}`,
        },
      });
      throw error;
    }
  },

  /**
   * Create a new Claude Code session (JSONL file)
   *
   * @param request - Session creation request with project path, messages, and optional summary
   * @returns Response with created session path, ID, and message count
   * @throws Error if session creation fails
   */
  createSession: async (request: CreateSessionRequest): Promise<CreateSessionResponse> => {
    try {
      if (!isTauriAvailable()) {
        throw new Error("Tauri API is not available. Please run in the desktop app.");
      }

      const response = await invoke<CreateSessionResponse>("create_claude_session", {
        request,
      });

      console.log(
        `✅ Created session: ${response.session_id} with ${response.message_count} messages`
      );

      // Refresh sessions for the project to show the new session
      const { selectedProject } = get();
      if (selectedProject && selectedProject.path === request.project_path) {
        await get().selectProject(selectedProject);
      }

      return response;
    } catch (error) {
      console.error("Failed to create session:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to create session: ${errorMessage}`,
        },
      });
      throw error;
    }
  },

  /**
   * Append messages to an existing session
   *
   * @param sessionPath - Path to the session JSONL file
   * @param messages - Array of messages to append
   * @returns Number of messages appended
   * @throws Error if append fails
   */
  appendToSession: async (
    sessionPath: string,
    messages: MessageInput[]
  ): Promise<number> => {
    try {
      if (!isTauriAvailable()) {
        throw new Error("Tauri API is not available. Please run in the desktop app.");
      }

      const messageCount = await invoke<number>("append_to_claude_session", {
        sessionPath,
        messages,
      });

      console.log(`✅ Appended ${messageCount} messages to session: ${sessionPath}`);

      // Refresh current session if it matches
      const { selectedSession } = get();
      if (selectedSession && selectedSession.file_path === sessionPath) {
        await get().refreshCurrentSession();
      }

      return messageCount;
    } catch (error) {
      console.error("Failed to append to session:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to append to session: ${errorMessage}`,
        },
      });
      throw error;
    }
  },
}));
