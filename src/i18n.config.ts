import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// Import translation files
import enCommon from './i18n/locales/en/common.json';
import enComponents from './i18n/locales/en/components.json';
import enMessages from './i18n/locales/en/messages.json';
import enSourceManager from './i18n/locales/en/sourceManager.json';
import enSplash from './i18n/locales/en/splash.json';
import enSearch from './i18n/locales/en/search.json';

import koCommon from './i18n/locales/ko/common.json';
import koComponents from './i18n/locales/ko/components.json';
import koMessages from './i18n/locales/ko/messages.json';
import koSourceManager from './i18n/locales/ko/sourceManager.json';
import koSplash from './i18n/locales/ko/splash.json';
import koSearch from './i18n/locales/ko/search.json';

import jaCommon from './i18n/locales/ja/common.json';
import jaComponents from './i18n/locales/ja/components.json';
import jaMessages from './i18n/locales/ja/messages.json';
import jaSourceManager from './i18n/locales/ja/sourceManager.json';
import jaSplash from './i18n/locales/ja/splash.json';
import jaSearch from './i18n/locales/ja/search.json';

import zhCNCommon from './i18n/locales/zh-CN/common.json';
import zhCNComponents from './i18n/locales/zh-CN/components.json';
import zhCNMessages from './i18n/locales/zh-CN/messages.json';
import zhCNSourceManager from './i18n/locales/zh-CN/sourceManager.json';
import zhCNSplash from './i18n/locales/zh-CN/splash.json';
import zhCNSearch from './i18n/locales/zh-CN/search.json';

import zhTWCommon from './i18n/locales/zh-TW/common.json';
import zhTWComponents from './i18n/locales/zh-TW/components.json';
import zhTWMessages from './i18n/locales/zh-TW/messages.json';
import zhTWSourceManager from './i18n/locales/zh-TW/sourceManager.json';
import zhTWSplash from './i18n/locales/zh-TW/splash.json';
import zhTWSearch from './i18n/locales/zh-TW/search.json';

import ruCommon from './i18n/locales/ru/common.json';
import ruComponents from './i18n/locales/ru/components.json';
import ruMessages from './i18n/locales/ru/messages.json';
import ruSourceManager from './i18n/locales/ru/sourceManager.json';
import ruSplash from './i18n/locales/ru/splash.json';
import ruSearch from './i18n/locales/ru/search.json';

// Define resources
const resources = {
  en: {
    common: enCommon,
    components: enComponents,
    messages: enMessages,
    sourceManager: enSourceManager,
    splash: enSplash,
    search: enSearch,
  },
  ko: {
    common: koCommon,
    components: koComponents,
    messages: koMessages,
    sourceManager: koSourceManager,
    splash: koSplash,
    search: koSearch,
  },
  ja: {
    common: jaCommon,
    components: jaComponents,
    messages: jaMessages,
    sourceManager: jaSourceManager,
    splash: jaSplash,
    search: jaSearch,
  },
  'zh-CN': {
    common: zhCNCommon,
    components: zhCNComponents,
    messages: zhCNMessages,
    sourceManager: zhCNSourceManager,
    splash: zhCNSplash,
    search: zhCNSearch,
  },
  'zh-TW': {
    common: zhTWCommon,
    components: zhTWComponents,
    messages: zhTWMessages,
    sourceManager: zhTWSourceManager,
    splash: zhTWSplash,
    search: zhTWSearch,
  },
  ru: {
    common: ruCommon,
    components: ruComponents,
    messages: ruMessages,
    sourceManager: ruSourceManager,
    splash: ruSplash,
    search: ruSearch,
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
      escapeValue: false, // React already handles escaping
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },

    ns: ['common', 'components', 'messages', 'sourceManager', 'splash', 'search'],
    defaultNS: 'common',
  });

console.log('🌐 i18n initialized with 6 namespaces');
console.log('  sourceManager.title:', enSourceManager.title);
console.log('  splash.appTitle:', enSplash.appTitle);

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