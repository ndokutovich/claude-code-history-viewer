"use client";

import { Edit } from "lucide-react";
import { useCopyButton } from "../../hooks/useCopyButton";
import { EnhancedDiffViewer } from "../EnhancedDiffViewer";
import { FileContent } from "../FileContent";

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
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Edit className="w-4 h-4" />
          <span className="font-medium text-blue-800">파일 편집 결과</span>
        </div>

        {/* 최종 결과물 복사 버튼 */}
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
      </div>

      {/* 파일 경로 */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-600 mb-1">파일 경로:</div>
        <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
          {filePath}
        </code>
      </div>

      {/* 편집 정보 */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-white p-2 rounded border">
          <div className="text-gray-600">편집 유형</div>
          <div className="font-medium text-blue-600">
            {replaceAll ? "전체 교체" : "부분 교체"}
          </div>
        </div>
        <div className="bg-white p-2 rounded border">
          <div className="text-gray-600">사용자 수정</div>
          <div
            className={`font-medium ${
              userModified ? "text-orange-600" : "text-green-600"
            }`}
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
    </div>
  );
};
