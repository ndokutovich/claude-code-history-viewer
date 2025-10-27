import i18n, { languageLocaleMap } from "../i18n.config";

// Returns the locale based on the current language
export const getLocale = (language: string): string => {
  return languageLocaleMap[language] || "en-US";
};

export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const currentLanguage = i18n.language || "en";
  const locale = getLocale(currentLanguage);

  return date.toLocaleString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 1) {
    return i18n.t("time.lessThanMinute", { ns: "components" });
  }

  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = Math.floor(minutes % 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(
      `${days}${i18n.t("time.day", { count: days, ns: "components" })}`
    );
  }

  if (hours > 0) {
    parts.push(
      `${hours}${i18n.t("time.hour", { count: hours, ns: "components" })}`
    );
  }

  if (mins > 0) {
    parts.push(
      `${mins}${i18n.t("time.minute", { count: mins, ns: "components" })}`
    );
  }

  return parts.join(" ");
};

export const formatRelativeTime = (date: Date | string): string => {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return i18n.t("time.justNow", { ns: "components" });
  }
  if (diffMin < 60) {
    return i18n.t("time.minutesAgo", { count: diffMin, ns: "components" });
  }
  if (diffHour < 24) {
    return i18n.t("time.hoursAgo", { count: diffHour, ns: "components" });
  }
  if (diffDay < 30) {
    return i18n.t("time.daysAgo", { count: diffDay, ns: "components" });
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return i18n.t("time.monthsAgo", { count: diffMonth, ns: "components" });
  }

  const diffYear = Math.floor(diffDay / 365);
  return i18n.t("time.yearsAgo", { count: diffYear, ns: "components" });
};
