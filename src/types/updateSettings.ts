// Update settings type definition
export interface UpdateSettings {
  // Whether automatic checking is enabled (checks automatically and shows modal automatically)
  autoCheck: boolean;

  // Check interval
  checkInterval: 'startup' | 'daily' | 'weekly' | 'never';

  // Skipped versions
  skippedVersions: string[];

  // Last postponed timestamp
  lastPostponedAt?: number;

  // Postpone interval (in milliseconds)
  postponeInterval: number; // Default 24 hours

  // Whether the introduction has been shown to the user
  hasSeenIntroduction: boolean;

  // Disable checking when offline
  respectOfflineStatus: boolean;

  // Always show critical updates
  allowCriticalUpdates: boolean;
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  autoCheck: true, // Automatic checking enabled by default
  checkInterval: 'startup',
  skippedVersions: [],
  postponeInterval: 24 * 60 * 60 * 1000, // 24 hours
  hasSeenIntroduction: false,
  respectOfflineStatus: true,
  allowCriticalUpdates: true, // Critical updates are always shown
};