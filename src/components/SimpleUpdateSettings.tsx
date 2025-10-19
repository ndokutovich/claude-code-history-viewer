import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getUpdateSettings, setUpdateSettings } from '@/utils/updateSettings';
import { clearUpdateCache } from '@/utils/updateCache';
import type { UpdateSettings } from '@/types/updateSettings';

interface SimpleUpdateSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onManualCheck?: () => void;
  isCheckingForUpdates?: boolean;
}

export function SimpleUpdateSettings({ isOpen, onClose, onManualCheck, isCheckingForUpdates = false }: SimpleUpdateSettingsProps) {
  const { t } = useTranslation(['components', 'common']);
  const [settings, setLocalSettings] = useState<UpdateSettings>(getUpdateSettings());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentSettings = getUpdateSettings();
      setLocalSettings(currentSettings);
      setHasChanges(false);
    }
  }, [isOpen]);

  const updateSetting = <K extends keyof UpdateSettings>(
    key: K,
    value: UpdateSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = () => {
    setUpdateSettings(settings);
    setHasChanges(false);
    onClose();
  };

  const handleClearCache = () => {
    clearUpdateCache();
    alert(t('components:settings.cacheCleared'));
  };

  const handleManualCheckClick = () => {
    if (onManualCheck) {
      onManualCheck();
      // Don't close modal while checking for updates
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('components:settings.updateSettings')}</DialogTitle>
          <DialogDescription>{t("update.settings.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 dark:text-gray-300">
          {/* Auto check settings */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">{t('components:settings.autoUpdateCheck')}</label>
            <input
              type="checkbox"
              checked={settings.autoCheck}
              onChange={(e) => updateSetting('autoCheck', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Check interval settings */}
          {settings.autoCheck && (
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-200">{t('components:settings.checkInterval')}</label>
              <select
                value={settings.checkInterval}
                onChange={(e) => updateSetting('checkInterval', e.target.value as 'startup' | 'daily' | 'weekly' | 'never')}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="startup">{t('components:settings.everyAppStartup')}</option>
                <option value="daily">{t('components:settings.onceADay')}</option>
                <option value="weekly">{t('components:settings.onceAWeek')}</option>
              </select>
            </div>
          )}

          {/* Offline settings */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">{t('components:settings.disableWhenOffline')}</label>
            <input
              type="checkbox"
              checked={settings.respectOfflineStatus}
              onChange={(e) => updateSetting('respectOfflineStatus', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Critical update settings */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">{t('components:settings.criticalUpdateNotifications')}</label>
            <input
              type="checkbox"
              checked={settings.allowCriticalUpdates}
              onChange={(e) => updateSetting('allowCriticalUpdates', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Skipped versions management */}
          {settings.skippedVersions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium dark:text-gray-200">{t('components:settings.skippedVersions')}</label>
                <button
                  onClick={() => updateSetting('skippedVersions', [])}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  {t('components:settings.clearAll')}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {settings.skippedVersions.map((version) => (
                  <span key={version} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded">
                    v{version}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Manual actions */}
          <div className="border-t dark:border-gray-600 pt-4 space-y-2">
            <button
              onClick={handleManualCheckClick}
              disabled={isCheckingForUpdates}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingForUpdates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('components:settings.checkingForUpdates')}
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t('components:settings.checkForUpdatesNow')}
                </>
              )}
            </button>
            <button
              onClick={handleClearCache}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Trash2 className="w-4 h-4" />
              {t('components:settings.clearCache')}
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('common:close')}
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              {t('common:save')}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}