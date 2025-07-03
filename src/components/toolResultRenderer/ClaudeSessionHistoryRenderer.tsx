import { MessageCircle, User, Bot, Wrench, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";
import { formatTime } from "../../utils/time";

type Props = {
  content: string;
};

export const ClaudeSessionHistoryRenderer = ({ content }: Props) => {
  const { t } = useTranslation('components');
  try {
    // Split by lines and filter out empty lines
    const lines = content.split("\n").filter((line) => line.trim());
    const parsedMessages: Record<string, unknown>[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        parsedMessages.push(parsed);
      } catch {
        // Skip invalid JSON lines
        continue;
      }
    }

    // Filter out summary messages and keep only user/assistant messages
    const chatMessages = parsedMessages.filter(
      (msg) => msg.type === "user" || msg.type === "assistant"
    );

    if (chatMessages.length === 0) {
      return (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <MessageCircle className="w-4 h-4" />
            <span className="font-medium text-gray-800">{t('claudeSessionHistoryRenderer.title')}</span>
          </div>
          <p className="text-gray-600 text-sm">
            {t('claudeSessionHistoryRenderer.noValidMessages')}
          </p>
        </div>
      );
    }

    return (
      <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <MessageCircle className="w-4 h-4" />
          <span className="font-medium text-purple-800">
            {t('claudeSessionHistoryRenderer.messageCount', { count: chatMessages.length })}
          </span>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {chatMessages.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg ${
                msg.type === "user"
                  ? "bg-blue-100 border-l-4 border-blue-400"
                  : "bg-green-100 border-l-4 border-green-400"
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                {msg.type === "user" ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
                <span className="font-medium text-sm">
                  {msg.type === "user" ? t('claudeSessionHistoryRenderer.user') : t('claudeSessionHistoryRenderer.claude')}
                </span>
                {typeof msg.timestamp === "string" && (
                  <span className="text-xs text-gray-500">
                    {formatTime(msg.timestamp)}
                  </span>
                )}
              </div>
              <div className="text-sm">
                {typeof msg.message === "object" &&
                msg.message !== null &&
                "content" in msg.message ? (
                  typeof msg.message.content === "string" ? (
                    <div className="prose prose-sm max-w-none prose-gray">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.message.content}
                      </ReactMarkdown>
                    </div>
                  ) : Array.isArray(msg.message.content) ? (
                    <div className="space-y-2">
                      {msg.message.content.map(
                        (item: Record<string, unknown>, idx: number) => (
                          <div key={idx}>
                            {item.type === "text" &&
                              typeof item.text === "string" && (
                                <div className="prose prose-sm max-w-none prose-gray">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {item.text}
                                  </ReactMarkdown>
                                </div>
                              )}
                            {item.type === "tool_use" && (
                              <div className="bg-gray-100 p-2 rounded text-xs">
                                <span className="font-medium">
                                  <Wrench className="w-4 h-4 inline mr-1" />
                                  {typeof item.name === "string"
                                    ? item.name
                                    : "Unknown Tool"}
                                </span>
                                {item.input &&
                                typeof item.input === "object" &&
                                item.input !== null ? (
                                  <pre className="mt-1 text-xs overflow-x-auto">
                                    {JSON.stringify(item.input, null, 2)}
                                  </pre>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : msg.message.content ? (
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(msg.message.content, null, 2)}
                    </pre>
                  ) : null
                ) : (
                  <span className="text-gray-500 italic">{t('claudeSessionHistoryRenderer.noContent')}</span>
                )}
              </div>
              {typeof msg.message === "object" &&
                msg.message !== null &&
                "usage" in msg.message &&
                typeof msg.message.usage === "object" &&
                msg.message.usage !== null && (
                  <div className="mt-2 text-xs text-gray-600">
                    <span>
                      {t('claudeSessionHistoryRenderer.tokenUsage')}:{" "}
                      {"input_tokens" in msg.message.usage &&
                      typeof msg.message.usage.input_tokens === "number"
                        ? msg.message.usage.input_tokens
                        : "?"}
                      →
                      {"output_tokens" in msg.message.usage &&
                      typeof msg.message.usage.output_tokens === "number"
                        ? msg.message.usage.output_tokens
                        : "?"}
                    </span>
                    {"model" in msg.message &&
                      typeof msg.message.model === "string" && (
                        <span className="ml-2">{t('claudeSessionHistoryRenderer.model')}: {msg.message.model}</span>
                      )}
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    );
  } catch {
    return (
      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <X className="w-4 h-4 text-red-500" />
          <span className="font-medium text-red-800">{t('claudeSessionHistoryRenderer.parsingError')}</span>
        </div>
        <p className="text-red-600 text-sm">
          {t('claudeSessionHistoryRenderer.parsingErrorDescription')}
        </p>
        <details className="mt-2">
          <summary className="text-sm cursor-pointer">{t('claudeSessionHistoryRenderer.viewOriginalData')}</summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
            {content}
          </pre>
        </details>
      </div>
    );
  }
};
