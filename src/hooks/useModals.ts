import { useState } from "react";

export type ModalType = "feedback";

export interface ModalState {
  feedback: boolean;
}

interface UseModalsReturn {
  modals: ModalState;
  openModal: (name: ModalType) => void;
  closeModal: (name: ModalType) => void;
  isOpen: (name: ModalType) => boolean;
}

export const useModals = (): UseModalsReturn => {
  const [modals, setModals] = useState<ModalState>({
    feedback: false,
  });

  const openModal = (name: ModalType): void => {
    setModals((prev) => ({ ...prev, [name]: true }));
  };

  const closeModal = (name: ModalType): void => {
    setModals((prev) => ({ ...prev, [name]: false }));
  };

  const isOpen = (name: ModalType): boolean => {
    return modals[name];
  };

  return { modals, openModal, closeModal, isOpen };
};
