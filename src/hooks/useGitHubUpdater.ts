import { useState, useEffect, useCallback } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

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
  checkForUpdates: () => Promise<void>;
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

  // 현재 버전 가져오기
  useEffect(() => {
    getVersion().then((version) => {
      setState((prev) => ({ ...prev, currentVersion: version }));
    });
  }, []);

  const fetchGitHubRelease =
    useCallback(async (): Promise<GitHubRelease | null> => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/jhlee0409/claude-code-history-viewer/releases/latest",
          {
            method: "GET",
            headers: {
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "Claude-Code-History-Viewer",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`GitHub API 오류: ${response.status}`);
        }

        const release = (await response.json()) as GitHubRelease;
        return release;
      } catch (error) {
        console.error("GitHub 릴리즈 정보 가져오기 실패:", error);
        return null;
      }
    }, []);

  const checkForUpdates = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isChecking: true, error: null }));

      // GitHub API로 릴리즈 정보 가져오기
      const releaseInfo = await fetchGitHubRelease();

      if (!releaseInfo) {
        throw new Error("릴리즈 정보를 가져올 수 없습니다.");
      }
-      console.log(releaseInfo);
+      if (process.env.NODE_ENV === 'development') {
+        console.log('Release info:', releaseInfo);
+      }

      // Tauri 업데이터로 업데이트 확인
      const update = await check();

      setState((prev) => ({
        ...prev,
        isChecking: false,
        hasUpdate: !!update,
        updateInfo: update || null,
        releaseInfo,
      }));
    } catch (error) {
      console.error("업데이트 확인 실패:", error);
      setState((prev) => ({
        ...prev,
        isChecking: false,
        error:
          error instanceof Error
            ? error.message
            : "업데이트 확인 중 오류가 발생했습니다.",
      }));
    }
  }, [fetchGitHubRelease]);

  const downloadAndInstall = useCallback(async () => {
    if (!state.updateInfo) return;

    try {
      setState((prev) => ({ ...prev, isDownloading: true, error: null }));

      // 다운로드 진행률 리스너
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

      // 설치 완료 후 앱 재시작
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isDownloading: false,
        isInstalling: false,
        error:
          error instanceof Error
            ? error.message
            : "업데이트 설치 중 오류가 발생했습니다.",
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

  // 앱 시작 시 자동으로 업데이트 확인 (5초 후)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    state,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}
