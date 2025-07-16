import { FolderSelector } from "./FolderSelector";
import { useAppStore } from "@/store/useAppStore";
import { useModal } from "@/contexts/modal";
import { AppErrorType } from "@/types";
import { useEffect } from "react";

export const FolderSelectorContainer: React.FC = () => {
  const { isOpen, closeModal, folderSelectorMode, openModal } = useModal();
  const { setClaudePath, scanProjects, error } = useAppStore();

  // 에러 발생 시 자동으로 폴더 선택 모달 열기
  useEffect(() => {
    if (error?.type === AppErrorType.CLAUDE_FOLDER_NOT_FOUND) {
      openModal("folderSelector", { mode: "notFound" });
    }
  }, [error, openModal]);

  const handleFolderSelected = async (path: string) => {
    // .claude 폴더 경로 처리
    let claudeFolderPath = path;
    if (!path.endsWith(".claude")) {
      claudeFolderPath = `${path}/.claude`;
    }

    // 경로 설정 및 프로젝트 스캔
    setClaudePath(claudeFolderPath);
    try {
      await scanProjects();
    } catch (error) {
      console.error("Failed to scan projects:", error);
      // 에러 처리 로직 추가 (예: 사용자에게 알림)
    }
  };

  if (!isOpen("folderSelector")) return null;

  return (
    <div className="fixed inset-0 z-50">
      <FolderSelector
        mode={folderSelectorMode}
        onClose={() => closeModal("folderSelector")}
        onFolderSelected={handleFolderSelected}
      />
    </div>
  );
};
