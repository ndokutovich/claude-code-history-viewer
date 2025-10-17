import { useState, useEffect, useCallback } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { getCachedUpdateResult, setCachedUpdateResult } from "../utils/updateCache";

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export interface UpdateState {
  isChecking: boolean;
  hasUpdate: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  downloadProgress: number;
  error: string | null;
  updateInfo: Update | null;
  releaseInfo: GitHubRelease | null;
  currentVersion: string;
}

export interface UseGitHubUpdaterReturn {
  state: UpdateState;
  checkForUpdates: (forceCheck?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
}

export function useGitHubUpdater(): UseGitHubUpdaterReturn {
  const [state, setState] = useState<UpdateState>({
    isChecking: false,
    hasUpdate: false,
    isDownloading: false,
    isInstalling: false,
    downloadProgress: 0,
    error: null,
    updateInfo: null,
    releaseInfo: null,
    currentVersion: "",
  });

  // Get current version
  useEffect(() => {
    getVersion().then((version) => {
      setState((prev) => ({ ...prev, currentVersion: version }));
    });
  }, []);

  const fetchGitHubRelease =
    useCallback(async (): Promise<GitHubRelease | null> => {
      try {
        // Timeout control with AbortController (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          "https://api.github.com/repos/jhlee0409/claude-code-history-viewer/releases/latest",
          {
            method: "GET",
            headers: {
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "Claude-Code-History-Viewer",
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const release = (await response.json()) as GitHubRelease;
        return release;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn("GitHub API request timeout (10 seconds)");
        } else {
          console.error("Failed to fetch GitHub release info:", error);
        }
        return null;
      }
    }, []);

  const checkForUpdates = useCallback(async (forceCheck: boolean = false) => {
    try {
      setState((prev) => ({ ...prev, isChecking: true, error: null }));

      // Check cache if not a forced check
      if (!forceCheck && state.currentVersion) {
        const cached = getCachedUpdateResult(state.currentVersion);
        if (cached) {
          setState((prev) => ({
            ...prev,
            isChecking: false,
            hasUpdate: cached.hasUpdate,
            updateInfo: null, // Don't cache Tauri update object
            releaseInfo: cached.releaseInfo,
          }));
          return;
        }
      }

      // Fetch release info from GitHub API
      const releaseInfo = await fetchGitHubRelease();

      if (!releaseInfo) {
        throw new Error("Could not fetch release information.");
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Release info:', releaseInfo);
      }

      // Check for updates with Tauri updater
      const update = await check();

      const hasUpdate = !!update;

      // Cache the result (only when current version is available)
      if (state.currentVersion) {
        setCachedUpdateResult(hasUpdate, releaseInfo, state.currentVersion);
      }

      setState((prev) => ({
        ...prev,
        isChecking: false,
        hasUpdate,
        updateInfo: update || null,
        releaseInfo,
      }));
    } catch (error) {
      console.error("Update check failed:", error);
      setState((prev) => ({
        ...prev,
        isChecking: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while checking for updates.",
      }));
    }
  }, [fetchGitHubRelease, state.currentVersion]);

  const downloadAndInstall = useCallback(async () => {
    if (!state.updateInfo) return;

    try {
      setState((prev) => ({ ...prev, isDownloading: true, error: null }));

      // Download progress listener
      await state.updateInfo.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setState((prev) => ({ ...prev, downloadProgress: 0 }));
            break;
          case "Progress": {
            const progress = Math.round(
              (event.data.chunkLength / (event.data.chunkLength || 1)) * 100
            );
            setState((prev) => ({ ...prev, downloadProgress: progress }));
            break;
          }
          case "Finished":
            setState((prev) => ({
              ...prev,
              isDownloading: false,
              isInstalling: true,
              downloadProgress: 100,
            }));
            break;
        }
      });

      // Relaunch app after installation completes
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isDownloading: false,
        isInstalling: false,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while installing the update.",
      }));
    }
  }, [state.updateInfo]);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hasUpdate: false,
      updateInfo: null,
      releaseInfo: null,
      error: null,
    }));
  }, []);

  // Auto-execution is managed by SmartUpdater, removed from here

  return {
    state,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}
