// Update settings management utility
import type { UpdateSettings } from '../types/updateSettings';
import { DEFAULT_UPDATE_SETTINGS } from '../types/updateSettings';

const SETTINGS_KEY = 'update_settings';

export function getUpdateSettings(): UpdateSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DEFAULT_UPDATE_SETTINGS;
    
    const parsed = JSON.parse(stored);
    // Merge with defaults to maintain compatibility when new settings are added
    return { ...DEFAULT_UPDATE_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_UPDATE_SETTINGS;
  }
}

export function setUpdateSettings(settings: Partial<UpdateSettings>): void {
  try {
    const current = getUpdateSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save update settings:', error);
  }
}

export function shouldCheckForUpdates(): boolean {
  const settings = getUpdateSettings();

  // If automatic checking is disabled
  if (!settings.autoCheck) {
    return false;
  }

  // If set to never
  if (settings.checkInterval === 'never') {
    return false;
  }

  // If respecting offline status and currently offline
  if (settings.respectOfflineStatus && !isOnline()) {
    return false;
  }

  // Check if there's a postponed update
  if (settings.lastPostponedAt) {
    const now = Date.now();
    const timeSincePostpone = now - settings.lastPostponedAt;
    if (timeSincePostpone < settings.postponeInterval) {
      return false; // Still in postpone period
    }
  }

  return true;
}

export function shouldShowUpdateForVersion(version: string): boolean {
  const settings = getUpdateSettings();
  return !settings.skippedVersions.includes(version);
}

export function skipVersion(version: string): void {
  const settings = getUpdateSettings();
  if (!settings.skippedVersions.includes(version)) {
    settings.skippedVersions.push(version);
    setUpdateSettings(settings);
  }
}

export function postponeUpdate(): void {
  setUpdateSettings({
    lastPostponedAt: Date.now()
  });
}

export function isOnline(): boolean {
  return navigator.onLine;
}