"use client";
import { Globe } from "lucide-react";
import { useTranslation } from 'react-i18next';

type Props = {
  mcpData: Record<string, unknown>;
};

// Render MCP tool call results
export const MCPRenderer = ({ mcpData }: Props) => {
  const { t } = useTranslation('components');
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
          <span className="font-medium text-purple-800">{t('mcpRenderer.mcpToolCall')}</span>
        </div>
        <div className="text-xs text-purple-600">
          {String(server)}.{String(method)}
        </div>
      </div>

      <div className="space-y-2">
        {/* Parameters */}
        <details className="text-sm">
          <summary className="cursor-pointer text-purple-700 font-medium">
            {t('mcpRenderer.parameters')}
          </summary>
          <pre className="mt-1 p-2 bg-purple-100 rounded text-xs overflow-auto">
            {JSON.stringify(params, null, 2)}
          </pre>
        </details>

        {/* Result */}
        {error ? (
          <div className="p-2 bg-red-100 border border-red-200 rounded">
            <div className="text-xs font-medium text-red-800 mb-1">{t('mcpRenderer.error')}</div>
            <div className="text-sm text-red-700">{String(error)}</div>
          </div>
        ) : (
          <details className="text-sm">
            <summary className="cursor-pointer text-purple-700 font-medium">
              {t('mcpRenderer.executionResult')}
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
