import { RefreshCw } from "lucide-react";
import { EnhancedDiffViewer } from "../EnhancedDiffViewer";
import { FileContent } from "../FileContent";
import { cn } from "../../utils/cn";
import { COLORS } from "../../constants/colors";

type Props = {
  toolResult: Record<string, unknown>;
};

export const StructuredPatchRenderer = ({ toolResult }: Props) => {
  const filePath =
    typeof toolResult.filePath === "string" ? toolResult.filePath : "";
  const content =
    typeof toolResult.content === "string" ? toolResult.content : "";
  const patches = Array.isArray(toolResult.structuredPatch)
    ? toolResult.structuredPatch
    : [];

  // Reconstruct old and new content from patches
  const reconstructDiff = () => {
    if (patches.length === 0) return { oldStr: "", newStr: "" };

    const oldLines: string[] = [];
    const newLines: string[] = [];

    patches.forEach((patch: Record<string, unknown>) => {
      if (Array.isArray(patch.lines)) {
        patch.lines.forEach((line: unknown) => {
          if (typeof line === "string") {
            if (line.startsWith("-")) {
              oldLines.push(line.substring(1));
            } else if (line.startsWith("+")) {
              newLines.push(line.substring(1));
            } else {
              // Context line (no prefix or space prefix)
              const contextLine = line.startsWith(" ")
                ? line.substring(1)
                : line;
              oldLines.push(contextLine);
              newLines.push(contextLine);
            }
          }
        });
      }
    });

    return {
      oldStr: oldLines.join("\n"),
      newStr: newLines.join("\n"),
    };
  };

  const { oldStr, newStr } = reconstructDiff();

  return (
    <div
      className={cn(
        "mt-2 p-3 rounded-lg",
        COLORS.tools.task.bg,
        COLORS.tools.task.border
      )}
    >
      <div className="flex items-center space-x-2 mb-2">
        <RefreshCw className={cn("w-4 h-4", COLORS.tools.task.icon)} />
        <span className={cn("font-medium", COLORS.tools.task.text)}>
          파일 변경 사항 (Patch)
        </span>
      </div>

      {/* 파일 정보 */}
      <div className="mb-3">
        <div
          className={cn("text-xs font-medium mb-1", COLORS.ui.text.tertiary)}
        >
          파일 경로:
        </div>
        <code
          className={cn(
            "text-sm block",
            COLORS.message.assistant.bg,
            COLORS.message.assistant.text
          )}
        >
          {filePath}
        </code>
      </div>

      {/* 변경 통계 */}
      {patches.length > 0 && (
        <div className="mb-3">
          <div
            className={cn("text-xs font-medium mb-1", COLORS.ui.text.tertiary)}
          >
            변경 통계:
          </div>
          <div
            className={cn(
              "p-2 rounded border text-xs",
              COLORS.ui.background.primary,
              COLORS.ui.border.medium
            )}
          >
            <span className={cn("font-medium", COLORS.tools.task.icon)}>
              {patches.length}개 영역
            </span>
            에서 변경사항 발견
          </div>
        </div>
      )}

      {/* Diff Viewer */}
      {patches.length > 0 && (oldStr || newStr) && (
        <EnhancedDiffViewer
          oldText={oldStr}
          newText={newStr}
          filePath={filePath}
          showAdvancedDiff={true}
        />
      )}

      {/* 전체 파일 내용 */}
      {content && (
        <div>
          <div
            className={cn("text-xs font-medium mb-2", COLORS.ui.text.tertiary)}
          >
            업데이트된 파일:
          </div>
          <FileContent
            title="업데이트된 파일 내용"
            fileData={{
              content: content,
              filePath: filePath,
              numLines: content.split("\n").length,
              startLine: 1,
              totalLines: content.split("\n").length,
            }}
          />
        </div>
      )}
    </div>
  );
};
