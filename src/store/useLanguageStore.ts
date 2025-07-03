import { create } from 'zustand';
import { load } from '@tauri-apps/plugin-store';
import { locale } from '@tauri-apps/plugin-os';
import i18n from '../i18n';
import type { SupportedLanguage } from '../i18n';

interface LanguageStore {
  language: SupportedLanguage;
  isLoading: boolean;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  loadLanguage: () => Promise<void>;
}

// 현재 언어 감지 헬퍼 함수
const getCurrentLanguage = (): SupportedLanguage => {
  // 1. localStorage 확인
  const storedLang = localStorage.getItem('i18nextLng');
  if (storedLang) {
    if (storedLang.startsWith('zh')) {
      return storedLang.includes('TW') || storedLang.includes('HK') ? 'zh-TW' : 'zh-CN';
    }
    const primary = storedLang.split('-')[0];
    if (['en', 'ko', 'ja'].includes(primary)) {
      return primary as SupportedLanguage;
    }
  }
  
  // 2. i18n 현재 언어 확인
  const lang = i18n.language;
  if (!lang) return 'en';
  
  // 중국어의 경우 전체 코드 사용
  if (lang.startsWith('zh')) {
    return lang.includes('TW') || lang.includes('HK') ? 'zh-TW' : 'zh-CN';
  }
  
  // 다른 언어는 첫 부분만 사용
  const primary = lang.split('-')[0];
  return ['en', 'ko', 'ja'].includes(primary) ? primary as SupportedLanguage : 'en';
};

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  language: getCurrentLanguage(),
  isLoading: true,
  
  setLanguage: async (language) => {
    try {
      // i18n 언어 변경 (이것이 localStorage를 자동으로 업데이트함)
      await i18n.changeLanguage(language);
      
      // 상태 업데이트
      set({ language });
      
      // Tauri Store에도 저장 (데스크톱 앱용)
      try {
        const store = await load('settings.json', { autoSave: true });
        await store.set('language', language);
        await store.save();
      } catch (e) {
        // Tauri Store가 없어도 계속 진행 (웹에서 실행 시)
        console.log('Tauri Store not available:', e);
      }
    } catch (error) {
      console.error('Failed to set language:', error);
    }
  },
  
  loadLanguage: async () => {
    try {
      set({ isLoading: true });
      
      // 1. localStorage에서 i18next가 저장한 언어 확인
      const i18nextLang = localStorage.getItem('i18nextLng');
      if (i18nextLang) {
        const lang = i18nextLang.startsWith('zh') 
          ? (i18nextLang.includes('TW') || i18nextLang.includes('HK') ? 'zh-TW' : 'zh-CN')
          : i18nextLang.split('-')[0];
        
        if (['en', 'ko', 'ja', 'zh-CN', 'zh-TW'].includes(lang)) {
          set({ language: lang as SupportedLanguage });
          return;
        }
      }
      
      // 2. Tauri Store에서 언어 설정 로드 (localStorage에 없을 때)
      let savedLanguage: SupportedLanguage | null = null;
      try {
        const store = await load('settings.json', { autoSave: true });
        savedLanguage = await store.get<SupportedLanguage>('language');
      } catch (e) {
        console.log('Tauri Store not available:', e);
      }
      
      if (savedLanguage) {
        await i18n.changeLanguage(savedLanguage);
        set({ language: savedLanguage });
      } else {
        // 저장된 언어가 없으면 자동 감지
        let detectedLanguage: SupportedLanguage = 'en';
        
        // 1. 브라우저/시스템 언어 감지
        const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
        const primaryLang = browserLang.split('-')[0].toLowerCase();
        
        // 2. 중국어의 경우 지역 코드도 확인
        if (primaryLang === 'zh') {
          const region = browserLang.split('-')[1]?.toUpperCase();
          if (region === 'TW' || region === 'HK' || region === 'MO') {
            detectedLanguage = 'zh-TW';
          } else {
            detectedLanguage = 'zh-CN';
          }
        } else if (['en', 'ko', 'ja'].includes(primaryLang)) {
          detectedLanguage = primaryLang as SupportedLanguage;
        }
        
        // 3. 시스템 로케일 기반 추가 확인 (Tauri 환경)
        try {
          const systemLocale = await locale();
          if (systemLocale) {
            const localePrimary = systemLocale.split('-')[0].toLowerCase();
            if (localePrimary === 'zh') {
              const localeRegion = systemLocale.split('-')[1]?.toUpperCase();
              if (localeRegion === 'TW' || localeRegion === 'HK') {
                detectedLanguage = 'zh-TW';
              } else {
                detectedLanguage = 'zh-CN';
              }
            } else if (['en', 'ko', 'ja'].includes(localePrimary)) {
              detectedLanguage = localePrimary as SupportedLanguage;
            }
          }
        } catch (error) {
          console.log('Failed to get system locale:', error);
        }
        
        // 감지된 언어 설정
        console.log('Auto-detected language:', detectedLanguage);
        console.log('Navigator language:', navigator.language);
        console.log('System locale:', await locale().catch(() => 'N/A'));
        await get().setLanguage(detectedLanguage);
      }
    } catch (error) {
      console.error('Failed to load language:', error);
      set({ language: 'en' });
    } finally {
      set({ isLoading: false });
    }
  },
}));