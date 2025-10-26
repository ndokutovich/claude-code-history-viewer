import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import {
  File,
  FileEdit,
  FileText,
  FolderSearch,
  Eye,
  Download,
  ArrowRight,
} from "lucide-react";
import type { FileActivity } from "../types";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import { formatRelativeTime } from "../utils/time";
import { getFileName, getDirectoryParts } from "../utils/pathUtils";
import { getOperationColor } from "../utils/fileOperationUtils";
import { toast } from "sonner";
import { openPath } from "@tauri-apps/plugin-opener";
import { downloadDir } from "@tauri-apps/api/path";

interface FileActivityTableProps {
  activities: FileActivity[];
  onViewFile: (file: FileActivity) => void;
}

const FileActivityTableComponent = ({
  activities,
  onViewFile,
}: FileActivityTableProps) => {
  const { t } = useTranslation("components");
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: activities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const getOperationIcon = (operation: string): React.ReactNode => {
    switch (operation.toLowerCase()) {
      case "read":
        return <Eye className="w-4 h-4" />;
      case "write":
      case "create":
        return <FileText className="w-4 h-4" />;
      case "edit":
      case "multiedit":
        return <FileEdit className="w-4 h-4" />;
      case "glob":
        return <FolderSearch className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  const getFileExtension = (filePath: string): string => {
    const parts = filePath.split(".");
    return parts.length > 1 ? (parts[parts.length - 1] || "") : "";
  };

  const getDirectory = (filePath: string): string => {
    const parts = getDirectoryParts(filePath);
    return parts.join("/");
  };

  const handleDownload = useCallback(async (file: FileActivity, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();

    const content = file.content_after || file.content_before || "";
    if (!content) {
      toast.error(t("filesView.toast.cannotDownload"), {
        description: t("filesView.toast.noContentAvailable")
      });
      return;
    }

    const fileName = getFileName(file.file_path) || "file.txt";

    // Show loading toast
    const loadingToast = toast.loading(t("filesView.toast.downloading", { fileName }));

    try {
      // Small delay to ensure toast is mounted before dismissing
      await new Promise(resolve => setTimeout(resolve, 100));

      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      // Show success toast with action
      toast.success(t("filesView.toast.downloaded", { fileName }), {
        description: t("filesView.toast.savedToDownloads"),
        action: {
          label: t("filesView.toast.openFolder"),
          onClick: async () => {
            try {
              const downloadsPath = await downloadDir();
              await openPath(downloadsPath);
            } catch (error) {
              console.error("Failed to open downloads folder:", error);
              toast.error(t("filesView.toast.failedToOpenFolder"));
            }
          }
        },
        duration: 5000,
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast.dismiss(loadingToast);
      toast.error(t("filesView.toast.downloadFailed"), {
        description: error instanceof Error ? error.message : t("filesView.toast.unknownError")
      });
    }
  }, [t]);

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      {/* Table Header */}
      <div
        className={cn(
          "sticky top-0 z-10 grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium border-b",
          COLORS.ui.background.secondary,
          COLORS.ui.border.medium,
          COLORS.ui.text.tertiary
        )}
      >
        <div className="col-span-4">{t("filesView.table.filePath")}</div>
        <div className="col-span-2">{t("filesView.table.operation")}</div>
        <div className="col-span-2">{t("filesView.table.timestamp")}</div>
        <div className="col-span-2">{t("filesView.table.changes")}</div>
        <div className="col-span-2 text-right">{t("filesView.table.actions")}</div>
      </div>

      {/* Table Body (Virtualized) */}
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const file = activities[virtualRow.index];
          if (!file) return null;

          const operationColor = getOperationColor(file.operation);
          const fileName = getFileName(file.file_path);
          const directory = getDirectory(file.file_path);
          const ext = getFileExtension(file.file_path);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={cn(
                "grid grid-cols-12 gap-4 px-4 py-3 border-b cursor-pointer transition-colors",
                COLORS.ui.border.light,
                "hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
              onClick={() => onViewFile(file)}
            >
              {/* File Path */}
              <div className="col-span-4 flex items-center space-x-2 min-w-0">
                <File className={cn("w-4 h-4 flex-shrink-0", COLORS.ui.text.muted)} />
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm font-medium truncate", COLORS.ui.text.primary)}>
                    {fileName}
                  </div>
                  {directory && (
                    <div className={cn("text-xs truncate", COLORS.ui.text.muted)}>
                      {directory}
                    </div>
                  )}
                </div>
                {ext && (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs rounded",
                      COLORS.ui.background.secondary,
                      COLORS.ui.text.secondary
                    )}
                  >
                    .{ext}
                  </span>
                )}
              </div>

              {/* Operation */}
              <div className="col-span-2 flex items-center space-x-2">
                <span className={cn(operationColor.icon)}>
                  {getOperationIcon(file.operation)}
                </span>
                <span className={cn("text-sm", operationColor.text)}>
                  {file.operation}
                </span>
              </div>

              {/* Timestamp */}
              <div className="col-span-2 flex items-center">
                <span className={cn("text-sm", COLORS.ui.text.secondary)}>
                  {formatRelativeTime(file.timestamp)}
                </span>
              </div>

              {/* Changes */}
              <div className="col-span-2 flex items-center space-x-3">
                {file.lines_added !== undefined && file.lines_added > 0 && (
                  <span className={cn("text-xs", COLORS.semantic.success.text)}>
                    +{file.lines_added}
                  </span>
                )}
                {file.lines_removed !== undefined && file.lines_removed > 0 && (
                  <span className={cn("text-xs", COLORS.semantic.error.text)}>
                    -{file.lines_removed}
                  </span>
                )}
                {file.changes && (
                  <span className={cn("text-xs", COLORS.ui.text.tertiary)}>
                    {t("filesView.table.changeCount", { count: file.changes.length })}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="col-span-2 flex items-center justify-end space-x-2">
                {(file.content_after || file.content_before) && (
                  <button
                    onClick={(e) => handleDownload(file, e)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      COLORS.ui.background.secondary,
                      "hover:bg-gray-200 dark:hover:bg-gray-700"
                    )}
                    title={t("filesView.table.download")}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onViewFile(file)}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    COLORS.semantic.info.bg,
                    COLORS.semantic.info.text,
                    "hover:opacity-80"
                  )}
                  title={t("filesView.table.view")}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Memoized export to prevent unnecessary re-renders
export const FileActivityTable = memo(FileActivityTableComponent);
