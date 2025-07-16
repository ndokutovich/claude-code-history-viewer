import type { ModalType } from "@/hooks/useModals";
import type { TFunction } from "i18next";
import { MessageSquare, Folder, type LucideIcon } from "lucide-react";

export interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  action?: ModalType;
  onClick?: () => void;
}

export interface MenuSection {
  id: string;
  items: MenuItem[];
  separator?: boolean;
}
export const getMenuItems = (
  t: TFunction<"common" | "components">
): MenuItem[] => [
  {
    id: "folder",
    icon: Folder,
    label: t("settings.changeFolder"),
    action: "folderSelector",
  },
  {
    id: "feedback",
    icon: MessageSquare,
    label: t("feedback.title"),
    action: "feedback",
  },
];
