import { FileText } from "lucide-react";

type Props = {
  contextData: Record<string, unknown>;
};

// 코드베이스 컨텍스트 정보 렌더링
export const CodebaseContextRenderer = ({ contextData }: Props) => {
  const filesAnalyzed =
    contextData.files_analyzed || contextData.filesAnalyzed || 0;
  const contextWindow =
    contextData.context_window || contextData.contextWindow || "";
  const relevantFiles =
    contextData.relevant_files || contextData.relevantFiles || [];

  return (
    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-3">
        <FileText className="w-4 h-4 text-indigo-600" />
        <span className="font-medium text-indigo-800">코드베이스 컨텍스트</span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-indigo-700 font-medium">분석된 파일:</span>
          <span className="ml-2 text-indigo-900">
            {String(filesAnalyzed)}개
          </span>
        </div>
        <div>
          <span className="text-indigo-700 font-medium">컨텍스트 윈도우:</span>
          <span className="ml-2 text-indigo-900">{String(contextWindow)}</span>
        </div>
      </div>

      {Array.isArray(relevantFiles) && relevantFiles.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-indigo-700 font-medium text-sm">
            관련 파일 ({relevantFiles.length}개)
          </summary>
          <div className="mt-2 space-y-1">
            {relevantFiles.slice(0, 10).map((file, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-indigo-800 bg-indigo-100 px-2 py-1 rounded"
              >
                {String(file)}
              </div>
            ))}
            {relevantFiles.length > 10 && (
              <div className="text-xs text-indigo-600 italic">
                ...및 {relevantFiles.length - 10}개 파일 더
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
};
