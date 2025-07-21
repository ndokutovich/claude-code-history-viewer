import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ExternalLink, Download, AlertTriangle, X } from 'lucide-react';
import type { UseGitHubUpdaterReturn } from '@/hooks/useGitHubUpdater';
import { skipVersion, postponeUpdate } from '@/utils/updateSettings';

interface SimpleUpdateModalProps {
  updater: UseGitHubUpdaterReturn;
  isVisible: boolean;
  onClose: () => void;
}

export function SimpleUpdateModal({ updater, isVisible, onClose }: SimpleUpdateModalProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  if (!updater.state.releaseInfo || !updater.state.hasUpdate) return null;

  const release = updater.state.releaseInfo;
  const currentVersion = updater.state.currentVersion;
  const newVersion = release.tag_name.replace('v', '');
  
  const isImportant = release.body.toLowerCase().includes('security') || 
                     release.body.toLowerCase().includes('critical');

  const handleDownload = () => {
    updater.downloadAndInstall();
  };

  const handleSkip = () => {
    skipVersion(newVersion);
    updater.dismissUpdate();
    onClose();
  };

  const handlePostpone = () => {
    postponeUpdate();
    updater.dismissUpdate();
    onClose();
  };

  return (
    <Dialog open={isVisible} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            새 업데이트 사용 가능
            {isImportant && (
              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                중요
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 버전 정보 */}
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">현재 버전</div>
              <div className="font-medium dark:text-white">{currentVersion}</div>
            </div>
            <div className="text-2xl text-gray-400 dark:text-gray-500">→</div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">새 버전</div>
              <div className="font-medium text-blue-600 dark:text-blue-400">{newVersion}</div>
            </div>
          </div>

          {/* 다운로드 진행률 */}
          {updater.state.isDownloading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Download className="w-4 h-4 animate-bounce" />
                <span className="dark:text-gray-300">다운로드 중... {updater.state.downloadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all" 
                  style={{ width: `${updater.state.downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* 설치 중 */}
          {updater.state.isInstalling && (
            <div className="flex items-center gap-2 text-sm p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="animate-spin w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full" />
              <span className="dark:text-gray-300">설치 중... 잠시 후 앱이 재시작됩니다.</span>
            </div>
          )}

          {/* 에러 표시 */}
          {updater.state.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>오류가 발생했습니다: {updater.state.error}</span>
              </div>
            </div>
          )}

          {/* 세부 정보 */}
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
            >
              {showDetails ? '세부 정보 숨기기' : '세부 정보 보기'}
            </button>

            {showDetails && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <div className="mb-2">
                  <strong className="dark:text-gray-200">릴리스명:</strong> <span className="dark:text-gray-300">{release.name}</span>
                </div>
                <div className="mb-2">
                  <strong className="dark:text-gray-200">변경사항:</strong>
                  <pre className="mt-1 text-xs bg-white dark:bg-gray-900 dark:text-gray-300 p-2 rounded border dark:border-gray-600 max-h-32 overflow-auto">
                    {release.body}
                  </pre>
                </div>
                <a
                  href={release.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <ExternalLink className="w-3 h-3" />
                  GitHub에서 보기
                </a>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex flex-wrap gap-2 w-full">
            <button
              onClick={handleDownload}
              disabled={updater.state.isDownloading || updater.state.isInstalling}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updater.state.isDownloading ? (
                <>
                  <Download className="w-4 h-4 inline mr-2 animate-bounce" />
                  다운로드 중...
                </>
              ) : updater.state.isInstalling ? (
                '설치 중...'
              ) : (
                <>
                  <Download className="w-4 h-4 inline mr-2" />
                  다운로드 & 설치
                </>
              )}
            </button>

            <div className="flex gap-2 w-full">
              <button
                onClick={handlePostpone}
                disabled={updater.state.isDownloading || updater.state.isInstalling}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                24시간 후 다시 알림
              </button>
              <button
                onClick={handleSkip}
                disabled={updater.state.isDownloading || updater.state.isInstalling}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm"
              >
                이 버전 건너뛰기
              </button>
              <button
                onClick={onClose}
                disabled={updater.state.isDownloading || updater.state.isInstalling}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}