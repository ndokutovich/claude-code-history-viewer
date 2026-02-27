import { useState, useEffect } from 'react';
import { SimpleUpdateSettings } from "@/components/SimpleUpdateSettings";
import { useSmartUpdater } from "@/hooks/useSmartUpdater";

export const UpdateSettingsContainer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const smartUpdater = useSmartUpdater();

  useEffect(() => {
    const handleOpenSettings = () => {
      setIsOpen(true);
    };

    window.addEventListener("open-update-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("open-update-settings", handleOpenSettings);
    };
  }, []);

  const handleManualCheck = () => {
    window.dispatchEvent(new Event("manual-update-check"));
    smartUpdater.smartCheckForUpdates(true); // Force check
  };

  return (
    <SimpleUpdateSettings
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onManualCheck={handleManualCheck}
      isCheckingForUpdates={smartUpdater.state.isChecking}
    />
  );
};