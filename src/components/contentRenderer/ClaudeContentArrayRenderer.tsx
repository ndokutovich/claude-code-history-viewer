import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy } from "lucide-react";
import { CommandRenderer } from "./CommandRenderer";
import { ThinkingRenderer } from "./ThinkingRenderer";
import { ToolUseRenderer } from "./ToolUseRenderer";
import { ClaudeToolResultItem } from "../toolResultRenderer";

type Props = {
  content: unknown[];
  messageType?: string;
};

export const ClaudeContentArrayRenderer = ({ content, messageType }: Props) => {
  return (
    <div className="space-y-3">
      {content.map((item: unknown, index: number) => {
        if (item && typeof item === "object") {
          const contentItem = item as Record<string, unknown>;

          // Handle text content
          if (
            contentItem.type === "text" &&
            typeof contentItem.text === "string"
          ) {
            // Check for command tags first
            if (
              contentItem.text.includes("<command-message>") &&
              contentItem.text.includes("</command-message>")
            ) {
              return <CommandRenderer text={contentItem.text} />;
            }

            // Check for thinking tags
            if (
              contentItem.text.includes("<thinking>") &&
              contentItem.text.includes("</thinking>")
            ) {
              return <ThinkingRenderer text={contentItem.text} />;
            }

            // Assistant 메시지일 때는 말풍선 스타일 적용
            if (messageType === "assistant") {
              return (
                <div key={index} className="mb-3 flex justify-start">
                  <div className="max-w-xs sm:max-w-md lg:max-w-2xl bg-green-500 text-white rounded-2xl px-4 py-3 relative group shadow-sm">
                    <div className="prose prose-sm max-w-none prose-headings:text-white prose-p:text-white prose-a:text-blue-200 prose-code:text-gray-900 prose-code:bg-white prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-blockquote:text-green-100 prose-blockquote:border-l-4 prose-blockquote:border-green-300 prose-blockquote:pl-4 prose-ul:text-white prose-ol:text-white prose-li:text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {contentItem.text}
                      </ReactMarkdown>
                    </div>
                    {/* 복사 버튼 */}
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            contentItem.text as string
                          )
                        }
                        className="p-1 rounded-full transition-colors bg-green-600 hover:bg-green-700 text-white"
                        title="메시지 복사하기"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={index}
                className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {contentItem.text}
                </ReactMarkdown>
              </div>
            );
          }

          // Handle tool use content
          if (contentItem.type === "tool_use") {
            return <ToolUseRenderer toolUse={contentItem} />;
          }

          // Handle tool result content
          if (contentItem.type === "tool_result") {
            return (
              <ClaudeToolResultItem toolResult={contentItem} index={index} />
            );
          }

          // Handle other content types
          return (
            <div key={index} className="bg-gray-50 p-3 rounded border">
              <div className="text-xs text-gray-500 mb-1">
                타입: {String(contentItem.type || "unknown")}
              </div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(item, null, 2)}
              </pre>
            </div>
          );
        }

        return (
          <div key={index} className="text-sm text-gray-600">
            {String(item)}
          </div>
        );
      })}
    </div>
  );
};
