import { RefreshCw } from "lucide-react";
import { EnhancedDiffViewer } from "../EnhancedDiffViewer";
import { FileContent } from "../FileContent";

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
    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <RefreshCw className="w-4 h-4" />
        <span className="font-medium text-orange-800">
          파일 변경 사항 (Patch)
        </span>
      </div>

      {/* 파일 정보 */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-600 mb-1">파일 경로:</div>
        <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
          {filePath}
        </code>
      </div>

      {/* 변경 통계 */}
      {patches.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            변경 통계:
          </div>
          <div className="bg-white p-2 rounded border text-xs">
            <span className="text-orange-600 font-medium">
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
          <div className="text-xs font-medium text-gray-600 mb-2">
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
