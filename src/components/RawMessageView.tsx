import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import type { UIMessage } from "@/types";
import { formatTime } from "@/utils/time";

interface RawMessageViewProps {
  messages: UIMessage[];
}

export function RawMessageView({ messages }: RawMessageViewProps) {
  const { t } = useTranslation("components");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyMessage = async (message: UIMessage, index: number) => {
    try {
      // Create a clean JSON representation
      const cleanMessage = {
        uuid: message.uuid,
        parentUuid: message.parentUuid,
        sessionId: message.sessionId,
        timestamp: message.timestamp,
        type: message.type,
        content: message.content,
        toolUse: message.toolUse,
        toolUseResult: message.toolUseResult,
        model: message.model,
        usage: message.usage,
      };

      const jsonString = JSON.stringify(cleanMessage, null, 2);
      await writeText(jsonString);
      setCopiedIndex(index);
      toast.success(t("messageView.rawCopied"));
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error(t("messageView.rawCopyFailed"));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-full mx-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.uuid}
            className={cn(
              "border rounded-lg p-4",
              COLORS.ui.background.secondary,
              COLORS.ui.border.light
            )}
          >
            {/* Message Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: 'inherit' }}>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-semibold", COLORS.ui.text.primary)}>
                  {message.type === "user" ? "👤 User" : message.type === "assistant" ? "🤖 Assistant" : "🔧 System"}
                </span>
                <span className={cn("text-xs", COLORS.ui.text.secondary)}>
                  {formatTime(message.timestamp)}
                </span>
                <span className={cn("text-xs font-mono", COLORS.ui.text.muted)}>
                  {message.uuid.slice(0, 8)}
                </span>
              </div>
              <button
                onClick={() => handleCopyMessage(message, index)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
                  "hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors",
                  COLORS.ui.text.secondary
                )}
              >
                {copiedIndex === index ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span>{t("messageView.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("messageView.copyRaw")}</span>
                  </>
                )}
              </button>
            </div>

            {/* Raw JSON Content */}
            <pre className={cn(
              "text-xs overflow-x-auto p-3 rounded",
              "bg-gray-50 dark:bg-gray-900 font-mono whitespace-pre-wrap break-words"
            )}>
              {JSON.stringify(
                {
                  uuid: message.uuid,
                  parentUuid: message.parentUuid,
                  sessionId: message.sessionId,
                  timestamp: message.timestamp,
                  type: message.type,
                  content: message.content,
                  toolUse: message.toolUse,
                  toolUseResult: message.toolUseResult,
                  ...(message.model && { model: message.model }),
                  ...(message.usage && { usage: message.usage }),
                },
                null,
                2
              )}
            </pre>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className={cn("text-sm", COLORS.ui.text.muted)}>
              {t("messageView.noMessages")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
