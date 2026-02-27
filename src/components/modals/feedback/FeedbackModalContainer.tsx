import { FeedbackModal } from "./FeedbackModal";
import { useModal } from "@/contexts/modal";

export const FeedbackModalContainer: React.FC = () => {
  const { isOpen, closeModal } = useModal();

  if (!isOpen("feedback")) return null;

  return <FeedbackModal isOpen={true} onClose={() => closeModal("feedback")} />;
};
