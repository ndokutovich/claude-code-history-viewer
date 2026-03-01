import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted so these variables are initialized before vi.mock factory runs
const { mockCheck, mockGetVersion, mockRelaunch } = vi.hoisted(() => {
  return {
    mockCheck: vi.fn(),
    mockGetVersion: vi.fn(),
    mockRelaunch: vi.fn(),
  };
});

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mockCheck,
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: mockRelaunch,
}));

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: mockGetVersion,
}));

vi.mock('@/utils/updateError', () => ({
  UPDATE_INSTALL_FAILED_ERROR_CODE: 'UPDATE_INSTALL_FAILED',
}));

import { useUpdater } from '../useUpdater';

describe('useUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetVersion.mockResolvedValue('1.0.0');
    // Default: no update available
    mockCheck.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('returns correct initial state shape', async () => {
      const { result } = renderHook(() => useUpdater());

      expect(result.current.state.isChecking).toBe(false);
      expect(result.current.state.hasUpdate).toBe(false);
      expect(result.current.state.isDownloading).toBe(false);
      expect(result.current.state.isInstalling).toBe(false);
      expect(result.current.state.isRestarting).toBe(false);
      expect(result.current.state.requiresManualRestart).toBe(false);
      expect(result.current.state.downloadProgress).toBe(0);
      expect(result.current.state.error).toBeNull();
      expect(result.current.state.updateInfo).toBeNull();
      expect(result.current.state.newVersion).toBeNull();
    });

    it('starts with empty currentVersion and loads it on mount', async () => {
      const { result } = renderHook(() => useUpdater());

      // Initially empty
      expect(result.current.state.currentVersion).toBe('');

      // Resolve the getVersion promise
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.state.currentVersion).toBe('1.0.0');
    });

    it('exposes checkForUpdates, downloadAndInstall, dismissUpdate functions', () => {
      const { result } = renderHook(() => useUpdater());

      expect(typeof result.current.checkForUpdates).toBe('function');
      expect(typeof result.current.downloadAndInstall).toBe('function');
      expect(typeof result.current.dismissUpdate).toBe('function');
    });
  });

  describe('checkForUpdates', () => {
    it('sets isChecking = true while checking, then false after resolve', async () => {
      let resolveCheck!: (value: null) => void;
      mockCheck.mockReturnValue(
        new Promise<null>((resolve) => {
          resolveCheck = resolve;
        })
      );

      const { result } = renderHook(() => useUpdater());

      let checkPromise!: Promise<unknown>;
      act(() => {
        checkPromise = result.current.checkForUpdates();
      });

      expect(result.current.state.isChecking).toBe(true);

      await act(async () => {
        resolveCheck(null);
        await checkPromise;
      });

      expect(result.current.state.isChecking).toBe(false);
    });

    it('sets hasUpdate = false and returns null when no update is available', async () => {
      mockCheck.mockResolvedValue(null);

      const { result } = renderHook(() => useUpdater());

      let updateResult: unknown;
      await act(async () => {
        updateResult = await result.current.checkForUpdates();
      });

      expect(updateResult).toBeNull();
      expect(result.current.state.hasUpdate).toBe(false);
      expect(result.current.state.updateInfo).toBeNull();
      expect(result.current.state.newVersion).toBeNull();
    });

    it('sets hasUpdate = true and stores update info when update is available', async () => {
      const mockUpdate = {
        version: '2.0.0',
        date: '2025-01-01',
        body: 'New release',
        download: vi.fn(),
        install: vi.fn(),
        downloadAndInstall: vi.fn(),
      };
      mockCheck.mockResolvedValue(mockUpdate);

      const { result } = renderHook(() => useUpdater());

      let updateResult: unknown;
      await act(async () => {
        updateResult = await result.current.checkForUpdates();
      });

      expect(updateResult).toBe(mockUpdate);
      expect(result.current.state.hasUpdate).toBe(true);
      expect(result.current.state.updateInfo).toBe(mockUpdate);
      expect(result.current.state.newVersion).toBe('2.0.0');
    });

    it('sets error state when check throws', async () => {
      mockCheck.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useUpdater());

      let updateResult: unknown;
      await act(async () => {
        updateResult = await result.current.checkForUpdates();
      });

      expect(updateResult).toBeNull();
      expect(result.current.state.isChecking).toBe(false);
      expect(result.current.state.hasUpdate).toBe(false);
      expect(result.current.state.error).toBe('Network error');
    });

    it('sets error state when check times out', async () => {
      // Never resolves to trigger timeout
      mockCheck.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useUpdater());

      let checkPromise!: Promise<unknown>;
      act(() => {
        checkPromise = result.current.checkForUpdates();
      });

      // Advance past the 20s timeout
      await act(async () => {
        vi.advanceTimersByTime(21_000);
        await checkPromise;
      });

      expect(result.current.state.isChecking).toBe(false);
      expect(result.current.state.error).toBe('Update check timeout');
    });
  });

  describe('dismissUpdate', () => {
    it('clears update state when called after finding an update', async () => {
      const mockUpdate = {
        version: '2.0.0',
        date: '2025-01-01',
        body: 'New release',
        download: vi.fn(),
        install: vi.fn(),
        downloadAndInstall: vi.fn(),
      };
      mockCheck.mockResolvedValue(mockUpdate);

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.state.hasUpdate).toBe(true);

      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.state.hasUpdate).toBe(false);
      expect(result.current.state.updateInfo).toBeNull();
      expect(result.current.state.newVersion).toBeNull();
      expect(result.current.state.requiresManualRestart).toBe(false);
      expect(result.current.state.error).toBeNull();
    });

    it('is a no-op when there is no pending update', () => {
      const { result } = renderHook(() => useUpdater());

      // Should not throw
      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.state.hasUpdate).toBe(false);
      expect(result.current.state.error).toBeNull();
    });
  });
});
