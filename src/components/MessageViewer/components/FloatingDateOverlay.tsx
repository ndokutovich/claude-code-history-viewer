/**
 * FloatingDateOverlay Component
 *
 * Displays the current date as a floating header at the top of the
 * message viewport while scrolling, mimicking sticky date headers in chat apps.
 *
 * This viewer is NOT virtualized, so we derive the current date from the
 * topmost visible message element (read via its `data-timestamp` attribute)
 * on scroll, throttled with requestAnimationFrame.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../../../utils/cn";
import { formatDateDivider } from "../../../utils/time";

type FloatingDateOverlayProps = {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Changes to this value force a re-scan (e.g. when messages change). */
  revision?: number;
};

/** How long (ms) after scrolling stops before the overlay fades out. */
const FADE_OUT_DELAY_MS = 1500;

export const FloatingDateOverlay: React.FC<FloatingDateOverlayProps> =
  React.memo(({ scrollContainerRef, revision }) => {
    const [label, setLabel] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rafRef = useRef<number | null>(null);
    const lastTimestampRef = useRef<string | null>(null);

    const resolveTopTimestamp = useCallback((): string | null => {
      const container = scrollContainerRef.current;
      if (!container) return null;
      const containerTop = container.getBoundingClientRect().top;
      const nodes = container.querySelectorAll<HTMLElement>("[data-timestamp]");
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        // First element whose bottom is below the container top is the topmost visible one.
        if (rect.bottom > containerTop + 1) {
          return node.dataset.timestamp ?? null;
        }
      }
      return null;
    }, [scrollContainerRef]);

    const update = useCallback(() => {
      const ts = resolveTopTimestamp();
      if (!ts) return;

      if (ts !== lastTimestampRef.current) {
        lastTimestampRef.current = ts;
        setLabel(formatDateDivider(ts));
      }

      setIsVisible(true);
      if (fadeTimerRef.current != null) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(
        () => setIsVisible(false),
        FADE_OUT_DELAY_MS
      );
    }, [resolveTopTimestamp]);

    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const onScroll = () => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          update();
        });
      };

      container.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        container.removeEventListener("scroll", onScroll);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        if (fadeTimerRef.current != null) clearTimeout(fadeTimerRef.current);
      };
    }, [scrollContainerRef, update, revision]);

    if (!label) return null;

    return (
      <div
        className={cn(
          "absolute top-2 left-1/2 -translate-x-1/2 z-20",
          "px-3 py-1 rounded-full",
          "bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm",
          "border border-gray-200/60 dark:border-gray-700/60 shadow-sm",
          "text-[11px] font-medium text-gray-600 dark:text-gray-300",
          "transition-opacity duration-300",
          "pointer-events-none select-none",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {label}
      </div>
    );
  });

FloatingDateOverlay.displayName = "FloatingDateOverlay";
