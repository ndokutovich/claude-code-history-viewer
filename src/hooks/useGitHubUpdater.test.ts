import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { UPDATE_CHECK_TIMEOUT_MS } from '@/utils/updateTimeout';

const { mockCheck, mockRelaunch, mockGetVersion, mockFetch } = vi.hoisted(() => ({
  mockCheck: vi.fn(),
  mockRelaunch: vi.fn(),
  mockGetVersion: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({ check: mockCheck }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mockRelaunch }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: mockGetVersion }));
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mockFetch }));
vi.mock('@/utils/updateCache', () => ({
  getCachedUpdateResult: () => null,
  setCachedUpdateResult: () => undefined,
}));

import { useGitHubUpdater } from './useGitHubUpdater';

describe('useGitHubUpdater check timeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVersion.mockResolvedValue('1.10.7');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.10.8', name: 'v1.10.8', body: '', published_at: '', html_url: '', assets: [] }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('releases the spinner when the updater never answers', async () => {
    vi.useFakeTimers();

    // The plugin's Rust-side request stalls: neither resolves nor rejects.
    mockCheck.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useGitHubUpdater());

    await act(async () => {
      void result.current.checkForUpdates(true);
    });
    expect(result.current.state.isChecking).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_TIMEOUT_MS + 1);
    });

    expect(result.current.state.isChecking).toBe(false);
    expect(result.current.state.error).toBeTruthy();
  });

  it('finishes normally when the updater answers in time', async () => {
    mockCheck.mockResolvedValue(null);

    const { result } = renderHook(() => useGitHubUpdater());

    await act(async () => {
      await result.current.checkForUpdates(true);
    });

    expect(result.current.state.isChecking).toBe(false);
    expect(result.current.state.error).toBeNull();
  });
});
