import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CommandRenderer, ImageRenderer } from "../contentRenderer";
import { isImageUrl, isBase64Image } from "../../utils/messageUtils";
import { TooltipButton } from "../../shared/TooltipButton";
import type { Components } from "react-markdown";

interface MessageContentDisplayProps {
  content: string | null;
  messageType: string;
}

export const MessageContentDisplay: React.FC<MessageContentDisplayProps> = ({
  content,
  messageType,
}) => {
  const { t } = useTranslation("components");

  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = React.useState(
    document.documentElement.classList.contains('dark')
  );

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Custom markdown components for assistant messages with inline styles
  // Use useMemo to recreate when isDarkMode changes
  const assistantMarkdownComponents: Components = React.useMemo(() => ({
    code: ({ inline, children, ...props }: any) => {
      if (inline) {
        return (
          <code
            {...props}
            style={{
              backgroundColor: isDarkMode ? '#374151' : '#0c4a6e', // dark: gray-700, light: blue-900 (strong contrast on green)
              color: isDarkMode ? '#f3f4f6' : '#e0f2fe', // dark: gray-100, light: blue-100 (bright on dark blue)
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.875em',
              fontWeight: 500,
            }}
          >
            {children}
          </code>
        );
      }
      // Block code (inside <pre>)
      return (
        <code
          {...props}
          style={{
            color: isDarkMode ? '#f3f4f6' : '#111827', // Light mode: BLACK text, Dark mode: light text
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        >
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        {...props}
        style={{
          backgroundColor: isDarkMode ? '#1f2937' : '#f9fafb', // Light mode: very light gray background, Dark mode: dark background
          color: isDarkMode ? '#f3f4f6' : '#111827', // Light mode: BLACK text, Dark mode: light text
          padding: '1rem',
          borderRadius: '0.375rem',
          overflowX: 'auto',
          margin: '0.5rem 0',
        }}
      >
        {children}
      </pre>
    ),
    p: ({ children, ...props }) => (
      <p {...props} style={{ margin: '0.5rem 0', color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </p>
    ),
    a: ({ children, ...props }) => (
      <a {...props} style={{ color: isDarkMode ? '#fde047' : '#1d4ed8', textDecoration: 'underline', fontWeight: 500 }}>
        {children}
      </a>
    ),
    strong: ({ children, ...props }) => (
      <strong {...props} style={{ fontWeight: 600, color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </strong>
    ),
    ul: ({ children, ...props }) => (
      <ul {...props} style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol {...props} style={{ margin: '0.5rem 0', paddingLeft: '1.5rem', color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li {...props} style={{ color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </li>
    ),
    h1: ({ children, ...props }) => (
      <h1 {...props} style={{ fontSize: '1.5rem', fontWeight: 700, margin: '1rem 0 0.5rem', color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 {...props} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '1rem 0 0.5rem', color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 {...props} style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1rem 0 0.5rem', color: isDarkMode ? '#ffffff' : '#111827' }}>
        {children}
      </h3>
    ),
  }), [isDarkMode]);

  if (!content) return null;

  if (typeof content === "string") {
    const hasCommandTags =
      content.includes("<command-") ||
      content.includes("<local-command-") ||
      content.includes("-command-") ||
      content.includes("-stdout>") ||
      content.includes("-stderr>");

    if (hasCommandTags) {
      return <CommandRenderer text={content} />;
    }

    if (isImageUrl(content) || isBase64Image(content)) {
      return <ImageRenderer imageUrl={content} />;
    }

    const imageMatch = content.match(
      /(data:image\/[^;\s]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|svg|webp))/i
    );
    if (imageMatch && imageMatch[1]) {
      const imageUrl = imageMatch[1];
      const textWithoutImage = content.replace(imageMatch[0], "").trim();

      return (
        <>
          <ImageRenderer imageUrl={imageUrl} />
          {textWithoutImage && textWithoutImage.length > 0 && (
            <div className="mt-2">
              <MessageContentDisplay
                content={textWithoutImage}
                messageType={messageType}
              />
            </div>
          )}
        </>
      );
    }
  }

  if (typeof content !== "string") {
    return null; // Or some other fallback for non-string content
  }

  if (messageType === "user") {
    return (
      <div className="mb-3 flex justify-end">
        <div className="max-w-xs sm:max-w-md lg:max-w-lg bg-blue-100 dark:bg-blue-600 text-gray-900 dark:text-white rounded-2xl px-4 py-3 relative group shadow-sm">
          <div className="whitespace-pre-wrap break-words text-sm">
            {content}
          </div>
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipButton
              onClick={() => navigator.clipboard.writeText(content)}
              className="p-1 rounded-full transition-colors bg-blue-200 hover:bg-blue-300 dark:bg-blue-700 dark:hover:bg-blue-800 text-gray-900 dark:text-white"
              content={t("messageContentDisplay.copyMessage")}
            >
              <Copy className="w-3 h-3" />
            </TooltipButton>
          </div>
        </div>
      </div>
    );
  } else if (messageType === "assistant") {
    return (
      <div className="mb-3 flex justify-start">
        <div className="max-w-xs sm:max-w-md lg:max-w-2xl bg-green-100 dark:bg-green-600/80 text-gray-900 dark:text-white rounded-2xl px-4 py-3 relative group shadow-sm">
          <div className="text-gray-900 dark:text-white text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={assistantMarkdownComponents}
              children={content}
            />
          </div>
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipButton
              onClick={() => navigator.clipboard.writeText(content)}
              className="p-1 rounded-full transition-colors bg-green-200 hover:bg-green-300 dark:bg-green-600 dark:hover:bg-green-700 text-gray-900 dark:text-white"
              content={t("messageContentDisplay.copyMessage")}
            >
              <Copy className="w-3 h-3" />
            </TooltipButton>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for other message types like 'system'
  return (
    <div className="prose prose-sm max-w-none">
      <div className="whitespace-pre-wrap text-gray-800">{content}</div>
    </div>
  );
};
