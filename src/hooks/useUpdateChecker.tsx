import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UpdateInfo } from "../types";

interface UpdateState {
  updateInfo: UpdateInfo | null;
  isLoading: boolean;
  error: string | null;
  showModal: boolean;
  showUpToDateNotification: boolean;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    updateInfo: null,
    isLoading: false,
    error: null,
    showModal: false,
    showUpToDateNotification: false,
  });

  const shouldCheck = useCallback(() => {
    const lastCheck = localStorage.getItem("last_update_check");
    const checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    return !lastCheck || Date.now() - parseInt(lastCheck) > checkInterval;
  }, []);

  const saveLastCheckTime = useCallback(() => {
    localStorage.setItem("last_update_check", Date.now().toString());
  }, []);

  const isVersionPostponed = useCallback((version: string) => {
    const postponed = localStorage.getItem("postponed_update");
    if (!postponed) return false;
    try {
      const data = JSON.parse(postponed);
      return data.version === version && Date.now() < data.postponeUntil;
    } catch {
      return false;
    }
  }, []);

  const isVersionSkipped = useCallback((version: string) => {
    return localStorage.getItem(`skipped_version_${version}`) === "true";
  }, []);

  const checkForUpdates = useCallback(
    async (forceCheck = false) => {
      if (!forceCheck && !shouldCheck()) {
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const updateInfo = await invoke<UpdateInfo>("check_for_updates");

        // Check if update exists but is postponed or skipped
        const shouldShowModal = Boolean(
          updateInfo.has_update &&
            updateInfo.latest_version &&
            !isVersionPostponed(updateInfo.latest_version) &&
            !isVersionSkipped(updateInfo.latest_version)
        );

        // For forced checks: show modal if update available, otherwise show up-to-date notification
        const finalShowModal = forceCheck
          ? Boolean(updateInfo.has_update)
          : shouldShowModal;
        const showUpToDate = forceCheck && !updateInfo.has_update;

        setState((prev) => ({
          ...prev,
          updateInfo,
          isLoading: false,
          showModal: finalShowModal,
          showUpToDateNotification: showUpToDate,
        }));

        if (updateInfo.has_update) {
          saveLastCheckTime();
        }
      } catch (error) {
        console.error("Update check failed:", error);
        setState((prev) => ({
          ...prev,
          error: error as string,
          isLoading: false,
        }));
      }
    },
    [shouldCheck, isVersionPostponed, isVersionSkipped, saveLastCheckTime]
  );

  const postponeUpdate = useCallback((version: string, days: number = 7) => {
    const postponeData = {
      version,
      postponedAt: Date.now(),
      postponeUntil: Date.now() + days * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem("postponed_update", JSON.stringify(postponeData));
    setState((prev) => ({ ...prev, showModal: false }));
  }, []);

  const skipVersion = useCallback((version: string) => {
    localStorage.setItem(`skipped_version_${version}`, "true");
    setState((prev) => ({ ...prev, showModal: false }));
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, showModal: false }));
  }, []);

  const closeUpToDateNotification = useCallback(() => {
    setState((prev) => ({ ...prev, showUpToDateNotification: false }));
  }, []);

  const downloadUpdate = useCallback(
    (url: string) => {
      window.open(url, "_blank");
      closeModal();
    },
    [closeModal]
  );

  // Auto-check on app startup
  useEffect(() => {
    const initCheck = async () => {
      await checkForUpdates();
    };
    initCheck();
  }, [checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    postponeUpdate,
    skipVersion,
    isVersionPostponed,
    isVersionSkipped,
    closeModal,
    closeUpToDateNotification,
    downloadUpdate,
  };
}
