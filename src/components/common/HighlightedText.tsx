import React, { useMemo, memo } from "react";
import { cn } from "@/utils/cn";

interface HighlightedTextProps {
  text: string;
  searchQuery: string;
  isCurrentMatch?: boolean;
  currentMatchIndex?: number;
  className?: string;
}

/**
 * Renders text with search query highlighted.
 *
 * Features:
 * - Case-insensitive search matching
 * - KakaoTalk-style highlighting: bright yellow for current match, light yellow for others
 * - Accessibility support with aria-current attribute
 * - Scroll targeting with data-search-highlight attribute
 */
const HighlightedTextComponent: React.FC<HighlightedTextProps> = ({
  text,
  searchQuery,
  isCurrentMatch = false,
  currentMatchIndex = 0,
  className,
}) => {
  const highlightedContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return text;
    }

    const query = searchQuery.toLowerCase();
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let matchIndex = 0;

    const textLower = text.toLowerCase();
    let currentIndex = textLower.indexOf(query);

    while (currentIndex !== -1) {
      if (currentIndex > lastIndex) {
        parts.push(text.slice(lastIndex, currentIndex));
      }

      const matchedText = text.slice(currentIndex, currentIndex + query.length);
      const isThisMatchActive = isCurrentMatch && matchIndex === currentMatchIndex;
      const keyId = `${currentIndex}-${matchedText.slice(0, 10)}`;

      parts.push(
        <mark
          key={keyId}
          {...(isThisMatchActive ? { "data-search-highlight": "current" } : {})}
          aria-current={isThisMatchActive ? "true" : undefined}
          className={cn(
            "rounded px-0.5 transition-colors",
            isThisMatchActive
              ? "bg-yellow-400 dark:bg-yellow-500 text-gray-900 ring-2 ring-yellow-500 dark:ring-yellow-400"
              : "bg-yellow-200 dark:bg-yellow-600/50 text-gray-900 dark:text-gray-100"
          )}
        >
          {matchedText}
        </mark>
      );

      lastIndex = currentIndex + query.length;
      matchIndex++;
      currentIndex = textLower.indexOf(query, lastIndex);
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, [text, searchQuery, isCurrentMatch, currentMatchIndex]);

  return <span className={className}>{highlightedContent}</span>;
};

export const HighlightedText = memo(HighlightedTextComponent);
