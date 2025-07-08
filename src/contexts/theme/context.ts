import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";
type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  initializeTheme: () => Promise<void>;
  isDarkMode: boolean;
};

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return value;
}
