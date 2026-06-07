import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/store/useAppStore";
import type { ResolvedSessionMatch } from "@/store/slices/sessionPickerSlice";
import { navigateToResolvedSession } from "@/lib/preloadSession";
import { cn } from "@/utils/cn";

/**
 * Disambiguation modal for the CLI session-launch feature. Opened by
 * `preloadSessionFromHint` when a `--session <uuid-prefix>` value matches more
 * than one session. The user picks one (or dismisses, which emits a toast so
 * the no-op is visible).
 */
export const SessionPickerModal = () => {
  const { t } = useTranslation("session");
  const candidates = useAppStore((s) => s.sessionPickerCandidates);
  const hintValue = useAppStore((s) => s.sessionPickerHintValue);
  const closeSessionPicker = useAppStore((s) => s.closeSessionPicker);

  const isOpen = candidates !== null && candidates.length > 0;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) setSelectedIndex(0);
  }, [isOpen, candidates]);

  const handleSelect = useCallback(
    async (candidate: ResolvedSessionMatch) => {
      closeSessionPicker();
      const {
        projects,
        loadProjectSessions,
        selectProject,
        selectSession,
      } = useAppStore.getState();
      const ok = await navigateToResolvedSession(candidate, {
        getProjects: () => projects,
        loadProjectSessions,
        selectProject,
        selectSession,
      });
      if (!ok) {
        toast.error(
          t("cli.notFound", "Session not found: {{value}}", {
            value: candidate.sessionId,
          })
        );
      }
    },
    [closeSessionPicker, t]
  );

  const handleDismiss = useCallback(() => {
    closeSessionPicker();
    toast(t("cli.picker.cancelled", "Session selection cancelled"));
  }, [closeSessionPicker, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!candidates || candidates.length === 0) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i < candidates.length - 1 ? i + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i > 0 ? i - 1 : candidates.length - 1));
          break;
        case "Enter": {
          e.preventDefault();
          const picked = candidates[selectedIndex];
          if (picked) void handleSelect(picked);
          break;
        }
      }
    },
    [candidates, selectedIndex, handleSelect]
  );

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen || !candidates) return null;

  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp) return "";
    try {
      return new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) handleDismiss();
      }}
    >
      <DialogContent
        className="sm:max-w-2xl p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
        aria-label={t("cli.picker.title", "Choose a session")}
      >
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle>{t("cli.picker.title", "Choose a session")}</DialogTitle>
          <DialogDescription>
            {t("cli.picker.subtitle", {
              defaultValue: '{{count}} sessions match "{{value}}"',
              count: candidates.length,
              value: hintValue ?? "",
            })}
          </DialogDescription>
        </DialogHeader>

        <ul
          ref={listRef}
          role="listbox"
          aria-label={t("cli.picker.title", "Choose a session")}
          className="max-h-100 overflow-y-auto py-2"
        >
          {candidates.map((candidate, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li key={`${candidate.sourceId}:${candidate.sessionId}`}>
                <button
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => void handleSelect(candidate)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors",
                    isSelected && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-500">
                      {candidate.providerId}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {candidate.projectName}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">
                      {formatTimestamp(candidate.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2">
                    {candidate.title || candidate.sessionId}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    {t("cli.picker.messageCount", {
                      defaultValue: "{{count}} messages",
                      count: candidate.messageCount,
                    })}
                    {" • "}
                    <span className="font-mono">
                      {candidate.sessionId.slice(0, 8)}
                    </span>
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
};
