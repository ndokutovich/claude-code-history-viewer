"use client";

import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { useTranslation } from "react-i18next";
import { Search, X, Filter } from "lucide-react";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";

export const FileActivityFilters = () => {
  const { t } = useTranslation("components");
  const { fileActivityFilters, setFileActivityFilters, selectedProject, loadFileActivities } = useAppStore();

  const [searchQuery, setSearchQuery] = useState(fileActivityFilters.searchQuery || "");
  const [selectedOperations, setSelectedOperations] = useState<string[]>(
    fileActivityFilters.operations || []
  );
  const [selectedExtensions, setSelectedExtensions] = useState<string[]>(
    fileActivityFilters.fileExtensions || []
  );

  const operations = ["read", "write", "edit", "delete", "create", "glob", "multiedit"];
  const commonExtensions = ["ts", "tsx", "js", "jsx", "py", "rs", "json", "md", "css", "html"];

  const applyFilters = () => {
    const filters = {
      searchQuery: searchQuery || undefined,
      operations: selectedOperations.length > 0 ? selectedOperations : undefined,
      fileExtensions: selectedExtensions.length > 0 ? selectedExtensions : undefined,
    };

    setFileActivityFilters(filters);

    if (selectedProject) {
      loadFileActivities(selectedProject.path, filters);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedOperations([]);
    setSelectedExtensions([]);
    setFileActivityFilters({});

    if (selectedProject) {
      loadFileActivities(selectedProject.path, {});
    }
  };

  const toggleOperation = (op: string) => {
    setSelectedOperations(prev =>
      prev.includes(op) ? prev.filter(o => o !== op) : [...prev, op]
    );
  };

  const toggleExtension = (ext: string) => {
    setSelectedExtensions(prev =>
      prev.includes(ext) ? prev.filter(e => e !== ext) : [...prev, ext]
    );
  };

  const hasActiveFilters = searchQuery || selectedOperations.length > 0 || selectedExtensions.length > 0;

  return (
    <div className={cn("px-4 py-3 border-b", COLORS.ui.border.light, COLORS.ui.background.primary)}>
      {/* Search Bar */}
      <div className="flex items-center space-x-2 mb-3">
        <div className="flex-1 relative">
          <Search className={cn("absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4", COLORS.ui.text.muted)} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder={t("filesView.filters.searchPlaceholder")}
            className={cn(
              "w-full pl-10 pr-4 py-2 rounded-lg border text-sm",
              COLORS.ui.border.medium,
              COLORS.ui.background.primary,
              COLORS.ui.text.primary,
              "focus:outline-none focus:ring-2 focus:ring-blue-500"
            )}
          />
        </div>
        <button
          onClick={applyFilters}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            COLORS.semantic.info.bg,
            COLORS.semantic.info.text,
            "hover:opacity-90"
          )}
        >
          <Filter className="w-4 h-4" />
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              COLORS.ui.background.secondary,
              COLORS.ui.text.secondary,
              "hover:bg-gray-200 dark:hover:bg-gray-700"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Operation Filters */}
      <div className="mb-3">
        <label className={cn("text-xs font-medium mb-2 block", COLORS.ui.text.tertiary)}>
          {t("filesView.filters.operations")}
        </label>
        <div className="flex flex-wrap gap-2">
          {operations.map((op) => (
            <button
              key={op}
              onClick={() => toggleOperation(op)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                selectedOperations.includes(op)
                  ? cn(COLORS.semantic.info.bg, COLORS.semantic.info.text)
                  : cn(COLORS.ui.background.secondary, COLORS.ui.text.secondary, "hover:bg-gray-200 dark:hover:bg-gray-700")
              )}
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      {/* Extension Filters */}
      <div>
        <label className={cn("text-xs font-medium mb-2 block", COLORS.ui.text.tertiary)}>
          {t("filesView.filters.extensions")}
        </label>
        <div className="flex flex-wrap gap-2">
          {commonExtensions.map((ext) => (
            <button
              key={ext}
              onClick={() => toggleExtension(ext)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                selectedExtensions.includes(ext)
                  ? cn(COLORS.tools.code.bg, COLORS.tools.code.text)
                  : cn(COLORS.ui.background.secondary, COLORS.ui.text.secondary, "hover:bg-gray-200 dark:hover:bg-gray-700")
              )}
            >
              .{ext}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
