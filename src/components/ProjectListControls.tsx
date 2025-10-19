import { Settings2, SortAsc, SortDesc, Group, Ungroup, Eye, EyeOff, ChevronsDown, ChevronsUp, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "./ui/dropdown-menu";

export const ProjectListControls = () => {
  const { t } = useTranslation("components");
  const { projectListPreferences, setProjectListPreferences } = useAppStore();

  console.log('🎛️ ProjectListControls render:', projectListPreferences);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center space-x-2">
        {/* Group/Ungroup - Cycles through: source → none → sessions → source */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next =
              projectListPreferences.groupBy === "source"
                ? "none"
                : projectListPreferences.groupBy === "none"
                ? "sessions"
                : "source";
            setProjectListPreferences({ groupBy: next });
          }}
          className="text-xs"
          title={t(`projectListControls.groupBy.${projectListPreferences.groupBy}`)}
        >
          {projectListPreferences.groupBy === "source" ? (
            <Group className="w-4 h-4 mr-1" />
          ) : projectListPreferences.groupBy === "none" ? (
            <Ungroup className="w-4 h-4 mr-1" />
          ) : (
            <MessageCircle className="w-4 h-4 mr-1" />
          )}
          {t(`projectListControls.groupBy.${projectListPreferences.groupBy}`)}
        </Button>

        {/* Expand All */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.dispatchEvent(new Event('expandAllProjects'));
          }}
          className="text-xs"
          title={t("projectListControls.expandAll")}
        >
          <ChevronsDown className="w-4 h-4" />
        </Button>

        {/* Collapse All */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            window.dispatchEvent(new Event('collapseAllProjects'));
          }}
          className="text-xs"
          title={t("projectListControls.collapseAll")}
        >
          <ChevronsUp className="w-4 h-4" />
        </Button>

        {/* Sort Controls Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              {projectListPreferences.sortOrder === "asc" ? (
                <SortAsc className="w-4 h-4 mr-1" />
              ) : (
                <SortDesc className="w-4 h-4 mr-1" />
              )}
              {t(`projectListControls.sortBy.${projectListPreferences.sortBy}`)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => setProjectListPreferences({ sortBy: "name" })}
            >
              {t("projectListControls.sortBy.name")}
              {projectListPreferences.sortBy === "name" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setProjectListPreferences({ sortBy: "date" })}
            >
              {t("projectListControls.sortBy.date")}
              {projectListPreferences.sortBy === "date" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setProjectListPreferences({ sortOrder: "asc" })}
            >
              {t("projectListControls.sortOrder.asc")}
              {projectListPreferences.sortOrder === "asc" && " ✓"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setProjectListPreferences({ sortOrder: "desc" })}
            >
              {t("projectListControls.sortOrder.desc")}
              {projectListPreferences.sortOrder === "desc" && " ✓"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            {projectListPreferences.hideEmptyProjects ||
            projectListPreferences.hideEmptySessions ? (
              <EyeOff className="w-4 h-4 mr-1" />
            ) : (
              <Eye className="w-4 h-4 mr-1" />
            )}
            <Settings2 className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuCheckboxItem
            checked={projectListPreferences.hideEmptyProjects}
            onCheckedChange={(checked) => {
              console.log('✅ Hide Empty Projects clicked:', checked);
              setProjectListPreferences({ hideEmptyProjects: checked });
            }}
          >
            {t("projectListControls.hideEmptyProjects")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={projectListPreferences.hideEmptySessions}
            onCheckedChange={(checked) => {
              console.log('✅ Hide Empty Sessions clicked:', checked);
              setProjectListPreferences({ hideEmptySessions: checked });
            }}
          >
            {t("projectListControls.hideEmptySessions")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              setProjectListPreferences({
                hideEmptyProjects: false,
                hideEmptySessions: false,
              })
            }
          >
            {t("projectListControls.showAll")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
