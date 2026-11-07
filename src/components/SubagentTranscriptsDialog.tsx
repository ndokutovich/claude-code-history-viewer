/**
 * Sub-agent transcripts dialog (upstream #99b2ec7d groundwork).
 *
 * Lists the transcripts Claude Code keeps beside a session — flat agents and
 * dynamic Workflow agents — and renders a selected one inline, so workflow
 * runs are readable without leaving the app.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import { Bot, Loader2 } from "lucide-react";

export interface SubagentTranscript {
  agentId: string;
  path: string;
  kind: "flat" | "workflow";
  workflow?: string;
}

interface UniversalContentBlock {
  type?: string;
  data?: { text?: string };
}

interface UniversalMessageLike {
  id: string;
  role: string;
  timestamp: string;
  content: UniversalContentBlock[];
}

interface MessagePage {
  messages: UniversalMessageLike[];
  has_more: boolean;
}

interface SubagentTranscriptsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionFilePath: string;
}

const textOf = (message: UniversalMessageLike): string =>
  message.content
    .map((block) => block.data?.text ?? "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n");

export const SubagentTranscriptsDialog: React.FC<
  SubagentTranscriptsDialogProps
> = ({ open, onOpenChange, sessionFilePath }) => {
  const { t } = useTranslation("components");
  const [transcripts, setTranscripts] = useState<SubagentTranscript[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selected, setSelected] = useState<SubagentTranscript | null>(null);
  const [messages, setMessages] = useState<UniversalMessageLike[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoadingList(true);
    setError(null);
    setSelected(null);
    setMessages([]);

    invoke<SubagentTranscript[]>("list_subagent_transcripts", {
      sessionPath: sessionFilePath,
    })
      .then((found) => {
        if (!cancelled) setTranscripts(found);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionFilePath]);

  const openTranscript = useCallback(async (transcript: SubagentTranscript) => {
    setSelected(transcript);
    setIsLoadingMessages(true);
    setError(null);
    try {
      const page = await invoke<MessagePage>("load_subagent_messages", {
        transcriptPath: transcript.path,
        offset: 0,
        limit: 200,
      });
      setMessages(page.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t("subagents.title", "Sub-agent transcripts")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "subagents.description",
              "Agents Claude Code ran for this session, including dynamic workflows"
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoadingList ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("subagents.loading", "Loading transcripts…")}
          </div>
        ) : transcripts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("subagents.empty", "This session has no sub-agent transcripts")}
          </p>
        ) : (
          <div className="grid grid-cols-[220px_1fr] gap-3 min-h-[320px]">
            <div className="h-[360px] overflow-y-auto border border-border rounded-md">
              <ul className="p-1 space-y-0.5">
                {transcripts.map((transcript) => (
                  <li key={transcript.path}>
                    <button
                      type="button"
                      onClick={() => void openTranscript(transcript)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-1.5",
                        selected?.path === transcript.path
                          ? "bg-accent/15 text-accent"
                          : "hover:bg-muted"
                      )}
                      title={transcript.path}
                    >
                      <Bot className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{transcript.agentId}</span>
                      {transcript.kind === "workflow" && transcript.workflow && (
                        <span className="ml-auto text-[10px] px-1 rounded bg-muted text-muted-foreground">
                          {transcript.workflow}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="h-[360px] overflow-y-auto border border-border rounded-md">
              <div className="p-3 space-y-3">
                {isLoadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("subagents.loadingMessages", "Loading messages…")}
                  </div>
                ) : error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : !selected ? (
                  <p className="text-sm text-muted-foreground">
                    {t("subagents.pickOne", "Pick an agent to read its transcript")}
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("subagents.noMessages", "No displayable messages")}
                  </p>
                ) : (
                  messages.map((message) => {
                    const text = textOf(message);
                    if (!text) return null;
                    return (
                      <div key={message.id} className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {message.role} · {message.timestamp}
                        </div>
                        <pre className="whitespace-pre-wrap break-words text-xs bg-muted/50 rounded p-2">
                          {text}
                        </pre>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
