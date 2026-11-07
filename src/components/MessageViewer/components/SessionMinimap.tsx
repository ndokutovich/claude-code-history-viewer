/**
 * Session minimap — a narrow strip beside the message list showing where the
 * turns sit and which slice is on screen. Click or drag to jump (upstream #634).
 *
 * Opt-in: the toggle lives in the message-list header and persists with the
 * view preferences.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "../../../types";
import { cn } from "../../../utils/cn";
import { viewportFraction, fractionToScrollTop } from "../helpers/minimap";

export interface SessionMinimapProps {
  /** Ordered rows currently loaded (same array the virtualizer windows over). */
  messages: UIMessage[];
  /** Scroll container the strip drives. */
  scrollElement: HTMLElement | null;
  className?: string;
}

const barClassFor = (type: UIMessage["type"]): string => {
  if (type === "user") return "bg-blue-400/70";
  if (type === "assistant") return "bg-emerald-400/70";
  return "bg-gray-400/60";
};

export const SessionMinimap: React.FC<SessionMinimapProps> = ({
  messages,
  scrollElement,
  className,
}) => {
  const [viewport, setViewport] = useState({ start: 0, size: 1 });
  const draggingRef = useRef(false);

  const measure = useCallback(() => {
    if (!scrollElement) return;
    setViewport(
      viewportFraction(
        scrollElement.scrollTop,
        scrollElement.clientHeight,
        scrollElement.scrollHeight
      )
    );
  }, [scrollElement]);

  useEffect(() => {
    if (!scrollElement) return;
    measure();
    scrollElement.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scrollElement);
    return () => {
      scrollElement.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [scrollElement, measure]);

  const jumpTo = useCallback(
    (clientY: number, rect: DOMRect) => {
      if (!scrollElement || rect.height <= 0) return;
      const fraction = (clientY - rect.top) / rect.height;
      scrollElement.scrollTop = fractionToScrollTop(
        fraction,
        scrollElement.clientHeight,
        scrollElement.scrollHeight
      );
    },
    [scrollElement]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      jumpTo(event.clientY, event.currentTarget.getBoundingClientRect());
    },
    [jumpTo]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      jumpTo(event.clientY, event.currentTarget.getBoundingClientRect());
    },
    [jumpTo]
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  if (messages.length === 0) return null;

  return (
    <div
      role="scrollbar"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(viewport.start * 100)}
      aria-label="Session minimap"
      className={cn(
        "relative w-2.5 shrink-0 cursor-pointer rounded-full bg-muted/60",
        "hover:bg-muted transition-colors touch-none select-none",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Turn bars */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        {messages.map((message, index) => (
          <div
            key={`${message.uuid}-${index}`}
            className={cn("absolute left-0 right-0", barClassFor(message.type))}
            style={{
              top: `${(index / messages.length) * 100}%`,
              height: `${Math.max(100 / messages.length, 0.6)}%`,
            }}
          />
        ))}
      </div>

      {/* Viewport box */}
      <div
        className="absolute left-0 right-0 rounded-full border border-primary/60 bg-primary/15"
        style={{
          top: `${viewport.start * 100}%`,
          height: `${Math.max(viewport.size * 100, 4)}%`,
        }}
      />
    </div>
  );
};
