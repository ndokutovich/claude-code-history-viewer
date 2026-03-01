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
import enRecentEdits from './i18n/locales/en/recentEdits.json';
import enSettings from './i18n/locales/en/settings.json';
import enAnalytics from './i18n/locales/en/analytics.json';
import enTools from './i18n/locales/en/tools.json';
import enError from './i18n/locales/en/error.json';
import enMessage from './i18n/locales/en/message.json';
import enRenderers from './i18n/locales/en/renderers.json';
import enUpdate from './i18n/locales/en/update.json';
import enFeedback from './i18n/locales/en/feedback.json';
import enSession from './i18n/locales/en/session.json';

import koCommon from './i18n/locales/ko/common.json';
import koComponents from './i18n/locales/ko/components.json';
import koMessages from './i18n/locales/ko/messages.json';
import koSourceManager from './i18n/locales/ko/sourceManager.json';
import koSplash from './i18n/locales/ko/splash.json';
import koSearch from './i18n/locales/ko/search.json';
import koRecentEdits from './i18n/locales/ko/recentEdits.json';
import koSettings from './i18n/locales/ko/settings.json';
import koAnalytics from './i18n/locales/ko/analytics.json';
import koTools from './i18n/locales/ko/tools.json';
import koError from './i18n/locales/ko/error.json';
import koMessage from './i18n/locales/ko/message.json';
import koRenderers from './i18n/locales/ko/renderers.json';
import koUpdate from './i18n/locales/ko/update.json';
import koFeedback from './i18n/locales/ko/feedback.json';
import koSession from './i18n/locales/ko/session.json';

import jaCommon from './i18n/locales/ja/common.json';
import jaComponents from './i18n/locales/ja/components.json';
import jaMessages from './i18n/locales/ja/messages.json';
import jaSourceManager from './i18n/locales/ja/sourceManager.json';
import jaSplash from './i18n/locales/ja/splash.json';
import jaSearch from './i18n/locales/ja/search.json';
import jaRecentEdits from './i18n/locales/ja/recentEdits.json';
import jaSettings from './i18n/locales/ja/settings.json';
import jaAnalytics from './i18n/locales/ja/analytics.json';
import jaTools from './i18n/locales/ja/tools.json';
import jaError from './i18n/locales/ja/error.json';
import jaMessage from './i18n/locales/ja/message.json';
import jaRenderers from './i18n/locales/ja/renderers.json';
import jaUpdate from './i18n/locales/ja/update.json';
import jaFeedback from './i18n/locales/ja/feedback.json';
import jaSession from './i18n/locales/ja/session.json';

import zhCNCommon from './i18n/locales/zh-CN/common.json';
import zhCNComponents from './i18n/locales/zh-CN/components.json';
import zhCNMessages from './i18n/locales/zh-CN/messages.json';
import zhCNSourceManager from './i18n/locales/zh-CN/sourceManager.json';
import zhCNSplash from './i18n/locales/zh-CN/splash.json';
import zhCNSearch from './i18n/locales/zh-CN/search.json';
import zhCNRecentEdits from './i18n/locales/zh-CN/recentEdits.json';
import zhCNSettings from './i18n/locales/zh-CN/settings.json';
import zhCNAnalytics from './i18n/locales/zh-CN/analytics.json';
import zhCNTools from './i18n/locales/zh-CN/tools.json';
import zhCNError from './i18n/locales/zh-CN/error.json';
import zhCNMessage from './i18n/locales/zh-CN/message.json';
import zhCNRenderers from './i18n/locales/zh-CN/renderers.json';
import zhCNUpdate from './i18n/locales/zh-CN/update.json';
import zhCNFeedback from './i18n/locales/zh-CN/feedback.json';
import zhCNSession from './i18n/locales/zh-CN/session.json';

import zhTWCommon from './i18n/locales/zh-TW/common.json';
import zhTWComponents from './i18n/locales/zh-TW/components.json';
import zhTWMessages from './i18n/locales/zh-TW/messages.json';
import zhTWSourceManager from './i18n/locales/zh-TW/sourceManager.json';
import zhTWSplash from './i18n/locales/zh-TW/splash.json';
import zhTWSearch from './i18n/locales/zh-TW/search.json';
import zhTWRecentEdits from './i18n/locales/zh-TW/recentEdits.json';
import zhTWSettings from './i18n/locales/zh-TW/settings.json';
import zhTWAnalytics from './i18n/locales/zh-TW/analytics.json';
import zhTWTools from './i18n/locales/zh-TW/tools.json';
import zhTWError from './i18n/locales/zh-TW/error.json';
import zhTWMessage from './i18n/locales/zh-TW/message.json';
import zhTWRenderers from './i18n/locales/zh-TW/renderers.json';
import zhTWUpdate from './i18n/locales/zh-TW/update.json';
import zhTWFeedback from './i18n/locales/zh-TW/feedback.json';
import zhTWSession from './i18n/locales/zh-TW/session.json';

