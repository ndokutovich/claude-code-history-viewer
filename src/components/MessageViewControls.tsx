import { useTranslation } from "react-i18next";
import { MessageSquare, FileCode, Filter, User, Bot, Settings } from "lucide-react";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_MESSAGE_FILTERS, hasActiveMessageFilters } from "@/utils/messageFilters";

/**
 * Message view controls component
 * Provides:
 * 1. View mode toggle (Formatted / Raw)
 * 2. Message filters (Bash only, Tool use only, Messages only)
 * 3. Advanced filters (role + content-type visibility toggles)
 */
export function MessageViewControls() {
  const { t } = useTranslation("components");
  const { messageViewMode, messageFilters, setMessageViewMode, setMessageFilters } = useAppStore();

  const hasActiveFilters = hasActiveMessageFilters(messageFilters);

  // Role visibility toggles (checked = visible).
  const roleToggles: { key: "roleUser" | "roleAssistant" | "roleSystem"; icon: typeof User; label: string }[] = [
    { key: "roleUser", icon: User, label: t("messageView.roleUser") },
    { key: "roleAssistant", icon: Bot, label: t("messageView.roleAssistant") },
    { key: "roleSystem", icon: Settings, label: t("messageView.roleSystem") },
  ];

  // Content-type visibility toggles (checked = visible).
  const contentToggles: { key: "contentText" | "contentToolUse" | "contentToolResult" | "contentThinking"; label: string }[] = [
    { key: "contentText", label: t("messageView.contentText") },
    { key: "contentToolUse", label: t("messageView.contentToolUse") },
    { key: "contentToolResult", label: t("messageView.contentToolResult") },
    { key: "contentThinking", label: t("messageView.contentThinking") },
  ];

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
              // Disable Command only if Bash only is disabled
              showCommandOnly: e.target.checked ? messageFilters.showCommandOnly : false,
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.bashOnly")}
          </span>
        </label>

        {/* Command only - chained with Bash only */}
        {messageFilters.showBashOnly && (
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 ml-2">
            <input
              type="checkbox"
              checked={messageFilters.showCommandOnly}
              onChange={(e) => setMessageFilters({
                showCommandOnly: e.target.checked,
              })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className={cn(COLORS.ui.text.secondary)}>
              {t("messageView.commandOnly")}
            </span>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={messageFilters.showToolUseOnly}
            onChange={(e) => setMessageFilters({
              showToolUseOnly: e.target.checked,
              // Disable other filters when enabling this one
              showBashOnly: e.target.checked ? false : messageFilters.showBashOnly,
              showMessagesOnly: e.target.checked ? false : messageFilters.showMessagesOnly,
              showCommandOnly: false, // Command only requires Bash only
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
              showCommandOnly: false, // Command only requires Bash only
            })}
            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.messagesOnly")}
          </span>
        </label>

        {/* Separator before advanced role/content-type filters */}
        <div className={cn("h-4 w-px", COLORS.ui.border.light)} />

        {/* Role visibility filters (frontend) */}
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", COLORS.ui.text.secondary)}>
            {t("messageView.role")}:
          </span>
          {roleToggles.map(({ key, icon: Icon, label }) => (
            <label
              key={key}
              className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-80"
              title={label}
            >
              <input
                type="checkbox"
                checked={messageFilters[key]}
                onChange={(e) => setMessageFilters({ [key]: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <Icon className={cn("w-3.5 h-3.5", COLORS.ui.text.secondary)} />
              <span className={cn(COLORS.ui.text.secondary)}>{label}</span>
            </label>
          ))}
        </div>

        {/* Separator before content-type filters */}
        <div className={cn("h-4 w-px", COLORS.ui.border.light)} />

        {/* Content-type visibility filters (frontend) */}
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", COLORS.ui.text.secondary)}>
            {t("messageView.contentType")}:
          </span>
          {contentToggles.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-80"
              title={label}
            >
              <input
                type="checkbox"
                checked={messageFilters[key]}
                onChange={(e) => setMessageFilters({ [key]: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className={cn(COLORS.ui.text.secondary)}>{label}</span>
            </label>
          ))}
        </div>

        {/* Separator before noise toggle */}
        <div className={cn("h-4 w-px", COLORS.ui.border.light)} />

        {/* Show noise messages (backend filter — triggers reload) */}
        <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={messageFilters.showNoiseMessages}
            onChange={(e) => setMessageFilters({
              showNoiseMessages: e.target.checked,
            })}
            className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.showNoise")}
          </span>
        </label>

        {/* Show sub-agent (sidechain) messages (backend filter — triggers reload) */}
        <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80">
          <input
            type="checkbox"
            checked={messageFilters.showSubagentMessages}
            onChange={(e) => setMessageFilters({
              showSubagentMessages: e.target.checked,
            })}
            className="w-4 h-4 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
          />
          <span className={cn(COLORS.ui.text.secondary)}>
            {t("messageView.showSubAgent")}
          </span>
        </label>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <button
            onClick={() => setMessageFilters({ ...DEFAULT_MESSAGE_FILTERS })}
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
