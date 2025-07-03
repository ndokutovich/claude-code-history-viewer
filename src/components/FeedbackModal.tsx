import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FeedbackData {
  subject: string;
  body: string;
  include_system_info: boolean;
  feedback_type: string;
}

interface SystemInfo {
  app_version: string;
  os_type: string;
  os_version: string;
  arch: string;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal = ({ isOpen, onClose }: FeedbackModalProps) => {
  const [feedbackType, setFeedbackType] = useState<string>('bug');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [includeSystemInfo, setIncludeSystemInfo] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  const feedbackTypes = [
    { value: 'bug', label: '🐛 버그 신고' },
    { value: 'feature', label: '✨ 기능 요청' },
    { value: 'improvement', label: '🔧 개선사항' },
    { value: 'other', label: '💬 기타' },
  ];

  const loadSystemInfo = async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSystemInfo(info);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    setIsSubmitting(true);
    try {
      const feedbackData: FeedbackData = {
        subject: subject.trim(),
        body: body.trim(),
        include_system_info: includeSystemInfo,
        feedback_type: feedbackType,
      };

      await invoke('send_feedback', { feedback: feedbackData });
      
      // 성공 후 초기화
      setSubject('');
      setBody('');
      onClose();
    } catch (error) {
      console.error('Failed to send feedback:', error);
      alert('피드백 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenGitHub = async () => {
    try {
      await invoke('open_github_issues');
    } catch (error) {
      console.error('Failed to open GitHub:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              피드백 보내기
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 피드백 타입 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                피드백 유형
              </label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {feedbackTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                제목 *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="간단한 제목을 입력해주세요"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                상세 내용 *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  feedbackType === 'bug'
                    ? '버그가 발생한 상황과 재현 방법을 자세히 설명해주세요.'
                    : feedbackType === 'feature'
                    ? '필요한 기능과 그 이유를 설명해주세요.'
                    : '자세한 내용을 입력해주세요.'
                }
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                required
              />
            </div>

            {/* 시스템 정보 포함 옵션 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="includeSystemInfo"
                checked={includeSystemInfo}
                onChange={(e) => setIncludeSystemInfo(e.target.checked)}
                className="rounded"
              />
              <label
                htmlFor="includeSystemInfo"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                시스템 정보 포함 (앱 버전, OS 정보)
              </label>
              {includeSystemInfo && !systemInfo && (
                <button
                  type="button"
                  onClick={loadSystemInfo}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  미리보기
                </button>
              )}
            </div>

            {/* 시스템 정보 미리보기 */}
            {includeSystemInfo && systemInfo && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs">
                <div className="font-medium mb-1">포함될 시스템 정보:</div>
                <div>앱 버전: {systemInfo.app_version}</div>
                <div>OS: {systemInfo.os_type} {systemInfo.os_version}</div>
                <div>아키텍처: {systemInfo.arch}</div>
              </div>
            )}

            {/* 버튼들 */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !body.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
              >
                {isSubmitting ? '전송 중...' : '📧 이메일로 보내기'}
              </button>
              
              <button
                type="button"
                onClick={handleOpenGitHub}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                🔗 GitHub에서 이슈 등록
              </button>
            </div>
          </form>

          {/* 도움말 */}
          <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            <div className="mb-2">💡 <strong>팁:</strong></div>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>버그 신고 시: 재현 단계와 예상 동작을 명확히 적어주세요</li>
              <li>기능 요청 시: 어떤 문제를 해결하려는지 설명해주세요</li>
              <li>스크린샷이 있다면 이메일에 첨부해주세요</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};