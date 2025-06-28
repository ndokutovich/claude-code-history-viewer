"use client";
import { Globe } from "lucide-react";

type Props = {
  mcpData: Record<string, unknown>;
};

// MCP 도구 호출 결과 렌더링
export const MCPRenderer = ({ mcpData }: Props) => {
  const server = mcpData.server || "unknown";
  const method = mcpData.method || "unknown";
  const params = mcpData.params || {};
  const result = mcpData.result || {};
  const error = mcpData.error;

  return (
    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-purple-600" />
          <span className="font-medium text-purple-800">MCP 도구 호출</span>
        </div>
        <div className="text-xs text-purple-600">
          {String(server)}.{String(method)}
        </div>
      </div>

      <div className="space-y-2">
        {/* 매개변수 */}
        <details className="text-sm">
          <summary className="cursor-pointer text-purple-700 font-medium">
            매개변수
          </summary>
          <pre className="mt-1 p-2 bg-purple-100 rounded text-xs overflow-auto">
            {JSON.stringify(params, null, 2)}
          </pre>
        </details>

        {/* 결과 */}
        {error ? (
          <div className="p-2 bg-red-100 border border-red-200 rounded">
            <div className="text-xs font-medium text-red-800 mb-1">오류:</div>
            <div className="text-sm text-red-700">{String(error)}</div>
          </div>
        ) : (
          <details className="text-sm">
            <summary className="cursor-pointer text-purple-700 font-medium">
              실행 결과
            </summary>
            <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};
