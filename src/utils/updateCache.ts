// Update check result caching utility
import type { GitHubRelease } from '../hooks/useGitHubUpdater';

interface CachedUpdateResult {
  hasUpdate: boolean;
  releaseInfo: GitHubRelease | null;
  timestamp: number;
  currentVersion: string;
}

const CACHE_KEY = 'update_check_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function getCachedUpdateResult(currentVersion: string): CachedUpdateResult | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const result: CachedUpdateResult = JSON.parse(cached);

    // Invalidate if version changed or cache expired
    if (
      result.currentVersion !== currentVersion ||
      Date.now() - result.timestamp > CACHE_DURATION
    ) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return result;
  } catch {
    // Clear cache on parsing error
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

export function setCachedUpdateResult(
  hasUpdate: boolean,
  releaseInfo: GitHubRelease | null,
  currentVersion: string
): void {
  try {
    const result: CachedUpdateResult = {
      hasUpdate,
      releaseInfo,
      timestamp: Date.now(),
      currentVersion,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch (error) {
    console.warn('Failed to save update cache:', error);
  }
}

export function clearUpdateCache(): void {
  localStorage.removeItem(CACHE_KEY);
}