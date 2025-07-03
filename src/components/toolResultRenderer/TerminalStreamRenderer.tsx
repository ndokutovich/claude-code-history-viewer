"use client";

import { Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  command: string;
  stream: string;
  output: string;
  timestamp: string;
  exitCode: number;
};

export const TerminalStreamRenderer = ({
  command,
  stream,
  output,
  timestamp,
  exitCode,
}: Props) => {
  const { t } = useTranslation('components');
  return (
    <div className="mt-2 p-3 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-green-400" />
          <span className="font-medium text-green-400">{t('terminalStreamRenderer.title')}</span>
          {command && (
            <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-300">
              {String(command)}
            </code>
          )}
        </div>
        {timestamp && (
          <span className="text-xs text-gray-400">
            {new Date(String(timestamp)).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="relative">
        {/* 스트림 타입 표시 */}
        <div className="flex items-center space-x-2 mb-1">
          <span
            className={`text-xs px-2 py-1 rounded ${
              stream === "stderr"
                ? "bg-red-800 text-red-200"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            {String(stream)}
          </span>
          {exitCode !== undefined && (
            <span
              className={`text-xs px-2 py-1 rounded ${
                Number(exitCode) === 0
                  ? "bg-green-800 text-green-200"
                  : "bg-red-800 text-red-200"
              }`}
            >
              {t('terminalStreamRenderer.exitCode')}: {String(exitCode)}
            </span>
          )}
        </div>

        {/* 출력 내용 */}
        <pre className="text-sm text-gray-100 whitespace-pre-wrap bg-gray-800 p-2 rounded overflow-auto max-h-80">
          {String(output)}
        </pre>
      </div>
    </div>
  );
};
