/**
 * Expanded Card
 *
 * Portal-based detail view for a message card in the Session Board.
 */

import { memo, useMemo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { UIMessage } from "../../types";
import { clsx } from "clsx";
import {
  FileText,
  X,
  FileCode,
  AlignLeft,
  Bot,
  User,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ToolIcon } from "../ToolIcon";
import { useTranslation } from "react-i18next";
import { getToolUseBlock } from "../../utils/cardSemantics";
import { useSessionBoard } from "../../hooks/useSessionBoard";

export const ExpandedCard = memo(
  ({
    message,
    content,
    editedMdFile,
    role,
    isError,
    triggerRect,
    isMarkdownPretty,
    onClose,
    onNext,
    onPrev,
    onFileClick,
    onNavigate,
  }: {
    message: UIMessage;
    content: string;
    editedMdFile: string | null;
    role: string;
    isError: boolean;
    triggerRect: DOMRect | null;
    isMarkdownPretty: boolean;
    onClose: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onFileClick?: (file: string) => void;
    onNavigate?: () => void;
  }) => {
    const { t } = useTranslation("components");
    const { setMarkdownPretty } = useSessionBoard();
    const [position, setPosition] = useState<{
      x: number;
      y: number;
      anchorY: "top" | "bottom";
    } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);

    const toolUseBlock = getToolUseBlock(message);

    // Initial positioning
    useEffect(() => {
      if (!triggerRect || position !== null) return;

      const windowHeight =
        typeof window !== "undefined" ? window.innerHeight : 768;
      const gap = 12;

      const left = triggerRect.right + gap;
      const isBottomHalf = triggerRect.top > windowHeight / 2;
      const anchorY = isBottomHalf ? "bottom" : "top";

      let top: number;
      if (isBottomHalf) {
        top = windowHeight - triggerRect.bottom;
        if (top < 20) top = 20;
      } else {
        top = triggerRect.top;
        if (top < 20) top = 20;
      }

      setPosition({ x: left, y: top, anchorY });
    }, [triggerRect, position]);

    // Dragging
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging || !dragStartRef.current || !position)
          return;

        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;

        setPosition((prev) => {
          if (!prev) return null;
          if (prev.anchorY === "bottom") {
            return {
              x: prev.x + deltaX,
              y: prev.y - deltaY,
              anchorY: "bottom",
            };
          }
          return {
            x: prev.x + deltaX,
            y: prev.y + deltaY,
            anchorY: "top",
          };
        });

        dragStartRef.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
      };

      if (isDragging) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
      }

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isDragging, position]);

    const handleDragStart = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const ToolContent = useMemo(() => {
      if (!toolUseBlock) return null;
      return (
        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words max-w-[440px]">
          {JSON.stringify(toolUseBlock.input, null, 2)}
        </pre>
      );
    }, [toolUseBlock]);

    if (!triggerRect || !position) return null;

    const windowHeight =
      typeof window !== "undefined" ? window.innerHeight : 768;
    const maxHeight = Math.min(600, windowHeight - 40);

    return createPortal(
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        />

        <div
          className={clsx(
            "absolute w-[480px] bg-popover/95 text-popover-foreground border border-border rounded-lg shadow-2xl flex flex-col backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 pointer-events-auto ring-1 ring-border/50",
            isDragging
              ? "cursor-grabbing shadow-xl scale-[1.01]"
              : "shadow-2xl"
          )}
          style={{
            left: `${position.x}px`,
            top:
              position.anchorY === "top"
                ? `${position.y}px`
                : undefined,
            bottom:
              position.anchorY === "bottom"
                ? `${position.y}px`
                : undefined,
            maxHeight: `${maxHeight}px`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (
              window.getSelection()?.toString().length === 0
            ) {
              onNavigate?.();
            }
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30 rounded-t-lg shrink-0 select-none cursor-grab active:cursor-grabbing group/header"
            onMouseDown={handleDragStart}
          >
            <div className="flex items-center gap-2.5">
              <GripVertical className="w-4 h-4 text-muted-foreground/30 group-hover/header:text-muted-foreground/60 transition-colors" />
              <div className="p-1.5 bg-background rounded-md shadow-sm border border-border/50">
                {toolUseBlock ? (
                  <ToolIcon
                    toolName={toolUseBlock.name}
                    className="w-4 h-4 text-accent"
                  />
                ) : role === "user" ? (
                  <User className="w-3 h-3 text-primary" />
                ) : (
                  <Bot className="w-3 h-3 text-muted-foreground" />
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <span
                  className={clsx(
                    "font-bold uppercase text-[11px] tracking-wide",
                    toolUseBlock
                      ? "text-accent"
                      : role === "user"
                        ? "text-primary"
                        : "text-foreground"
                  )}
                >
                  {toolUseBlock ? toolUseBlock.name : role}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono leading-none">
                  {new Date(
                    message.timestamp
                  ).toLocaleTimeString()}
                </span>
              </div>
              {editedMdFile && (
                <div
                  className={clsx(
                    "flex items-center gap-1.5 ml-3 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-600 font-medium font-mono transition-colors",
                    onFileClick &&
                      "hover:bg-amber-500/20 cursor-pointer"
                  )}
                  title={t(
                    "analytics.markdownFileEditClick",
                    {
                      defaultValue:
                        "Markdown File Edit - Click to view",
                    }
                  )}
                  onClick={(e) => {
                    if (onFileClick) {
                      e.stopPropagation();
                      onFileClick(editedMdFile);
                    }
                  }}
                >
                  <FileText className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">
                    {editedMdFile}
                  </span>
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Navigation Controls */}
              <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-md border border-border/50 mr-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrev?.();
                  }}
                  disabled={!onPrev}
                  className="p-1 rounded hover:bg-background hover:shadow-sm disabled:opacity-30 transition-all"
                  title={t("analytics.prevMsg", {
                    defaultValue: "Previous Message",
                  })}
                  aria-label={t("analytics.prevMsg", {
                    defaultValue: "Previous Message",
                  })}
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext?.();
                  }}
                  disabled={!onNext}
                  className="p-1 rounded hover:bg-background hover:shadow-sm disabled:opacity-30 transition-all"
                  title={t("analytics.nextMsg", {
                    defaultValue: "Next Message",
                  })}
                  aria-label={t("analytics.nextMsg", {
                    defaultValue: "Next Message",
                  })}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              {/* Markdown Toggle */}
              <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-md border border-border/50">
                <button
                  onClick={() => setMarkdownPretty(false)}
                  className={clsx(
                    "p-1 rounded transition-all",
                    !isMarkdownPretty
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={t("analytics.rawText", {
                    defaultValue: "Raw Text",
                  })}
                  aria-label={t("analytics.rawText", {
                    defaultValue: "Raw Text",
                  })}
                >
                  <AlignLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setMarkdownPretty(true)}
                  className={clsx(
                    "p-1 rounded transition-all",
                    isMarkdownPretty
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={t("analytics.prettyMarkdown", {
                    defaultValue: "Pretty Markdown",
                  })}
                  aria-label={t("analytics.prettyMarkdown", {
                    defaultValue: "Pretty Markdown",
                  })}
                >
                  <FileCode className="w-3 h-3" />
                </button>
              </div>

              {/* Open in Full View */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.();
                }}
                className="p-1 hover:bg-muted rounded text-xs text-muted-foreground hover:text-foreground transition-colors mr-1"
                title={t("analytics.openInView", {
                  defaultValue: "Open in Message View",
                })}
                aria-label={t("analytics.openInView", {
                  defaultValue: "Open in Message View",
                })}
              >
                {t("analytics.open", { defaultValue: "Open" })}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1 hover:bg-muted rounded-full transition-colors opacity-70 hover:opacity-100"
                title={t("analytics.close", {
                  defaultValue: "Close",
                })}
                aria-label={t("analytics.close", {
                  defaultValue: "Close",
                })}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
            {isMarkdownPretty && !toolUseBlock ? (
              <div className="prose prose-xs dark:prose-invert max-w-none break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
              </div>
            ) : content ? (
              content
            ) : (
              ToolContent ||
              t("analytics.noContent", {
                defaultValue: "No content",
              })
            )}
          </div>

          {isError && (
            <div className="px-4 py-2 border-t border-destructive/20 bg-destructive/5 text-destructive text-xs font-medium">
              {t("analytics.errorDetected", {
                defaultValue:
                  "Error detected in this interaction",
              })}
            </div>
          )}

          <div className="p-2 border-t border-border/50 bg-muted/10 rounded-b-lg flex justify-end gap-3 text-[10px] text-muted-foreground shrink-0 font-mono">
            {message.type === "assistant" && message.usage && (
              <>
                <span>
                  {t("sessionBoard.inputTokens")} {message.usage.input_tokens || 0}
                </span>
                <span>
                  {t("sessionBoard.outputTokens")} {message.usage.output_tokens || 0}
                </span>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }
);
ExpandedCard.displayName = "ExpandedCard";
