import {
  AlertTriangle,
  Download,
  CheckCircle,
  Info,
  X,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import type { UseNativeUpdaterReturn } from "../hooks/useNativeUpdater";

interface NativeUpdateModalProps {
  updater: UseNativeUpdaterReturn;
  isVisible: boolean;
  onClose: () => void;
}

export function NativeUpdateModal({
  updater,
  isVisible,
  onClose,
}: NativeUpdateModalProps) {
  const { t } = useTranslation("components");
  const { state, downloadAndInstall, dismissUpdate } = updater;

  if (!isVisible || !state.hasUpdate || !state.updateInfo) return null;

  const { updateInfo } = state;
  const version = updateInfo.version;
  const releaseNotes = updateInfo.body || "";

  // 우선순위 결정 (임시로 버전에 따라)
  const isCritical = version.includes("critical") || version.includes("hotfix");
  const isRecommended = !isCritical;

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
          "max-w-lg w-full rounded-xl shadow-2xl border",
          classes.bg,
          classes.border,
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start space-x-4">
            <div className={cn("p-3 rounded-full", classes.iconBg)}>
              {isProcessing ? (
                <Loader2 className={cn("w-6 h-6 animate-spin", classes.iconColor)} />
              ) : (
                <Icon className={cn("w-6 h-6", classes.iconColor)} />
              )}
            </div>
            <div className="flex-1">
              <h2 className={cn("text-xl font-semibold", COLORS.ui.text.primary)}>
                {t("updateModal.updateAvailable", { version })}
              </h2>
              <p className={cn("text-sm mt-1", COLORS.ui.text.secondary)}>
                {isProcessing ? progressText : t("updateModal.readyToInstall")}
              </p>
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
        <div className="px-6 pb-2">
          {state.error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">{state.error}</p>
            </div>
          )}

          {!isProcessing && (
            <>
              <p className={cn("text-sm", COLORS.ui.text.secondary)}>
                {releaseNotes || t("updateModal.newVersionAvailable")}
              </p>

              {/* Progress Bar */}
              {state.isDownloading && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${state.downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    {state.downloadProgress}% 완료
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
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