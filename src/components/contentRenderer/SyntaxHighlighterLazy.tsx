import { Suspense } from "react";

interface LazySyntaxHighlighterProps {
  language?: string;
  children?: string;
  style?: Record<string, unknown>;
  showLineNumbers?: boolean;
  fallback?: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}

/**
 * Simple syntax highlighter wrapper using <pre><code>.
 * This replaces react-syntax-highlighter (which is not installed)
 * with a minimal implementation.
 */
export function LazySyntaxHighlighter({
  fallback,
  children,
  language,
  className,
  ...props
}: LazySyntaxHighlighterProps) {
  // Suppress unused variable warnings for API compatibility
  void props;

  return (
    <Suspense
      fallback={
        fallback || (
          <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded p-4">
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
          </div>
        )
      }
    >
      <pre className={`${className || ""} overflow-x-auto p-4 rounded bg-gray-50 dark:bg-gray-900`}>
        <code className={language ? `language-${language}` : undefined}>
          {children}
        </code>
      </pre>
    </Suspense>
  );
}
