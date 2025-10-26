import { useState, useMemo } from "react";
import { FileText, FileCode, Globe, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { exportToMarkdown, exportToHTML, exportToDocx } from "@/utils/exportUtils";
import type { UIMessage, UISession } from "@/types";
import { getSessionTitle } from "@/utils/sessionUtils";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useAppStore } from "@/store/useAppStore";
import { useTheme } from "@/contexts/theme";

interface ExportControlsProps {
  messages: UIMessage[];
  session: UISession;
}

export function ExportControls({ messages, session }: ExportControlsProps) {
  const { t } = useTranslation("components");
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  // Get current view mode and theme from app settings
  const { messageViewMode, messageFilters } = useAppStore();
  const { isDarkMode } = useTheme();

  const sessionTitle = getSessionTitle(session, messages);

  // Filter messages based on current filter settings
  const filteredMessages = useMemo(() => {
    if (!messageFilters.showBashOnly && !messageFilters.showToolUseOnly && !messageFilters.showMessagesOnly) {
      return messages; // No filters active
    }

    return messages.filter((message) => {
      // Bash only filter
      if (messageFilters.showBashOnly) {
        const hasBashTool = message.content &&
          Array.isArray(message.content) &&
          message.content.some((item) =>
            item.type === "tool_use" && item.name === "Bash"
          );
        return hasBashTool;
      }

      // Tool use only filter
      if (messageFilters.showToolUseOnly) {
        const hasToolUse = message.content &&
          Array.isArray(message.content) &&
          message.content.some((item) => item.type === "tool_use");
        return hasToolUse;
      }

      // Messages only filter
      if (messageFilters.showMessagesOnly) {
        const hasNoTools = !message.toolUse && !message.toolUseResult;
        return hasNoTools;
      }

      return true;
    });
  }, [messages, messageFilters]);

  const handleExport = async (
    format: "markdown" | "html" | "docx",
    exportFn: (messages: UIMessage[], title: string, includeAttachments: boolean, mode: "formatted" | "raw", theme: "light" | "dark") => Promise<void>
  ) => {
    if (filteredMessages.length === 0) {
      toast.error(t("export.noMessages"));
      return;
    }

    setIsExporting(true);
    try {
      const mode = messageViewMode; // Use current view mode from app settings
      const theme = isDarkMode ? "dark" : "light"; // Use current theme from theme context
      await exportFn(filteredMessages, sessionTitle, includeAttachments, mode, theme);
      toast.success(t("export.success", { format: format.toUpperCase() }));
    } catch (error) {
      console.error(`Export to ${format} failed:`, error);
      toast.error(t("export.failed", { format: format.toUpperCase() }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyPath = async () => {
    try {
      await writeText(session.file_path);
      setCopiedPath(true);
      toast.success(t("export.pathCopied"));
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (error) {
      console.error("Failed to copy path:", error);
      toast.error(t("export.pathCopyFailed"));
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* With Attachments Toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={includeAttachments}
          onChange={(e) => setIncludeAttachments(e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <span className={cn(COLORS.ui.text.secondary)}>
          {t("export.withAttachments")}
        </span>
      </label>

      {/* Separator */}
      <div className={cn("h-6 w-px", COLORS.ui.border.light)} />

      {/* Export Buttons */}
      <div className="flex items-center gap-2">
        <span className={cn("text-sm", COLORS.ui.text.secondary)}>
          {t("export.exportTo")}:
        </span>

        <button
          onClick={() => handleExport("markdown", exportToMarkdown)}
          disabled={isExporting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            "hover:bg-blue-50 dark:hover:bg-blue-900/20",
            COLORS.ui.text.secondary,
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={t("export.markdownTooltip")}
        >
          <FileText className="w-4 h-4" />
          <span>MD</span>
        </button>

        <button
          onClick={() => handleExport("html", exportToHTML)}
          disabled={isExporting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            "hover:bg-green-50 dark:hover:bg-green-900/20",
            COLORS.ui.text.secondary,
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={t("export.htmlTooltip")}
        >
          <Globe className="w-4 h-4" />
          <span>HTML</span>
        </button>

        <button
          onClick={() => handleExport("docx", exportToDocx)}
          disabled={isExporting}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            "hover:bg-purple-50 dark:hover:bg-purple-900/20",
            COLORS.ui.text.secondary,
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={t("export.docxTooltip")}
        >
          <FileCode className="w-4 h-4" />
          <span>DOCX</span>
        </button>
      </div>

      {/* Separator */}
      <div className={cn("h-6 w-px", COLORS.ui.border.light)} />

      {/* Copy Path Button */}
      <button
        onClick={handleCopyPath}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          COLORS.ui.text.secondary
        )}
        title={t("export.copyPathTooltip")}
      >
        {copiedPath ? (
          <>
            <Check className="w-4 h-4 text-green-500" />
            <span>{t("export.copied")}</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            <span>{t("export.copyPath")}</span>
          </>
        )}
      </button>
    </div>
  );
}
