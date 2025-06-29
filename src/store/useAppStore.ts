import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import type {
  AppState,
  ClaudeProject,
  ClaudeSession,
  ClaudeMessage,
  MessagePage,
  SearchFilters,
  SessionTokenStats,
} from "../types";

// Tauri API가 사용 가능한지 확인하는 함수
const isTauriAvailable = () => {
  try {
    // Tauri v2에서는 invoke 함수가 바로 사용 가능합니다
    return typeof window !== "undefined" && typeof invoke === "function";
  } catch {
    return false;
  }
};

interface AppStore extends AppState {
  // Actions
  initializeApp: () => Promise<void>;
  scanProjects: () => Promise<void>;
  selectProject: (project: ClaudeProject) => Promise<void>;
  selectSession: (session: ClaudeSession, pageSize?: number) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  searchMessages: (query: string, filters?: SearchFilters) => Promise<void>;
  setSearchFilters: (filters: SearchFilters) => void;
  setError: (error: string | null) => void;
  setClaudePath: (path: string) => void;
  loadSessionTokenStats: (sessionPath: string) => Promise<void>;
  loadProjectTokenStats: (projectPath: string) => Promise<void>;
  clearTokenStats: () => void;
}

const DEFAULT_PAGE_SIZE = 20; // 초기 로딩 시 20개 메시지만 로드하여 빠른 로딩

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
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
  searchQuery: "",
  searchResults: [],
  searchFilters: {},
  isLoading: false,
  isLoadingProjects: false,
  isLoadingSessions: false,
  isLoadingMessages: false,
  isLoadingTokenStats: false,
  error: null,
  sessionTokenStats: null,
  projectTokenStats: [],

  // Actions
  initializeApp: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isTauriAvailable()) {
        throw new Error(
          "Tauri API를 사용할 수 없습니다. 데스크톱 앱에서 실행해주세요."
        );
      }

      // Try to load saved claude path first
      try {
        const store = await load("settings.json", { autoSave: false });
        const savedPath = await store.get<string>("claudePath");
        
        if (savedPath) {
          // Validate saved path
          const isValid = await invoke<boolean>("validate_claude_folder", { path: savedPath });
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
      set({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      set({ isLoading: false });
    }
  },

  scanProjects: async () => {
    const { claudePath } = get();
    if (!claudePath) return;

    set({ isLoadingProjects: true, error: null });
    try {
      const projects = await invoke<ClaudeProject[]>("scan_projects", {
        claudePath,
      });
      set({ projects });
    } catch (error) {
      console.error("Failed to scan projects:", error);
      set({ error: error as string });
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
      });
      set({ sessions });
    } catch (error) {
      console.error("Failed to load project sessions:", error);
      set({ error: error as string });
    } finally {
      set({ isLoadingSessions: false });
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
      const sessionPath = `${get().selectedProject?.path}/${
        session.session_id
      }.jsonl`;

      // 첫 페이지 로드
      const messagePage = await invoke<MessagePage>(
        "load_session_messages_paginated",
        {
          sessionPath,
          offset: 0,
          limit: pageSize,
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
      set({ error: error as string, isLoadingMessages: false });
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
      const sessionPath = `${selectedProject.path}/${selectedSession.session_id}.jsonl`;

      const messagePage = await invoke<MessagePage>(
        "load_session_messages_paginated",
        {
          sessionPath,
          offset: pagination.currentOffset,
          limit: pagination.pageSize,
        }
      );

      set({
        messages: [...messages, ...messagePage.messages],
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
        error: error as string,
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
      set({ error: error as string });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  refreshCurrentSession: async () => {
    const { selectedSession, pagination } = get();

    if (!selectedSession) {
      console.warn("No session selected for refresh");
      return;
    }

    console.log("새로고침 시작:", selectedSession.session_id);

    // 로딩 상태 설정 (selectSession이 내부적으로 isLoadingMessages를 관리함)
    set({ error: null });

    try {
      // 현재 세션을 다시 로드 (첫 페이지부터)
      await get().selectSession(selectedSession, pagination.pageSize);
      console.log("새로고침 완료");
    } catch (error) {
      console.error("새로고침 실패:", error);
      set({ error: error as string });
    }
  },

  setSearchFilters: (filters: SearchFilters) => {
    set({ searchFilters: filters });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  setClaudePath: async (path: string) => {
    set({ claudePath: path });
    
    // Save to persistent storage
    try {
      const store = await load("settings.json", { autoSave: false });
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
        error: `Failed to load token stats: ${error}`,
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
        error: `Failed to load project token stats: ${error}`,
        projectTokenStats: [],
      });
    } finally {
      set({ isLoadingTokenStats: false });
    }
  },

  clearTokenStats: () => {
    set({ sessionTokenStats: null, projectTokenStats: [] });
  },
}));
