import { useSyncExternalStore } from "react";

// Single shared MutationObserver for dark mode detection
// Replaces per-component MutationObserver instances

let darkMode = document.documentElement.classList.contains("dark");
const listeners = new Set<() => void>();

// Lazy-initialize observer on first subscribe
let observer: MutationObserver | null = null;

function subscribe(callback: () => void): () => void {
  listeners.add(callback);

  if (!observer) {
    observer = new MutationObserver(() => {
      const next = document.documentElement.classList.contains("dark");
      if (next !== darkMode) {
        darkMode = next;
        listeners.forEach((fn) => fn());
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

function getSnapshot(): boolean {
  return darkMode;
}

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
