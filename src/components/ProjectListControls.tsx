import { Settings2, SortAsc, SortDesc, Group, Ungroup, Eye, EyeOff } from "lucide-react";
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
        {/* Group/Ungroup */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setProjectListPreferences({
              groupBy: projectListPreferences.groupBy === "source" ? "none" : "source",
            })
          }
          className="text-xs"
        >
          {projectListPreferences.groupBy === "source" ? (
            <Ungroup className="w-4 h-4 mr-1" />
          ) : (
            <Group className="w-4 h-4 mr-1" />
          )}
          {projectListPreferences.groupBy === "source"
            ? t("projectListControls.ungroup")
            : t("projectListControls.groupBySource")}
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
