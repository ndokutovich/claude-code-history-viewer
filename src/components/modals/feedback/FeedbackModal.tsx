import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("components");
  const [feedbackType, setFeedbackType] = useState<string>("bug");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [includeSystemInfo, setIncludeSystemInfo] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  const feedbackTypes = [
    { value: "bug", label: t("feedback.types.bug") },
    { value: "feature", label: t("feedback.types.feature") },
    { value: "improvement", label: t("feedback.types.improvement") },
    { value: "other", label: t("feedback.types.other") },
  ];

  const loadSystemInfo = async () => {
    try {
      const info = await invoke<SystemInfo>("get_system_info");
      setSystemInfo(info);
    } catch (error) {
      console.error("Failed to load system info:", error);
      alert(t("feedback.systemInfoError"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enhanced input validation
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (!trimmedSubject || !trimmedBody) {
      // Notify via toast message
      return;
    }

    if (trimmedSubject.length > 100 || trimmedBody.length > 1000) {
      // Notify length limit exceeded
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackData: FeedbackData = {
        subject: trimmedSubject,
        body: trimmedBody,
        include_system_info: includeSystemInfo,
        feedback_type: feedbackType,
      };

      await invoke("send_feedback", { feedback: feedbackData });

      // Reset after success
      setSubject("");
      setBody("");
      onClose();
    } catch (error) {
      console.error("Failed to send feedback:", error);
      alert(t("feedback.sendError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenGitHub = async () => {
    try {
      await invoke("open_github_issues");
    } catch (error) {
      console.error("Failed to open GitHub:", error);
      alert(t("feedback.openGitHubError"));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t("feedback.title")}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {t("feedback.close")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Feedback type selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("feedback.type")}
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

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("feedback.subjectRequired")}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("feedback.subjectPlaceholder")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("feedback.contentRequired")}
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  feedbackType === "bug"
                    ? t("feedback.placeholders.bug")
                    : feedbackType === "feature"
                    ? t("feedback.placeholders.feature")
                    : t("feedback.placeholders.default")
                }
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                required
              />
            </div>

            {/* Include system information option */}
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
                {t("feedback.includeSystemInfo")}
              </label>
              {includeSystemInfo && !systemInfo && (
                <button
                  type="button"
                  onClick={loadSystemInfo}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {t("feedback.preview")}
                </button>
              )}
            </div>

            {/* System information preview */}
            {includeSystemInfo && systemInfo && (
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs">
                <div className="font-medium mb-1">
                  {t("feedback.systemInfoPreview")}
                </div>
                <div>
                  {t("feedback.appVersion", {
                    version: systemInfo.app_version,
                  })}
                </div>
                <div>
                  {t("feedback.os", {
                    os: systemInfo.os_type,
                    version: systemInfo.os_version,
                  })}
                </div>
                <div>
                  {t("feedback.architecture", { arch: systemInfo.arch })}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !body.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
              >
                {isSubmitting
                  ? t("feedback.sendingEmail")
                  : t("feedback.sendEmail")}
              </button>

              <button
                type="button"
                onClick={handleOpenGitHub}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium"
              >
                {t("feedback.openGitHub")}
              </button>
            </div>
          </form>

          {/* Help text */}
          <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            <div className="mb-2">{t("feedback.tips")}</div>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>{t("feedback.tipBugReport")}</li>
              <li>{t("feedback.tipFeatureRequest")}</li>
              <li>{t("feedback.tipScreenshot")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
