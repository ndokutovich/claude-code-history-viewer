import { useTranslation } from "react-i18next";
import { MessageSquare, FileCode, Filter } from "lucide-react";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { useAppStore } from "@/store/useAppStore";

/**
 * Message view controls component
 * Provides:
 * 1. View mode toggle (Formatted / Raw)
 * 2. Message filters (Bash only, Tool use only, Messages only)
 */
export function MessageViewControls() {
  const { t } = useTranslation("components");
  const { messageViewMode, messageFilters, setMessageViewMode, setMessageFilters } = useAppStore();

  const hasActiveFilters = Object.values(messageFilters).some(v => v);

  return (
    <div className="flex items-center gap-4">
      {/* View Mode Toggle */}
      <div className={cn("flex items-center gap-1 rounded-lg p-1 bg-gray-100 dark:bg-gray-800")}>
        <button
          onClick={() => setMessageViewMode("formatted")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            messageViewMode === "formatted"
              ? "bg-white dark:bg-gray-800 shadow-sm"
              : "hover:bg-gray-100 dark:hover:bg-gray-700",
            messageViewMode === "formatted"
              ? COLORS.ui.text.primary
              : COLORS.ui.text.secondary
          )}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t("messageView.formatted")}</span>
        </button>

        <button
          onClick={() => setMessageViewMode("raw")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            messageViewMode === "raw"
              ? "bg-white dark:bg-gray-800 shadow-sm"
              : "hover:bg-gray-100 dark:hover:bg-gray-700",
            messageViewMode === "raw"
              ? COLORS.ui.text.primary
              : COLORS.ui.text.secondary
          )}
        >
          <FileCode className="w-4 h-4" />
          <span>{t("messageView.raw")}</span>
        </button>
      </div>

      {/* Separator */}
      <div className={cn("h-6 w-px", COLORS.ui.border.light)} />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className={cn("w-4 h-4", hasActiveFilters ? "text-blue-500" : COLORS.ui.text.secondary)} />
          <span className={cn("text-sm font-medium", COLORS.ui.text.secondary)}>
            {t("messageView.filters")}:
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={messageFilters.showBashOnly}
            onChange={(e) => setMessageFilters({
              showBashOnly: e.target.checked,
              // Disable other filters when enabling this one
              showToolUseOnly: e.target.checked ? false : messageFilters.showToolUseOnly,
              showMessagesOnly: e.target.checked ? false : messageFilters.showMessagesOnly,
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.bashOnly")}
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={messageFilters.showToolUseOnly}
            onChange={(e) => setMessageFilters({
              showToolUseOnly: e.target.checked,
              // Disable other filters when enabling this one
              showBashOnly: e.target.checked ? false : messageFilters.showBashOnly,
              showMessagesOnly: e.target.checked ? false : messageFilters.showMessagesOnly,
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.toolUseOnly")}
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={messageFilters.showMessagesOnly}
            onChange={(e) => setMessageFilters({
              showMessagesOnly: e.target.checked,
              // Disable other filters when enabling this one
              showBashOnly: e.target.checked ? false : messageFilters.showBashOnly,
              showToolUseOnly: e.target.checked ? false : messageFilters.showToolUseOnly,
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.messagesOnly")}
          </span>
        </label>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={() => setMessageFilters({
              showBashOnly: false,
              showToolUseOnly: false,
              showMessagesOnly: false,
            })}
            className={cn(
              "text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700",
              "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {t("messageView.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
