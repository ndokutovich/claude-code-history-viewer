import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Terminal } from "lucide-react";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import type { UIMessage } from "@/types";
import { extractBashCommand } from "@/utils/messageFilters";

interface CommandHistoryViewProps {
  messages: UIMessage[];
}

/**
 * Command History View - Displays bash commands like `history` command output
 * Shows only the command text in a simple numbered list format
 */
export const CommandHistoryView: React.FC<CommandHistoryViewProps> = ({ messages }) => {
  const { t } = useTranslation("components");

  // Extract all bash commands from messages
  const commands = useMemo(() => {
    const cmds: Array<{ index: number; command: string; timestamp: string }> = [];
    messages.forEach((msg, idx) => {
      const cmd = extractBashCommand(msg);
      if (cmd) {
        cmds.push({
          index: idx + 1,
          command: cmd,
          timestamp: msg.timestamp,
        });
      }
    });
    return cmds;
  }, [messages]);

  if (commands.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={cn("text-center p-8", COLORS.ui.text.muted)}>
          <Terminal className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t("messageView.noMessages")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full overflow-auto p-6", COLORS.ui.background.primary)}>
      <div className={cn("max-w-4xl mx-auto")}>
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Terminal className={cn("w-6 h-6", COLORS.ui.text.secondary)} />
          <h2 className={cn("text-xl font-semibold", COLORS.ui.text.primary)}>
            Command History ({commands.length} commands)
          </h2>
        </div>

        {/* Command list (bash history style) */}
        <div
          className={cn(
            "font-mono text-sm rounded-lg p-4",
            "bg-gray-50 dark:bg-gray-900",
            "border",
            COLORS.ui.border.light
          )}
        >
          {commands.map(({ index, command, timestamp }) => (
            <div
              key={index}
              className={cn(
                "py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-2 -mx-2",
                "transition-colors group"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Index number (like bash history) */}
                <span className={cn("flex-shrink-0 w-12 text-right", COLORS.ui.text.muted)}>
                  {index}
                </span>

                {/* Command text */}
                <span className={cn("flex-1 break-all", COLORS.ui.text.primary)}>
                  {command}
                </span>

                {/* Timestamp (hidden by default, shown on hover) */}
                <span
                  className={cn(
                    "flex-shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity",
                    COLORS.ui.text.muted
                  )}
                >
                  {new Date(timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Info footer */}
        <div className={cn("mt-4 text-sm", COLORS.ui.text.muted)}>
          <p>
            Displaying {commands.length} Bash command{commands.length !== 1 ? "s" : ""} from{" "}
            {messages.length} message{messages.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
};
