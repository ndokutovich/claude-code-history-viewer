import { useRef, useState, useEffect, useCallback, type RefObject } from "react";
import type { UISession, PaginationState } from "../../../types";
import {
  SCROLL_ADJUSTMENT_DELAY,
  SESSION_SCROLL_DELAY,
  SCROLL_BOTTOM_THRESHOLD,
  SCROLL_THROTTLE_DELAY,
  MIN_MESSAGES_FOR_SCROLL_BTN,
} from "../../../constants/layout";

interface UseMessageScrollingParams {
  messages: { length: number };
  selectedSession: UISession | null;
  pagination: PaginationState;
  isLoading: boolean;
  onLoadMore: () => void;
}

interface UseMessageScrollingResult {
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  showScrollToBottom: boolean;
  handleScrollToBottom: () => void;
  handleLoadMoreWithScroll: () => void;
}

export const useMessageScrolling = ({
  messages,
  selectedSession,
  pagination,
  isLoading,
  onLoadMore,
}: UseMessageScrollingParams): UseMessageScrollingResult => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(messages.length);

  // Ref to prevent infinite rendering
  const isProcessingLoadMore = useRef(false);
  const lastPaginationCall = useRef<number>(0);

  // Chat style: maintain scroll position after loading previous messages
  const prevScrollHeight = useRef<number>(0);
  const prevScrollTop = useRef<number>(0);

  // Add scroll position state
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Track previous session ID
  const prevSessionIdRef = useRef<string | null>(null);

  // Function to scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      const element = scrollContainerRef.current;
      // Multiple attempts to ensure scrolling to bottom
      const attemptScroll = (attempts = 0) => {
        element.scrollTop = element.scrollHeight;
        if (
          attempts < 3 &&
          element.scrollTop < element.scrollHeight - element.clientHeight - 10
        ) {
          setTimeout(() => attemptScroll(attempts + 1), SCROLL_ADJUSTMENT_DELAY);
        }
      };
      attemptScroll();
    }
  }, []);

  // Detect message changes and adjust scroll position (optimized)
  useEffect(() => {
    const prevLength = prevMessagesLength.current;
    const currentLength = messages.length;

    // Only execute when message length changed and not currently processing
    if (prevLength !== currentLength && !isProcessingLoadMore.current) {
      // Adjust scroll only when messages are added via load more
      if (prevLength > 0 && currentLength > prevLength) {
        isProcessingLoadMore.current = true;

        if (scrollContainerRef.current) {
          const scrollElement = scrollContainerRef.current;
          const currentScrollHeight = scrollElement.scrollHeight;
          const heightDifference =
            currentScrollHeight - prevScrollHeight.current;

          if (heightDifference > 0 && prevScrollTop.current >= 0) {
            const newScrollTop = prevScrollTop.current + heightDifference;
            scrollElement.scrollTop = newScrollTop;
          }

          prevScrollHeight.current = currentScrollHeight;

          // Processing complete
          requestAnimationFrame(() => {
            if (scrollElement.style.overflow === "hidden") {
              scrollElement.style.overflow = "auto";
            }
            isProcessingLoadMore.current = false;
          });
        } else {
          isProcessingLoadMore.current = false;
        }
      }

      prevMessagesLength.current = currentLength;
    }
  }, [messages.length]);

  // Scroll to bottom when new session is selected (chat style)
  useEffect(() => {
    // Execute only when session actually changed and messages are loaded
    if (
      selectedSession &&
      prevSessionIdRef.current !== selectedSession.session_id &&
      messages.length > 0 &&
      !isLoading
    ) {
      // Update previous session ID
      prevSessionIdRef.current = selectedSession.session_id;

      // Execute scroll after DOM is fully updated
      setTimeout(() => scrollToBottom(), SESSION_SCROLL_DELAY);
    }
  }, [selectedSession, messages.length, isLoading, scrollToBottom]);

  // Scroll to bottom when pagination is reset (new session or refresh)
  useEffect(() => {
    if (pagination.currentOffset === 0 && messages.length > 0 && !isLoading) {
      setTimeout(() => scrollToBottom(), SCROLL_ADJUSTMENT_DELAY);
    }
  }, [pagination.currentOffset, messages.length, isLoading, scrollToBottom]);

  // Optimize scroll event (apply throttling)
  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      if (throttleTimer) return;

      throttleTimer = setTimeout(() => {
        try {
          if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } =
              scrollContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < SCROLL_BOTTOM_THRESHOLD;
            setShowScrollToBottom(!isNearBottom && messages.length > MIN_MESSAGES_FOR_SCROLL_BTN);
          }
        } catch (error) {
          console.error("Scroll handler error:", error);
        }
        throttleTimer = null;
      }, SCROLL_THROTTLE_DELAY);
    };

    const scrollElement = scrollContainerRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll, { passive: true });
      handleScroll();

      return () => {
        if (throttleTimer) {
          clearTimeout(throttleTimer);
        }
        scrollElement.removeEventListener("scroll", handleScroll);
      };
    }
  }, [messages.length]);

  // Optimize load more button (prevent duplicate calls)
  const handleLoadMoreWithScroll = useCallback(() => {
    const now = Date.now();

    // Prevent duplicate clicks (block duplicate calls within 1 second)
    if (
      !pagination.hasMore ||
      pagination.isLoadingMore ||
      isLoading ||
      isProcessingLoadMore.current ||
      now - lastPaginationCall.current < 1000
    ) {
      return;
    }

    lastPaginationCall.current = now;

    if (scrollContainerRef.current) {
      const scrollElement = scrollContainerRef.current;
      prevScrollTop.current = scrollElement.scrollTop;
      prevScrollHeight.current = scrollElement.scrollHeight;
      scrollElement.style.overflow = "hidden";
    }

    try {
      onLoadMore();
    } catch (error) {
      console.error("Load more execution error:", error);
      isProcessingLoadMore.current = false;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.overflow = "auto";
      }
    }
  }, [pagination.hasMore, pagination.isLoadingMore, isLoading, onLoadMore]);

  return {
    scrollContainerRef,
    showScrollToBottom,
    handleScrollToBottom: scrollToBottom,
    handleLoadMoreWithScroll,
  };
};
