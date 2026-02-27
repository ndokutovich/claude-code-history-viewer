/**
 * SimpleUpdateSettings
 *
 * Stub component that wraps update settings UI.
 * Provides a simple dialog for update-related configuration.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@/components/ui";
import { useTranslation } from "react-i18next";

interface SimpleUpdateSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onManualCheck: () => void;
  isCheckingForUpdates: boolean;
}

export const SimpleUpdateSettings: React.FC<SimpleUpdateSettingsProps> = ({
  isOpen,
  onClose,
  onManualCheck,
  isCheckingForUpdates,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("updateSettingsModal.title", "Update Settings")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "updateSettingsModal.description",
              "Configure how updates are checked and applied."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Button
            onClick={onManualCheck}
            disabled={isCheckingForUpdates}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {isCheckingForUpdates
              ? t("updateSettingsModal.checking", "Checking for updates...")
              : t("updateSettingsModal.checkNow", "Check for updates now")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
