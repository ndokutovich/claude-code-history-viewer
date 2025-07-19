// 업데이트 체크 결과 캐싱 유틸리티
import type { GitHubRelease } from '../hooks/useGitHubUpdater';

interface CachedUpdateResult {
  hasUpdate: boolean;
  releaseInfo: GitHubRelease | null;
  timestamp: number;
  currentVersion: string;
}

const CACHE_KEY = 'update_check_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30분

export function getCachedUpdateResult(currentVersion: string): CachedUpdateResult | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const result: CachedUpdateResult = JSON.parse(cached);
    
    // 버전이 다르거나 캐시가 만료된 경우 무효화
    if (
      result.currentVersion !== currentVersion ||
      Date.now() - result.timestamp > CACHE_DURATION
    ) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return result;
  } catch {
    // 파싱 오류 시 캐시 삭제
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
    console.warn('업데이트 캐시 저장 실패:', error);
  }
}

export function clearUpdateCache(): void {
  localStorage.removeItem(CACHE_KEY);
}