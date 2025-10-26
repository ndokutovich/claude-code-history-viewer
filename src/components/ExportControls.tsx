import { useState } from "react";
import { FileText, FileCode, Globe, Copy, Check, MessageSquare, Code, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { exportToMarkdown, exportToHTML, exportToDocx } from "@/utils/exportUtils";
import type { UIMessage, UISession } from "@/types";
import { getSessionTitle } from "@/utils/sessionUtils";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

interface ExportControlsProps {
  messages: UIMessage[];
  session: UISession;
}

type ExportMode = "formatted" | "raw";
type ExportTheme = "light" | "dark";

export function ExportControls({ messages, session }: ExportControlsProps) {
  const { t } = useTranslation("components");
  const [includeAttachments, setIncludeAttachments] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("formatted");
  const [exportTheme, setExportTheme] = useState<ExportTheme>("light");
  const [isExporting, setIsExporting] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const sessionTitle = getSessionTitle(session, messages);

  const handleExport = async (
    format: "markdown" | "html" | "docx",
    exportFn: (messages: UIMessage[], title: string, includeAttachments: boolean, mode: ExportMode, theme: ExportTheme) => Promise<void>
  ) => {
    if (messages.length === 0) {
      toast.error(t("export.noMessages"));
      return;
    }

    setIsExporting(true);
    try {
      await exportFn(messages, sessionTitle, includeAttachments, exportMode, exportTheme);
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
      {/* Export Mode Toggle (Formatted / Raw) */}
      <div className={cn("flex items-center gap-1 rounded-lg p-1 bg-gray-100 dark:bg-gray-800")}>
        <button
          onClick={() => setExportMode("formatted")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors",
            exportMode === "formatted"
              ? "bg-white dark:bg-gray-700 shadow-sm"
              : "hover:bg-gray-100 dark:hover:bg-gray-700",
            exportMode === "formatted"
              ? COLORS.ui.text.primary
              : COLORS.ui.text.secondary
          )}
          title={t("export.formattedTooltip")}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{t("export.formatted")}</span>
        </button>

        <button
          onClick={() => setExportMode("raw")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors",
            exportMode === "raw"
              ? "bg-white dark:bg-gray-700 shadow-sm"
              : "hover:bg-gray-100 dark:hover:bg-gray-700",
            exportMode === "raw"
              ? COLORS.ui.text.primary
              : COLORS.ui.text.secondary
          )}
          title={t("export.rawTooltip")}
        >
          <Code className="w-3.5 h-3.5" />
          <span>{t("export.raw")}</span>
        </button>
      </div>

      {/* Theme Toggle (Light / Dark) - Only for Formatted mode */}
      {exportMode === "formatted" && (
        <div className={cn("flex items-center gap-1 rounded-lg p-1 bg-gray-100 dark:bg-gray-800")}>
          <button
            onClick={() => setExportTheme("light")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors",
              exportTheme === "light"
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "hover:bg-gray-100 dark:hover:bg-gray-700",
              exportTheme === "light"
                ? COLORS.ui.text.primary
                : COLORS.ui.text.secondary
            )}
            title={t("export.lightTheme")}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setExportTheme("dark")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors",
              exportTheme === "dark"
                ? "bg-white dark:bg-gray-700 shadow-sm"
                : "hover:bg-gray-100 dark:hover:bg-gray-700",
              exportTheme === "dark"
                ? COLORS.ui.text.primary
                : COLORS.ui.text.secondary
            )}
            title={t("export.darkTheme")}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Separator */}
      <div className={cn("h-6 w-px", COLORS.ui.border.light)} />

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
