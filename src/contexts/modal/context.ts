import { createContext, useContext } from "react";

export type ModalType = "feedback";

interface ModalContextValue {
  // State
  isOpen: (modal: ModalType) => boolean;

  // Actions
  openModal: (modal: ModalType) => void;
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
