import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Trash2, Loader2 } from 'lucide-react';
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
    alert('Update cache has been cleared.');
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
          <DialogTitle>Update Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 dark:text-gray-300">
          {/* Auto check settings */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">Auto Update Check</label>
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
              <label className="text-sm font-medium dark:text-gray-200">Check Interval</label>
              <select
                value={settings.checkInterval}
                onChange={(e) => updateSetting('checkInterval', e.target.value as 'startup' | 'daily' | 'weekly' | 'never')}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="startup">Every app startup</option>
                <option value="daily">Once a day</option>
                <option value="weekly">Once a week</option>
              </select>
            </div>
          )}

          {/* Offline settings */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">Disable check when offline</label>
            <input
              type="checkbox"
              checked={settings.respectOfflineStatus}
              onChange={(e) => updateSetting('respectOfflineStatus', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* Critical update settings */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">Critical update notifications</label>
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
                <label className="text-sm font-medium dark:text-gray-200">Skipped versions</label>
                <button
                  onClick={() => updateSetting('skippedVersions', [])}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Clear all
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
                  Checking for updates...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Check for updates now
                </>
              )}
            </button>
            <button
              onClick={handleClearCache}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Trash2 className="w-4 h-4" />
              Clear cache
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Close
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              Save
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}