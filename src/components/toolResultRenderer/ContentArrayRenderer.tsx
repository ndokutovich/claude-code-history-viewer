import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingRenderer, ToolUseRenderer } from "../contentRenderer";
import { ClaudeToolResultItem } from "./ClaudeToolResultItem";

type Props = {
  toolResult: Record<string, unknown>;
};

export const ContentArrayRenderer = ({ toolResult }: Props) => {
  const { t } = useTranslation("components");
  const content = Array.isArray(toolResult.content) ? toolResult.content : [];
  const totalDurationMs =
    typeof toolResult.totalDurationMs === "number"
      ? toolResult.totalDurationMs
      : null;
  const totalTokens =
    typeof toolResult.totalTokens === "number" ? toolResult.totalTokens : null;
  const totalToolUseCount =
    typeof toolResult.totalToolUseCount === "number"
      ? toolResult.totalToolUseCount
      : null;
  const wasInterrupted =
    typeof toolResult.wasInterrupted === "boolean"
      ? toolResult.wasInterrupted
      : null;
  const usage =
    toolResult.usage && typeof toolResult.usage === "object"
      ? (toolResult.usage as Record<string, unknown>)
      : null;

  return (
    <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="font-medium text-indigo-800 dark:text-indigo-200">{t("contentArray.claudeApiResponse")}</span>
      </div>

      {/* Metadata information */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        {totalDurationMs && (
          <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
            <div className="text-gray-600 dark:text-gray-400">{t("contentArray.executionTime")}</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {(totalDurationMs / 1000).toFixed(2)}{t("contentArray.seconds")}
            </div>
          </div>
        )}
        {totalTokens && (
          <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
            <div className="text-gray-600 dark:text-gray-400">{t("contentArray.totalTokens")}</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{totalTokens.toLocaleString()}</div>
          </div>
        )}
        {totalToolUseCount && (
          <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
            <div className="text-gray-600 dark:text-gray-400">{t("contentArray.toolUseCount")}</div>
            <div className="font-medium text-gray-900 dark:text-gray-100">{totalToolUseCount}</div>
          </div>
        )}
        {wasInterrupted !== null && (
          <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600">
            <div className="text-gray-600 dark:text-gray-400">{t("contentArray.interruptionStatus")}</div>
            <div
              className={`font-medium ${
                wasInterrupted ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              }`}
            >
              {wasInterrupted ? t("contentArray.interrupted") : t("contentArray.completed")}
            </div>
          </div>
        )}
      </div>

      {/* Usage information */}
      {usage && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t("contentArray.tokenUsage")}
          </div>
          <div className="bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-600 text-xs">
            <div className="grid grid-cols-2 gap-2">
              {typeof usage.input_tokens === "number" && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("contentArray.input")}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 ml-1">
                    {usage.input_tokens.toLocaleString()}
                  </span>
                </div>
              )}
              {typeof usage.output_tokens === "number" && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("contentArray.output")}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 ml-1">
                    {usage.output_tokens.toLocaleString()}
                  </span>
                </div>
              )}
              {typeof usage.cache_creation_input_tokens === "number" && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("contentArray.cacheCreation")}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 ml-1">
                    {usage.cache_creation_input_tokens.toLocaleString()}
                  </span>
                </div>
              )}
              {typeof usage.cache_read_input_tokens === "number" && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">{t("contentArray.cacheRead")}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 ml-1">
                    {usage.cache_read_input_tokens.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {content.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t("contentArray.content")}</div>
          <div className="space-y-2">
            {content.map((item: unknown, index: number) => {
              if (!item || typeof item !== "object") {
                return (
                  <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t("contentArray.typeUnknown")}
                    </div>
                    <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </div>
                );
              }

              const itemObj = item as Record<string, unknown>;

              return (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-800 p-3 rounded border dark:border-gray-600 max-h-80 overflow-y-auto"
                >
                  {itemObj.type === "text" &&
                    typeof itemObj.text === "string" && (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-code:text-red-600 dark:prose-code:text-red-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-pre:bg-gray-900 dark:prose-pre:bg-gray-800 prose-pre:text-gray-100 dark:prose-pre:text-gray-200 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300">
                        {itemObj.text.includes("<thinking>") &&
                        itemObj.text.includes("</thinking>") ? (
                          <ThinkingRenderer text={itemObj.text} />
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {itemObj.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    )}
                  {itemObj.type === "tool_use" && (
                    <ToolUseRenderer toolUse={itemObj} />
                  )}
                  {itemObj.type === "tool_result" && (
                    <ClaudeToolResultItem toolResult={itemObj} index={index} />
                  )}
                  {!["text", "tool_use", "tool_result"].includes(
                    itemObj.type as string
                  ) && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t("contentArray.type")} {String(itemObj.type || "unknown")}
                      </div>
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
