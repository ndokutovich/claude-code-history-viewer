import { createContext, useContext } from "react";

export type ModalType = "feedback" | "folderSelector";
export type FolderSelectorMode = "notFound" | "change";

interface ModalContextValue {
  // State
  isOpen: (modal: ModalType) => boolean;
  folderSelectorMode: FolderSelectorMode;

  // Actions
  openModal: (
    modal: ModalType,
    options?: { mode?: FolderSelectorMode }
  ) => void;
  closeModal: (modal: ModalType) => void;
  closeAllModals: () => void;
}

export const ModalContext = createContext<ModalContextValue | null>(null);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
};
