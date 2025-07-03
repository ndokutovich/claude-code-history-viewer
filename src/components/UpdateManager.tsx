import { useState, useEffect } from "react";
import { useGitHubUpdater } from "../hooks/useGitHubUpdater";
import { GitHubUpdateModal } from "./GitHubUpdateModal";
import { UpToDateNotification } from "./UpToDateNotification";

export function UpdateManager() {
  const updater = useGitHubUpdater();
  const [showModal, setShowModal] = useState(true);
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [manualCheck, setManualCheck] = useState(false);

  // 업데이트 확인이 완료되면 결과에 따라 UI 표시
  useEffect(() => {
    // 수동 체크가 아닌 경우 최신 버전 알림을 표시하지 않음
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

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleCloseUpToDate = () => {
    setShowUpToDate(false);
  };

  // 수동 업데이트 체크 함수를 외부에서 호출할 수 있도록 노출
  useEffect(() => {
    const handleManualCheck = () => {
      setManualCheck(true);
    };

    // updater의 checkForUpdates가 호출될 때마다 manualCheck 플래그 설정
    window.addEventListener("manual-update-check", handleManualCheck);
    return () => {
      window.removeEventListener("manual-update-check", handleManualCheck);
    };
  }, []);

  return (
    <>
      {/* GitHub 업데이트 모달 */}
      <GitHubUpdateModal
        updater={updater}
        isVisible={showModal && updater.state.hasUpdate}
        onClose={handleCloseModal}
      />

      {/* 최신 버전 알림 - 수동 체크 시에만 표시 */}
      <UpToDateNotification
        currentVersion={updater.state.currentVersion}
        onClose={handleCloseUpToDate}
        isVisible={showUpToDate}
      />
    </>
  );
}
