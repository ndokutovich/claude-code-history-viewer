import { useState } from "react";
import { Folder, AlertCircle } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

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
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="mb-6">
            <Folder className="w-16 h-16 mx-auto text-blue-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Claude 폴더를 찾을 수 없습니다
          </h1>
          
          <p className="text-gray-600 mb-8">
            홈 디렉토리에서 .claude 폴더를 찾을 수 없습니다. 
            직접 폴더를 선택해주세요.
          </p>

          <button
            onClick={handleSelectFolder}
            disabled={isValidating}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isValidating ? "확인 중..." : ".claude 폴더 선택"}
          </button>

          {selectedPath && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-700">
              <p className="truncate">선택한 경로: {selectedPath}</p>
            </div>
          )}

          {validationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{validationError}</p>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">도움말</h3>
            <ul className="text-sm text-blue-800 space-y-1 text-left">
              <li>• .claude 폴더는 일반적으로 홈 디렉토리에 있습니다</li>
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