import i18n, { languageLocaleMap } from "../i18n";

// 현재 언어에 따른 로케일 반환
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
    const dayUnit = days === 1 ? "time.day" : "time.days";
    parts.push(`${days}${i18n.t(dayUnit, { ns: "components" })}`);
  }

  if (hours > 0) {
    const hourUnit = hours === 1 ? "time.hour" : "time.hours";
    parts.push(`${hours}${i18n.t(hourUnit, { ns: "components" })}`);
  }

  if (mins > 0) {
    const minUnit = mins === 1 ? "time.minute" : "time.minutes";
    parts.push(`${mins}${i18n.t(minUnit, { ns: "components" })}`);
  }

  return parts.join(" ");
};