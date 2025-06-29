import { lazy, Suspense } from "react";
import type { SyntaxHighlighterProps } from "react-syntax-highlighter";

// Lazy load the syntax highlighter
const SyntaxHighlighter = lazy(() =>
  import("react-syntax-highlighter").then((module) => ({
    default: module.Prism,
  }))
);

interface LazySyntaxHighlighterProps extends SyntaxHighlighterProps {
  fallback?: React.ReactNode;
}

export function LazySyntaxHighlighter({
  fallback,
  style,
  ...props
}: LazySyntaxHighlighterProps) {
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
      <Suspense fallback={null}>
        <SyntaxHighlighter style={style} {...props} />
      </Suspense>
    </Suspense>
  );
}

// Example usage:
// import { LazySyntaxHighlighter } from './SyntaxHighlighterLazy';
//
// <LazySyntaxHighlighter
//   language="typescript"
//   style={vscDarkPlus}
//   showLineNumbers
// >
//   {code}
// </LazySyntaxHighlighter>
