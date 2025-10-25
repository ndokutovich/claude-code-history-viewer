"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { FileActivityTable } from "./FileActivityTable";
import { FileActivityFilters as Filters } from "./FileActivityFilters";
import { FileViewerModal } from "./FileViewerModal";
import { Loader2, Files, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FileActivity } from "../types";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";

export const FilesView = () => {
  const { t } = useTranslation("components");
  const {
    selectedProject,
    selectedSession,
    fileActivities,
    isLoadingFileActivities,
    error,
    loadFileActivities,
    fileActivityFilters,
  } = useAppStore();

  const [selectedFile, setSelectedFile] = useState<FileActivity | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Load file activities when project, session, or filters change
  useEffect(() => {
    // Behavior:
    // - No project selected: Load ALL files across all projects
    // - Project selected, no session: Load all files from that project (all sessions)
    // - Project + session selected: Load files from that specific session only

    // IMPORTANT: When a session is selected, use the session's project path
    // (extracted from session.file_path) rather than selectedProject.path
    // This prevents race conditions when switching projects
    let projectPath = selectedProject?.path || "*";

    // Extract session UUID filter ONLY if a session is selected
    // Format: "C:\...\48523bee-c9c7-421e-b8da-e35d7321b8f9.jsonl" -> "48523bee-c9c7-421e-b8da-e35d7321b8f9"
    let sessionIdFilter: string | undefined;
    if (selectedSession?.actual_session_id) {
      const pathParts = selectedSession.actual_session_id.split(/[/\\]/);
      const fileName = pathParts[pathParts.length - 1];
      if (fileName) {
        sessionIdFilter = fileName.replace('.jsonl', '');
      }

      // Extract project path from session file path
      // Format: "C:\Users\xxx\.claude\projects\PROJECT_NAME\session.jsonl"
      // We want: "C:\Users\xxx\.claude\projects\PROJECT_NAME"
      const sessionPathParts = selectedSession.actual_session_id.split(/[/\\]/);
      // Remove filename to get project directory
      sessionPathParts.pop();
      // Detect original path separator (backslash on Windows, forward slash on Unix)
      const separator = selectedSession.actual_session_id.includes('\\') ? '\\' : '/';
      const sessionProjectPath = sessionPathParts.join(separator);

      // Use session's project path (overrides selectedProject.path to prevent race conditions)
      projectPath = sessionProjectPath;
    }

    // Build filters - only include sessionId if we have one
    // If no sessionId filter, backend will return files from ALL sessions in the project
    const filters = {
      ...fileActivityFilters,
      ...(sessionIdFilter ? { sessionId: sessionIdFilter } : {}),
    };

    console.log("📂 FilesView useEffect triggered:", {
      projectPath,
      selectedProjectPath: selectedProject?.path,
      projectName: selectedProject?.name,
      hasSession: !!selectedSession,
      sessionId: selectedSession?.actual_session_id,
      sessionIdFilter,
      usingSessionProjectPath: !!selectedSession && projectPath !== selectedProject?.path,
      filters
    });

    loadFileActivities(projectPath, filters);
  }, [selectedProject?.path, selectedSession?.actual_session_id, fileActivityFilters, loadFileActivities]);

  const handleViewFile = (file: FileActivity) => {
    setSelectedFile(file);
    setIsViewerOpen(true);
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setSelectedFile(null);
  };

  const projectDisplayName = selectedProject?.name || "All Projects";

  // Loading state
  if (isLoadingFileActivities) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className={cn("w-12 h-12 animate-spin mx-auto mb-4", COLORS.ui.text.muted)} />
          <p className={cn("text-sm", COLORS.ui.text.secondary)}>
            {t("filesView.loadingFiles")}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && error.type === "LOAD_FILE_ACTIVITIES") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className={cn("w-12 h-12 mx-auto mb-4", COLORS.semantic.error.icon)} />
          <h3 className={cn("text-lg font-semibold mb-2", COLORS.semantic.error.text)}>
            {t("filesView.errorLoadingFiles")}
          </h3>
          <p className={cn("text-sm", COLORS.ui.text.secondary)}>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={cn("px-4 py-3 border-b", COLORS.ui.border.light)}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={cn("text-lg font-semibold", COLORS.ui.text.primary)}>
              {t("filesView.title")}
            </h2>
            <p className={cn("text-sm", COLORS.ui.text.secondary)}>
              {t("filesView.subtitle", {
                count: fileActivities.length,
                project: projectDisplayName
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Filters />

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        {fileActivities.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Files className={cn("w-16 h-16 mx-auto mb-4", COLORS.ui.text.muted)} />
              <h3 className={cn("text-lg font-semibold mb-2", COLORS.ui.text.primary)}>
                {t("filesView.noFilesFound")}
              </h3>
              <p className={cn("text-sm", COLORS.ui.text.secondary)}>
                {t("filesView.noFilesDescription")}
              </p>
            </div>
          </div>
        ) : (
          <FileActivityTable
            activities={fileActivities}
            onViewFile={handleViewFile}
          />
        )}
      </div>

      {/* File Viewer Modal */}
      {selectedFile && (
        <FileViewerModal
          file={selectedFile}
          isOpen={isViewerOpen}
          onClose={handleCloseViewer}
        />
      )}
    </div>
  );
};
