import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enComponents from './locales/en/components.json';
import enMessages from './locales/en/messages.json';

import koCommon from './locales/ko/common.json';
import koComponents from './locales/ko/components.json';
import koMessages from './locales/ko/messages.json';

import jaCommon from './locales/ja/common.json';
import jaComponents from './locales/ja/components.json';
import jaMessages from './locales/ja/messages.json';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNComponents from './locales/zh-CN/components.json';
import zhCNMessages from './locales/zh-CN/messages.json';

import zhTWCommon from './locales/zh-TW/common.json';
import zhTWComponents from './locales/zh-TW/components.json';
import zhTWMessages from './locales/zh-TW/messages.json';

export const supportedLanguages = {
  en: 'English',
  ko: '한국어',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
} as const;

export type SupportedLanguage = keyof typeof supportedLanguages;

export const languageLocaleMap: Record<string, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'zh-HK': 'zh-HK',
  'zh-MO': 'zh-MO',
};

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
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'components', 'messages'],

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'], // localStorage에 저장
    },
  });

export default i18n;
