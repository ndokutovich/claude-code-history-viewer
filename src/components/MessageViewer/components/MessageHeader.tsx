/**
 * MessageHeader Component
 *
 * Displays message metadata (role, timestamp, model info, usage stats).
 */

import React from "react";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../utils/cn";
import { formatTime } from "../../../utils/time";
import { getShortModelName } from "../../../utils/model";
import { getToolDisplayName } from "../../../utils/toolUtils";
import { hasSystemCommandContent } from "../helpers/messageHelpers";
import type { MessageHeaderProps } from "../types";

/** Format timestamp to a short human-readable string */
function formatTimeShort(timestamp: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Extract tool name from message tool use / tool use result */
function getToolName(
  toolUse?: Record<string, unknown>,
  toolUseResult?: Record<string, unknown>
): string | null {
  if (toolUse && typeof toolUse.name === "string") {
    return getToolDisplayName(toolUse.name);
  }
  if (toolUseResult && typeof toolUseResult.tool_name === "string") {
    return getToolDisplayName(toolUseResult.tool_name);
  }
  return null;
}

export const MessageHeader: React.FC<MessageHeaderProps> = ({ message }) => {
  const { t } = useTranslation();
  const isToolResultMessage =
    (message.type === "user" || message.type === "assistant") &&
    !!message.toolUseResult;
  const isSystemContent = hasSystemCommandContent(message);
  const toolName = isToolResultMessage
    ? getToolName(
      message.toolUse as Record<string, unknown> | undefined,
      message.toolUseResult as Record<string, unknown> | undefined
    )
    : null;
  const isLeftAligned =
    message.type !== "user" || isToolResultMessage || isSystemContent;

  return (
    <div className={cn(
      "flex items-center mb-1 text-xs text-muted-foreground",
      isLeftAligned ? "justify-between" : "justify-end"
    )}>
      <div className="flex items-center gap-1.5">
        <span className="font-medium">
          {isToolResultMessage && toolName
            ? toolName
            : isSystemContent
              ? t("messageViewer.system")
              : message.type === "user"
                ? t("messageViewer.user")
                : message.type === "assistant"
                  ? (message.provider === "codex"
                    ? "Codex"
                    : message.provider === "opencode"
                      ? "OpenCode"
                      : t("messageViewer.claude"))
                  : t("messageViewer.system")}
        </span>
        <span>·</span>
        <span>{formatTimeShort(message.timestamp)}</span>
        {message.isSidechain && (
          <span className="px-1.5 py-0.5 text-xs font-mono bg-warning/20 text-warning-foreground rounded-full">
            {t("messageViewer.branch")}
          </span>
        )}
      </div>

      {message.type === "assistant" && message.model && (
        <div className="relative group flex items-center gap-1.5">
          <span className="text-muted-foreground">{getShortModelName(message.model)}</span>
          {message.usage && (
            <>
              <HelpCircle className="w-3 h-3 cursor-help text-muted-foreground" />
              <div className={cn(
                "absolute bottom-full mb-2 right-0 w-52 bg-popover text-popover-foreground",
                "text-xs rounded-md p-2.5",
                "opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10 border border-border"
              )}>
                <p className="mb-1"><strong>{t("assistantMessageDetails.model")}:</strong> {message.model}</p>
                <p className="mb-1"><strong>{t("messageViewer.time")}:</strong> {formatTime(message.timestamp)}</p>
                {message.usage.input_tokens && <p>{t("assistantMessageDetails.input")}: {message.usage.input_tokens.toLocaleString()}</p>}
                {message.usage.output_tokens && <p>{t("assistantMessageDetails.output")}: {message.usage.output_tokens.toLocaleString()}</p>}
                {message.usage.cache_creation_input_tokens ? <p>{t("assistantMessageDetails.cacheCreation")}: {message.usage.cache_creation_input_tokens.toLocaleString()}</p> : null}
                {message.usage.cache_read_input_tokens ? <p>{t("assistantMessageDetails.cacheRead")}: {message.usage.cache_read_input_tokens.toLocaleString()}</p> : null}
                <div className="absolute right-4 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-popover"></div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

MessageHeader.displayName = "MessageHeader";
