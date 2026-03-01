/**
 * RecentEditsViewer Component
 *
 * Displays a list of recent file edits with search and filtering.
 * Supports real backend pagination.
 */

import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FileEdit, Search, File, ChevronDown, Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/theme";
import type { RecentEditsViewerProps } from "./types";
import { FileEditItem } from "./FileEditItem";

export const RecentEditsViewer: React.FC<RecentEditsViewerProps> = ({
  recentEdits,
  pagination,
  onLoadMore,
  isLoading = false,
  error = null,
  initialSearchQuery = "",
}) => {
  const { t } = useTranslation("recentEdits");
  const { t: tCommon } = useTranslation("common");
  const { isDarkMode } = useTheme();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);

  // Sync internal state when external prop changes (e.g. navigation from Board)
  React.useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  // Handle "Show More" click - calls backend via onLoadMore
  const handleShowMore = useCallback(() => {
    if (onLoadMore && pagination?.hasMore && !pagination?.isLoadingMore) {
      onLoadMore();
    }
  }, [onLoadMore, pagination?.hasMore, pagination?.isLoadingMore]);

  // Filter files by search query (client-side filtering on loaded data)
  const filteredFiles = useMemo(() => {
    if (!recentEdits?.files) return [];
    if (!searchQuery.trim()) return recentEdits.files;

    const query = searchQuery.toLowerCase();
    return recentEdits.files.filter(
      (file) =>
        file.file_path.toLowerCase().includes(query) ||
        file.content_after_change.toLowerCase().includes(query)
    );
  }, [recentEdits?.files, searchQuery]);

  // Calculate stats based on pagination or filtered results
  const stats = useMemo(() => {
    return {
      uniqueFilesCount: pagination?.uniqueFilesCount ?? recentEdits?.unique_files_count ?? 0,
      totalEditsCount: pagination?.totalEditsCount ?? recentEdits?.total_edits_count ?? 0,
    };
  }, [pagination, recentEdits]);

  // Pagination state from props
  const hasMoreFiles = searchQuery.trim() ? false : (pagination?.hasMore ?? false);
  const isLoadingMore = pagination?.isLoadingMore ?? false;
  const totalUniqueFiles = pagination?.uniqueFilesCount ?? recentEdits?.unique_files_count ?? 0;
  const remainingCount = totalUniqueFiles - (recentEdits?.files?.length ?? 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!recentEdits || recentEdits.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <File className="w-12 h-12 mb-4 text-muted-foreground/50" />
        <p className="text-lg mb-2 text-muted-foreground">{t("noEdits")}</p>
        <p className="text-sm text-muted-foreground">{t("noEditsDescription")}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header with stats */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
              <span title={t("title")}><FileEdit className="w-5 h-5 text-accent" /></span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                {t("title")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t("stats", {
                  files: stats.uniqueFilesCount,
                  edits: stats.totalEditsCount,
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground font-mono">
              {recentEdits?.files?.length ?? 0} / {totalUniqueFiles}
            </span>
            <div className="flex items-center gap-2 text-xs text-accent bg-accent/10 px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="font-medium">{t("editsCount", { count: stats.totalEditsCount })}</span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
            <span title={tCommon("search.title")}><Search className="w-4 h-4 text-muted-foreground" /></span>
          </div>
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-4 py-3 rounded-xl border-2 text-sm border-border bg-card text-foreground focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all duration-300"
          />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto space-y-3">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">{t("noSearchResults")}</p>
          </div>
        ) : (
          <>
            {filteredFiles.map((edit, index) => (
              <FileEditItem key={`${edit.file_path}-${index}`} edit={edit} isDarkMode={isDarkMode} />
            ))}

            {/* Show More Button */}
            {hasMoreFiles && (
              <button
                type="button"
                onClick={handleShowMore}
                disabled={isLoadingMore}
                aria-label={t("showMore", {
                  count: Math.min(pagination?.limit ?? 20, remainingCount),
                })}
                className="w-full py-4 rounded-xl text-[13px] font-medium bg-muted/30 hover:bg-muted/50 border border-border/50 hover:border-border text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  <>
                    <span title={t("showMore", { count: Math.min(pagination?.limit ?? 20, remainingCount) })}><ChevronDown className="w-4 h-4" /></span>
                    {t("showMore", {
                      count: Math.min(pagination?.limit ?? 20, remainingCount),
                    })}
                    <span className="text-muted-foreground/70">
                      ({remainingCount} {t("remaining")})
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer info */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-1 h-1 rounded-full bg-accent/50" />
          {t("footerInfo")}
        </div>
      </div>
    </div>
  );
};

RecentEditsViewer.displayName = "RecentEditsViewer";
