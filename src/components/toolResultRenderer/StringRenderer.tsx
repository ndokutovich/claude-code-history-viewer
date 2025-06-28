"use client";

import { useState } from "react";
import { Folder, Check, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  result: string;
};

export const StringRenderer = ({ result }: Props) => {
  // 파일 트리나 디렉토리 구조인지 확인
  const isFileTree =
    result.includes("/") &&
    (result.includes("- ") || result.includes("├") || result.includes("└"));

  // 접기/펼치기 상태 관리
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LINES = 15; // 최대 표시 줄 수
  const resultLines = result.split("\n");
  const shouldCollapse = resultLines.length > MAX_LINES;
  const displayResult =
    shouldCollapse && !isExpanded
      ? resultLines.slice(0, MAX_LINES).join("\n")
      : result;

  return (
    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {isFileTree ? (
            <Folder className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span className="font-medium text-green-800">
            {isFileTree ? "파일 구조" : "도구 실행 결과"}
          </span>
        </div>
        {shouldCollapse && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
          >
            {isExpanded ? (
              <>
                <span>접기 ▲</span>
              </>
            ) : (
              <>
                <span>펼치기 ({resultLines.length}줄) ▼</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="bg-white rounded border">
        {isFileTree ? (
          <div className="p-3 font-mono text-sm text-gray-800 whitespace-pre-wrap">
            {displayResult}
          </div>
        ) : (
          <div className="p-3 prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100 prose-pre:bg-gray-900 prose-pre:text-gray-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {displayResult}
            </ReactMarkdown>
          </div>
        )}
        {shouldCollapse && !isExpanded && (
          <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
            <button
              onClick={() => setIsExpanded(true)}
              className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
            >
              <FileText className="w-3 h-3 inline mr-1" />
              {resultLines.length - MAX_LINES}줄 더 보기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
