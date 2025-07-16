import { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeContext, type Theme } from "@/contexts/theme/context";
import { loadThemeFromTauriStore, saveThemeToTauriStore } from "./utils";

const initialState = {
  theme: "system" as Theme,
};

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(initialState.theme);

  const handleSetTheme = useCallback(async (theme: Theme) => {
    setTheme(theme);
    await saveThemeToTauriStore(theme);
  }, []);

  const initializeTheme = useCallback(async () => {
    const theme = await loadThemeFromTauriStore();
    if (theme) {
      setTheme(theme);
    }
  }, []);

  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (theme === "system") {
      // Check system preference
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mediaQuery.matches);

      // Listen for system theme changes
      const handleChange = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      applyTheme(theme === "dark");
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: handleSetTheme,
      initializeTheme,
      isDarkMode,
    }),
    [isDarkMode, theme, initializeTheme, handleSetTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
