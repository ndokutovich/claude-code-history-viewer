/**
 * Layout switches (upstream #4bc63da2).
 *
 * The sessions column is off by default: the tree already nests sessions, and
 * the extra pane is for keeping one project open all day.
 */
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "react-i18next";

export const ViewLayoutMenuGroup = () => {
  const { t } = useTranslation("common");
  const showSessionsColumn = useAppStore(
    (s) => s.viewPreferences.showSessionsColumn === true
  );
  const setViewPreferences = useAppStore((s) => s.setViewPreferences);

  return (
    <>
      <DropdownMenuLabel>
        {t("settings.layout.title", { defaultValue: "Layout" })}
      </DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        checked={showSessionsColumn}
        onCheckedChange={(checked) =>
          setViewPreferences({ showSessionsColumn: checked === true })
        }
      >
        {t("settings.layout.sessionsColumn", {
          defaultValue: "Show sessions column",
        })}
      </DropdownMenuCheckboxItem>
    </>
  );
};
