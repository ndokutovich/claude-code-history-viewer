import { useState } from "react";
import { Folder, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
  mode?: "notFound" | "change";
  onClose?: () => void;
}

export function FolderSelector({
  onFolderSelected,
  mode = "notFound",
  onClose,
}: FolderSelectorProps) {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  const { t: tComponents } = useTranslation("components");
  const isChangeMode = mode === "change";

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: tComponents("folderPicker.selectFolderTitle"),
      });

      if (selected && typeof selected === "string") {
        setSelectedPath(selected);
        setValidationError("");
        await validateAndSelectFolder(selected);
      }
    } catch (err) {
      console.error(tComponents("folderPicker.folderSelectError"), err);
      setValidationError(tComponents("folderPicker.folderSelectErrorDetails"));
    }
  };

  const validateAndSelectFolder = async (path: string) => {
    setIsValidating(true);
    setValidationError("");

    try {
      // 선택한 폴더가 .claude 폴더인지 또는 .claude 폴더를 포함하는지 확인
      const isValid = await invoke<boolean>("validate_claude_folder", { path });

      if (isValid) {
        onFolderSelected(path);
      } else {
        setValidationError(tComponents("folderPicker.invalidFolder"));
      }
    } catch {
      setValidationError(tComponents("folderPicker.validationError"));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div
      className={cn(
        "h-screen flex items-center justify-center",
        COLORS.ui.background.primary
      )}
    >
      <div
        className={cn(
          "max-w-md w-full mx-auto p-8 rounded-lg shadow-lg relative",
          COLORS.ui.background.secondary,
          COLORS.ui.border.medium
        )}
      >
        {isChangeMode && onClose && (
          <button
            onClick={onClose}
            className={cn(
              "absolute left-4 top-4 flex items-center text-sm font-medium px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
              COLORS.ui.text.secondary
            )}
            type="button"
          >
            {tComponents("folderPicker.backButton")}
          </button>
        )}
        <div className="text-center">
          <div className="mb-6">
            <Folder
              className={cn("w-16 h-16 mx-auto", COLORS.ui.text.primary)}
            />
          </div>

          <h1 className={cn("text-2xl font-bold mb-2", COLORS.ui.text.primary)}>
            {isChangeMode
              ? tComponents("folderPicker.change")
              : tComponents("folderPicker.notFound")}
          </h1>

          <p className={cn("mb-8", COLORS.ui.text.secondary)}>
            {isChangeMode
              ? tComponents("folderPicker.newFolder")
              : tComponents("folderPicker.homeNotFound")}
          </p>

          <button
            onClick={handleSelectFolder}
            disabled={isValidating}
            className={cn(
              "w-full px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium",
              COLORS.ui.background.primary,
              COLORS.ui.text.primary
            )}
          >
            {isValidating
              ? tComponents("folderPicker.validating")
              : tComponents("folderPicker.selectButton")}
          </button>

          {selectedPath && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg text-sm",
                COLORS.ui.background.secondary,
                COLORS.ui.text.secondary
              )}
            >
              <p className="truncate">
                {tComponents("folderPicker.selectedPath")} {selectedPath}
              </p>
            </div>
          )}

          {validationError && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg",
                COLORS.ui.background.error,
                COLORS.ui.border.error
              )}
            >
              <div className="flex items-start space-x-2">
                <AlertCircle
                  className={cn(
                    "w-5 h-5 flex-shrink-0 mt-0.5",
                    COLORS.ui.text.error
                  )}
                />
                <p className={cn("text-sm", COLORS.ui.text.error)}>
                  {validationError}
                </p>
              </div>
            </div>
          )}

          <div
            className={cn(
              "mt-8 p-4 rounded-lg",
              COLORS.ui.background.primary,
              COLORS.ui.border.medium
            )}
          >
            <h3 className={cn("font-semibold mb-2", COLORS.ui.text.primary)}>
              {tComponents("folderPicker.help")}
            </h3>
            <div
              className={cn(
                "text-sm text-left whitespace-pre-line",
                COLORS.ui.text.secondary
              )}
            >
              {tComponents("folderPicker.helpDetails")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
