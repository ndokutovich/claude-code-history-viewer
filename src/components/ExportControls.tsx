import { useState, useMemo, useEffect } from "react";
import { FileText, FileCode, Globe, Copy, Check, Wrench, Play } from "lucide-react";
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
import { filterMessages } from "@/utils/messageFilters";
import { downloadDir, join } from "@tauri-apps/api/path";
import { createFileActions } from "@/utils/fileActions";

interface ExportControlsProps {
  messages: UIMessage[];
  session: UISession;
}

export function ExportControls({ messages, session }: ExportControlsProps) {
  const { t } = useTranslation("components");
  const { t: tCommon } = useTranslation("common");
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isFixingSession, setIsFixingSession] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [supportsResume, setSupportsResume] = useState(false);

  // Get current view mode, theme, and pagination state from app settings
  const { messageViewMode, messageFilters, pagination, loadAllMessages, refreshCurrentSession } = useAppStore();
  const { isDarkMode } = useTheme();

  const sessionTitle = getSessionTitle(session, messages);

  // Check if provider supports resume functionality
  useEffect(() => {
    const checkResumeSupport = async () => {
      if (!session.providerId) {
        setSupportsResume(false);
        return;
      }
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const supported = await invoke<boolean>("provider_supports_resume", {
          providerId: session.providerId,
        });
        setSupportsResume(supported);
      } catch (error) {
        console.error("Failed to check resume support:", error);
        setSupportsResume(false);
      }
    };
    checkResumeSupport();
  }, [session.providerId]);

  // Filter messages based on current filter settings (reuse utility function)
  const filteredMessages = useMemo(() => {
    return filterMessages(messages, messageFilters);
  }, [messages, messageFilters]);

  const handleExport = async (
    format: "markdown" | "html" | "docx",
    exportFn: (messages: UIMessage[], title: string, includeAttachments: boolean, mode: "formatted" | "raw", theme: "light" | "dark", filters?: typeof messageFilters) => Promise<string>
  ) => {
    if (filteredMessages.length === 0) {
      toast.error(t("export.noMessages"));
      return;
    }

    setIsExporting(true);
    try {
      const mode = messageViewMode; // Use current view mode from app settings
      const theme = isDarkMode ? "dark" : "light"; // Use current theme from theme context
      const filename = await exportFn(filteredMessages, sessionTitle, includeAttachments, mode, theme, messageFilters);

      // Get full path to exported file in Downloads folder
      const downloadsPath = await downloadDir();
      const fullFilePath = await join(downloadsPath, filename);
      const actions = createFileActions(fullFilePath, { t: (key) => t(`common:${key}`) });

      // Show success toast with Open File and Open Folder buttons
      toast.success(t("export.success", { format: format.toUpperCase() }), {
        action: actions.openFile,
        cancel: actions.openFolder,
      });
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

  const handleLoadAll = async () => {
    try {
      await loadAllMessages();
      toast.success(t("export.allMessagesLoaded", { count: pagination.totalCount }));
    } catch (error) {
      console.error("Failed to load all messages:", error);
      toast.error(t("export.failedToLoadAll"));
    }
  };

  const handleFixSession = async () => {
    if (!session.is_problematic) return;

    try {
      setIsFixingSession(true);
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<string>("fix_session", {
        sessionFilePath: session.file_path,
      });

      toast.success(result);
      await refreshCurrentSession();
    } catch (error) {
      console.error("Failed to fix session:", error);
      toast.error(`Failed to fix session: ${error}`);
    } finally {
      setIsFixingSession(false);
    }
  };

  const handleResumeSession = async (event: React.MouseEvent) => {
    try {
      setIsResuming(true);
      const { invoke } = await import("@tauri-apps/api/core");

      // Get actual working directory from session file
      // For Cursor: use file_path (composite ID: db_path#session=...#timestamp=...)
      // For others: use session_id (file path)
      const sessionIdentifier = session.providerId === "cursor"
        ? session.file_path
        : session.session_id;

      const cwd = await invoke<string>("get_session_cwd", {
        sessionFilePath: sessionIdentifier,
        providerId: session.providerId || "claude-code",
      });

      // If Shift key is held, copy command instead of executing
      if (event.shiftKey) {
        const resumeCommand = await invoke<string>("get_resume_command", {
          sessionId: sessionIdentifier,
          cwd,
          providerId: session.providerId || "claude-code",
        });
        await writeText(resumeCommand);
        toast.success(t("export.resumeCommandCopied"));
      } else {
        // Execute resume in terminal
        await invoke("resume_session", {
          sessionId: sessionIdentifier,
          cwd,
          providerId: session.providerId || "claude-code",
        });
        toast.success(t("export.sessionResumed"));
      }
    } catch (error) {
      console.error("Failed to resume session:", error);
      toast.error(`Failed to resume: ${error}`);
    } finally {
      setIsResuming(false);
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

      {/* Load All Messages Button */}
      {pagination.hasMore && (
        <button
          onClick={handleLoadAll}
          disabled={pagination.isLoadingMore}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            "bg-blue-500 hover:bg-blue-600 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={t("export.loadAllTooltip")}
        >
          {pagination.isLoadingMore ? (
            <span>{t("export.loading")}</span>
          ) : (
            <span>{t("export.loadAll")}</span>
          )}
        </button>
      )}

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

      {/* Resume Session Button - Show for providers that support resume */}
      {supportsResume && (
        <button
          onClick={handleResumeSession}
          disabled={isResuming}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
            "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700",
            "hover:bg-green-100 dark:hover:bg-green-900/30",
            "text-green-700 dark:text-green-400",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={t("export.resumeTooltip")}
        >
          <Play className={cn("w-4 h-4", isResuming && "animate-pulse")} />
          <span>{isResuming ? t("status.resuming") : t("export.resume")}</span>
        </button>
      )}

      {/* Fix Session Button - Only show if session is problematic */}
      {session.is_problematic && (
        <button
          onClick={handleFixSession}
          disabled={isFixingSession}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border-2",
            "bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600",
            "hover:bg-orange-100 dark:hover:bg-orange-900/30",
            "text-orange-700 dark:text-orange-400",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          title={tCommon("session.fix")}
        >
          <Wrench className={cn("w-4 h-4", isFixingSession && "animate-pulse")} />
          <span>{isFixingSession ? t("status.fixing") : t("export.fixSession")}</span>
        </button>
      )}
    </div>
  );
}
