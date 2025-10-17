import { useState, useEffect } from "react";
import { useSmartUpdater } from "../hooks/useSmartUpdater";
import { SimpleUpdateModal } from "./SimpleUpdateModal";
import { UpdateIntroModal } from "./UpdateConsentModal";
import { UpToDateNotification } from "./UpToDateNotification";

export function SimpleUpdateManager() {
  const updater = useSmartUpdater();
  const [showUpdateModal, setShowUpdateModal] = useState(true);
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);

  // Handle manual check results
  useEffect(() => {
    if (
      !updater.state.isChecking &&
      !updater.state.hasUpdate &&
      !updater.state.error &&
      manualCheck
    ) {
      setShowUpToDate(true);
      setTimeout(() => setShowUpToDate(false), 3000);
      setManualCheck(false);
    }
  }, [
    updater.state.isChecking,
    updater.state.hasUpdate,
    updater.state.error,
    manualCheck,
  ]);

  // Manual update check event listener
  useEffect(() => {
    const handleManualCheck = () => {
      setManualCheck(true);
      updater.smartCheckForUpdates(true); // Force check
    };

    window.addEventListener("manual-update-check", handleManualCheck);
    return () => {
      window.removeEventListener("manual-update-check", handleManualCheck);
    };
  }, [updater]);

  const handleCloseUpdateModal = () => {
    setShowUpdateModal(false);
  };

  return (
    <>
      {/* Update system introduction modal (first run) */}
      <UpdateIntroModal
        isOpen={updater.showIntroModal}
        onClose={updater.onIntroClose}
      />

      {/* Improved update modal */}
      <SimpleUpdateModal
        updater={updater}
        isVisible={showUpdateModal && updater.shouldShowUpdateModal}
        onClose={handleCloseUpdateModal}
      />

      {/* Latest version notification (manual check) */}
      <UpToDateNotification
        currentVersion={updater.state.currentVersion}
        onClose={() => setShowUpToDate(false)}
        isVisible={showUpToDate}
      />
    </>
  );
}