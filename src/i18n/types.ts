import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof import('./locales/en/common.json');
      components: typeof import('./locales/en/components.json');
      messages: typeof import('./locales/en/messages.json');
    };
  }
}