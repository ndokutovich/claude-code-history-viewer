import { X, Check, FileText, AlertTriangle, Folder, File } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useCopyButton } from "../../hooks/useCopyButton";

type Props = {
  toolResult: Record<string, unknown>;
  index: number;
};

export const ToolResultRenderer = ({ toolResult, index }: Props) => {
  const { renderCopyButton } = useCopyButton();
  const toolUseId = toolResult.tool_use_id || "";
  const content = toolResult.content || "";
  const isError = toolResult.is_error === true;

  // 줄 번호가 붙은 파일 내용인지 감지하는 함수
  const isNumberedFileContent = (text: string): boolean => {
    if (typeof text !== "string") return false;

    // 멀티라인에서 "숫자→" 패턴이 있는지 확인
    const hasNumberedLines = /^\s*\d+→/m.test(text);
    // 여러 줄이 있는지 확인
    const hasMultipleLines = text.split("\n").length > 1;
    // 최소 2개 이상의 줄 번호가 있는지 확인
    const numberedLineCount = (text.match(/^\s*\d+→/gm) || []).length;

    return hasNumberedLines && hasMultipleLines && numberedLineCount >= 2;
  };

  // system-reminder 태그와 기타 시스템 메시지를 분리하는 함수
  const separateSystemContent = (
    text: string
  ): {
    codeContent: string;
    systemMessages: Array<{ type: string; content: string }>;
  } => {
    if (typeof text !== "string")
      return { codeContent: text, systemMessages: [] };

    const systemMessages: Array<{ type: string; content: string }> = [];
    let codeContent = text;

    // system-reminder 태그 추출
    const systemReminderMatch = text.match(
      /<system-reminder>(.*?)<\/system-reminder>/s
    );
    if (
      systemReminderMatch &&
      systemReminderMatch[0] &&
      systemReminderMatch[1]
    ) {
      systemMessages.push({
        type: "system-reminder",
        content: systemReminderMatch[1].trim(),
      });
      codeContent = codeContent.replace(systemReminderMatch[0], "").trim();
    }

    return { codeContent, systemMessages };
  };

  // 줄 번호를 제거하고 원본 코드를 추출하는 함수
  const extractCodeFromNumberedLines = (
    text: string
  ): { code: string; language: string; description: string } => {
    const lines = text.split("\n");
    const codeLines: string[] = [];
    const descriptionLines: string[] = [];
    let detectedLanguage = "text"; // 기본값

    for (const line of lines) {
      const match = line.match(/^\s*\d+→(.*)$/);
      if (match && match[1] !== undefined) {
        codeLines.push(match[1]);
      } else if (line.trim()) {
        // 줄 번호가 없는 줄은 설명 텍스트로 분류
        descriptionLines.push(line.trim());
      }
    }

    const code = codeLines.join("\n");
    const description = descriptionLines.join(" ");

    // 코드 내용으로부터 언어 감지
    if (
      code.includes("import ") &&
      (code.includes("from ") || code.includes("require("))
    ) {
      if (
        code.includes("type ") ||
        code.includes("interface ") ||
        code.includes(": string") ||
        code.includes(": number")
      ) {
        detectedLanguage = "typescript";
      } else {
        detectedLanguage = "javascript";
      }
    } else if (
      (code.includes("use ") && code.includes("struct ")) ||
      code.includes("fn ") ||
      code.includes("let mut ")
    ) {
      detectedLanguage = "rust";
    } else if (code.includes("def ") && code.includes("import ")) {
      detectedLanguage = "python";
    } else if (code.includes("package ") && code.includes("public class ")) {
      detectedLanguage = "java";
    }

    return { code, language: detectedLanguage, description };
  };

  // 시스템 메시지를 렌더링하는 함수
  const renderSystemMessages = (
    messages: Array<{ type: string; content: string }>
  ) => {
    if (messages.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm"
          >
            <div className="flex items-center space-x-2 mb-1">
              <AlertTriangle className="w-3 h-3 text-yellow-600" />
              <span className="font-medium text-yellow-800 capitalize">
                {msg.type?.replace("-", " ") || "System Message"}
              </span>
            </div>
            <div className="text-yellow-700 text-xs">{msg.content}</div>
          </div>
        ))}
      </div>
    );
  };

  // 파일 검색 결과인지 감지하는 함수
  const isFileSearchResult = (text: string): boolean => {
    if (typeof text !== "string") return false;

    const lines = text.trim().split("\n");
    if (lines.length < 2) return false;

    // "Found X files" 패턴이나 파일 경로들이 있는지 확인
    const hasFoundPattern = /^Found \d+ files?/i.test(lines[0] ?? "");
    const hasFilePaths = lines
      .slice(1)
      .some(
        (line) =>
          line.trim().length > 0 &&
          (line.includes("/") || line.includes("\\")) &&
          (line.includes(".ts") ||
            line.includes(".js") ||
            line.includes(".tsx") ||
            line.includes(".jsx") ||
            line.includes(".py") ||
            line.includes(".java") ||
            line.includes(".rs") ||
            line.includes(".go") ||
            line.includes(".php") ||
            line.includes(".rb") ||
            line.includes(".vue") ||
            line.includes(".svelte"))
      );

    return hasFoundPattern || (lines.length >= 3 && hasFilePaths);
  };

  // 파일 검색 결과를 렌더링하는 함수
  const renderFileSearchResult = (text: string) => {
    const lines = text.trim().split("\n");
    const headerLine = lines[0];
    const filePaths = lines.slice(1).filter((line) => line.trim().length > 0);

    return (
      <div className="space-y-2">
        {/* 헤더 */}
        <div className="flex items-center space-x-2 p-2 bg-blue-100 rounded">
          <Folder className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-blue-800">{headerLine}</span>
        </div>

        {/* 파일 목록 */}
        <div className="space-y-1">
          {filePaths.map((filePath, idx) => {
            const pathParts = filePath.split("/");
            const lastPart = pathParts[pathParts.length - 1];
            const fileName: string = lastPart ? lastPart : filePath;
            const directory = filePath.substring(0, filePath.lastIndexOf("/"));

            return (
              <div
                key={idx}
                className="flex items-center space-x-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
              >
                <File className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-gray-900 truncate">
                    {fileName}
                  </div>
                  {directory && (
                    <div className="font-mono text-xs text-gray-500 truncate">
                      {directory}
                    </div>
                  )}
                </div>
                {renderCopyButton(filePath, `file-path-${idx}`, "경로 복사")}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // content 처리
  // 줄 번호가 붙은 파일 내용 처리 (우선순위 높음)
  if (typeof content === "string" && isNumberedFileContent(content)) {
    const { codeContent, systemMessages } = separateSystemContent(content);
    const { code, language, description } =
      extractCodeFromNumberedLines(codeContent);

    return (
      <div
        className={`mt-2 p-3 border rounded-lg ${
          isError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {isError ? (
              <X className="w-4 h-4 text-red-500" />
            ) : (
              <FileText className="w-4 h-4 text-green-500" />
            )}
            <span
              className={`font-medium ${
                isError ? "text-red-800" : "text-green-800"
              }`}
            >
              파일 내용
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {renderCopyButton(code, `tool-result-code-${index}`, "코드 복사")}
            {toolUseId && (
              <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                Tool ID: {String(toolUseId)}
              </code>
            )}
          </div>
        </div>

        {/* 설명 텍스트 */}
        {description && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
            <div className="text-blue-800">{description}</div>
          </div>
        )}

        <div className="rounded-lg overflow-hidden">
          <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center justify-between">
            <span>{language}</span>
            <span className="text-gray-400">{code.split("\n").length} 줄</span>
          </div>
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            showLineNumbers={true}
            customStyle={{
              margin: 0,
              fontSize: "0.875rem",
              lineHeight: "1.25rem",
              maxHeight: "32rem",
              overflow: "auto",
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>

        {/* 시스템 메시지들 렌더링 */}
        {renderSystemMessages(systemMessages)}
      </div>
    );
  }

  // 파일 검색 결과 처리 (줄 번호가 붙은 파일 내용 이후)
  if (typeof content === "string" && isFileSearchResult(content)) {
    const { codeContent: cleanContent, systemMessages } =
      separateSystemContent(content);

    return (
      <div
        className={`mt-2 p-3 border rounded-lg ${
          isError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {isError ? (
              <X className="w-4 h-4 text-red-500" />
            ) : (
              <Folder className="w-4 h-4 text-green-500" />
            )}
            <span
              className={`font-medium ${
                isError ? "text-red-800" : "text-green-800"
              }`}
            >
              파일 검색 결과
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {renderCopyButton(
              cleanContent,
              `file-search-result-${index}`,
              "결과 복사"
            )}
            {toolUseId && (
              <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                Tool ID: {String(toolUseId)}
              </code>
            )}
          </div>
        </div>

        {renderFileSearchResult(cleanContent)}

        {/* 시스템 메시지들 렌더링 */}
        {renderSystemMessages(systemMessages)}
      </div>
    );
  }

  // 기본 처리 (기존 로직)
  return (
    <div
      className={`mt-2 p-3 border rounded-lg ${
        isError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {isError ? (
            <X className="w-4 h-4 text-red-500" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}
          <span
            className={`font-medium ${
              isError ? "text-red-800" : "text-green-800"
            }`}
          >
            도구 실행 결과
          </span>
        </div>
        {toolUseId && (
          <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
            Tool ID: {String(toolUseId)}
          </code>
        )}
      </div>

      <div className="text-sm">
        {typeof content === "string" ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : Array.isArray(content) ? (
          // 배열 내용을 처리
          <div className="space-y-2">
            {content.map((item: unknown, idx: number) => {
              if (item && typeof item === "object") {
                const contentItem = item as Record<string, unknown>;

                // text 타입 항목 처리
                if (
                  contentItem.type === "text" &&
                  typeof contentItem.text === "string"
                ) {
                  return (
                    <div key={idx} className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {contentItem.text}
                      </ReactMarkdown>
                    </div>
                  );
                }

                // 기타 객체 항목 처리
                return (
                  <pre
                    key={idx}
                    className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border"
                  >
                    {JSON.stringify(item, null, 2)}
                  </pre>
                );
              }

              // 단순 값 처리
              return (
                <div key={idx} className="text-gray-700">
                  {String(item)}
                </div>
              );
            })}
          </div>
        ) : (
          <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white p-2 rounded border">
            {JSON.stringify(content, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
