import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

import {
  User,
  Bot,
  Settings,
  MessageCircle,
  Terminal,
  Package,
  TestTube,
  Hammer,
  BarChart3,
  X,
  Check,
  Copy,
} from "lucide-react";
import type { ClaudeMessage } from "../types";
import {
  ChatHistoryRenderer,
  CodebaseContextRenderer,
  ErrorRenderer,
  GitWorkflowRenderer,
  MCPRenderer,
  StringRenderer,
  StructuredPatchRenderer,
  TerminalStreamRenderer,
  TodoUpdateRenderer,
  WebSearchRenderer,
  FileEditRenderer,
  ContentArrayRenderer,
} from "./toolResultRenderer";
import { FileContent } from "./FileContent";
import { ClaudeContentArrayRenderer, CommandRenderer } from "./contentRenderer";
import { ToolIcon } from "./ToolIcon";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageViewerProps {
  messages: ClaudeMessage[];
  isLoading: boolean;
}

interface MessageNodeProps {
  message: ClaudeMessage;
  depth: number;
  hasParent: boolean;
}

const MessageNode = ({
  message,
  depth,
  hasParent = true,
}: MessageNodeProps) => {
  // 빈 메시지인지 확인하는 함수
  const isEmptyMessage = (message: ClaudeMessage): boolean => {
    const hasContent =
      message.content &&
      (typeof message.content === "string"
        ? message.content.trim() !== ""
        : true);
    const hasToolUse =
      message.toolUse && Object.keys(message.toolUse).length > 0;
    const hasToolResult =
      message.toolUseResult && Object.keys(message.toolUseResult).length > 0;

    return !hasContent && !hasToolUse && !hasToolResult;
  };

  // 헬퍼 함수들을 먼저 정의
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case "user":
        return <User className="w-4 h-4" />;
      case "assistant":
        return <Bot className="w-4 h-4" />;
      case "system":
        return <Settings className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  // 빈 메시지 처리 - 완전히 숨기지 않고 진행 상태로 표시
  if (isEmptyMessage(message)) {
    return (
      <div
        className={`border-l-2 ${
          message.isSidechain ? "border-orange-300" : "border-gray-200"
        } ${depth === 0 ? "border-t-4" : ""} ${hasParent ? "ml-4" : "ml-0"}`}
      >
        <div className="p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <span className="text-lg">
                {depth}
                {getMessageIcon(message.type)}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <span className="font-medium text-gray-900 capitalize">
                  {message.type === "user"
                    ? "사용자"
                    : message.type === "assistant"
                    ? "Claude"
                    : "시스템"}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTime(message.timestamp)}
                </span>
                {message.isSidechain && (
                  <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                    분기
                  </span>
                )}
              </div>

              {/* 빈 메시지 상태 표시 */}
              <div className="flex items-center space-x-2 py-2">
                {message.type === "assistant" ? (
                  <>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500 italic">
                      Claude가 생각하고 있습니다...
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-500 italic">
                      세션 시작
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getMessageContent = (message: ClaudeMessage) => {
    if (message.content === null || message.content === undefined) {
      return "";
    }
    if (typeof message.content === "string") {
      return message.content;
    } else if (message.content && typeof message.content === "object") {
      // Check if it's a content array (Claude API format)
      if (Array.isArray(message.content)) {
        // Extract text from content array for assistant messages
        if (message.type === "assistant") {
          const textContent = message.content
            .filter((item: Record<string, unknown>) => item.type === "text")
            .map((item: Record<string, unknown>) => item.text as string)
            .join("\n");
          return textContent || "";
        }
        return null; // Will be handled by renderClaudeContentArray for non-assistant messages
      }
      return JSON.stringify(message.content, null, 2);
    }
    return "";
  };

  const formatErrorOutput = (error: string) => {
    // ESLint 오류 포맷 개선
    if (error.includes("eslint") && error.includes("error")) {
      return error
        .split("\n")
        .map((line) => {
          if (line.match(/^\s*\d+:\d+\s+error/)) {
            return `⚠️ ${line}`;
          }
          if (line.match(/^✖\s+\d+\s+problems/)) {
            return `\n${line}`;
          }
          return line;
        })
        .join("\n");
    }
    return error;
  };

  const renderToolUse = (toolUse: Record<string, unknown>) => {
    const toolName = toolUse.name || toolUse.tool || "Unknown Tool";

    return (
      <div className={`mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg`}>
        <div className="flex items-center space-x-2 mb-2">
          <ToolIcon toolName={toolName as string} />
          <span className="font-medium text-blue-800">
            {String(toolName)}{" "}
            {typeof toolUse.description === "string" &&
              `- ${toolUse.description}`}
          </span>
        </div>
        <div className="rounded overflow-hidden max-h-96 overflow-y-auto">
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              fontSize: "0.75rem",
              padding: "0.5rem",
            }}
          >
            {JSON.stringify(toolUse.parameters || toolUse, null, 2)}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  const renderToolResult = (toolResult: Record<string, unknown> | string) => {
    // Helper function to check if content is JSONL chat history
    const isJSONLChatHistory = (content: string): boolean => {
      try {
        const lines = content
          .trim()
          .split("\n")
          .filter((line) => line.trim());

        // Need at least 2 lines to be considered chat history
        if (lines.length < 2) return false;

        let validChatMessages = 0;
        let totalValidJson = 0;

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            totalValidJson++;

            // Check if it looks like a Claude message
            if (
              parsed &&
              typeof parsed === "object" &&
              (parsed.type === "user" || parsed.type === "assistant") &&
              (parsed.message || parsed.content)
            ) {
              validChatMessages++;
            }
          } catch {
            // If we encounter non-JSON lines, it's probably not JSONL chat history
            return false;
          }
        }

        // Consider it chat history if:
        // 1. All lines are valid JSON
        // 2. At least 50% are valid chat messages
        // 3. Have at least 2 valid chat messages
        return (
          totalValidJson === lines.length &&
          validChatMessages >= 2 &&
          validChatMessages / totalValidJson >= 0.5
        );
      } catch {
        return false;
      }
    };

    // Handle string toolUseResult first (like file trees, directory listings, errors)
    if (typeof toolResult === "string") {
      // Check if it's an error message
      if (toolResult.startsWith("Error: ")) {
        return <ErrorRenderer error={toolResult} />;
      }

      // Check if string content is JSONL chat history
      if (isJSONLChatHistory(toolResult)) {
        return <ChatHistoryRenderer content={toolResult} />;
      }

      return <StringRenderer result={toolResult} />;
    }

    // Handle Claude Code specific formats first

    // Handle MCP tool results
    if (
      (toolResult.type === "mcp_tool_call" || toolResult.server) &&
      (toolResult.method || toolResult.function)
    ) {
      return <MCPRenderer mcpData={toolResult} />;
    }

    // Handle codebase context
    if (
      toolResult.type === "codebase_context" ||
      toolResult.files_analyzed !== undefined ||
      toolResult.filesAnalyzed !== undefined ||
      toolResult.context_window !== undefined ||
      toolResult.contextWindow !== undefined
    ) {
      return <CodebaseContextRenderer contextData={toolResult} />;
    }

    // Handle terminal stream output
    if (
      toolResult.type === "terminal_stream" ||
      (toolResult.command &&
        toolResult.output &&
        (toolResult.stream || toolResult.stdout || toolResult.stderr))
    ) {
      return (
        <TerminalStreamRenderer
          command={toolResult.command as string}
          stream={toolResult.stream as string}
          output={toolResult.output as string}
          timestamp={toolResult.timestamp as string}
          exitCode={toolResult.exitCode as number}
        />
      );
    }

    // Handle Git workflow results
    if (
      toolResult.type === "git_workflow" ||
      (toolResult.command &&
        typeof toolResult.command === "string" &&
        (String(toolResult.command).startsWith("git ") ||
          toolResult.git_command)) ||
      toolResult.status ||
      toolResult.diff ||
      toolResult.commit
    ) {
      return <GitWorkflowRenderer gitData={toolResult} />;
    }

    // Handle web search results
    if (
      toolResult.query &&
      typeof toolResult.query === "string" &&
      Array.isArray(toolResult.results) &&
      toolResult.results.length > 0
    ) {
      // Additional check: first result often starts with "I'll search"
      const firstResult = toolResult.results[0];
      if (
        typeof firstResult === "string" &&
        (firstResult.includes("I'll search") || firstResult.includes("search"))
      ) {
        return <WebSearchRenderer searchData={toolResult} />;
      }
      // Even without "I'll search", if it has query + results structure, treat as web search
      return <WebSearchRenderer searchData={toolResult} />;
    }

    // Handle todo updates
    if (
      toolResult.newTodos !== undefined ||
      toolResult.oldTodos !== undefined
    ) {
      return <TodoUpdateRenderer todoData={toolResult} />;
    }

    // Handle file object parsing
    if (toolResult.file && typeof toolResult.file === "object") {
      const fileData = toolResult.file as Record<string, unknown>;

      // Check if file content is JSONL chat history
      if (
        fileData.content &&
        typeof fileData.content === "string" &&
        isJSONLChatHistory(fileData.content)
      ) {
        return <ChatHistoryRenderer content={fileData.content} />;
      }

      return <FileContent fileData={fileData} />;
    }

    // Handle file edit results
    if (
      toolResult.filePath &&
      typeof toolResult.filePath === "string" &&
      (toolResult.oldString || toolResult.newString || toolResult.originalFile)
    ) {
      return <FileEditRenderer toolResult={toolResult} />;
    }

    // Handle structured patch results
    if (
      toolResult.structuredPatch &&
      Array.isArray(toolResult.structuredPatch) &&
      toolResult.filePath &&
      typeof toolResult.filePath === "string"
    ) {
      return <StructuredPatchRenderer toolResult={toolResult} />;
    }

    // Handle direct content that might be JSONL chat history
    if (
      toolResult.content &&
      typeof toolResult.content === "string" &&
      isJSONLChatHistory(toolResult.content)
    ) {
      return <ChatHistoryRenderer content={toolResult.content} />;
    }

    // Handle content array with text objects (Claude API response)
    if (Array.isArray(toolResult.content) && toolResult.content.length > 0) {
      return <ContentArrayRenderer toolResult={toolResult} />;
    }

    // Handle direct content as string (non-chat history)
    if (
      toolResult.content &&
      typeof toolResult.content === "string" &&
      !toolResult.stdout &&
      !toolResult.stderr
    ) {
      return <StringRenderer result={toolResult.content} />;
    }

    // Handle generic structured results with various properties
    const hasError =
      toolResult.stderr &&
      typeof toolResult.stderr === "string" &&
      toolResult.stderr.length > 0;
    const stdout =
      typeof toolResult.stdout === "string" ? toolResult.stdout : "";
    const stderr =
      typeof toolResult.stderr === "string" ? toolResult.stderr : "";
    const filePath =
      typeof toolResult.filePath === "string" ? toolResult.filePath : "";
    const interrupted =
      typeof toolResult.interrupted === "boolean"
        ? toolResult.interrupted
        : null;
    const isImage =
      typeof toolResult.isImage === "boolean" ? toolResult.isImage : null;

    // 메타데이터가 있는지 확인
    const hasMetadata = interrupted !== null || isImage !== null;
    const hasOutput =
      stdout.length > 0 || stderr.length > 0 || filePath.length > 0;

    // Handle completely generic objects (fallback)
    if (!hasOutput && !hasMetadata && Object.keys(toolResult).length > 0) {
      return (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Check className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-gray-800">도구 실행 결과</span>
          </div>
          <div className="text-sm">
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                fontSize: "0.75rem",
                padding: "0.5rem",
              }}
            >
              {JSON.stringify(toolResult, null, 2)}
            </SyntaxHighlighter>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`mt-2 p-3 border rounded-lg ${
          hasError ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        }`}
      >
        <div className="flex items-center space-x-2 mb-2">
          {hasError ? (
            <X className="w-4 h-4 text-red-500" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}
          <span
            className={`font-medium ${
              hasError ? "text-red-800" : "text-green-800"
            }`}
          >
            도구 실행 결과
          </span>
        </div>

        {/* 메타데이터 정보 */}
        {hasMetadata && (
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            {interrupted !== null && (
              <div className="bg-white p-2 rounded border">
                <div className="text-gray-600">실행 상태</div>
                <div
                  className={`font-medium ${
                    interrupted ? "text-orange-600" : "text-green-600"
                  }`}
                >
                  {interrupted ? "중단됨" : "완료"}
                </div>
              </div>
            )}
            {isImage !== null && (
              <div className="bg-white p-2 rounded border">
                <div className="text-gray-600">이미지 결과</div>
                <div
                  className={`font-medium ${
                    isImage ? "text-blue-600" : "text-gray-600"
                  }`}
                >
                  {isImage ? "포함" : "없음"}
                </div>
              </div>
            )}
          </div>
        )}

        {stdout.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-medium text-gray-600 mb-1">출력:</div>
            {renderStdout(stdout)}
          </div>
        )}

        {stderr.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-medium text-red-600 mb-1">에러:</div>
            <pre className="text-sm text-red-700 whitespace-pre-wrap bg-white p-2 rounded border max-h-96 overflow-y-auto">
              {formatErrorOutput(stderr)}
            </pre>
          </div>
        )}

        {filePath.length > 0 && (
          <div className="text-xs text-gray-600">
            파일: <code className="bg-gray-100 px-1 rounded">{filePath}</code>
          </div>
        )}

        {/* 출력이 없을 때 상태 표시 */}
        {!hasOutput && hasMetadata && (
          <div className="text-sm text-gray-500 italic">출력 없음</div>
        )}

        {/* 완전히 빈 결과일 때 */}
        {!hasOutput && !hasMetadata && (
          <div className="text-sm text-gray-500 italic">
            실행 완료 (출력 없음)
          </div>
        )}
      </div>
    );
  };

  const renderStdout = (stdout: string) => {
    // 다양한 출력 유형 감지
    const isTestOutput =
      stdout.includes("Test Suites:") ||
      stdout.includes("jest") ||
      stdout.includes("coverage");
    const isBuildOutput =
      stdout.includes("webpack") ||
      stdout.includes("build") ||
      stdout.includes("compile");
    const isPackageOutput =
      stdout.includes("npm") ||
      stdout.includes("yarn") ||
      stdout.includes("pnpm");
    const isJsonOutput =
      stdout.trim().startsWith("{") && stdout.trim().endsWith("}");
    const isTableOutput =
      stdout.includes("|") &&
      stdout.includes("-") &&
      stdout.split("\n").length > 2;

    // JSON 출력 처리
    if (isJsonOutput) {
      try {
        const parsed = JSON.parse(stdout);
        return (
          <div className="bg-white rounded border">
            <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300">
              JSON 출력
            </div>
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                fontSize: "0.75rem",
              }}
            >
              {JSON.stringify(parsed, null, 2)}
            </SyntaxHighlighter>
          </div>
        );
      } catch {
        // JSON 파싱 실패시 일반 텍스트로 처리
      }
    }

    // 테스트 출력 처리
    if (isTestOutput) {
      return (
        <div className="bg-white rounded border">
          <div className="bg-green-800 px-3 py-1 text-xs text-green-100 flex items-center space-x-2">
            <TestTube className="w-4 h-4" />
            <span>테스트 결과</span>
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      );
    }

    // 빌드 출력 처리
    if (isBuildOutput) {
      return (
        <div className="bg-white rounded border">
          <div className="bg-blue-800 px-3 py-1 text-xs text-blue-100 flex items-center space-x-2">
            <Hammer className="w-4 h-4" />
            <span>빌드 출력</span>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
              {stdout}
            </pre>
          </div>
        </div>
      );
    }

    // 패키지 매니저 출력 처리
    if (isPackageOutput) {
      return (
        <div className="bg-white rounded border">
          <div className="bg-purple-800 px-3 py-1 text-xs text-purple-100 flex items-center space-x-2">
            <Package className="w-4 h-4" />
            <span>패키지 관리</span>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
              {stdout}
            </pre>
          </div>
        </div>
      );
    }

    // 테이블 형태 출력 처리
    if (isTableOutput) {
      return (
        <div className="bg-white rounded border">
          <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>표 형태 출력</span>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
              {stdout}
            </pre>
          </div>
        </div>
      );
    }

    // 기본 출력 (bash/shell)
    return (
      <div className="bg-white rounded border">
        <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center space-x-2">
          <Terminal className="w-4 h-4" />
          <span>터미널 출력</span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full px-4 py-2">
      <div className="max-w-4xl mx-auto">
        {/* 메시지 헤더 (시간, 사용자 정보) */}
        <div
          className={`flex items-center space-x-2 mb-1 text-xs text-gray-500 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <span className="font-medium">
            {depth}
            {message.type === "user"
              ? "사용자"
              : message.type === "assistant"
              ? "Claude"
              : "시스템"}
          </span>
          <span>{formatTime(message.timestamp)}</span>
          {message.isSidechain && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
              분기
            </span>
          )}
        </div>

        {/* 메시지 내용 */}
        <div className="w-full">
          {/* Message Content */}
          {getMessageContent(message) &&
            (() => {
              const content = getMessageContent(message);

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
                if (message.type === "user") {
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
                            onClick={() =>
                              navigator.clipboard.writeText(content)
                            }
                            className="p-1 rounded-full transition-colors bg-blue-600 hover:bg-blue-700 text-white"
                            title="메시지 복사하기"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                } else if (message.type === "assistant") {
                  // 어시스턴트 메시지 스타일 (마크다운 지원)
                  return (
                    <div className="mb-3 flex justify-start">
                      <div className="max-w-xs sm:max-w-md lg:max-w-2xl bg-green-500/50 text-white rounded-2xl px-4 py-3 relative group shadow-sm">
                        <div className="chat-prose chat-prose-sm max-w-none chat-prose-headings:text-white chat-prose-p:text-white chat-prose-a:text-blue-200 chat-prose-code:text-gray-900 chat-prose-code:bg-white chat-prose-code:px-1 chat-prose-code:py-0.5 chat-prose-code:rounded chat-prose-pre:bg-gray-900 chat-prose-pre:text-gray-100 chat-prose-blockquote:text-green-100 chat-prose-blockquote:border-l-4 chat-prose-blockquote:border-green-300 chat-prose-blockquote:pl-4 chat-prose-ul:text-white chat-prose-ol:text-white chat-prose-li:text-white">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                          </ReactMarkdown>
                        </div>
                        {/* 복사 버튼 */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(content)
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
              }

              // 기본 렌더링 (시스템 메시지 등)
              return (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-gray-800">
                    {content}
                  </div>
                </div>
              );
            })()}

          {/* Claude API Content Array */}
          {message.content &&
            typeof message.content === "object" &&
            Array.isArray(message.content) &&
            (message.type !== "assistant" ||
              (message.type === "assistant" &&
                !getMessageContent(message))) && (
              <div className="mb-2">
                <ClaudeContentArrayRenderer
                  content={message.content}
                  messageType={message.type}
                />
              </div>
            )}

          {/* Special case: when content is null but toolUseResult exists */}
          {!getMessageContent(message) &&
            message.toolUseResult &&
            typeof message.toolUseResult === "object" &&
            Array.isArray(message.toolUseResult.content) && (
              <div className="text-sm text-gray-600 mb-2">
                <span className="italic">도구 실행 결과:</span>
              </div>
            )}

          {/* Tool Use */}
          {message.toolUse && renderToolUse(message.toolUse)}

          {/* Tool Result */}
          {message.toolUseResult && renderToolResult(message.toolUseResult)}
        </div>
      </div>
    </div>
  );
};

export const MessageViewer: React.FC<MessageViewerProps> = ({
  messages,
  isLoading,
}) => {
  // 메시지를 트리 구조로 변환
  const buildMessageTree = (messages: ClaudeMessage[]) => {
    const messageMap = new Map<string, ClaudeMessage>();
    const roots: ClaudeMessage[] = [];

    // 모든 메시지를 맵에 저장
    messages.forEach((msg) => messageMap.set(msg.uuid, msg));

    // 루트 메시지들과 자식 메시지들 구분
    messages.forEach((msg) => {
      if (!msg.parentUuid || msg.parentUuid === null) {
        roots.push(msg);
      }
    });

    return roots;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-claude-orange"></div>
          <span>메시지를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
        <div className="mb-4">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-400" />
        </div>
        <h3 className="text-lg font-medium mb-2">메시지가 없습니다</h3>
        <p className="text-sm text-center">
          왼쪽에서 프로젝트와 세션을 선택하여
          <br />
          대화 내용을 확인하세요.
        </p>
      </div>
    );
  }

  const renderMessageTree = (
    message: ClaudeMessage,
    beforeMessage: ClaudeMessage | null,
    depth = 0,
    visitedIds = new Set<string>()
  ): React.ReactNode => {
    // 순환 참조 방지
    if (visitedIds.has(message.uuid)) {
      console.warn(`Circular reference detected for message: ${message.uuid}`);
      return null;
    }

    visitedIds.add(message.uuid);
    const children = messages.filter((m) => m.parentUuid === message.uuid);

    return (
      <div key={message.uuid}>
        <MessageNode
          message={message}
          depth={depth}
          hasParent={message.parentUuid === beforeMessage?.uuid}
        />
        {children.map((child) =>
          renderMessageTree(child, message, depth + 1, new Set(visitedIds))
        )}
      </div>
    );
  };

  const rootMessages = buildMessageTree(messages);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto">
        {rootMessages.map((message) => renderMessageTree(message, null))}
      </div>
    </div>
  );
};
