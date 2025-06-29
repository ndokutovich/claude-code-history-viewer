"use client";

import { Edit } from "lucide-react";
import { useCopyButton } from "../../hooks/useCopyButton";
import { EnhancedDiffViewer } from "../EnhancedDiffViewer";
import { FileContent } from "../FileContent";
import { Renderer } from "../../shared/RendererHeader";
import { cn } from "../../utils/cn";
import { COLORS } from "../../constants/colors";

type Props = {
  toolResult: Record<string, unknown>;
};

export const FileEditRenderer = ({ toolResult }: Props) => {
  const { renderCopyButton } = useCopyButton();
  const filePath =
    typeof toolResult.filePath === "string" ? toolResult.filePath : "";
  const oldString =
    typeof toolResult.oldString === "string" ? toolResult.oldString : "";
  const newString =
    typeof toolResult.newString === "string" ? toolResult.newString : "";
  const originalFile =
    typeof toolResult.originalFile === "string" ? toolResult.originalFile : "";
  const replaceAll =
    typeof toolResult.replaceAll === "boolean" ? toolResult.replaceAll : false;
  const userModified =
    typeof toolResult.userModified === "boolean"
      ? toolResult.userModified
      : false;

  return (
    <Renderer className={cn(COLORS.tools.code.bg, COLORS.tools.code.border)}>
      <Renderer.Header
        title="파일 편집 결과"
        icon={<Edit className={cn(COLORS.tools.code.icon)} />}
        titleClassName={COLORS.tools.code.text}
        rightContent={
          <div className="flex items-center space-x-2">
            {newString &&
              renderCopyButton(
                newString,
                `edit-result-${filePath}`,
                "변경된 결과 결과 복사"
              )}
            {originalFile &&
              renderCopyButton(
                originalFile,
                `original-file-${filePath}`,
                "원본 파일 복사"
              )}
          </div>
        }
      />
      <Renderer.Content>
        {/* 파일 경로 */}
        <div className="mb-3">
          <div
            className={cn("text-xs font-medium mb-1", COLORS.ui.text.tertiary)}
          >
            파일 경로:
          </div>
          <code
            className={cn(
              "text-sm block",
              COLORS.ui.background.secondary,
              COLORS.ui.text.primary
            )}
          >
            {filePath}
          </code>
        </div>

        {/* 편집 정보 */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div
            className={cn(
              COLORS.ui.background.primary,
              COLORS.ui.border.medium
            )}
          >
            <div className={cn(COLORS.ui.text.tertiary)}>편집 유형</div>
            <div className={cn(COLORS.tools.code.text)}>
              {replaceAll ? "전체 교체" : "부분 교체"}
            </div>
          </div>
          <div
            className={cn(
              COLORS.ui.background.primary,
              COLORS.ui.border.medium
            )}
          >
            <div className={cn(COLORS.ui.text.tertiary)}>사용자 수정</div>
            <div
              className={cn(
                "font-medium",
                userModified
                  ? COLORS.semantic.warning.text
                  : COLORS.semantic.success.text
              )}
            >
              {userModified ? "있음" : "없음"}
            </div>
          </div>
        </div>

        {/* 변경 내용 - Enhanced Diff Viewer 사용 */}
        {oldString && newString && (
          <EnhancedDiffViewer
            oldText={oldString}
            newText={newString}
            filePath={filePath}
            showAdvancedDiff={true}
          />
        )}

        {/* 원본 파일 내용 (접기/펼치기 가능) */}
        {originalFile && (
          <div>
            <FileContent
              title="원본 파일 내용"
              fileData={{
                content: originalFile,
                filePath: filePath,
                numLines: originalFile.split("\n").length,
                startLine: 1,
                totalLines: originalFile.split("\n").length,
              }}
            />
          </div>
        )}
      </Renderer.Content>
    </Renderer>
  );
};
