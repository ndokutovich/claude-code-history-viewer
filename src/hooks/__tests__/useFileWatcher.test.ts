import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Use vi.hoisted so these variables are initialized before vi.mock factory runs
const { mockUnlisten, mockListen } = vi.hoisted(() => {
  const mockUnlisten = vi.fn();
  const mockListen = vi.fn();
  return { mockUnlisten, mockListen };
});

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { useFileWatcher } from '../useFileWatcher';

describe('useFileWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: listen resolves with an unlisten function
    mockListen.mockResolvedValue(mockUnlisten);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with isWatching = false when disabled', () => {
      const { result } = renderHook(() =>
        useFileWatcher({ enabled: false })
      );

      expect(result.current.isWatching).toBe(false);
    });

    it('exposes startWatching and stopWatching functions', () => {
      const { result } = renderHook(() =>
        useFileWatcher({ enabled: false })
      );

      expect(typeof result.current.startWatching).toBe('function');
      expect(typeof result.current.stopWatching).toBe('function');
    });
  });

  describe('when enabled = true', () => {
    it('registers listeners for all three event types on mount', async () => {
      const { result } = renderHook(() =>
        useFileWatcher({ enabled: true })
      );

      // Allow async startWatching to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockListen).toHaveBeenCalledWith('session-file-changed', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('session-file-created', expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith('session-file-deleted', expect.any(Function));
      expect(result.current.isWatching).toBe(true);
    });
  });

  describe('callback triggering', () => {
    it('calls onSessionChanged when session-file-changed fires', async () => {
      const onSessionChanged = vi.fn();

      let capturedChangedListener: ((event: { payload: unknown }) => void) | null = null;

      mockListen.mockImplementation((event: string, handler: (e: { payload: unknown }) => void) => {
        if (event === 'session-file-changed') {
          capturedChangedListener = handler;
        }
        return Promise.resolve(mockUnlisten);
      });

      renderHook(() =>
        useFileWatcher({ enabled: true, onSessionChanged, debounceMs: 0 })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(capturedChangedListener).not.toBeNull();

      const payload = {
        projectPath: '/test/project',
        sessionPath: '/test/project/session.jsonl',
        eventType: 'changed' as const,
      };

      act(() => {
        capturedChangedListener!({ payload });
      });

      // Wait for debounce (debounceMs = 0 still uses setTimeout internally)
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(onSessionChanged).toHaveBeenCalledWith(payload);
    });

    it('calls onSessionCreated when session-file-created fires', async () => {
      const onSessionCreated = vi.fn();

      let capturedCreatedListener: ((event: { payload: unknown }) => void) | null = null;

      mockListen.mockImplementation((event: string, handler: (e: { payload: unknown }) => void) => {
        if (event === 'session-file-created') {
          capturedCreatedListener = handler;
        }
        return Promise.resolve(mockUnlisten);
      });

      renderHook(() =>
        useFileWatcher({ enabled: true, onSessionCreated, debounceMs: 0 })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(capturedCreatedListener).not.toBeNull();

      const payload = {
        projectPath: '/test/project',
        sessionPath: '/test/project/new-session.jsonl',
        eventType: 'created' as const,
      };

      act(() => {
        capturedCreatedListener!({ payload });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(onSessionCreated).toHaveBeenCalledWith(payload);
    });

    it('calls onSessionDeleted when session-file-deleted fires', async () => {
      const onSessionDeleted = vi.fn();

      let capturedDeletedListener: ((event: { payload: unknown }) => void) | null = null;

      mockListen.mockImplementation((event: string, handler: (e: { payload: unknown }) => void) => {
        if (event === 'session-file-deleted') {
          capturedDeletedListener = handler;
        }
        return Promise.resolve(mockUnlisten);
      });

      renderHook(() =>
        useFileWatcher({ enabled: true, onSessionDeleted, debounceMs: 0 })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(capturedDeletedListener).not.toBeNull();

      const payload = {
        projectPath: '/test/project',
        sessionPath: '/test/project/old-session.jsonl',
        eventType: 'deleted' as const,
      };

      act(() => {
        capturedDeletedListener!({ payload });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(onSessionDeleted).toHaveBeenCalledWith(payload);
    });
  });

  describe('cleanup', () => {
    it('calls unlisten functions on stopWatching', async () => {
      const { result } = renderHook(() =>
        useFileWatcher({ enabled: true })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.isWatching).toBe(true);

      act(() => {
        result.current.stopWatching();
      });

      expect(result.current.isWatching).toBe(false);
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('calls unlisten functions on unmount', async () => {
      const { unmount } = renderHook(() =>
        useFileWatcher({ enabled: true })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      unmount();

      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('stops watching when enabled changes to false', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useFileWatcher({ enabled }),
        { initialProps: { enabled: true } }
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.isWatching).toBe(true);

      rerender({ enabled: false });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.isWatching).toBe(false);
    });
  });

  describe('error handling', () => {
    it('sets isWatching = false when listen rejects', async () => {
      mockListen.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() =>
        useFileWatcher({ enabled: true })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.isWatching).toBe(false);
    });
  });
});
