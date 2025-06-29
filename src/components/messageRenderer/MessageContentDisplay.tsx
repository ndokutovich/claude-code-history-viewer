import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy } from "lucide-react";
import { CommandRenderer } from "../contentRenderer";

interface MessageContentDisplayProps {
  content: string | null;
  messageType: string;
}

export const MessageContentDisplay: React.FC<MessageContentDisplayProps> = ({
  content,
  messageType,
}) => {
  if (!content) return null;

  // Check for command tags in string content
  if (
    typeof content === "string" &&
    content.includes("<command-message>") &&
    content.includes("</command-message>")
  ) {
    return <CommandRenderer text={content} />;
  }

  // 사용자와 어시스턴트 메시지에 따라 다른 렌더링
  if (typeof content === "string") {
    if (messageType === "user") {
      // 사용자 메시지 스타일
      return (
        <div className="mb-3 flex justify-end">
          <div className="max-w-xs sm:max-w-md lg:max-w-lg bg-blue-500 text-white rounded-2xl px-4 py-3 relative group shadow-sm">
            <div className="whitespace-pre-wrap break-words text-sm">
              {content}
            </div>
            {/* 복사 버튼 */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => navigator.clipboard.writeText(content)}
                className="p-1 rounded-full transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                title="메시지 복사하기"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );
    } else if (messageType === "assistant") {
      // 어시스턴트 메시지 스타일 (마크다운 지원)
      return (
        <div className="mb-3 flex justify-start">
          <div className="max-w-xs sm:max-w-md lg:max-w-2xl bg-green-500/80 text-white rounded-2xl px-4 py-3 relative group shadow-sm">
            <div className="prose prose-sm max-w-none prose-headings:text-white prose-p:text-white prose-a:text-blue-200 prose-code:text-gray-900 prose-code:bg-white prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-blockquote:text-green-100 prose-blockquote:border-l-4 prose-blockquote:border-green-300 prose-blockquote:pl-4 prose-ul:text-white prose-ol:text-white prose-li:text-white">
              <ReactMarkdown remarkPlugins={[remarkGfm]} children={content} />
            </div>
            {/* 복사 버튼 */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => navigator.clipboard.writeText(content)}
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
  }

  // 기본 렌더링 (시스템 메시지 등)
  return (
    <div className="prose prose-sm max-w-none">
      <div className="whitespace-pre-wrap text-gray-800">{content}</div>
    </div>
  );
};
