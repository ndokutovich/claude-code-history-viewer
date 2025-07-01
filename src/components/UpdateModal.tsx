import {
  AlertTriangle,
  Download,
  Clock,
  X,
  CheckCircle,
  Info,
} from "lucide-react";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import type { UpdateInfo } from "../types";

interface UpdateModalProps {
  updateInfo: UpdateInfo;
  onDownload: (url: string) => void;
  onPostpone: (version: string) => void;
  onSkip: (version: string) => void;
  onClose: () => void;
  isVisible: boolean;
}

export function UpdateModal({
  updateInfo,
  onDownload,
  onPostpone,
  onSkip,
  onClose,
  isVisible,
}: UpdateModalProps) {
  if (!isVisible || !updateInfo.has_update) return null;

  const { metadata, latest_version, download_url, release_url } = updateInfo;
  const isCritical = metadata?.priority === "critical";
  const isRecommended = metadata?.priority === "recommended";

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
    if (download_url) {
      onDownload(download_url);
    } else if (release_url) {
      onDownload(release_url);
    }
  };

  const handlePostpone = () => {
    if (latest_version) {
      onPostpone(latest_version);
    }
  };

  const handleSkip = () => {
    if (latest_version) {
      onSkip(latest_version);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={isCritical ? undefined : onClose}
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
              <Icon className={cn("w-6 h-6", classes.iconColor)} />
            </div>
            <div className="flex-1">
              <h2
                className={cn("text-xl font-semibold", COLORS.ui.text.primary)}
              >
                {metadata?.message.title || `버전 ${latest_version} 업데이트`}
              </h2>
              <p className={cn("text-sm mt-1", COLORS.ui.text.secondary)}>
                현재 버전: {updateInfo.current_version} → {latest_version}
              </p>
            </div>
          </div>

          {!isCritical && (
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
          <p className={cn("text-sm", COLORS.ui.text.secondary)}>
            {metadata?.message.description || "새로운 버전이 available합니다."}
          </p>

          {/* Deadline Warning */}
          {updateInfo.days_until_deadline &&
            updateInfo.days_until_deadline > 0 && (
              <div
                className={cn(
                  "mt-4 p-3 rounded-lg border",
                  "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                )}
              >
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    업데이트 마감일: {updateInfo.days_until_deadline}일 남음
                  </span>
                </div>
              </div>
            )}

          {/* Features List */}
          {metadata?.message.features &&
            metadata.message.features.length > 0 && (
              <div className="mt-4">
                <h4
                  className={cn(
                    "text-sm font-medium mb-2",
                    COLORS.ui.text.primary
                  )}
                >
                  주요 변경사항:
                </h4>
                <ul className="space-y-1">
                  {metadata.message.features.map((feature, index) => (
                    <li
                      key={index}
                      className={cn(
                        "text-sm flex items-start space-x-2",
                        COLORS.ui.text.secondary
                      )}
                    >
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-2 space-y-reverse sm:space-y-0 sm:space-x-3">
            {!isCritical && (
              <>
                <button
                  onClick={handleSkip}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  이 버전 건너뛰기
                </button>

                <button
                  onClick={handlePostpone}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg border transition-colors",
                    "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300",
                    "hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  나중에 (7일)
                </button>
              </>
            )}

            <button
              onClick={handleDownload}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors",
                "flex items-center justify-center space-x-2",
                classes.buttonPrimary
              )}
            >
              <Download className="w-4 h-4" />
              <span>{isCritical ? "지금 업데이트" : "업데이트 다운로드"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
