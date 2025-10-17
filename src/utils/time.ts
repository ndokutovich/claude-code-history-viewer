import i18n, { languageLocaleMap } from "../i18n";

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
