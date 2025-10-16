import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enCommon from './i18n/locales/en/common.json';
import enComponents from './i18n/locales/en/components.json';
import enMessages from './i18n/locales/en/messages.json';

import koCommon from './i18n/locales/ko/common.json';
import koComponents from './i18n/locales/ko/components.json';
import koMessages from './i18n/locales/ko/messages.json';

import jaCommon from './i18n/locales/ja/common.json';
import jaComponents from './i18n/locales/ja/components.json';
import jaMessages from './i18n/locales/ja/messages.json';

import zhCNCommon from './i18n/locales/zh-CN/common.json';
import zhCNComponents from './i18n/locales/zh-CN/components.json';
import zhCNMessages from './i18n/locales/zh-CN/messages.json';

import zhTWCommon from './i18n/locales/zh-TW/common.json';
import zhTWComponents from './i18n/locales/zh-TW/components.json';
import zhTWMessages from './i18n/locales/zh-TW/messages.json';

import ruCommon from './i18n/locales/ru/common.json';
import ruComponents from './i18n/locales/ru/components.json';
import ruMessages from './i18n/locales/ru/messages.json';

// Define resources
const resources = {
  en: {
    common: enCommon,
    components: enComponents,
    messages: enMessages,
  },
  ko: {
    common: koCommon,
    components: koComponents,
    messages: koMessages,
  },
  ja: {
    common: jaCommon,
    components: jaComponents,
    messages: jaMessages,
  },
  'zh-CN': {
    common: zhCNCommon,
    components: zhCNComponents,
    messages: zhCNMessages,
  },
  'zh-TW': {
    common: zhTWCommon,
    components: zhTWComponents,
    messages: zhTWMessages,
  },
  ru: {
    common: ruCommon,
    components: ruComponents,
    messages: ruMessages,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: false,

    interpolation: {
      escapeValue: false, // React already does escaping
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    ns: ['common', 'components', 'messages'],
    defaultNS: 'common',
  });

// Export types and constants
export type SupportedLanguage = 'en' | 'ko' | 'ja' | 'zh-CN' | 'zh-TW' | 'ru';

export const supportedLanguages: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ru', label: 'Русский' },
];

export const languageLocaleMap: Record<string, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja-JP',
  ru: 'ru-RU',
};

export default i18n;