import { FileText, Package, GitBranch, Code, Terminal } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  metadata: Record<string, unknown>;
}

export const ProviderMetadataDisplay = ({ metadata }: Props) => {
  const { t } = useTranslation("components");

  // Extract file-related data
  const relevantFiles = (metadata.relevant_files as any[]) || [];
  const attachedCodeChunks = (metadata.attached_code_chunks as any[]) || [];
  const attachedFileMetadata = (metadata.attached_file_metadata as any[]) || [];
  const suggestedDiffs = (metadata.suggested_diffs as any[]) || [];
  const gitDiffs = (metadata.git_diffs as any[]) || [];
  const interpreterResults = (metadata.interpreter_results as any[]) || [];
  const consoleLogs = (metadata.console_logs as any[]) || [];
  const thinkingBlocks = (metadata.thinking_blocks as any[]) || [];

  const hasAnyData =
    relevantFiles.length > 0 ||
    attachedCodeChunks.length > 0 ||
    attachedFileMetadata.length > 0 ||
    suggestedDiffs.length > 0 ||
    gitDiffs.length > 0 ||
    interpreterResults.length > 0 ||
    consoleLogs.length > 0 ||
    thinkingBlocks.length > 0;

  if (!hasAnyData) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {/* Relevant Files */}
      {relevantFiles.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300">
            <FileText className="w-4 h-4" />
            <span className="font-medium">
              {t("providerMetadata.relevantFiles", { count: relevantFiles.length })}
            </span>
          </summary>
          <div className="mt-2 ml-6 space-y-1">
            {relevantFiles.map((file, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700"
              >
                {typeof file === "string" ? file : JSON.stringify(file)}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Attached Code Chunks */}
      {attachedCodeChunks.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center space-x-2 text-sm text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300">
            <Code className="w-4 h-4" />
            <span className="font-medium">
              {t("providerMetadata.codeChunks", { count: attachedCodeChunks.length })}
            </span>
          </summary>
          <div className="mt-2 ml-6 space-y-2">
            {attachedCodeChunks.slice(0, 5).map((chunk, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded border border-purple-200 dark:border-purple-800"
              >
                {typeof chunk === "string" ? chunk : JSON.stringify(chunk, null, 2)}
              </div>
            ))}
            {attachedCodeChunks.length > 5 && (
              <div className="text-xs text-purple-600 dark:text-purple-400 italic">
                ...and {attachedCodeChunks.length - 5} more code chunks
              </div>
            )}
          </div>
        </details>
      )}

      {/* File Metadata */}
      {attachedFileMetadata.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center space-x-2 text-sm text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300">
            <Package className="w-4 h-4" />
            <span className="font-medium">
              {t("providerMetadata.fileMetadata", { count: attachedFileMetadata.length })}
            </span>
          </summary>
          <div className="mt-2 ml-6 space-y-1">
            {attachedFileMetadata.map((meta, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-200 dark:border-green-800"
              >
                {typeof meta === "string" ? meta : JSON.stringify(meta)}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Suggested Diffs */}
      {suggestedDiffs.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center space-x-2 text-sm text-orange-700 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300">
            <GitBranch className="w-4 h-4" />
            <span className="font-medium">
              {t("providerMetadata.suggestedDiffs", { count: suggestedDiffs.length })}
            </span>
          </summary>
          <div className="mt-2 ml-6 space-y-2">
            {suggestedDiffs.map((diff, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded border border-orange-200 dark:border-orange-800"
              >
                <pre className="whitespace-pre-wrap">
                  {typeof diff === "string" ? diff : JSON.stringify(diff, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Console Logs */}
      {consoleLogs.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300">
            <Terminal className="w-4 h-4" />
            <span className="font-medium">
              {t("providerMetadata.consoleLogs", { count: consoleLogs.length })}
            </span>
          </summary>
          <div className="mt-2 ml-6 space-y-1">
            {consoleLogs.map((log, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700"
              >
                {typeof log === "string" ? log : JSON.stringify(log)}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
