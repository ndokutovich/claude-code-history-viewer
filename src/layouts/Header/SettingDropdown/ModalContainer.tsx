import {
  FeedbackModalContainer,
  UpdateSettingsContainer,
  SessionPickerModal,
} from "@/components/modals";

export const ModalContainer = () => {
  return (
    <>
      <FeedbackModalContainer />
      <UpdateSettingsContainer />
      <SessionPickerModal />
    </>
  );
};
