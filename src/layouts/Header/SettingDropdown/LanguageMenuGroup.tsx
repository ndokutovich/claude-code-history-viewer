import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { supportedLanguages, type SupportedLanguage } from "@/i18n.config";
import { useLanguageStore } from "@/store/useLanguageStore";
import { useTranslation } from "react-i18next";

export const LanguageMenuGroup = () => {
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation("common");

  return (
    <>
      <DropdownMenuLabel>{t("settings.language.title")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={language}
        onValueChange={(value) => setLanguage(value as SupportedLanguage)}
      >
        {supportedLanguages.map(({ code, label }) => (
          <DropdownMenuRadioItem key={code} value={code}>
            <span>{label}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
};
