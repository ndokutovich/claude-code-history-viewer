import React from "react";
import { Check, Link2, ArrowUpCircle, ArrowDownCircle, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ClaudeContentArrayRenderer } from "../../contentRenderer";
import {
  ClaudeToolUseDisplay,
  ToolExecutionResultRouter,
  MessageContentDisplay,
  AssistantMessageDetails,
  ProviderMetadataDisplay,
} from "../../messageRenderer";
import { SystemMessageRenderer } from "../../messageRenderer/SystemMessageRenderer";
import { extractUIMessageContent } from "../../../utils/messageUtils";
import { cn } from "../../../utils/cn";
import { COLORS } from "../../../constants/colors";
import { formatTime } from "../../../utils/time";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { MAX_DEPTH_MARGIN } from "../../../constants/layout";
import type { MessageNodeProps } from "../types";

export const MessageNode = React.memo(({
  message,
  depth,
  providerName,
  sessionFilePath,
  allMessages,
  onExtractRange,
  isCaptureMode,
  onHideMessage,
}: MessageNodeProps) => {
  const { t } = useTranslation("components");
  const [copiedReference, setCopiedReference] = React.useState(false);

  const handleCopyReference = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Format: file_path:line_number or file_path#messageUUID
      const reference = sessionFilePath
        ? `${sessionFilePath}#${message.uuid}`
        : message.uuid;

      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(reference);
      setCopiedReference(true);

      const { toast } = await import("sonner");
      toast.success(t("messageReference.referenceCopied"));

      setTimeout(() => setCopiedReference(false), 2000);
    } catch (error) {
      console.error("Failed to copy reference:", error);
      const { toast } = await import("sonner");
      toast.error(t("messageReference.referenceCopyFailed"));
    }
  };

  const handleExtractAbove = (openModal: boolean) => {
    const currentIndex = allMessages.findIndex(m => m.uuid === message.uuid);
    if (currentIndex >= 0) {
      // Extract from start to current (inclusive)
      onExtractRange(0, currentIndex, openModal);
    }
  };

  const handleExtractBelow = (openModal: boolean) => {
    const currentIndex = allMessages.findIndex(m => m.uuid === message.uuid);
    if (currentIndex >= 0) {
      // Extract from current to end (inclusive)
      onExtractRange(currentIndex, allMessages.length - 1, openModal);
    }
  };

  // Cache content extraction (was called 3x per render)
  const extractedContent = React.useMemo(
    () => extractUIMessageContent(message),
    [message]
  );

  // Sidechain filtering is now handled at the data loading level (adapter.loadMessages)
  // This is a defensive check to catch adapter bugs during development
  if (message.isSidechain && import.meta.env.DEV) {
    console.warn(
      '[MessageViewer] Sidechain message not filtered by adapter:',
      message.uuid,
      'This indicates an adapter bug - sidechains should be filtered during data loading.'
    );
  }

  // Apply left margin based on depth
  const leftMargin = depth > 0 ? `ml-${Math.min(depth * 4, MAX_DEPTH_MARGIN)}` : "";

  return (
    <div
      id={`message-${message.uuid}`}
      className={cn(
        "w-full px-4 py-2",
        leftMargin,
        message.isSidechain && "bg-gray-100 dark:bg-gray-800"
      )}
    >
      <div className="max-w-full mx-auto px-4">
        {/* Show depth (only in development mode) */}
        {import.meta.env.DEV && depth > 0 && (
          <div className="text-xs text-gray-400 dark:text-gray-600 mb-1">
            └─ {t("messageViewer.reply", { depth })}
          </div>
        )}

        {/* Message header */}
        <div
          className={`flex items-center space-x-2 mb-1 text-md text-gray-500 dark:text-gray-400 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {message.type === "user" && (
            <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full" />
          )}
          <span className="font-medium whitespace-nowrap">
            {message.type === "user"
              ? t("messageViewer.user")
              : message.type === "assistant"
              ? providerName
              : t("messageViewer.system")}
          </span>
          <span className="whitespace-nowrap">
            {formatTime(message.timestamp)}
          </span>
          {message.isSidechain && (
            <span className="px-2 py-1 whitespace-nowrap text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-300 rounded-full">
              {t("messageViewer.branch")}
            </span>
          )}
          {/* Copy Reference Button */}
          <button
            onClick={handleCopyReference}
            className={cn(
              "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
              "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
            title={t("messageReference.referenceTooltip")}
          >
            {copiedReference ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Link2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Extract Messages Above Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
                  "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
                title={t("messageReference.extractAboveTooltip")}
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExtractAbove(true)}>
                {t("messageReference.openInBuilder")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExtractAbove(false)}>
                {t("messageReference.createDirectly")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Extract Messages Below Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
                  "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                )}
                title={t("messageReference.extractBelowTooltip")}
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExtractBelow(true)}>
                {t("messageReference.openInBuilder")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExtractBelow(false)}>
                {t("messageReference.createDirectly")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Hide Block Button (Capture Mode) */}
          {isCaptureMode && onHideMessage && (
            <button
              onClick={() => onHideMessage(message.uuid)}
              className={cn(
                "p-1 rounded transition-colors",
                "text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
              )}
              title={t("renderers:captureMode.hideBlock")}
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
          {message.type === "assistant" && (
            <div className="w-full h-0.5 bg-gray-100 dark:bg-gray-700 rounded-full" />
          )}
        </div>

        {/* Message content */}
        <div className="w-full">
          {/* System message with subtype → dedicated renderer */}
          {message.type === "system" && message.subtype ? (
            <SystemMessageRenderer
              content={typeof message.content === "string" ? message.content : undefined}
              subtype={message.subtype}
              level={message.level}
              hookCount={message.hookCount}
              hookInfos={message.hookInfos}
              stopReason={message.stopReasonSystem}
              preventedContinuation={message.preventedContinuation}
              durationMs={message.durationMs}
              compactMetadata={message.compactMetadata}
              microcompactMetadata={message.microcompactMetadata}
            />
          ) : (
            <>
              {/* Message Content */}
              <MessageContentDisplay
                content={extractedContent}
                messageType={message.type}
              />

              {/* Claude API Content Array */}
              {message.content &&
                typeof message.content === "object" &&
                Array.isArray(message.content) &&
                (message.type !== "assistant" ||
                  (message.type === "assistant" &&
                    !extractedContent)) && (
                  <div className="mb-2">
                    <ClaudeContentArrayRenderer content={message.content} />
                  </div>
                )}

              {/* Special case: when content is null but toolUseResult exists */}
              {!extractedContent &&
                message.toolUseResult &&
                typeof message.toolUseResult === "object" &&
                Array.isArray(message.toolUseResult.content) && (
                  <div className={cn("text-sm mb-2", COLORS.ui.text.tertiary)}>
                    <span className="italic">:</span>
                  </div>
                )}

              {/* Tool Use */}
              {message.toolUse && (
                <ClaudeToolUseDisplay toolUse={message.toolUse} />
              )}

              {/* Tool Result */}
              {message.toolUseResult && (
                <ToolExecutionResultRouter
                  toolResult={message.toolUseResult}
                />
              )}

              {/* Provider-specific Metadata (file attachments, etc.) */}
              {message.provider_metadata && (
                <ProviderMetadataDisplay metadata={message.provider_metadata} />
              )}

              {/* Assistant Metadata */}
              <AssistantMessageDetails message={message} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});
