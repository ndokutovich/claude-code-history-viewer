import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { setUpdateSettings } from '@/utils/updateSettings';

interface UpdateIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateIntroModal({ isOpen, onClose }: UpdateIntroModalProps) {
  const handleUnderstood = () => {
    setUpdateSettings({
      hasSeenIntroduction: true,
    });
    onClose();
  };

  const handleDisableAutoCheck = () => {
    setUpdateSettings({
      hasSeenIntroduction: true,
      autoCheck: false,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>업데이트 시스템 안내</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4 dark:text-gray-300">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Claude Code History Viewer는 더 나은 사용 경험을 위해 자동으로 업데이트를 확인합니다.
          </p>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2 dark:text-gray-200">작동 방식:</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 앱 시작 시 백그라운드에서 업데이트 확인</li>
              <li>• 새 업데이트 발견 시 알림 모달 표시</li>
              <li>• 다운로드/설치는 사용자가 직접 선택</li>
              <li>• 30분간 결과 캐시로 효율적 운영</li>
            </ul>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <h4 className="font-medium text-sm mb-2 dark:text-gray-200">장점:</h4>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 보안 패치 신속 적용</li>
              <li>• 새로운 기능 빠른 접근</li>
              <li>• 오프라인 시 자동 비활성화</li>
              <li>• 설정에서 언제든 변경 가능</li>
            </ul>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            💡 설정 → 업데이트에서 자동 확인을 비활성화할 수 있습니다.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={handleDisableAutoCheck}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            자동 확인 비활성화
          </button>
          <button
            onClick={handleUnderstood}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            이해했습니다
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}