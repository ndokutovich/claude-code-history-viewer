import { useState, useCallback, useRef, type ReactNode, useMemo } from "react";
import {
  ModalContext,
  type ModalType,
} from "./context";

interface ModalState {
  feedback: boolean;
}

export const ModalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const focusOriginsRef = useRef<Partial<Record<ModalType, HTMLElement[]>>>({});
  const openOrderRef = useRef<ModalType[]>([]);
  const closeAllGenerationRef = useRef(0);

  const restoreFocus = useCallback((modal: ModalType) => {
    const candidates = focusOriginsRef.current[modal];
    if (candidates == null || candidates.length === 0) return false;

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const target = candidates[index];
      if (target == null || !target.isConnected) {
        continue;
      }

      target.focus();
      return true;
    }

    return false;
  }, []);

  const [modalState, setModalState] = useState<ModalState>({
    feedback: false,
  });

  const isOpen = useCallback(
    (modal: ModalType): boolean => {
      return modalState[modal];
    },
    [modalState]
  );

  const openModal = useCallback(
    (modal: ModalType) => {
      closeAllGenerationRef.current += 1;
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        const current = focusOriginsRef.current[modal] ?? [];
        focusOriginsRef.current[modal] = [...current, activeElement];
      }

      openOrderRef.current = [...openOrderRef.current.filter((item) => item !== modal), modal];

      setModalState((prev) => ({
        ...prev,
        [modal]: true,
      }));
    },
    []
  );

  const closeModal = useCallback((modal: ModalType) => {
    closeAllGenerationRef.current += 1;
    openOrderRef.current = openOrderRef.current.filter((item) => item !== modal);
    setModalState((prev) => ({
      ...prev,
      [modal]: false,
    }));
    restoreFocus(modal);
    focusOriginsRef.current[modal] = [];
  }, [restoreFocus]);

  const closeAllModals = useCallback(() => {
    const generation = ++closeAllGenerationRef.current;
    const openedModals = [...openOrderRef.current];
    openOrderRef.current = [];
    setModalState((prev) => ({
      ...prev,
      feedback: false,
    }));
    requestAnimationFrame(() => {
      if (generation !== closeAllGenerationRef.current) {
        return;
      }
      for (const modal of [...openedModals].reverse()) {
        if (restoreFocus(modal)) {
          break;
        }
      }
      for (const modal of openedModals) {
        focusOriginsRef.current[modal] = [];
      }
    });
  }, [restoreFocus]);

  const value = useMemo(
    () => ({
      isOpen,
      openModal,
      closeModal,
      closeAllModals,
    }),
    [
      closeAllModals,
      closeModal,
      isOpen,
      openModal,
    ]
  );

  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
};
