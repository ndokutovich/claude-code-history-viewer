import type { Theme } from "@/contexts/theme/context";
import { load, type StoreOptions } from "@tauri-apps/plugin-store";

export const saveThemeToTauriStore = async (theme: Theme) => {
  try {
    const store = await load("settings.json", { autoSave: false } as StoreOptions);
    await store.set("theme", theme);
    await store.save();
  } catch (error) {
    console.error("Failed to save theme:", error);
  }
};

export const loadThemeFromTauriStore = async () => {
  try {
    const store = await load("settings.json", { autoSave: false } as StoreOptions);
    return (await store.get("theme")) as Theme | null;
  } catch (error) {
    console.error("Failed to load theme:", error);
    throw error;
  }
};
