import { load } from '@tauri-apps/plugin-store';

export const tauriDetector = {
  name: 'tauri-store',
  
  lookup: async (): Promise<string | null> => {
    try {
      const store = await load('settings.json', { autoSave: false });
      return await store.get<string>('language') || null;
    } catch {
      return null;
    }
  },
  
  cacheUserLanguage: async (lng: string) => {
    try {
      const store = await load('settings.json', { autoSave: false });
      await store.set('language', lng);
      await store.save();
    } catch (error) {
      console.error('Failed to cache language:', error);
    }
  }
};