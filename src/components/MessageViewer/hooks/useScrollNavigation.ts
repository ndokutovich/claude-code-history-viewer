/**
 * useScrollNavigation Hook
 *
 * Manages scroll behavior and navigation in the message viewer.
 * Supports both DOM-based scrolling and virtualizer-based scrolling.
 *
 * Adaptation note: upstream used OverlayScrollbars; replaced with standard
 * HTMLElement / scrollContainerRef pattern since overlayscrollbars-react
 * is not a dependency in this fork.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import { SCROLL_HIGHLIGHT_DELAY_MS } from "../types";

// Scroll behavior constants
const SCROLL_RETRY_DELAY_MS = 50;
const SCROLL_INIT_DELAY_MS = 100;
const SCROLL_THROTTLE_MS = 100;
const SCROLL_THRESHOLD_PX = 100;
const MIN_MESSAGES_FOR_SCROLL_BUTTONS = 5;
const SCROLL_BOTTOM_TOLERANCE_PX = 5;
const MAX_SCROLL_RETRY_ATTEMPTS = 3;

interface UseScrollNavigationOptions {
  /** Ref pointing to the scroll container element */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  currentMatchUuid: string | null;
  currentMatchIndex: number;
  messagesLength: number;
  selectedSessionId?: string;
  isLoading: boolean;
  /** Optional virtualizer instance for virtual scrolling */
  virtualizer?: Virtualizer<HTMLElement, Element> | null;
  /** Function to get scroll index for a UUID (handles group member resolution) */
  getScrollIndex?: (uuid: string) => number | null;
  /** Whether the scroll element is ready */
  scrollElementReady?: boolean;
}

interface UseScrollNavigationReturn {
  showScrollToTop: boolean;
  showScrollToBottom: boolean;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  getScrollViewport: () => HTMLElement | null;
  /** Session ID for which scroll is ready (compare with current session) */
  scrollReadyForSessionId: string | null;
}

