import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";

type Props = {
  text?: string;
  content?: string;
};

export const ThinkingRenderer = ({ text, content }: Props) => {
  const { t } = useTranslation('components');
  const textContent = text || content || "";
  if (!textContent) return null;
  // Extract thinking content and regular content
  const thinkingRegex = /<thinking>(.*?)<\/thinking>/gs;
  const matches = textContent.match(thinkingRegex);
  const withoutThinking = textContent.replace(thinkingRegex, "").trim();

  return (
    <div className="space-y-2">
      {matches &&
        matches.map((match, idx) => {
          const thinkingContent = match.replace(/<\/?thinking>/g, "").trim();
          return (
            <div
              key={idx}
              className="bg-amber-50 border border-amber-200 rounded-lg p-3"
            >
              <div className="flex items-center space-x-2 mb-2">
                <Bot className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-800">
                  {t('thinkingRenderer.title')}
                </span>
              </div>
              <div className="text-sm text-amber-700 italic">
                {thinkingContent}
              </div>
            </div>
          );
        })}

      {withoutThinking && (
        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {withoutThinking}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
