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

  // 수동 체크 결과 처리
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

  // 수동 업데이트 체크 이벤트 리스너
  useEffect(() => {
    const handleManualCheck = () => {
      setManualCheck(true);
      updater.smartCheckForUpdates(true); // 강제 체크
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
      {/* 업데이트 시스템 안내 모달 (첫 실행 시) */}
      <UpdateIntroModal
        isOpen={updater.showIntroModal}
        onClose={updater.onIntroClose}
      />

      {/* 개선된 업데이트 모달 */}
      <SimpleUpdateModal
        updater={updater}
        isVisible={showUpdateModal && updater.shouldShowUpdateModal}
        onClose={handleCloseUpdateModal}
      />

      {/* 최신 버전 알림 (수동 체크 시) */}
      <UpToDateNotification
        currentVersion={updater.state.currentVersion}
        onClose={() => setShowUpToDate(false)}
        isVisible={showUpToDate}
      />
    </>
  );
}