export const useScrollNavigation = ({
  scrollContainerRef,
  currentMatchUuid,
  currentMatchIndex,
  messagesLength,
  selectedSessionId,
  isLoading,
  virtualizer,
  getScrollIndex,
  scrollElementReady = false,
}: UseScrollNavigationOptions): UseScrollNavigationReturn => {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [scrollReadyForSessionId, setScrollReadyForSessionId] = useState<string | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to get the scroll viewport element
  const getScrollViewport = useCallback((): HTMLElement | null => {
    return scrollContainerRef.current ?? null;
  }, [scrollContainerRef]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const element = getScrollViewport();

    // Use virtualizer if available
    if (virtualizer && messagesLength > 0) {
      // First, scroll to last index
      virtualizer.scrollToIndex(messagesLength - 1, { align: "end" });

      // Then, ensure we're truly at the bottom using DOM scroll
      if (element) {
        setTimeout(() => {
          element.scrollTop = element.scrollHeight;
          // Retry if not at bottom (height estimation may cause slight offset)
          setTimeout(() => {
            if (element.scrollTop < element.scrollHeight - element.clientHeight - SCROLL_BOTTOM_TOLERANCE_PX) {
              element.scrollTop = element.scrollHeight;
            }
          }, SCROLL_RETRY_DELAY_MS);
        }, SCROLL_RETRY_DELAY_MS);
      }
      return;
    }

    // Fallback to DOM-based scrolling
    if (element) {
      const attemptScroll = (attempts = 0) => {
        element.scrollTop = element.scrollHeight;
        if (
          attempts < MAX_SCROLL_RETRY_ATTEMPTS &&
          element.scrollTop < element.scrollHeight - element.clientHeight - SCROLL_BOTTOM_TOLERANCE_PX * 2
        ) {
          setTimeout(() => attemptScroll(attempts + 1), SCROLL_RETRY_DELAY_MS);
        }
      };
      attemptScroll();
    }
  }, [getScrollViewport, virtualizer, messagesLength]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    // Use virtualizer if available
    if (virtualizer) {
      virtualizer.scrollToIndex(0, { align: "start" });
      return;
    }

    // Fallback to DOM-based scrolling
    const viewport = getScrollViewport();
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [getScrollViewport, virtualizer]);

  // Scroll to highlighted match
  const scrollToHighlight = useCallback((matchUuid: string | null) => {
    if (!matchUuid) return;

    // Use virtualizer if available
    if (virtualizer && getScrollIndex) {
      const index = getScrollIndex(matchUuid);
      if (index !== null) {
        virtualizer.scrollToIndex(index, { align: "center" });
        // After virtualizer scrolls, try to find the highlight element
        setTimeout(() => {
          const viewport = getScrollViewport();
          if (!viewport) return;
          const highlightElement = viewport.querySelector(
            '[data-search-highlight="current"]'
          );
          if (highlightElement) {
            highlightElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 100);
        return;
      }
    }

    // Fallback to DOM-based scrolling
    const viewport = getScrollViewport();
    if (!viewport) return;

    const highlightElement = viewport.querySelector(
      '[data-search-highlight="current"]'
    );

    if (highlightElement) {
      highlightElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    // Fallback: scroll to message container
    const messageElement = viewport.querySelector(
      `[data-message-uuid="${matchUuid}"]`
    );

    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [getScrollViewport, virtualizer, getScrollIndex]);

  // Scroll to bottom when session changes or messages load
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (!scrollElementReady) {
      return;
    }

    if (
      messagesLength > 0 &&
      !isLoading &&
      selectedSessionId &&
      scrollReadyForSessionId !== selectedSessionId
    ) {
      if (import.meta.env.DEV) {
        console.log(`[useScrollNavigation] Starting scroll for session ${selectedSessionId?.slice(-8)}, messages: ${messagesLength}`);
      }

      setScrollReadyForSessionId(selectedSessionId);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
          scrollTimeoutRef.current = setTimeout(() => {
            scrollToBottom();
            if (import.meta.env.DEV) {
              console.log(`[useScrollNavigation] Scroll complete for session ${selectedSessionId?.slice(-8)}`);
            }
          }, 50);
        });
      });
    }

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [messagesLength, isLoading, selectedSessionId, scrollReadyForSessionId, scrollToBottom, scrollElementReady]);

  // Scroll to current match when it changes
  useEffect(() => {
    if (currentMatchUuid) {
      const timer = setTimeout(() => {
        scrollToHighlight(currentMatchUuid);
      }, SCROLL_HIGHLIGHT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [currentMatchUuid, currentMatchIndex, scrollToHighlight]);

  // Scroll event listener with throttling
  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollElementRef: HTMLElement | null = null;

    const handleScroll = () => {
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        try {
          const viewport = getScrollViewport();
          if (viewport) {
            const { scrollTop, scrollHeight, clientHeight } = viewport;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD_PX;
            const isNearTop = scrollTop < SCROLL_THRESHOLD_PX;
            setShowScrollToBottom(!isNearBottom && messagesLength > MIN_MESSAGES_FOR_SCROLL_BUTTONS);
            setShowScrollToTop(!isNearTop && messagesLength > MIN_MESSAGES_FOR_SCROLL_BUTTONS);
          }
        } catch (error) {
          console.error("Scroll handler error:", error);
        }
        throttleTimer = null;
      }, SCROLL_THROTTLE_MS);
    };

    // Delay to ensure scroll element is initialized
    const timer = setTimeout(() => {
      scrollElementRef = getScrollViewport();
      if (scrollElementRef) {
        scrollElementRef.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
      }
    }, SCROLL_INIT_DELAY_MS);

    return () => {
      clearTimeout(timer);
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
      if (scrollElementRef) {
        scrollElementRef.removeEventListener("scroll", handleScroll);
      }
    };
  }, [messagesLength, getScrollViewport]);

  return {
    showScrollToTop,
    showScrollToBottom,
    scrollToTop,
    scrollToBottom,
    getScrollViewport,
    scrollReadyForSessionId,
  };
};
