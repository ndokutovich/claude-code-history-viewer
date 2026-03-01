/**
 * RecentEditsViewer Types
 */

import type { PaginatedRecentEdits, RecentFileEdit } from "@/types";

export interface RecentEditsPagination {
  hasMore: boolean;
  isLoadingMore: boolean;
  uniqueFilesCount: number;
  totalEditsCount: number;
  limit: number;
}

export interface RecentEditsViewerProps {
  recentEdits: PaginatedRecentEdits | null;
  pagination?: RecentEditsPagination;
  onLoadMore?: () => void;
  isLoading?: boolean;
  error?: string | null;
  initialSearchQuery?: string;
}

export interface FileEditItemProps {
  edit: RecentFileEdit;
  isDarkMode: boolean;
}

export type RestoreStatus = "idle" | "loading" | "success" | "error";
