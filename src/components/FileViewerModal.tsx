import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { FileContent } from "./FileContent";
import { EnhancedDiffViewer } from "./EnhancedDiffViewer";
import { Download, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { useAnalytics } from "../hooks/useAnalytics";
import type { FileActivity } from "../types";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import { formatRelativeTime } from "../utils/time";
import { getFileName } from "../utils/pathUtils";
import { getOperationColor } from "../utils/fileOperationUtils";
import { toast } from "sonner";
import { Command } from "@tauri-apps/plugin-shell";
import { platform } from "@tauri-apps/plugin-os";

interface FileViewerModalProps {
  file: FileActivity;
  isOpen: boolean;
  onClose: () => void;
}

export const FileViewerModal = ({
  file,
  isOpen,
  onClose,
}: FileViewerModalProps) => {
  const { t } = useTranslation("components");
  const { projects, selectProject, loadProjectSessions, selectSession } = useAppStore();
  const { actions: analyticsActions } = useAnalytics();

  const handleDownload = () => {
    const content = file.content_after || file.content_before || "";
    if (!content) {
      console.warn("Cannot download: No content available", {
        file_path: file.file_path,
        has_content_after: !!file.content_after,
        has_content_before: !!file.content_before,
        operation: file.operation,
      });
      toast.error(t("filesView.toast.cannotDownload"), {
        description: t("filesView.toast.noContentAvailable")
      });
      return;
    }

    const fileName = getFileName(file.file_path) || "file.txt";

    // Show download starting toast
    const downloadToast = toast.loading(t("filesView.toast.downloading", { fileName }));

    try {
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success toast with action to open folder
      toast.success(t("filesView.toast.downloaded", { fileName }), {
        description: t("filesView.toast.savedToDownloads"),
        action: {
          label: t("filesView.toast.openFolder"),
          onClick: async () => {
            try {
              const platformName = await platform();

              // Open downloads folder based on platform
              // Note: Shell commands are restricted by tauri.conf.json allowlist
              if (platformName === "windows") {
                await Command.create("explorer", ["shell:Downloads"]).execute();
              } else if (platformName === "macos") {
                // On macOS, use the user's actual Downloads folder
                const homeDir = await import("@tauri-apps/plugin-os").then((m) => m.homeDir());
                const downloadsPath = `${homeDir}/Downloads`;
                await Command.create("open", [downloadsPath]).execute();
              } else {
                // Linux - use xdg-user-dir if available, fallback to $HOME/Downloads
                const homeDir = await import("@tauri-apps/plugin-os").then((m) => m.homeDir());
                const downloadsPath = `${homeDir}/Downloads`;
                await Command.create("xdg-open", [downloadsPath]).execute();
              }
            } catch (error) {
              console.error("Failed to open downloads folder:", error);
              toast.error(t("filesView.toast.failedToOpenFolder"));
            }
          }
        },
        duration: 5000,
      });

      toast.dismiss(downloadToast);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error(t("filesView.toast.downloadFailed"), {
        description: error instanceof Error ? error.message : t("filesView.toast.unknownError")
      });
      toast.dismiss(downloadToast);
    }
  };

  const handleJumpToMessage = async () => {
    console.log("Jump to message clicked:", { file });

    try {
      if (!file.project_id) {
        console.error("No project_id in file");
        toast.error(t("filesView.errors.sessionNotFound"));
        return;
      }

      // Find the project that matches this file
      // file.project_id is the project name, not the full path
      const project = projects.find((p) => p.name === file.project_id || p.path.includes(file.project_id));
      if (!project) {
        console.error("Project not found:", file.project_id);
        console.log("Available projects:", projects.map(p => ({ name: p.name, path: p.path })));
        toast.error(t("filesView.errors.sessionNotFound"));
        return;
      }

      console.log("Switching to project:", project.name);
      // Switch to the project first
      await selectProject(project);

      // Load all sessions from the project to find the one containing this message
      console.log("Loading sessions from project:", project.path);
      const projectSessions = await loadProjectSessions(project.path, false);
      console.log("Loaded sessions:", projectSessions.length);

      // Find the session with matching actual_session_id
      // Note: actual_session_id is the full file path, so we need to check if it includes the session_id
      console.log("Searching for session_id:", file.session_id);
      console.log("All session actual_session_ids:", projectSessions.map(s => s.actual_session_id));

      const targetSession = projectSessions.find(s =>
        s.actual_session_id === file.session_id ||
        s.actual_session_id.includes(file.session_id) ||
        s.file_path?.includes(file.session_id)
      );

      if (!targetSession) {
        console.error("Session not found:", file.session_id);
        console.log("Available sessions (full details):", projectSessions.map(s => ({
          session_id: s.session_id,
          actual_session_id: s.actual_session_id,
          file_path: s.file_path,
          summary: s.summary?.substring(0, 50)
        })));
        toast.error(t("filesView.errors.sessionNotFound"));
        return;
      }

      console.log("Found session:", targetSession);

      // Close the modal first
      onClose();

      // Switch to Messages view
      console.log("Switching to Messages view");
      await analyticsActions.switchToMessages();

      // Load session with large page size to ensure message is loaded
      console.log("Loading session with full messages:", targetSession.session_id);
      await selectSession(targetSession, 10000);

      // Wait for message to render using polling with max attempts
      const messageId = `message-${file.message_id}`;
      console.log("Attempting to find element:", messageId);

      let attempts = 0;
      const maxAttempts = 20; // 2 seconds total (20 * 100ms)
      const pollInterval = setInterval(() => {
        const element = document.getElementById(messageId);

        if (element) {
          clearInterval(pollInterval);
          console.log("Element found, scrolling to it");
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          // Add highlight animation
          element.classList.add("highlight-message");
          setTimeout(() => element.classList.remove("highlight-message"), 2000);
        } else if (++attempts >= maxAttempts) {
          clearInterval(pollInterval);
          console.error("Message element not found after polling:", messageId);
          toast.error(t("filesView.errors.messageNotFound"));
        }
      }, 100);
    } catch (error) {
      console.error("Error jumping to message:", error);
      toast.error(t("filesView.errors.jumpError"));
    }
  };

  const operationColor = getOperationColor(file.operation);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[60vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex-1 min-w-0">
            <DialogTitle className={cn("text-lg font-semibold truncate", COLORS.ui.text.primary)}>
              {getFileName(file.file_path)}
            </DialogTitle>
            <p className={cn("text-sm mt-1 truncate", COLORS.ui.text.muted)}>
              {file.file_path}
            </p>
          </div>
        </DialogHeader>

        {/* File Info */}
        <div className={cn("grid grid-cols-4 gap-4 p-4 rounded-lg", COLORS.ui.background.secondary)}>
          <div>
            <div className={cn("text-xs font-medium mb-1", COLORS.ui.text.tertiary)}>
              {t("filesView.viewer.operation")}
            </div>
            <div className={cn("text-sm font-medium", operationColor.text)}>
              {file.operation}
            </div>
          </div>
          <div>
            <div className={cn("text-xs font-medium mb-1", COLORS.ui.text.tertiary)}>
              {t("filesView.viewer.timestamp")}
            </div>
            <div className={cn("text-sm", COLORS.ui.text.secondary)}>
              {formatRelativeTime(file.timestamp)}
            </div>
          </div>
          <div>
            <div className={cn("text-xs font-medium mb-1", COLORS.ui.text.tertiary)}>
              {t("filesView.viewer.changes")}
            </div>
            <div className="flex items-center space-x-2">
              {file.lines_added !== undefined && file.lines_added > 0 && (
                <span className={cn("text-sm", COLORS.semantic.success.text)}>
                  +{file.lines_added}
                </span>
              )}
              {file.lines_removed !== undefined && file.lines_removed > 0 && (
                <span className={cn("text-sm", COLORS.semantic.error.text)}>
                  -{file.lines_removed}
                </span>
              )}
              {!file.lines_added && !file.lines_removed && (
                <span className={cn("text-sm", COLORS.ui.text.muted)}>-</span>
              )}
            </div>
          </div>
          <div className="flex items-end justify-end space-x-2">
            <button
              onClick={handleJumpToMessage}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1",
                COLORS.semantic.info.bg,
                COLORS.semantic.info.text,
                "hover:opacity-90"
              )}
            >
              <ArrowRight className="w-3 h-3" />
              <span>{t("filesView.viewer.jumpToMessage")}</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={!file.content_after && !file.content_before}
              title={
                !file.content_after && !file.content_before
                  ? "No content available to download"
                  : `Download ${getFileName(file.file_path)}`
              }
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1",
                !file.content_after && !file.content_before
                  ? "opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  : cn(COLORS.tools.code.bg, COLORS.tools.code.text, "hover:opacity-90")
              )}
            >
              <Download className="w-3 h-3" />
              <span>{t("filesView.viewer.download")}</span>
            </button>
          </div>
        </div>

        {/* File Content */}
        <div className="flex-1 overflow-auto">
          {file.operation.toLowerCase() === "edit" || file.operation.toLowerCase() === "multiedit" ? (
            // Show diff for edits
            file.content_before && file.content_after ? (
              <EnhancedDiffViewer
                oldText={file.content_before}
                newText={file.content_after}
                filePath={file.file_path}
                showAdvancedDiff={true}
              />
            ) : file.changes && file.changes.length > 0 ? (
              // Show changes if we don't have full content
              <div className="space-y-4">
                {file.changes.map((change, idx) => (
                  <EnhancedDiffViewer
                    key={idx}
                    oldText={change.old_string}
                    newText={change.new_string}
                    filePath={file.file_path}
                    showAdvancedDiff={false}
                  />
                ))}
              </div>
            ) : (
              <div className={cn("p-8 text-center", COLORS.ui.text.muted)}>
                {t("filesView.viewer.noContentAvailable")}
              </div>
            )
          ) : (
            // Show file content for non-edit operations
            file.content_after || file.content_before ? (
              <FileContent
                fileData={{
                  content: file.content_after || file.content_before,
                  filePath: file.file_path,
                  numLines: (file.content_after || file.content_before || "").split("\n").length,
                  startLine: 1,
                  totalLines: (file.content_after || file.content_before || "").split("\n").length,
                }}
                title={t("filesView.viewer.fileContent")}
              />
            ) : (
              <div className={cn("p-8 text-center", COLORS.ui.text.muted)}>
                {t("filesView.viewer.noContentAvailable")}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
