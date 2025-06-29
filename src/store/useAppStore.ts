import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  AppState,
  ClaudeProject,
  ClaudeSession,
  ClaudeMessage,
  SearchFilters,
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
  selectSession: (session: ClaudeSession) => Promise<void>;
  searchMessages: (query: string, filters?: SearchFilters) => Promise<void>;
  setSearchFilters: (filters: SearchFilters) => void;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  claudePath: "",
  projects: [],
  selectedProject: null,
  sessions: [],
  selectedSession: null,
  messages: [],
  searchQuery: "",
  searchResults: [],
  searchFilters: {},
  isLoading: false,
  error: null,

  // Actions
  initializeApp: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isTauriAvailable()) {
        throw new Error(
          "Tauri API를 사용할 수 없습니다. 데스크톱 앱에서 실행해주세요."
        );
      }
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

    set({ isLoading: true, error: null });
    try {
      const projects = await invoke<ClaudeProject[]>("scan_projects", {
        claudePath,
      });
      set({ projects });
    } catch (error) {
      console.error("Failed to scan projects:", error);
      set({ error: error as string });
    } finally {
      set({ isLoading: false });
    }
  },

  selectProject: async (project: ClaudeProject) => {
    set({
      selectedProject: project,
      sessions: [],
      selectedSession: null,
      messages: [],
      isLoading: false,
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
      set({ isLoading: false });
    }
  },

  selectSession: async (session: ClaudeSession) => {
    set({ selectedSession: session, messages: [], isLoading: false });
    try {
      const sessionPath = `${get().selectedProject?.path}/${
        session.session_id
      }.jsonl`;
      const messages = await invoke<ClaudeMessage[]>("load_session_messages", {
        sessionPath,
      });
      set({ messages });
    } catch (error) {
      console.error("Failed to load session messages:", error);
      set({ error: error as string });
    } finally {
      set({ isLoading: false });
    }
  },

  searchMessages: async (query: string, filters: SearchFilters = {}) => {
    const { claudePath } = get();
    if (!claudePath || !query.trim()) {
      set({ searchResults: [], searchQuery: "" });
      return;
    }

    set({ isLoading: true, searchQuery: query });
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
      set({ isLoading: false });
    }
  },

  setSearchFilters: (filters: SearchFilters) => {
    set({ searchFilters: filters });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
