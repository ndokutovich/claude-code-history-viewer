import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { load, type StoreOptions } from "@tauri-apps/plugin-store";
import {
  type AppState,
  type AppView,
  type ClaudeProject,
  type ClaudeSession,
  type ClaudeMessage,
  type MessagePage,
  type SearchFilters,
  type SessionTokenStats,
  type ProjectStatsSummary,
  type SessionComparison,
  type AppError,
  AppErrorType,
} from "../types";

// Function to check if Tauri API is available
const isTauriAvailable = () => {
  try {
    // In Tauri v2, the invoke function is directly available
    return typeof window !== "undefined" && typeof invoke === "function";
  } catch {
    return false;
  }
};

interface AppStore extends AppState {
  // Filter state
  excludeSidechain: boolean;

  // Actions - View Management
  switchView: (view: AppView) => Promise<void>;

  // Actions - Data Loading
  initializeApp: () => Promise<void>;
  scanProjects: () => Promise<void>;
  selectProject: (project: ClaudeProject) => Promise<void>;
  loadProjectSessions: (projectPath: string, excludeSidechain?: boolean) => Promise<ClaudeSession[]>;
  selectSession: (session: ClaudeSession, pageSize?: number) => Promise<void>;
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
}

const DEFAULT_PAGE_SIZE = 100; // Load 100 messages on initial loading

export const useAppStore = create<AppStore>((set, get) => ({
  // Root-level view state (single source of truth)
  currentView: "messages" as AppView,

  // Core state
  claudePath: "",
  projects: [],
  selectedProject: null,
  sessions: [],
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

      // Try to load saved settings first
      try {
        const store = await load("settings.json", { autoSave: false } as StoreOptions);
        const savedPath = await store.get<string>("claudePath");

        if (savedPath) {
          // Validate saved path
          const isValid = await invoke<boolean>("validate_claude_folder", {
            path: savedPath,
          });
          if (isValid) {
            set({ claudePath: savedPath });
            await get().scanProjects();
            return;
          }
        }
      } catch {
        // Store doesn't exist yet, that's okay
        console.log("No saved settings found");
      }

      // Try default path
      const claudePath = await invoke<string>("get_claude_folder_path");
      set({ claudePath });
      await get().scanProjects();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Parse error type from message
      let errorType = AppErrorType.UNKNOWN;
      let message = errorMessage;

      if (errorMessage.includes("CLAUDE_FOLDER_NOT_FOUND:")) {
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
    const { claudePath } = get();
    if (!claudePath) return;

    set({ isLoadingProjects: true, error: null });
    try {
      const start = performance.now();
      const projects = await invoke<ClaudeProject[]>("scan_projects", {
        claudePath,
      });
      const duration = performance.now() - start;
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [Frontend] scanProjects: ${
            projects.length
          } projects, ${duration.toFixed(1)}ms`
        );
      }

      set({ projects });
    } catch (error) {
      console.error("Failed to scan projects:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  selectProject: async (project: ClaudeProject) => {
    set({
      selectedProject: project,
      sessions: [],
      selectedSession: null,
      messages: [],
      isLoadingSessions: true,
    });
    try {
      const sessions = await invoke<ClaudeSession[]>("load_project_sessions", {
        projectPath: project.path,
        excludeSidechain: get().excludeSidechain,
      });
      set({ sessions });
    } catch (error) {
      console.error("Failed to load project sessions:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  loadProjectSessions: async (projectPath: string, excludeSidechain?: boolean) => {
    try {
      const sessions = await invoke<ClaudeSession[]>("load_project_sessions", {
        projectPath,
        excludeSidechain: excludeSidechain !== undefined ? excludeSidechain : get().excludeSidechain,
      });
      return sessions;
    } catch (error) {
      console.error("Failed to load project sessions:", error);
      throw error;
    }
  },

  selectSession: async (
    session: ClaudeSession,
    pageSize = DEFAULT_PAGE_SIZE
  ) => {
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
    });

    try {
      // Use file_path from session directly
      const sessionPath = session.file_path;

      // Load first page
      const messagePage = await invoke<MessagePage>(
        "load_session_messages_paginated",
        {
          sessionPath,
          offset: 0,
          limit: pageSize,
          excludeSidechain: get().excludeSidechain,
        }
      );

      set({
        messages: messagePage.messages,
        pagination: {
          currentOffset: messagePage.next_offset,
          pageSize,
          totalCount: messagePage.total_count,
          hasMore: messagePage.has_more,
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
      // Use file_path from session directly
      const sessionPath = selectedSession.file_path;

      const messagePage = await invoke<MessagePage>(
        "load_session_messages_paginated",
        {
          sessionPath,
          offset: pagination.currentOffset,
          limit: pagination.pageSize,
          excludeSidechain: get().excludeSidechain,
        }
      );

      set({
        messages: [...messagePage.messages, ...messages], // Add older messages to the front (chat style)
        pagination: {
          ...pagination,
          currentOffset: messagePage.next_offset,
          hasMore: messagePage.has_more,
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
    const { claudePath } = get();
    if (!claudePath || !query.trim()) {
      set({ searchResults: [], searchQuery: "" });
      return;
    }

    set({ isLoadingMessages: true, searchQuery: query });
    try {
      const results = await invoke<ClaudeMessage[]>("search_messages", {
        claudePath,
        query,
        filters,
      });
      set({ searchResults: results });
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
          await get().loadProjectTokenStats(selectedProject.path);
          if (selectedSession?.file_path) {
            await get().loadSessionTokenStats(selectedSession.file_path);
          }
        } else if (currentView === "analytics") {
          // Refresh analytics dashboard
          const projectSummary = await invoke<ProjectStatsSummary>(
            "get_project_stats_summary",
            { projectPath: selectedProject.path }
          );
          get().setProjectSummary(projectSummary);

          // Refresh session comparison data
          if (selectedSession) {
            const sessionComparison = await invoke<SessionComparison>(
              "get_session_comparison",
              {
                sessionId: selectedSession.actual_session_id,
                projectPath: selectedProject.path
              }
            );
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
      const stats = await invoke<SessionTokenStats>("get_session_token_stats", {
        sessionPath,
      });
      set({ sessionTokenStats: stats });
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
          // Load project token stats
          await get().loadProjectTokenStats(selectedProject.path);
          // Load session token stats if session selected
          if (selectedSession) {
            await get().loadSessionTokenStats(selectedSession.file_path);
          }
          break;

        case 'analytics':
          if (!selectedProject) {
            throw new Error("No project selected.");
          }
          // Load project summary
          set({ isLoadingProjectSummary: true, projectSummaryError: null });
          try {
            const summary = await get().loadProjectStatsSummary(selectedProject.path);
            set({ projectStatsSummary: summary });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to load project summary";
            set({ projectSummaryError: errorMessage });
            throw error;
          } finally {
            set({ isLoadingProjectSummary: false });
          }

          // Load session comparison if session selected
          if (selectedSession) {
            set({ isLoadingSessionComparison: true, sessionComparisonError: null });
            try {
              const comparison = await get().loadSessionComparison(
                selectedSession.actual_session_id,
                selectedProject.path
              );
              set({ sessionComparison: comparison });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Failed to load session comparison";
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
}));
