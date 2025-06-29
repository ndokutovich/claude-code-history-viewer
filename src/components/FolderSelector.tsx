import { useState } from "react";
import { Folder, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";

interface FolderSelectorProps {
  onFolderSelected: (path: string) => void;
}

export function FolderSelector({ onFolderSelected }: FolderSelectorProps) {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  const handleSelectFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: ".claude 폴더 선택",
      });

      if (selected && typeof selected === "string") {
        setSelectedPath(selected);
        setValidationError("");
        await validateAndSelectFolder(selected);
      }
    } catch (err) {
      console.error("폴더 선택 실패:", err);
      setValidationError("폴더를 선택하는 중 오류가 발생했습니다.");
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
        setValidationError(
          "선택한 폴더에서 Claude 데이터를 찾을 수 없습니다. .claude 폴더를 선택해주세요."
        );
      }
    } catch {
      setValidationError("폴더 검증 중 오류가 발생했습니다.");
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
          "max-w-md w-full mx-auto p-8 rounded-lg shadow-lg",
          COLORS.ui.background.secondary,
          COLORS.ui.border.medium
        )}
      >
        <div className="text-center">
          <div className="mb-6">
            <Folder
              className={cn("w-16 h-16 mx-auto", COLORS.ui.text.primary)}
            />
          </div>

          <h1 className={cn("text-2xl font-bold mb-2", COLORS.ui.text.primary)}>
            Claude 폴더를 찾을 수 없습니다
          </h1>

          <p className={cn("mb-8", COLORS.ui.text.secondary)}>
            홈 디렉토리에서 .claude 폴더를 찾을 수 없습니다. .claude 폴더 또는
            이를 포함하는 상위 폴더를 선택해주세요.
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
            {isValidating ? "확인 중..." : "폴더 선택"}
          </button>

          {selectedPath && (
            <div
              className={cn(
                "mt-4 p-3 rounded-lg text-sm",
                COLORS.ui.background.secondary,
                COLORS.ui.text.secondary
              )}
            >
              <p className="truncate">선택한 경로: {selectedPath}</p>
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
              도움말
            </h3>
            <ul
              className={cn(
                "text-sm space-y-1 text-left",
                COLORS.ui.text.secondary
              )}
            >
              <li>
                • Claude Desktop 앱을 한 번이라도 실행해야 폴더가 생성됩니다
              </li>
              <li>• Windows: C:\Users\[사용자명]\.claude</li>
              <li>• macOS/Linux: ~/.claude 또는 /Users/[사용자명]/.claude</li>
              <li>• macOS: /Users/[사용자명]/.claude</li>
              <li>• Windows: C:\Users\[사용자명]\.claude</li>
              <li>• Linux: /home/[사용자명]/.claude</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
