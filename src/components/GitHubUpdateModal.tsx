import {
  AlertTriangle,
  Download,
  CheckCircle,
  Info,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import type { UseGitHubUpdaterReturn } from "../hooks/useGitHubUpdater";

interface GitHubUpdateModalProps {
  updater: UseGitHubUpdaterReturn;
  isVisible: boolean;
  onClose: () => void;
}

export function GitHubUpdateModal({
  updater,
  isVisible,
  onClose,
}: GitHubUpdateModalProps) {
  const { t } = useTranslation("components");
  const { state, downloadAndInstall, dismissUpdate } = updater;

  if (!isVisible || !state.hasUpdate || !state.updateInfo || !state.releaseInfo)
    return null;

  const { updateInfo, releaseInfo } = state;
  const version = updateInfo.version;
  const releaseNotes = releaseInfo.body || "";
  const releaseTitle = releaseInfo.name || `Version ${version}`;

  // 우선순위 결정 (릴리즈 노트나 태그에 따라)
  const isCritical =
    releaseNotes.toLowerCase().includes("critical") ||
    releaseNotes.toLowerCase().includes("hotfix") ||
    releaseNotes.toLowerCase().includes("security");
  const isRecommended =
    !isCritical &&
    (releaseNotes.toLowerCase().includes("recommended") ||
      releaseNotes.toLowerCase().includes("important"));

  const getModalClasses = () => {
    if (isCritical) {
      return {
        bg: "bg-red-50 dark:bg-red-950",
        border: "border-red-200 dark:border-red-800",
        iconBg: "bg-red-100 dark:bg-red-900",
        iconColor: "text-red-600 dark:text-red-400",
        buttonPrimary:
          "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600",
      };
    } else if (isRecommended) {
      return {
        bg: "bg-blue-50 dark:bg-blue-950",
        border: "border-blue-200 dark:border-blue-800",
        iconBg: "bg-blue-100 dark:bg-blue-900",
        iconColor: "text-blue-600 dark:text-blue-400",
        buttonPrimary:
          "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600",
      };
    } else {
      return {
        bg: "bg-gray-50 dark:bg-gray-850",
        border: "border-gray-200 dark:border-gray-700",
        iconBg: "bg-gray-100 dark:bg-gray-800",
        iconColor: "text-gray-600 dark:text-gray-400",
        buttonPrimary:
          "bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600",
      };
    }
  };

  const classes = getModalClasses();

  const getIcon = () => {
    if (isCritical) return AlertTriangle;
    if (isRecommended) return CheckCircle;
    return Info;
  };

  const Icon = getIcon();

  const handleDownload = () => {
    downloadAndInstall();
  };

  const handleSkip = () => {
    dismissUpdate();
    onClose();
  };

  const handleViewOnGitHub = () => {
    if (releaseInfo.html_url?.startsWith("https://github.com/")) {
      window.open(releaseInfo.html_url, "_blank", "noopener,noreferrer");
    }
  };

  const isProcessing = state.isDownloading || state.isInstalling;
  const progressText = state.isDownloading
    ? `${t("updateModal.downloading")} ${state.downloadProgress}%`
    : state.isInstalling
    ? t("updateModal.installing")
    : "";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={isCritical || isProcessing ? undefined : onClose}
    >
      <div
        className={cn(
          "max-w-2xl w-full rounded-xl shadow-2xl border max-h-[80vh] flex flex-col",
          classes.bg,
          classes.border,
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 shrink-0">
          <div className="flex items-start space-x-4">
            <div className={cn("p-3 rounded-full", classes.iconBg)}>
              {isProcessing ? (
                <Loader2
                  className={cn("w-6 h-6 animate-spin", classes.iconColor)}
                />
              ) : (
                <Icon className={cn("w-6 h-6", classes.iconColor)} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className={cn("text-xl font-semibold", COLORS.ui.text.primary)}
              >
                {releaseTitle}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <p className={cn("text-sm", COLORS.ui.text.secondary)}>
                  {state.currentVersion} → {version}
                </p>
                <button
                  onClick={handleViewOnGitHub}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md border transition-colors",
                    "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700",
                    COLORS.ui.text.secondary
                  )}
                >
                  <ExternalLink className="w-3 h-3 inline mr-1" />
                  {t("updateModal.viewOnGitHub")}
                </button>
              </div>
            </div>
          </div>

          {!isCritical && !isProcessing && (
            <button
              onClick={onClose}
              className={cn(
                "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
                COLORS.ui.text.muted
              )}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-2 flex-1 overflow-hidden flex flex-col">
          {state.error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">
                {state.error}
              </p>
            </div>
          )}

          {isProcessing ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2
                  className={cn(
                    "w-12 h-12 animate-spin mx-auto mb-4",
                    classes.iconColor
                  )}
                />
                <p
                  className={cn("text-lg font-medium", COLORS.ui.text.primary)}
                >
                  {progressText}
                </p>
                {state.isDownloading && (
                  <div className="mt-4 max-w-sm mx-auto">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${state.downloadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-center">
                      {t("updateModal.downloadProgress", {
                        progress: state.downloadProgress,
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div
                className={cn(
                  "prose prose-sm dark:prose-invert max-w-none",
                  COLORS.ui.text.secondary
                )}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // 링크 스타일링
                    a: ({ ...props }) => (
                      <a
                        {...props}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                    // 코드 블록 스타일링
                    code: ({ className, ...props }) => (
                      <code
                        className={cn(
                          "bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm",
                          className
                        )}
                        {...props}
                      />
                    ),
                    // 체크박스 스타일링
                    input: ({ ...props }) => {
                      if (props.type === "checkbox") {
                        return (
                          <input {...props} className="mr-2 accent-blue-600" />
                        );
                      }
                      return <input {...props} />;
                    },
                  }}
                >
                  {releaseNotes || t("updateModal.newVersionAvailable")}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
            {!isCritical && !isProcessing && (
              <button
                onClick={handleSkip}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {t("updateModal.skipThisVersion")}
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={isProcessing}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors",
                "flex items-center justify-center space-x-2",
                classes.buttonPrimary,
                isProcessing && "opacity-50 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isProcessing
                  ? progressText
                  : isCritical
                  ? t("updateModal.updateNow")
                  : t("updateModal.downloadUpdate")}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
