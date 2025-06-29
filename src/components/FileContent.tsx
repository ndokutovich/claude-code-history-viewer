"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useCopyButton } from "../hooks/useCopyButton";
import { Renderer } from "../shared/RendererHeader";

export const FileContent = ({
  fileData,
  title,
}: {
  fileData: Record<string, unknown>;
  title: string;
}) => {
  const { renderCopyButton } = useCopyButton();
  const content = typeof fileData.content === "string" ? fileData.content : "";
  const filePath =
    typeof fileData.filePath === "string" ? fileData.filePath : "";
  const numLines =
    typeof fileData.numLines === "number" ? fileData.numLines : 0;
  const startLine =
    typeof fileData.startLine === "number" ? fileData.startLine : 1;
  const totalLines =
    typeof fileData.totalLines === "number" ? fileData.totalLines : 0;

  // 파일 확장자에 따른 언어 결정
  const getLanguageFromPath = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    const fileName = path.split("/").pop()?.toLowerCase() || "";

    switch (ext) {
      case "rs":
        return "rust";
      case "ts":
        return "typescript";
      case "tsx":
        return "tsx"; // React TypeScript
      case "js":
        return "javascript";
      case "jsx":
        return "jsx"; // React JavaScript
      case "py":
        return "python";
      case "json":
        return "json";
      case "md":
      case "markdown":
        return "markdown";
      case "css":
        return "css";
      case "scss":
      case "sass":
        return "scss";
      case "html":
      case "htm":
        return "html";
      case "xml":
        return "xml";
      case "yaml":
      case "yml":
        return "yaml";
      case "mdx":
        return "markdown";
      case "sh":
      case "zsh":
      case "bash":
        return "bash";
      case "c":
        return "c";
      case "cpp":
      case "c++":
      case "cxx":
      case "cc":
        return "cpp";
      case "java":
        return "java";
      case "go":
        return "go";
      case "php":
        return "php";
      case "sql":
        return "sql";
      case "swift":
        return "swift";
      case "kotlin":
      case "kt":
        return "kotlin";
      case "scala":
        return "scala";
      case "rb":
        return "ruby";
      case "vue":
        return "vue";
      case "svelte":
        return "svelte";
      case "toml":
        return "toml";
      case "ini":
      case "conf":
      case "config":
        return "ini";
      case "dockerfile":
        return "dockerfile";
      case "txt":
      case "log":
        return "text";
      default:
        // 파일명으로 특수 케이스 처리
        if (fileName.includes("dockerfile")) return "dockerfile";
        if (fileName.includes("makefile")) return "makefile";
        if (fileName.includes("package.json")) return "json";
        if (fileName.includes("tsconfig")) return "json";
        if (fileName.includes("eslint")) return "json";
        return "text";
    }
  };

  const language = getLanguageFromPath(filePath);

  // 접기/펼치기 상태 관리
  const [isExpanded, setIsExpanded] = useState(false);
  const MAX_LINES = 20; // 최대 표시 줄 수
  const contentLines = content.split("\n");
  const shouldCollapse = contentLines.length > MAX_LINES;
  const displayContent =
    shouldCollapse && !isExpanded
      ? contentLines.slice(0, MAX_LINES).join("\n")
      : content;

  return (
    <Renderer className="bg-blue-50 border-blue-200">
      <Renderer.Header
        title={title}
        icon={<FileText className="w-4 h-4 text-blue-500" />}
        titleClassName="text-blue-800"
        rightContent={
          <div className="flex items-center space-x-2">
            {/* 파일 내용 복사 버튼 */}
            {content &&
              renderCopyButton(
                content,
                `file-content-${filePath}`,
                "파일 내용 복사"
              )}

            <div className="text-xs text-gray-600">
              {numLines > 0 && totalLines > 0 && (
                <span>
                  {startLine}-{startLine + numLines - 1} / {totalLines} 줄
                </span>
              )}
            </div>
          </div>
        }
      />

      <Renderer.Content>
        {filePath && (
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-600 mb-1">
              파일 경로:
            </div>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
              {filePath}
            </code>
          </div>
        )}

        {content && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-gray-600">내용:</div>
              {shouldCollapse && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <span>접기 ▲</span>
                    </>
                  ) : (
                    <>
                      <span>펼치기 ({contentLines.length}줄) ▼</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="rounded-lg overflow-hidden">
              <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center justify-between">
                <span>{language}</span>
                <div className="flex items-center space-x-2">
                  {startLine > 1 && (
                    <span className="text-gray-400">시작 줄: {startLine}</span>
                  )}
                  {shouldCollapse && !isExpanded && (
                    <span className="text-yellow-400">
                      {MAX_LINES}/{contentLines.length} 줄 표시 중
                    </span>
                  )}
                </div>
              </div>
              {language === "markdown" ? (
                <div className="bg-white p-4 prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100 prose-pre:bg-gray-900 prose-pre:text-gray-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayContent}
                  </ReactMarkdown>
                </div>
              ) : language === "text" ? (
                <div className="bg-white p-4">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {displayContent}
                  </pre>
                </div>
              ) : (
                <SyntaxHighlighter
                  language={
                    language === "tsx"
                      ? "typescript"
                      : language === "jsx"
                      ? "javascript"
                      : language
                  }
                  style={vscDarkPlus}
                  showLineNumbers={true}
                  startingLineNumber={startLine}
                  customStyle={{
                    margin: 0,
                    fontSize: "0.875rem",
                    lineHeight: "1.25rem",
                    maxHeight: "24rem",
                    overflow: "auto",
                  }}
                >
                  {displayContent}
                </SyntaxHighlighter>
              )}
              {shouldCollapse &&
                !isExpanded &&
                (language === "markdown" || language === "text") && (
                  <div className="bg-gradient-to-t from-white to-transparent px-4 py-3 border-t border-gray-200">
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <FileText className="w-3 h-3 inline mr-1" />
                      {contentLines.length - MAX_LINES}줄 더 보기
                    </button>
                  </div>
                )}
              {shouldCollapse &&
                !isExpanded &&
                language !== "markdown" &&
                language !== "text" && (
                  <div className="bg-gray-800 px-3 py-2 border-t border-gray-700">
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="text-xs text-blue-300 hover:text-blue-100 transition-colors"
                    >
                      <FileText className="w-3 h-3 inline mr-1" />
                      {contentLines.length - MAX_LINES}줄 더 보기
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}
      </Renderer.Content>
    </Renderer>
  );
};
