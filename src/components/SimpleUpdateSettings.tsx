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
    alert('업데이트 캐시가 삭제되었습니다.');
  };

  const handleManualCheckClick = () => {
    if (onManualCheck) {
      onManualCheck();
      // 업데이트 확인 중일 때는 모달을 닫지 않음
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>업데이트 설정</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 dark:text-gray-300">
          {/* 자동 체크 설정 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">자동 업데이트 확인</label>
            <input
              type="checkbox"
              checked={settings.autoCheck}
              onChange={(e) => updateSetting('autoCheck', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* 체크 주기 설정 */}
          {settings.autoCheck && (
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-200">체크 주기</label>
              <select
                value={settings.checkInterval}
                onChange={(e) => updateSetting('checkInterval', e.target.value as 'startup' | 'daily' | 'weekly' | 'never')}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              >
                <option value="startup">앱 시작할 때마다</option>
                <option value="daily">하루에 한 번</option>
                <option value="weekly">일주일에 한 번</option>
              </select>
            </div>
          )}

          {/* 오프라인 설정 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">오프라인 시 체크 비활성화</label>
            <input
              type="checkbox"
              checked={settings.respectOfflineStatus}
              onChange={(e) => updateSetting('respectOfflineStatus', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* 중요 업데이트 설정 */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium dark:text-gray-200">중요 업데이트 알림</label>
            <input
              type="checkbox"
              checked={settings.allowCriticalUpdates}
              onChange={(e) => updateSetting('allowCriticalUpdates', e.target.checked)}
              className="rounded dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          {/* 건너뛴 버전 관리 */}
          {settings.skippedVersions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium dark:text-gray-200">건너뛴 버전</label>
                <button
                  onClick={() => updateSetting('skippedVersions', [])}
                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  모두 지우기
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

          {/* 수동 액션 */}
          <div className="border-t dark:border-gray-600 pt-4 space-y-2">
            <button
              onClick={handleManualCheckClick}
              disabled={isCheckingForUpdates}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingForUpdates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  업데이트 확인 중...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  지금 업데이트 확인
                </>
              )}
            </button>
            <button
              onClick={handleClearCache}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Trash2 className="w-4 h-4" />
              캐시 삭제
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            닫기
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              저장
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}