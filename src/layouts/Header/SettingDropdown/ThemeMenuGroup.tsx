import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

import { Sun, Moon, Laptop } from "lucide-react";

import { cn } from "@/utils/cn";
import { useTheme } from "@/contexts/theme";
import { COLORS } from "@/constants/colors";

export const ThemeMenuGroup = () => {
  const { theme, setTheme } = useTheme();

  const { t } = useTranslation("common");

  const themeItems = [
    {
      icon: <Sun className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)} />,
      label: t("settings.theme.light"),
      value: "light",
    },
    {
      icon: <Moon className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)} />,
      label: t("settings.theme.dark"),
      value: "dark",
    },
    {
      icon: <Laptop className={cn("mr-2 h-4 w-4", COLORS.ui.text.primary)} />,
      label: t("settings.theme.system"),
      value: "system",
    },
  ];

  return (
    <>
      <DropdownMenuLabel>{t("settings.theme.title")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) => {
          if (value === "light" || value === "dark" || value === "system") {
            setTheme(value);
          }
        }}
      >
        {themeItems.map(({ icon, label, value }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            {icon}
            <span>{label}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};
