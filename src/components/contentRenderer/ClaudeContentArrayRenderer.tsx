import { ThinkingRenderer } from "./ThinkingRenderer";
import { ToolUseRenderer } from "./ToolUseRenderer";
import { ImageRenderer } from "./ImageRenderer";
import { ClaudeToolResultItem } from "../toolResultRenderer";

type Props = {
  content: unknown[];
};

// Type guard for content items
const isContentItem = (item: unknown): item is Record<string, unknown> => {
  return item !== null && typeof item === "object";
};

export const ClaudeContentArrayRenderer = ({ content }: Props) => {
  if (!Array.isArray(content) || content.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {content.map((item, index) => {
        if (!isContentItem(item)) {
          return (
            <div key={index} className="text-sm text-gray-600">
              {String(item)}
            </div>
          );
        }

        const itemType = item.type as string;

        switch (itemType) {
          case "text":
            if (typeof item.text === "string") {
              return (
                <div
                  key={index}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <div className="whitespace-pre-wrap text-gray-800">
                    {item.text}
                  </div>
                </div>
              );
            }
            return null;

          case "image":
            // Claude API 형태의 이미지 객체 처리
            if (item.source && typeof item.source === "object") {
              const source = item.source as Record<string, unknown>;
              if (
                source.type === "base64" &&
                source.data &&
                source.media_type
              ) {
                const imageUrl = `data:${source.media_type};base64,${source.data}`;
                return <ImageRenderer key={index} imageUrl={imageUrl} />;
              }
            }
            return null;

          case "thinking":
            if (typeof item.content === "string") {
              return <ThinkingRenderer key={index} content={item.content} />;
            }
            return null;

          case "tool_use":
            return <ToolUseRenderer key={index} toolUse={item} />;

          case "tool_result":
            return <ClaudeToolResultItem toolResult={item} index={index} />;

          default:
            // 기본 JSON 렌더링
            return (
              <div
                key={index}
                className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
              >
                <div className="text-xs font-medium text-yellow-800 mb-2">
                  알 수 없는 콘텐츠 타입: {itemType}
                </div>
                <pre className="text-xs text-yellow-700 overflow-auto">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </div>
            );
        }
      })}
    </div>
  );
};
