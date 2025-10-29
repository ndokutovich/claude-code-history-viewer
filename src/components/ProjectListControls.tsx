import { Settings2, SortAsc, SortDesc, Group, Ungroup, Eye, EyeOff, ChevronsDown, ChevronsUp, MessageCircle, RefreshCw, Search, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "./ui/dropdown-menu";

interface ProjectListControlsProps {
  isLoadingSearch?: boolean;
}

export const ProjectListControls: React.FC<ProjectListControlsProps> = ({ isLoadingSearch = false }) => {
  const { t } = useTranslation("components");
  const {
    projectListPreferences,
    setProjectListPreferences,
    initializeApp,
    selectedProject,
    selectedSession,
    selectProject,
    selectSession,
  } = useAppStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    if (isRefreshing) return; // Prevent multiple refreshes

    setIsRefreshing(true);
    const loadingToast = toast.loading(t("projectListControls.refreshing", "Refreshing..."));

    try {
      // Save current state before refresh
      const savedProject = selectedProject;
      const savedSession = selectedSession;

      // Get currently expanded projects from localStorage or event
      const expandedProjects = new Set<string>();
      try {
        const stored = localStorage.getItem('expandedProjects');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.forEach((path: string) => expandedProjects.add(path));
        }
      } catch (e) {
        console.error('Failed to load expanded projects:', e);
      }

      // Re-initialize the app to refresh sources and projects
      await initializeApp();

      // Restore expanded projects after a short delay
      if (expandedProjects.size > 0) {
        setTimeout(() => {
          expandedProjects.forEach(path => {
            window.dispatchEvent(new CustomEvent('expandProject', { detail: { path } }));
          });
        }, 100);
      }

      // Restore selected project and session
      if (savedProject) {
        await selectProject(savedProject);
        if (savedSession) {
          await selectSession(savedSession);
        }
      }

      toast.success(t("projectListControls.refreshed", "Refreshed successfully"), {
        id: loadingToast,
      });
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error(t("projectListControls.refreshFailed", "Refresh failed"), {
        id: loadingToast,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      {/* Toolbar row */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-2">
        {/* Refresh All Sessions */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          className="text-xs"
          title={t("projectListControls.refreshAll", "Refresh all sessions")}
          aria-label={t("projectListControls.refreshAll", "Refresh all sessions")}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
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
          aria-label={t(`projectListControls.groupBy.${projectListPreferences.groupBy}`)}
        >
          {projectListPreferences.groupBy === "source" ? (
            <Group className="w-4 h-4" />
          ) : projectListPreferences.groupBy === "none" ? (
            <Ungroup className="w-4 h-4" />
          ) : (
            <MessageCircle className="w-4 h-4" />
          )}
        </Button>

        {/* Expand All (hidden in flat sessions mode) */}
        {projectListPreferences.groupBy !== 'sessions' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.dispatchEvent(new Event('expandAllProjects'));
            }}
            className="text-xs"
            title={t("projectListControls.expandAll")}
            aria-label={t("projectListControls.expandAll")}
          >
            <ChevronsDown className="w-4 h-4" />
          </Button>
        )}

        {/* Collapse All (hidden in flat sessions mode) */}
        {projectListPreferences.groupBy !== 'sessions' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.dispatchEvent(new Event('collapseAllProjects'));
            }}
            className="text-xs"
            title={t("projectListControls.collapseAll")}
            aria-label={t("projectListControls.collapseAll")}
          >
            <ChevronsUp className="w-4 h-4" />
          </Button>
        )}

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
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            aria-label={t("projectListControls.filterSettings")}
          >
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
              setProjectListPreferences({ hideEmptyProjects: checked });
            }}
          >
            {t("projectListControls.hideEmptyProjects")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={projectListPreferences.hideEmptySessions}
            onCheckedChange={(checked) => {
              setProjectListPreferences({ hideEmptySessions: checked });
            }}
          >
            {t("projectListControls.hideEmptySessions")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={projectListPreferences.hideAgentSessions}
            onCheckedChange={(checked) => {
              setProjectListPreferences({ hideAgentSessions: checked });
            }}
          >
            {t("projectListControls.hideAgentSessions")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              setProjectListPreferences({
                hideEmptyProjects: false,
                hideEmptySessions: false,
                hideAgentSessions: false,
              })
            }
          >
            {t("projectListControls.showAll")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>

      {/* Search row */}
      <div className="px-4 pb-2">
        <div className="relative">
          {isLoadingSearch ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          )}
          <Input
            type="text"
            placeholder={t("projectListControls.searchPlaceholder", "Search sessions...")}
            value={projectListPreferences.sessionSearchQuery}
            onChange={(e) => setProjectListPreferences({ sessionSearchQuery: e.target.value })}
            className="pl-9 pr-9 h-8 text-sm bg-white dark:bg-gray-900"
            disabled={isLoadingSearch}
          />
          {projectListPreferences.sessionSearchQuery && !isLoadingSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProjectListPreferences({ sessionSearchQuery: '' })}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              aria-label={t("projectListControls.clearSearch", "Clear search")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
