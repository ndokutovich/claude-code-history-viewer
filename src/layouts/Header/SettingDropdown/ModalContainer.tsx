import {
  FeedbackModalContainer,
  FolderSelectorContainer,
  UpdateSettingsContainer,
} from "@/components/modals";

export const ModalContainer = () => {
  return (
    <>
      <FolderSelectorContainer />
      <FeedbackModalContainer />
      <UpdateSettingsContainer />
    </>
  );
};
