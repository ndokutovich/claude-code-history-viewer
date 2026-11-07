/**
 * Extra CLI arguments for session resume (upstream #595).
 *
 * The value is split into tokens and sanitised before it ever reaches a
 * resume command — see `parseResumeExtraArgs` in utils/providers.ts, which
 * mirrors the backend validator.
 */
import { DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { useTranslation } from "react-i18next";
import { parseResumeExtraArgs } from "@/utils/providers";

export const ResumeArgsMenuGroup = () => {
  const { t } = useTranslation("common");
  const { resumeExtraArgs, setResumeExtraArgs } = useAppStore();

  const parsed = parseResumeExtraArgs(resumeExtraArgs);
  const droppedSomething =
    resumeExtraArgs.trim().length > 0 && parsed.length === 0;

  return (
    <>
      <DropdownMenuLabel>
        {t("common.settings.resumeArgs.title", {
          defaultValue: "Resume CLI arguments",
        })}
      </DropdownMenuLabel>
      <div className="px-2 pb-2 space-y-1">
        <input
          type="text"
          value={resumeExtraArgs}
          onChange={(event) => setResumeExtraArgs(event.target.value)}
          placeholder="--dangerously-skip-permissions"
          spellCheck={false}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-mono"
          aria-label={t("common.settings.resumeArgs.title", {
            defaultValue: "Resume CLI arguments",
          })}
        />
        <p className="text-[11px] text-muted-foreground">
          {droppedSomething
            ? t("common.settings.resumeArgs.invalid", {
                defaultValue: "Only flags like --fast or --model=sonnet are kept",
              })
            : t("common.settings.resumeArgs.hint", {
                defaultValue: "Appended to the resume command",
              })}
        </p>
      </div>
    </>
  );
};