import ruCommon from './i18n/locales/ru/common.json';
import ruComponents from './i18n/locales/ru/components.json';
import ruMessages from './i18n/locales/ru/messages.json';
import ruSourceManager from './i18n/locales/ru/sourceManager.json';
import ruSplash from './i18n/locales/ru/splash.json';
import ruSearch from './i18n/locales/ru/search.json';
import ruRecentEdits from './i18n/locales/ru/recentEdits.json';
import ruSettings from './i18n/locales/ru/settings.json';
import ruAnalytics from './i18n/locales/ru/analytics.json';
import ruTools from './i18n/locales/ru/tools.json';
import ruError from './i18n/locales/ru/error.json';
import ruMessage from './i18n/locales/ru/message.json';
import ruRenderers from './i18n/locales/ru/renderers.json';
import ruUpdate from './i18n/locales/ru/update.json';
import ruFeedback from './i18n/locales/ru/feedback.json';
import ruSession from './i18n/locales/ru/session.json';

// Define resources
const resources = {
  en: {
    common: enCommon,
    components: enComponents,
    messages: enMessages,
    sourceManager: enSourceManager,
    splash: enSplash,
    search: enSearch,
    recentEdits: enRecentEdits,
    settings: enSettings,
    analytics: enAnalytics,
    tools: enTools,
    error: enError,
    message: enMessage,
    renderers: enRenderers,
    update: enUpdate,
    feedback: enFeedback,
    session: enSession,
  },
  ko: {
    common: koCommon,
    components: koComponents,
    messages: koMessages,
    sourceManager: koSourceManager,
    splash: koSplash,
    search: koSearch,
    recentEdits: koRecentEdits,
    settings: koSettings,
    analytics: koAnalytics,
    tools: koTools,
    error: koError,
    message: koMessage,
    renderers: koRenderers,
    update: koUpdate,
    feedback: koFeedback,
    session: koSession,
  },
  ja: {
    common: jaCommon,
    components: jaComponents,
    messages: jaMessages,
    sourceManager: jaSourceManager,
    splash: jaSplash,
    search: jaSearch,
    recentEdits: jaRecentEdits,
    settings: jaSettings,
    analytics: jaAnalytics,
    tools: jaTools,
    error: jaError,
    message: jaMessage,
    renderers: jaRenderers,
    update: jaUpdate,
    feedback: jaFeedback,
    session: jaSession,
  },
  'zh-CN': {
    common: zhCNCommon,
    components: zhCNComponents,
    messages: zhCNMessages,
    sourceManager: zhCNSourceManager,
    splash: zhCNSplash,
    search: zhCNSearch,
    recentEdits: zhCNRecentEdits,
    settings: zhCNSettings,
    analytics: zhCNAnalytics,
    tools: zhCNTools,
    error: zhCNError,
    message: zhCNMessage,
    renderers: zhCNRenderers,
    update: zhCNUpdate,
    feedback: zhCNFeedback,
    session: zhCNSession,
  },
  'zh-TW': {
    common: zhTWCommon,
    components: zhTWComponents,
    messages: zhTWMessages,
    sourceManager: zhTWSourceManager,
    splash: zhTWSplash,
    search: zhTWSearch,
    recentEdits: zhTWRecentEdits,
    settings: zhTWSettings,
    analytics: zhTWAnalytics,
    tools: zhTWTools,
    error: zhTWError,
    message: zhTWMessage,
    renderers: zhTWRenderers,
    update: zhTWUpdate,
    feedback: zhTWFeedback,
    session: zhTWSession,
  },
  ru: {
    common: ruCommon,
    components: ruComponents,
    messages: ruMessages,
    sourceManager: ruSourceManager,
    splash: ruSplash,
    search: ruSearch,
    recentEdits: ruRecentEdits,
    settings: ruSettings,
    analytics: ruAnalytics,
    tools: ruTools,
    error: ruError,
    message: ruMessage,
    renderers: ruRenderers,
    update: ruUpdate,
    feedback: ruFeedback,
    session: ruSession,
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

    ns: ['common', 'components', 'messages', 'sourceManager', 'splash', 'search', 'recentEdits', 'settings', 'analytics', 'tools', 'error', 'message', 'renderers', 'update', 'feedback', 'session'],
    defaultNS: 'common',
  });

console.log('i18n initialized with 16 namespaces');
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