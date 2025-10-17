import { useState, useEffect, useCallback } from 'react';
import { useGitHubUpdater } from './useGitHubUpdater';
import { 
  getUpdateSettings, 
  shouldCheckForUpdates, 
  shouldShowUpdateForVersion,
  isOnline 
} from '@/utils/updateSettings';

export function useSmartUpdater() {
  const githubUpdater = useGitHubUpdater();
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [introModalShown, setIntroModalShown] = useState(false);

  // Check whether to show initial introduction modal
  useEffect(() => {
    const settings = getUpdateSettings();
    if (!settings.hasSeenIntroduction && !introModalShown) {
      // Show introduction modal 2 seconds after app startup (UX improvement)
      const timer = setTimeout(() => {
        setShowIntroModal(true);
        setIntroModalShown(true);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [introModalShown]);

  // Smart update check
  const smartCheckForUpdates = useCallback(async (forceCheck = false) => {
    // Check conditions when not forced
    if (!forceCheck) {
      // Check offline status
      if (!isOnline()) {
        console.log('Skipping update check due to offline status');
        return;
      }

      // Check user settings
      if (!shouldCheckForUpdates()) {
        console.log('Skipping update check per user settings');
        return;
      }
    }

    await githubUpdater.checkForUpdates(forceCheck);
  }, [githubUpdater]);

  // Auto-check (improved version)
  useEffect(() => {
    const settings = getUpdateSettings();

    // Don't check if auto-check is disabled
    if (!settings.autoCheck) {
      return;
    }

    let delay = 5000; // Default 5 seconds

    // Adjust delay based on check interval
    switch (settings.checkInterval) {
      case 'startup':
        delay = 5000; // 5 seconds
        break;
      case 'daily':
        // Check if last check was 24 hours ago
        // (Treated same as startup due to implementation complexity)
        delay = 5000;
        break;
      case 'weekly':
        // Weekly check only on first run
        delay = 5000;
        break;
      case 'never':
        return; // Don't check
    }

    const timer = setTimeout(() => {
      smartCheckForUpdates();
    }, delay);

    return () => clearTimeout(timer);
  }, [smartCheckForUpdates]);

  // Improved update modal display conditions
  const shouldShowUpdateModal = useCallback(() => {
    if (!githubUpdater.state.hasUpdate || !githubUpdater.state.releaseInfo) {
      return false;
    }

    const version = githubUpdater.state.releaseInfo.tag_name;
    return shouldShowUpdateForVersion(version);
  }, [githubUpdater.state.hasUpdate, githubUpdater.state.releaseInfo]);

  const handleIntroClose = useCallback(() => {
    setShowIntroModal(false);

    // If auto-check is enabled after viewing intro, check after a moment
    const settings = getUpdateSettings();
    if (settings.autoCheck) {
      setTimeout(() => {
        smartCheckForUpdates();
      }, 1000);
    }
  }, [smartCheckForUpdates]);

  return {
    ...githubUpdater,
    smartCheckForUpdates,
    shouldShowUpdateModal: shouldShowUpdateModal(),
    showIntroModal,
    onIntroClose: handleIntroClose,
  };
}