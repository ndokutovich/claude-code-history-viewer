import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReactDiffViewer from "react-diff-viewer-continued";
import Prism from "prismjs";
import * as Diff from "diff";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-json";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-bash";

import {
  User,
  Bot,
  Settings,
  MessageCircle,
  Terminal,
  FileText,
  Edit,
  Search,
  FileEdit,
  Globe,
  Wrench,
  Package,
  TestTube,
  Hammer,
  BarChart3,
  X,
  Check,
  Clipboard,
  Folder,
  RefreshCw,
  Columns,
  AlignLeft,
  GitBranch,
} from "lucide-react";
import type { ClaudeMessage } from "../types";

interface MessageViewerProps {
  messages: ClaudeMessage[];
  isLoading: boolean;
}

interface MessageNodeProps {
  message: ClaudeMessage;
  depth: number;
  hasParent: boolean;
}

const MessageNode: React.FC<MessageNodeProps> = ({
  message,
  depth,
  hasParent = true,
}) => {
  console.log("message", message, depth);

  // 클립보드 복사 상태 관리
  const [copyStates, setCopyStates] = useState<
    Record<string, "idle" | "copying" | "success" | "error">
  >({});

  // 클립보드 복사 헬퍼 함수
  const copyToClipboard = async (text: string, id: string) => {
    setCopyStates((prev) => ({ ...prev, [id]: "copying" }));

    try {
      await navigator.clipboard.writeText(text);
      setCopyStates((prev) => ({ ...prev, [id]: "success" }));

      // 2초 후 상태 초기화
      setTimeout(() => {
        setCopyStates((prev) => ({ ...prev, [id]: "idle" }));
      }, 2000);
    } catch (error) {
      console.error("클립보드 복사 실패:", error);
      setCopyStates((prev) => ({ ...prev, [id]: "error" }));

      // 2초 후 상태 초기화
      setTimeout(() => {
        setCopyStates((prev) => ({ ...prev, [id]: "idle" }));
      }, 2000);
    }
  };

  // 복사 버튼 렌더링 헬퍼
  const renderCopyButton = (
    text: string,
    id: string,
    label: string = "복사"
  ) => {
    const state = copyStates[id] || "idle";

    return (
      <button
        onClick={() => copyToClipboard(text, id)}
        disabled={state === "copying"}
        className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
          state === "success"
            ? "bg-green-100 text-green-700"
            : state === "error"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }`}
        title={`${label}하기`}
      >
        {state === "copying" ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>복사 중...</span>
          </>
        ) : state === "success" ? (
          <>
            <Check className="w-3 h-3" />
            <span>복사됨</span>
          </>
        ) : state === "error" ? (
          <>
            <X className="w-3 h-3" />
            <span>실패</span>
          </>
        ) : (
          <>
            <Clipboard className="w-3 h-3" />
            <span>{label}</span>
          </>
        )}
      </button>
    );
  };

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
                ) : depth === 0 ? (
                  <>
                    <span className="text-sm text-gray-500 italic">
                      세션 시작
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-500 italic">
                      처리 중...
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

  const getToolIcon = (toolName: string) => {
    const name = toolName.toLowerCase();
    if (name.includes("bash") || name.includes("command"))
      return <Terminal className="w-4 h-4" />;
    if (name.includes("read") || name.includes("file"))
      return <FileText className="w-4 h-4" />;
    if (name.includes("edit") || name.includes("write"))
      return <Edit className="w-4 h-4" />;
    if (name.includes("search") || name.includes("grep"))
      return <Search className="w-4 h-4" />;
    if (name.includes("todo")) return <FileEdit className="w-4 h-4" />;
    if (name.includes("web") || name.includes("fetch"))
      return <Globe className="w-4 h-4" />;
    if (name.includes("task") || name.includes("agent"))
      return <Bot className="w-4 h-4" />;
    return <Wrench className="w-4 h-4" />;
  };

  const getMessageContent = (message: ClaudeMessage) => {
    if (message.content === null || message.content === undefined) {
      return "";
    }
    if (typeof message.content === "string") {
      return message.content;
    } else if (message.content && typeof message.content === "object") {
      // Check if it's a content array (Claude API format)
      if (Array.isArray(message.content)) {
        return null; // Will be handled by renderClaudeContentArray
      }
      return JSON.stringify(message.content, null, 2);
    }
    return "";
  };

  const renderThinkingContent = (text: string, index: number) => {
    // Extract thinking content and regular content
    const thinkingRegex = /<thinking>(.*?)<\/thinking>/gs;
    const matches = text.match(thinkingRegex);
    const withoutThinking = text.replace(thinkingRegex, "").trim();

    return (
      <div key={index} className="space-y-2">
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
                    Claude의 사고 과정
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

  const renderCommandContent = (text: string, index: number) => {
    // Extract command message and command name
    const commandMessageRegex = /<command-message>(.*?)<\/command-message>/gs;
    const commandNameRegex = /<command-name>(.*?)<\/command-name>/gs;

    const messageMatches = text.match(commandMessageRegex);
    const nameMatches = text.match(commandNameRegex);

    const commandMessage = messageMatches
      ? messageMatches[0].replace(/<\/?command-message>/g, "").trim()
      : null;
    const commandName = nameMatches
      ? nameMatches[0].replace(/<\/?command-name>/g, "").trim()
      : null;

    // Remove command tags from original text
    const withoutCommands = text
      .replace(commandMessageRegex, "")
      .replace(commandNameRegex, "")
      .trim();

    return (
      <div key={index} className="space-y-2">
        {(commandMessage || commandName) && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Terminal className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-medium text-indigo-800">
                명령 실행
              </span>
            </div>

            <div className="space-y-2">
              {commandName && (
                <div>
                  <span className="text-xs font-medium text-indigo-700">
                    명령:
                  </span>
                  <code className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-mono">
                    {commandName}
                  </code>
                </div>
              )}

              {commandMessage && (
                <div>
                  <span className="text-xs font-medium text-indigo-700">
                    상태:
                  </span>
                  <span className="ml-2 text-sm text-indigo-600 italic">
                    {commandMessage}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {withoutCommands && (
          <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {withoutCommands}
            </ReactMarkdown>
          </div>
        )}
      </div>
    );
  };

  const renderToolUseContent = (
    toolUse: Record<string, unknown>,
    index: number
  ) => {
    const toolName = toolUse.name || "Unknown Tool";
    const toolId = toolUse.id || "";
    const toolInput = toolUse.input || {};
    const toolIcon = getToolIcon(toolName as string);

    return (
      <div
        key={index}
        className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {toolIcon}
            <span className="font-medium text-blue-800">
              {String(toolName)}
            </span>
          </div>
          {toolId && (
            <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-700">
              ID: {String(toolId)}
            </code>
          )}
        </div>

        <div className="rounded overflow-hidden max-h-96 overflow-y-auto">
          <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300">
            도구 입력 매개변수
          </div>
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              fontSize: "0.75rem",
              padding: "0.5rem",
            }}
          >
            {JSON.stringify(toolInput, null, 2)}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  };

  const renderToolResultContent = (
    toolResult: Record<string, unknown>,
    index: number
  ) => {
    const toolUseId = toolResult.tool_use_id || "";
    const content = toolResult.content || "";
    const isError = toolResult.is_error === true;

    return (
      <div
        key={index}
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
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

  // renderClaudeContentArray 함수 추가
  const renderClaudeContentArray = (content: unknown[]) => {
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
                return renderCommandContent(contentItem.text, index);
              }

              // Check for thinking tags
              if (
                contentItem.text.includes("<thinking>") &&
                contentItem.text.includes("</thinking>")
              ) {
                return renderThinkingContent(contentItem.text, index);
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
              return renderToolUseContent(contentItem, index);
            }

            // Handle tool result content
            if (contentItem.type === "tool_result") {
              return renderToolResultContent(contentItem, index);
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
    const toolIcon = getToolIcon(toolName as string);

    return (
      <div className={`mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg`}>
        <div className="flex items-center space-x-2 mb-2">
          {toolIcon}
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
        return renderErrorResult(toolResult);
      }

      // Check if string content is JSONL chat history
      if (isJSONLChatHistory(toolResult)) {
        return renderChatHistory(toolResult);
      }

      return renderStringResult(toolResult);
    }

    // Handle Claude Code specific formats first

    // Handle MCP tool results
    if (
      (toolResult.type === "mcp_tool_call" || toolResult.server) &&
      (toolResult.method || toolResult.function)
    ) {
      return renderMCPToolResult(toolResult, 0);
    }

    // Handle codebase context
    if (
      toolResult.type === "codebase_context" ||
      toolResult.files_analyzed !== undefined ||
      toolResult.filesAnalyzed !== undefined ||
      toolResult.context_window !== undefined ||
      toolResult.contextWindow !== undefined
    ) {
      return renderCodebaseContext(toolResult, 0);
    }

    // Handle terminal stream output
    if (
      toolResult.type === "terminal_stream" ||
      (toolResult.command &&
        toolResult.output &&
        (toolResult.stream || toolResult.stdout || toolResult.stderr))
    ) {
      return renderTerminalStream(toolResult, 0);
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
      return renderGitWorkflow(toolResult, 0);
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
        return renderWebSearchResult(toolResult);
      }
      // Even without "I'll search", if it has query + results structure, treat as web search
      return renderWebSearchResult(toolResult);
    }

    // Handle todo updates
    if (
      toolResult.newTodos !== undefined ||
      toolResult.oldTodos !== undefined
    ) {
      return renderTodoUpdate(toolResult);
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
        return renderChatHistory(fileData.content);
      }

      return <FileContent fileData={fileData} />;
    }

    // Handle file edit results
    if (
      toolResult.filePath &&
      typeof toolResult.filePath === "string" &&
      (toolResult.oldString || toolResult.newString || toolResult.originalFile)
    ) {
      return renderFileEditResult(toolResult);
    }

    // Handle structured patch results
    if (
      toolResult.structuredPatch &&
      Array.isArray(toolResult.structuredPatch) &&
      toolResult.filePath &&
      typeof toolResult.filePath === "string"
    ) {
      return renderStructuredPatchResult(toolResult);
    }

    // Handle direct content that might be JSONL chat history
    if (
      toolResult.content &&
      typeof toolResult.content === "string" &&
      isJSONLChatHistory(toolResult.content)
    ) {
      return renderChatHistory(toolResult.content);
    }

    // Handle content array with text objects (Claude API response)
    if (Array.isArray(toolResult.content) && toolResult.content.length > 0) {
      return renderContentArray(toolResult);
    }

    // Handle direct content as string (non-chat history)
    if (
      toolResult.content &&
      typeof toolResult.content === "string" &&
      !toolResult.stdout &&
      !toolResult.stderr
    ) {
      return renderStringResult(toolResult.content);
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

  const FileContent: React.FC<{ fileData: Record<string, unknown> }> = ({
    fileData,
  }) => {
    const content =
      typeof fileData.content === "string" ? fileData.content : "";
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
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span className="font-medium text-blue-800">
              변경 이전 파일 내용
            </span>
          </div>
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
        </div>

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
      </div>
    );
  };

  const StringResult: React.FC<{ result: string }> = ({ result }) => {
    // 파일 트리나 디렉토리 구조인지 확인
    const isFileTree =
      result.includes("/") &&
      (result.includes("- ") || result.includes("├") || result.includes("└"));

    // 접기/펼치기 상태 관리
    const [isExpanded, setIsExpanded] = useState(false);
    const MAX_LINES = 15; // 최대 표시 줄 수
    const resultLines = result.split("\n");
    const shouldCollapse = resultLines.length > MAX_LINES;
    const displayResult =
      shouldCollapse && !isExpanded
        ? resultLines.slice(0, MAX_LINES).join("\n")
        : result;

    return (
      <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {isFileTree ? (
              <Folder className="w-4 h-4" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span className="font-medium text-green-800">
              {isFileTree ? "파일 구조" : "도구 실행 결과"}
            </span>
          </div>
          {shouldCollapse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors"
            >
              {isExpanded ? (
                <>
                  <span>접기 ▲</span>
                </>
              ) : (
                <>
                  <span>펼치기 ({resultLines.length}줄) ▼</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="bg-white rounded border">
          {isFileTree ? (
            <div className="p-3 font-mono text-sm text-gray-800 whitespace-pre-wrap">
              {displayResult}
            </div>
          ) : (
            <div className="p-3 prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100 prose-pre:bg-gray-900 prose-pre:text-gray-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayResult}
              </ReactMarkdown>
            </div>
          )}
          {shouldCollapse && !isExpanded && (
            <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
              >
                <FileText className="w-3 h-3 inline mr-1" />
                {resultLines.length - MAX_LINES}줄 더 보기
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStructuredPatchResult = (toolResult: Record<string, unknown>) => {
    const filePath =
      typeof toolResult.filePath === "string" ? toolResult.filePath : "";
    const content =
      typeof toolResult.content === "string" ? toolResult.content : "";
    const patches = Array.isArray(toolResult.structuredPatch)
      ? toolResult.structuredPatch
      : [];

    // Reconstruct old and new content from patches
    const reconstructDiff = () => {
      if (patches.length === 0) return { oldStr: "", newStr: "" };

      const oldLines: string[] = [];
      const newLines: string[] = [];

      patches.forEach((patch: Record<string, unknown>) => {
        if (Array.isArray(patch.lines)) {
          patch.lines.forEach((line: unknown) => {
            if (typeof line === "string") {
              if (line.startsWith("-")) {
                oldLines.push(line.substring(1));
              } else if (line.startsWith("+")) {
                newLines.push(line.substring(1));
              } else {
                // Context line (no prefix or space prefix)
                const contextLine = line.startsWith(" ")
                  ? line.substring(1)
                  : line;
                oldLines.push(contextLine);
                newLines.push(contextLine);
              }
            }
          });
        }
      });

      return {
        oldStr: oldLines.join("\n"),
        newStr: newLines.join("\n"),
      };
    };

    const { oldStr, newStr } = reconstructDiff();

    return (
      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <RefreshCw className="w-4 h-4" />
          <span className="font-medium text-orange-800">
            파일 변경 사항 (Patch)
          </span>
        </div>

        {/* 파일 정보 */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            파일 경로:
          </div>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
            {filePath}
          </code>
        </div>

        {/* 변경 통계 */}
        {patches.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-600 mb-1">
              변경 통계:
            </div>
            <div className="bg-white p-2 rounded border text-xs">
              <span className="text-orange-600 font-medium">
                {patches.length}개 영역
              </span>
              에서 변경사항 발견
            </div>
          </div>
        )}

        {/* Diff Viewer */}
        {patches.length > 0 && (oldStr || newStr) && (
          <EnhancedDiffViewer
            oldText={oldStr}
            newText={newStr}
            filePath={filePath}
            showAdvancedDiff={true}
          />
        )}

        {/* 전체 파일 내용 */}
        {content && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">
              업데이트된 파일:
            </div>
            <FileContent
              fileData={{
                content: content,
                filePath: filePath,
                numLines: content.split("\n").length,
                startLine: 1,
                totalLines: content.split("\n").length,
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const renderFileEditResult = (toolResult: Record<string, unknown>) => {
    const filePath =
      typeof toolResult.filePath === "string" ? toolResult.filePath : "";
    const oldString =
      typeof toolResult.oldString === "string" ? toolResult.oldString : "";
    const newString =
      typeof toolResult.newString === "string" ? toolResult.newString : "";
    const originalFile =
      typeof toolResult.originalFile === "string"
        ? toolResult.originalFile
        : "";
    const replaceAll =
      typeof toolResult.replaceAll === "boolean"
        ? toolResult.replaceAll
        : false;
    const userModified =
      typeof toolResult.userModified === "boolean"
        ? toolResult.userModified
        : false;

    return (
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Edit className="w-4 h-4" />
            <span className="font-medium text-blue-800">파일 편집 결과</span>
          </div>

          {/* 최종 결과물 복사 버튼 */}
          <div className="flex items-center space-x-2">
            {newString &&
              renderCopyButton(
                newString,
                `edit-result-${filePath}`,
                "변경된 결과 결과 복사"
              )}
            {originalFile &&
              renderCopyButton(
                originalFile,
                `original-file-${filePath}`,
                "원본 파일 복사"
              )}
          </div>
        </div>

        {/* 파일 경로 */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            파일 경로:
          </div>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
            {filePath}
          </code>
        </div>

        {/* 편집 정보 */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600">편집 유형</div>
            <div className="font-medium text-blue-600">
              {replaceAll ? "전체 교체" : "부분 교체"}
            </div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600">사용자 수정</div>
            <div
              className={`font-medium ${
                userModified ? "text-orange-600" : "text-green-600"
              }`}
            >
              {userModified ? "있음" : "없음"}
            </div>
          </div>
        </div>

        {/* 변경 내용 - Enhanced Diff Viewer 사용 */}
        {oldString && newString && (
          <EnhancedDiffViewer
            oldText={oldString}
            newText={newString}
            filePath={filePath}
            showAdvancedDiff={true}
          />
        )}

        {/* 원본 파일 내용 (접기/펼치기 가능) */}
        {originalFile && (
          <div>
            <FileContent
              fileData={{
                content: originalFile,
                filePath: filePath,
                numLines: originalFile.split("\n").length,
                startLine: 1,
                totalLines: originalFile.split("\n").length,
              }}
            />
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

  const renderStringResult = (result: string) => {
    return <StringResult result={result} />;
  };

  const renderErrorResult = (error: string) => {
    // Extract the error details
    const errorMessage = error.replace("Error: ", "");

    return (
      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <X className="w-4 h-4 text-red-500" />
          <span className="font-medium text-red-800">도구 실행 오류</span>
        </div>
        <div className="text-sm text-red-700 whitespace-pre-wrap max-h-80 overflow-y-scroll">
          {errorMessage}
        </div>
      </div>
    );
  };

  const renderChatHistory = (content: string) => {
    try {
      // Split by lines and filter out empty lines
      const lines = content.split("\n").filter((line) => line.trim());
      const parsedMessages: Record<string, unknown>[] = [];

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          parsedMessages.push(parsed);
        } catch {
          // Skip invalid JSON lines
          continue;
        }
      }

      // Filter out summary messages and keep only user/assistant messages
      const chatMessages = parsedMessages.filter(
        (msg) => msg.type === "user" || msg.type === "assistant"
      );

      if (chatMessages.length === 0) {
        return (
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium text-gray-800">채팅 기록</span>
            </div>
            <p className="text-gray-600 text-sm">
              유효한 채팅 메시지가 없습니다.
            </p>
          </div>
        );
      }

      return (
        <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <MessageCircle className="w-4 h-4" />
            <span className="font-medium text-purple-800">
              채팅 기록 ({chatMessages.length}개 메시지)
            </span>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  msg.type === "user"
                    ? "bg-blue-100 border-l-4 border-blue-400"
                    : "bg-green-100 border-l-4 border-green-400"
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  {msg.type === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                  <span className="font-medium text-sm">
                    {msg.type === "user" ? "사용자" : "Claude"}
                  </span>
                  {typeof msg.timestamp === "string" && (
                    <span className="text-xs text-gray-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  )}
                </div>
                <div className="text-sm">
                  {typeof msg.message === "object" &&
                  msg.message !== null &&
                  "content" in msg.message ? (
                    typeof msg.message.content === "string" ? (
                      <div className="prose prose-sm max-w-none prose-gray">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.message.content}
                        </ReactMarkdown>
                      </div>
                    ) : Array.isArray(msg.message.content) ? (
                      <div className="space-y-2">
                        {msg.message.content.map(
                          (item: Record<string, unknown>, idx: number) => (
                            <div key={idx}>
                              {item.type === "text" &&
                                typeof item.text === "string" && (
                                  <div className="prose prose-sm max-w-none prose-gray">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {item.text}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              {item.type === "tool_use" && (
                                <div className="bg-gray-100 p-2 rounded text-xs">
                                  <span className="font-medium">
                                    <Wrench className="w-4 h-4 inline mr-1" />
                                    {typeof item.name === "string"
                                      ? item.name
                                      : "Unknown Tool"}
                                  </span>
                                  {item.input &&
                                  typeof item.input === "object" &&
                                  item.input !== null ? (
                                    <pre className="mt-1 text-xs overflow-x-auto">
                                      {JSON.stringify(item.input, null, 2)}
                                    </pre>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    ) : msg.message.content ? (
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(msg.message.content, null, 2)}
                      </pre>
                    ) : null
                  ) : (
                    <span className="text-gray-500 italic">내용 없음</span>
                  )}
                </div>
                {typeof msg.message === "object" &&
                  msg.message !== null &&
                  "usage" in msg.message &&
                  typeof msg.message.usage === "object" &&
                  msg.message.usage !== null && (
                    <div className="mt-2 text-xs text-gray-600">
                      <span>
                        토큰:{" "}
                        {"input_tokens" in msg.message.usage &&
                        typeof msg.message.usage.input_tokens === "number"
                          ? msg.message.usage.input_tokens
                          : "?"}
                        →
                        {"output_tokens" in msg.message.usage &&
                        typeof msg.message.usage.output_tokens === "number"
                          ? msg.message.usage.output_tokens
                          : "?"}
                      </span>
                      {"model" in msg.message &&
                        typeof msg.message.model === "string" && (
                          <span className="ml-2">
                            모델: {msg.message.model}
                          </span>
                        )}
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      );
    } catch {
      return (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <X className="w-4 h-4 text-red-500" />
            <span className="font-medium text-red-800">
              채팅 기록 파싱 오류
            </span>
          </div>
          <p className="text-red-600 text-sm">
            채팅 데이터를 파싱하는 중 오류가 발생했습니다.
          </p>
          <details className="mt-2">
            <summary className="text-sm cursor-pointer">
              원본 데이터 보기
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {content}
            </pre>
          </details>
        </div>
      );
    }
  };

  const renderContentArray = (toolResult: Record<string, unknown>) => {
    const content = Array.isArray(toolResult.content) ? toolResult.content : [];
    const totalDurationMs =
      typeof toolResult.totalDurationMs === "number"
        ? toolResult.totalDurationMs
        : null;
    const totalTokens =
      typeof toolResult.totalTokens === "number"
        ? toolResult.totalTokens
        : null;
    const totalToolUseCount =
      typeof toolResult.totalToolUseCount === "number"
        ? toolResult.totalToolUseCount
        : null;
    const wasInterrupted =
      typeof toolResult.wasInterrupted === "boolean"
        ? toolResult.wasInterrupted
        : null;
    const usage =
      toolResult.usage && typeof toolResult.usage === "object"
        ? (toolResult.usage as Record<string, unknown>)
        : null;

    return (
      <div className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Bot className="w-4 h-4" />
          <span className="font-medium text-indigo-800">Claude API 응답</span>
        </div>

        {/* 메타데이터 정보 */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          {totalDurationMs && (
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">실행 시간</div>
              <div className="font-medium">
                {(totalDurationMs / 1000).toFixed(2)}초
              </div>
            </div>
          )}
          {totalTokens && (
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">총 토큰</div>
              <div className="font-medium">{totalTokens.toLocaleString()}</div>
            </div>
          )}
          {totalToolUseCount && (
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">도구 사용 횟수</div>
              <div className="font-medium">{totalToolUseCount}</div>
            </div>
          )}
          {wasInterrupted !== null && (
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">중단 여부</div>
              <div
                className={`font-medium ${
                  wasInterrupted ? "text-red-600" : "text-green-600"
                }`}
              >
                {wasInterrupted ? "중단됨" : "완료"}
              </div>
            </div>
          )}
        </div>

        {/* 사용량 정보 */}
        {usage && (
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-600 mb-1">
              토큰 사용량:
            </div>
            <div className="bg-white p-2 rounded border text-xs">
              <div className="grid grid-cols-2 gap-2">
                {typeof usage.input_tokens === "number" && (
                  <div>
                    <span className="text-gray-600">입력:</span>
                    <span className="font-medium ml-1">
                      {usage.input_tokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {typeof usage.output_tokens === "number" && (
                  <div>
                    <span className="text-gray-600">출력:</span>
                    <span className="font-medium ml-1">
                      {usage.output_tokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {typeof usage.cache_creation_input_tokens === "number" && (
                  <div>
                    <span className="text-gray-600">캐시 생성:</span>
                    <span className="font-medium ml-1">
                      {usage.cache_creation_input_tokens.toLocaleString()}
                    </span>
                  </div>
                )}
                {typeof usage.cache_read_input_tokens === "number" && (
                  <div>
                    <span className="text-gray-600">캐시 읽기:</span>
                    <span className="font-medium ml-1">
                      {usage.cache_read_input_tokens.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 콘텐츠 */}
        {content.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">내용:</div>
            <div className="space-y-2">
              {content.map((item: unknown, index: number) => {
                if (!item || typeof item !== "object") {
                  return (
                    <div key={index} className="bg-white p-3 rounded border">
                      <div className="text-xs text-gray-500 mb-1">
                        타입: unknown
                      </div>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </div>
                  );
                }

                const itemObj = item as Record<string, unknown>;

                return (
                  <div
                    key={index}
                    className="bg-white p-3 rounded border max-h-80 overflow-y-auto"
                  >
                    {itemObj.type === "text" &&
                      typeof itemObj.text === "string" && (
                        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100 prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
                          {itemObj.text.includes("<thinking>") &&
                          itemObj.text.includes("</thinking>") ? (
                            renderThinkingContent(itemObj.text, index)
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {itemObj.text}
                            </ReactMarkdown>
                          )}
                        </div>
                      )}
                    {itemObj.type === "tool_use" && (
                      <div>{renderToolUseContent(itemObj, index)}</div>
                    )}
                    {itemObj.type === "tool_result" && (
                      <div>{renderToolResultContent(itemObj, index)}</div>
                    )}
                    {!["text", "tool_use", "tool_result"].includes(
                      itemObj.type as string
                    ) && (
                      <div>
                        <div className="text-xs text-gray-500 mb-1">
                          타입: {String(itemObj.type || "unknown")}
                        </div>
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(item, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWebSearchResult = (searchData: Record<string, unknown>) => {
    const query = typeof searchData.query === "string" ? searchData.query : "";
    const results = Array.isArray(searchData.results) ? searchData.results : [];
    const durationSeconds =
      typeof searchData.durationSeconds === "number"
        ? searchData.durationSeconds
        : null;

    return (
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Globe className="w-4 h-4" />
          <span className="font-medium text-blue-800">웹 검색 결과</span>
        </div>

        {/* 검색 정보 */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            검색 쿼리:
          </div>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
            {query}
          </code>
        </div>

        {/* 메타데이터 */}
        {durationSeconds && (
          <div className="mb-3 text-xs">
            <div className="bg-white p-2 rounded border">
              <div className="text-gray-600">검색 소요 시간</div>
              <div className="font-medium text-blue-600">
                {durationSeconds.toFixed(2)}초
              </div>
            </div>
          </div>
        )}

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">
              검색 결과 ({results.length}개):
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {results.map((result: unknown, index: number) => (
                <div
                  key={index}
                  className="bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  {typeof result === "string" ? (
                    (() => {
                      // 문자열이 JSON인지 확인하고 파싱 시도
                      try {
                        const trimmed = result.trim();
                        if (
                          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                          (trimmed.startsWith("[") && trimmed.endsWith("]"))
                        ) {
                          const parsed = JSON.parse(trimmed);

                          // 파싱된 객체가 웹 검색 결과 구조인지 확인
                          if (parsed && typeof parsed === "object") {
                            const title =
                              typeof parsed.title === "string"
                                ? parsed.title
                                : null;
                            const url =
                              typeof parsed.url === "string"
                                ? parsed.url
                                : null;
                            const description =
                              typeof parsed.description === "string"
                                ? parsed.description
                                : null;

                            if (title || url || description) {
                              return (
                                <div className="space-y-2">
                                  {/* Title */}
                                  {title && (
                                    <div className="space-y-1">
                                      <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                        {title}
                                      </h4>
                                    </div>
                                  )}

                                  {/* URL */}
                                  {url && (
                                    <div className="flex items-center space-x-2">
                                      <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-green-600 hover:text-green-800 hover:underline truncate"
                                        title={url}
                                      >
                                        {url.length > 60
                                          ? `${url.substring(0, 60)}...`
                                          : url}
                                      </a>
                                    </div>
                                  )}

                                  {/* Description */}
                                  {description && (
                                    <div className="text-sm text-gray-700 leading-relaxed">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                      >
                                        {description}
                                      </ReactMarkdown>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          }
                        }
                      } catch {
                        // JSON 파싱 실패시 일반 텍스트로 처리
                      }

                      // 일반 마크다운 텍스트로 처리
                      return (
                        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {result}
                          </ReactMarkdown>
                        </div>
                      );
                    })()
                  ) : result && typeof result === "object" ? (
                    <div>
                      {/* Handle structured web search result */}
                      {(() => {
                        const resultObj = result as Record<string, unknown>;
                        const title =
                          typeof resultObj.title === "string"
                            ? resultObj.title
                            : null;
                        const url =
                          typeof resultObj.url === "string"
                            ? resultObj.url
                            : null;
                        const description =
                          typeof resultObj.description === "string"
                            ? resultObj.description
                            : null;

                        // 웹 검색 결과 구조인지 확인
                        if (title || url || description) {
                          return (
                            <div className="space-y-2">
                              {/* Title */}
                              {title && (
                                <div className="space-y-1">
                                  <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                    {title}
                                  </h4>
                                </div>
                              )}

                              {/* URL */}
                              {url && (
                                <div className="flex items-center space-x-2">
                                  <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-green-600 hover:text-green-800 hover:underline truncate"
                                    title={url}
                                  >
                                    {url.length > 60
                                      ? `${url.substring(0, 60)}...`
                                      : url}
                                  </a>
                                </div>
                              )}

                              {/* Description */}
                              {description && (
                                <div className="text-sm text-gray-700 leading-relaxed">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {description}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // 다른 구조화된 결과 처리
                        if (
                          "content" in resultObj &&
                          Array.isArray(resultObj.content)
                        ) {
                          return (
                            <div className="space-y-2">
                              {resultObj.content.map(
                                (item: unknown, idx: number) => (
                                  <div key={idx}>
                                    {item &&
                                    typeof item === "object" &&
                                    "text" in item &&
                                    typeof item.text === "string" ? (
                                      <div className="prose prose-sm max-w-none">
                                        <ReactMarkdown
                                          remarkPlugins={[remarkGfm]}
                                        >
                                          {item.text}
                                        </ReactMarkdown>
                                      </div>
                                    ) : (
                                      <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-50 p-2 rounded">
                                        {JSON.stringify(item, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          );
                        }

                        // 일반적인 객체 표시
                        return (
                          <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-50 p-2 rounded">
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic">
                      알 수 없는 결과 형식
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTodoUpdate = (todoData: Record<string, unknown>) => {
    const newTodos = Array.isArray(todoData.newTodos) ? todoData.newTodos : [];
    const oldTodos = Array.isArray(todoData.oldTodos) ? todoData.oldTodos : [];

    return (
      <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Clipboard className="w-4 h-4" />
          <span className="font-medium text-purple-800">
            할 일 목록 업데이트
          </span>
        </div>

        {oldTodos.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-600 mb-1">
              이전 상태:
            </div>
            <div className="space-y-1">
              {oldTodos.map(
                (
                  todo: { content: string; status: string; priority: string },
                  idx: number
                ) => (
                  <div
                    key={idx}
                    className="text-sm flex items-center space-x-2"
                  >
                    <span
                      className={`w-4 h-4 rounded ${getTodoStatusColor(
                        todo.status
                      )}`}
                    ></span>
                    <span
                      className={
                        todo.status === "completed"
                          ? "line-through text-gray-500"
                          : ""
                      }
                    >
                      {todo.content}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({todo.priority})
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {newTodos.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">
              현재 상태:
            </div>
            <div className="space-y-1">
              {newTodos.map(
                (
                  todo: { content: string; status: string; priority: string },
                  idx: number
                ) => (
                  <div
                    key={idx}
                    className="text-sm flex items-center space-x-2"
                  >
                    <span
                      className={`w-4 h-4 rounded ${getTodoStatusColor(
                        todo.status
                      )}`}
                    ></span>
                    <span
                      className={
                        todo.status === "completed"
                          ? "line-through text-gray-500"
                          : ""
                      }
                    >
                      {todo.content}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({todo.priority})
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getTodoStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "in_progress":
        return "bg-yellow-500";
      case "pending":
        return "bg-gray-300";
      default:
        return "bg-gray-300";
    }
  };

  // Advanced Text Diff Component using jsdiff API
  const AdvancedTextDiff: React.FC<{
    oldText: string;
    newText: string;
    diffMode?:
      | "chars"
      | "words"
      | "wordsWithSpace"
      | "lines"
      | "trimmedLines"
      | "sentences";
    title?: string;
  }> = ({
    oldText,
    newText,
    diffMode = "words",
    title = "텍스트 변경 사항",
  }) => {
    const [currentMode, setCurrentMode] = useState<
      | "chars"
      | "words"
      | "wordsWithSpace"
      | "lines"
      | "trimmedLines"
      | "sentences"
    >(diffMode);
    const [isExpanded, setIsExpanded] = useState(false);

    const getDiffResults = () => {
      switch (currentMode) {
        case "chars":
          return Diff.diffChars(oldText, newText);
        case "words":
          return Diff.diffWords(oldText, newText);
        case "wordsWithSpace":
          return Diff.diffWordsWithSpace(oldText, newText);
        case "lines":
          return Diff.diffLines(oldText, newText);
        case "trimmedLines":
          return Diff.diffTrimmedLines(oldText, newText);
        case "sentences":
          return Diff.diffSentences(oldText, newText);
        default:
          return Diff.diffWords(oldText, newText);
      }
    };

    const diffResults = getDiffResults();
    const stats = diffResults.reduce(
      (acc, part) => {
        if (part.added) acc.additions++;
        else if (part.removed) acc.deletions++;
        else acc.unchanged++;
        return acc;
      },
      { additions: 0, deletions: 0, unchanged: 0 }
    );

    const renderDiffPart = (part: Diff.Change, index: number) => {
      const baseClasses = "inline";
      let colorClasses = "";
      let title = "";

      if (part.added) {
        colorClasses =
          "bg-green-100 text-green-800 border-l-2 border-green-400";
        title = "추가됨";
      } else if (part.removed) {
        colorClasses = "bg-red-100 text-red-800 border-l-2 border-red-400";
        title = "삭제됨";
      } else {
        colorClasses = "text-gray-700";
        title = "변경 없음";
      }

      // 긴 텍스트는 줄바꿈 허용
      const content =
        currentMode === "lines" || currentMode === "trimmedLines"
          ? part.value
          : part.value;

      return (
        <span
          key={index}
          className={`${baseClasses} ${colorClasses} px-1 rounded`}
          title={title}
          style={{
            whiteSpace:
              currentMode === "lines" || currentMode === "trimmedLines"
                ? "pre-wrap"
                : "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {content}
        </span>
      );
    };

    const getModeLabel = (mode: string) => {
      const labels = {
        chars: "문자 단위",
        words: "단어 단위",
        wordsWithSpace: "단어+공백 단위",
        lines: "라인 단위",
        trimmedLines: "라인 단위 (공백 무시)",
        sentences: "문장 단위",
      };
      return labels[mode as keyof typeof labels] || mode;
    };

    const shouldCollapse =
      diffResults.length > 20 || oldText.length + newText.length > 1000;

    return (
      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FileEdit className="w-4 h-4" />
            <span className="font-medium text-amber-800">{title}</span>
          </div>
          {shouldCollapse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded transition-colors"
            >
              {isExpanded ? "접기 ▲" : "펼치기 ▼"}
            </button>
          )}
        </div>

        {/* Diff Mode Selector */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-2">
            비교 방식:
          </div>
          <div className="flex flex-wrap gap-1">
            {(
              [
                "chars",
                "words",
                "wordsWithSpace",
                "lines",
                "trimmedLines",
                "sentences",
              ] as const
            ).map((mode) => (
              <button
                key={mode}
                onClick={() => setCurrentMode(mode)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  currentMode === mode
                    ? "bg-amber-200 text-amber-800 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {getModeLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600">추가</div>
            <div className="font-medium text-green-600">+{stats.additions}</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600">삭제</div>
            <div className="font-medium text-red-600">-{stats.deletions}</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600">동일</div>
            <div className="font-medium text-gray-600">{stats.unchanged}</div>
          </div>
        </div>

        {/* Diff Content */}
        {(!shouldCollapse || isExpanded) && (
          <div className="bg-white p-3 rounded border max-h-96 overflow-y-auto">
            <div className="font-mono text-sm leading-relaxed">
              {diffResults.map((part, index) => renderDiffPart(part, index))}
            </div>
          </div>
        )}

        {shouldCollapse && !isExpanded && (
          <div className="bg-white p-3 rounded border text-center">
            <div className="text-sm text-gray-500">
              변경사항이 많습니다. 위의 "펼치기" 버튼을 눌러 전체 내용을
              확인하세요.
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {diffResults.length}개 변경 부분, 총{" "}
              {oldText.length + newText.length}자
            </div>
          </div>
        )}
      </div>
    );
  };

  // Enhanced Diff Viewer with multiple modes
  const EnhancedDiffViewer: React.FC<{
    oldText: string;
    newText: string;
    filePath?: string;
    showAdvancedDiff?: boolean;
  }> = ({ oldText, newText, filePath = "", showAdvancedDiff = false }) => {
    const [viewMode, setViewMode] = useState<"visual" | "advanced">("visual");
    const [splitView, setSplitView] = useState(true);

    // 파일 확장자에 따른 언어 결정
    const getLanguageFromPath = (path: string) => {
      const ext = path.split(".").pop()?.toLowerCase();
      const fileName = path.split("/").pop()?.toLowerCase() || "";

      switch (ext) {
        case "rs":
          return "rust";
        case "ts":
        case "tsx":
          return "typescript";
        case "js":
        case "jsx":
          return "javascript";
        case "py":
          return "python";
        case "json":
          return "json";
        case "css":
          return "css";
        case "scss":
        case "sass":
          return "scss";
        case "html":
        case "htm":
          return "html";
        case "yaml":
        case "yml":
          return "yaml";
        case "sh":
        case "zsh":
        case "bash":
          return "bash";
        default:
          if (fileName.includes("dockerfile")) return "dockerfile";
          if (fileName.includes("makefile")) return "makefile";
          return "text";
      }
    };

    const language = getLanguageFromPath(filePath);

    /**
     * Syntax highlighting 함수 - ReactDiffViewer의 renderContent용
     * @param str - 하이라이팅할 문자열 (undefined, null, empty string 처리)
     * @returns React Element
     */
    const highlightSyntax = (str: string | undefined | null) => {
      // 초기 안전성 검사
      if (str === null || str === undefined) {
        return <span style={{ display: "inline" }}></span>;
      }

      if (typeof str !== "string") {
        console.warn(
          "highlightSyntax received non-string value:",
          typeof str,
          str
        );
        return <span style={{ display: "inline" }}>{String(str)}</span>;
      }

      if (str.length === 0) {
        return <span style={{ display: "inline" }}></span>;
      }

      // 텍스트 언어인 경우 하이라이팅 없이 반환
      if (language === "text") {
        return <span style={{ display: "inline" }}>{str}</span>;
      }

      try {
        const prismLanguage =
          language === "typescript"
            ? "typescript"
            : language === "javascript"
            ? "javascript"
            : language === "python"
            ? "python"
            : language === "rust"
            ? "rust"
            : language === "json"
            ? "json"
            : language === "css"
            ? "css"
            : language === "scss"
            ? "scss"
            : language === "bash"
            ? "bash"
            : "markup";

        // Prism 언어 지원 확인
        const lang = Prism.languages[prismLanguage];
        if (!lang) {
          console.warn(
            `Prism language '${prismLanguage}' not found, falling back to plain text`
          );
          return <span style={{ display: "inline" }}>{str}</span>;
        }

        // 문자열 검증 (trim이 있는지 확인)
        const trimmedStr = str.trim();
        if (trimmedStr.length === 0) {
          return <span style={{ display: "inline" }}>{str}</span>;
        }

        // syntax highlighting 실행
        const highlightedHtml = Prism.highlight(str, lang, prismLanguage);
        return (
          <span
            style={{ display: "inline" }}
            dangerouslySetInnerHTML={{
              __html: highlightedHtml,
            }}
          />
        );
      } catch (error) {
        console.warn(
          "Syntax highlighting failed:",
          error,
          "for text:",
          str.substring(0, 50) + "..."
        );
        // 에러 발생 시 원본 텍스트 반환
        return <span style={{ display: "inline" }}>{str}</span>;
      }
    };

    return (
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-gray-600">변경 내용:</div>
          <div className="flex items-center space-x-2">
            {/* 이후 코드 복사 버튼 */}
            {renderCopyButton(
              newText,
              `diff-new-${filePath || "content"}`,
              "이후 코드 복사"
            )}

            {showAdvancedDiff && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setViewMode("visual")}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    viewMode === "visual"
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  시각적 뷰
                </button>
                <button
                  onClick={() => setViewMode("advanced")}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    viewMode === "advanced"
                      ? "bg-amber-100 text-amber-700 font-medium"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  고급 분석
                </button>
              </div>
            )}
            {viewMode === "visual" && (
              <button
                onClick={() => setSplitView(!splitView)}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                title={splitView ? "통합 뷰로 전환" : "분할 뷰로 전환"}
              >
                {splitView ? (
                  <>
                    <AlignLeft className="w-3 h-3" />
                    <span>통합</span>
                  </>
                ) : (
                  <>
                    <Columns className="w-3 h-3" />
                    <span>분할</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {viewMode === "visual" ? (
          <div className="border rounded-lg overflow-x-auto max-h-96">
            <ReactDiffViewer
              oldValue={oldText}
              newValue={newText}
              splitView={splitView}
              leftTitle="이전"
              rightTitle="이후"
              hideLineNumbers={false}
              renderContent={language !== "text" ? highlightSyntax : undefined}
              styles={{
                contentText: {
                  fontSize: "12px",
                },
              }}
            />
          </div>
        ) : (
          <AdvancedTextDiff
            oldText={oldText}
            newText={newText}
            title="고급 텍스트 분석"
          />
        )}
      </div>
    );
  };

  // renderClaudeContentArray 함수 뒤에 Claude Code 전용 렌더링 함수들 추가

  // MCP 도구 호출 결과 렌더링
  const renderMCPToolResult = (
    mcpData: Record<string, unknown>,
    index: number
  ) => {
    const server = mcpData.server || "unknown";
    const method = mcpData.method || "unknown";
    const params = mcpData.params || {};
    const result = mcpData.result || {};
    const error = mcpData.error;

    return (
      <div
        key={index}
        className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-purple-600" />
            <span className="font-medium text-purple-800">MCP 도구 호출</span>
          </div>
          <div className="text-xs text-purple-600">
            {String(server)}.{String(method)}
          </div>
        </div>

        <div className="space-y-2">
          {/* 매개변수 */}
          <details className="text-sm">
            <summary className="cursor-pointer text-purple-700 font-medium">
              매개변수
            </summary>
            <pre className="mt-1 p-2 bg-purple-100 rounded text-xs overflow-auto">
              {JSON.stringify(params, null, 2)}
            </pre>
          </details>

          {/* 결과 */}
          {error ? (
            <div className="p-2 bg-red-100 border border-red-200 rounded">
              <div className="text-xs font-medium text-red-800 mb-1">오류:</div>
              <div className="text-sm text-red-700">{String(error)}</div>
            </div>
          ) : (
            <details className="text-sm">
              <summary className="cursor-pointer text-purple-700 font-medium">
                실행 결과
              </summary>
              <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  // 코드베이스 컨텍스트 정보 렌더링
  const renderCodebaseContext = (
    contextData: Record<string, unknown>,
    index: number
  ) => {
    const filesAnalyzed =
      contextData.files_analyzed || contextData.filesAnalyzed || 0;
    const contextWindow =
      contextData.context_window || contextData.contextWindow || "";
    const relevantFiles =
      contextData.relevant_files || contextData.relevantFiles || [];

    return (
      <div
        key={index}
        className="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg"
      >
        <div className="flex items-center space-x-2 mb-3">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span className="font-medium text-indigo-800">
            코드베이스 컨텍스트
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-indigo-700 font-medium">분석된 파일:</span>
            <span className="ml-2 text-indigo-900">
              {String(filesAnalyzed)}개
            </span>
          </div>
          <div>
            <span className="text-indigo-700 font-medium">
              컨텍스트 윈도우:
            </span>
            <span className="ml-2 text-indigo-900">
              {String(contextWindow)}
            </span>
          </div>
        </div>

        {Array.isArray(relevantFiles) && relevantFiles.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-indigo-700 font-medium text-sm">
              관련 파일 ({relevantFiles.length}개)
            </summary>
            <div className="mt-2 space-y-1">
              {relevantFiles.slice(0, 10).map((file, idx) => (
                <div
                  key={idx}
                  className="text-xs font-mono text-indigo-800 bg-indigo-100 px-2 py-1 rounded"
                >
                  {String(file)}
                </div>
              ))}
              {relevantFiles.length > 10 && (
                <div className="text-xs text-indigo-600 italic">
                  ...및 {relevantFiles.length - 10}개 파일 더
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    );
  };

  // 터미널 스트림 출력 렌더링
  const renderTerminalStream = (
    streamData: Record<string, unknown>,
    index: number
  ) => {
    const command = streamData.command || "";
    const stream = streamData.stream || "stdout";
    const output = streamData.output || "";
    const timestamp = streamData.timestamp || "";
    const exitCode = streamData.exit_code || streamData.exitCode;

    return (
      <div key={index} className="mt-2 p-3 bg-gray-900 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="font-medium text-green-400">터미널</span>
            {command && (
              <code className="text-xs bg-gray-800 px-2 py-1 rounded text-green-300">
                {String(command)}
              </code>
            )}
          </div>
          {timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(String(timestamp)).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="relative">
          {/* 스트림 타입 표시 */}
          <div className="flex items-center space-x-2 mb-1">
            <span
              className={`text-xs px-2 py-1 rounded ${
                stream === "stderr"
                  ? "bg-red-800 text-red-200"
                  : "bg-gray-800 text-gray-300"
              }`}
            >
              {String(stream)}
            </span>
            {exitCode !== undefined && (
              <span
                className={`text-xs px-2 py-1 rounded ${
                  Number(exitCode) === 0
                    ? "bg-green-800 text-green-200"
                    : "bg-red-800 text-red-200"
                }`}
              >
                exit: {String(exitCode)}
              </span>
            )}
          </div>

          {/* 출력 내용 */}
          <pre className="text-sm text-gray-100 whitespace-pre-wrap bg-gray-800 p-2 rounded overflow-auto max-h-80">
            {String(output)}
          </pre>
        </div>
      </div>
    );
  };

  // Git 워크플로우 결과 렌더링
  const renderGitWorkflow = (
    gitData: Record<string, unknown>,
    index: number
  ) => {
    const command = gitData.command || "";
    const status = gitData.status || "";
    const files = gitData.files || [];
    const diff = gitData.diff || "";

    return (
      <div
        key={index}
        className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg"
      >
        <div className="flex items-center space-x-2 mb-3">
          <GitBranch className="w-4 h-4 text-orange-600" />
          <span className="font-medium text-orange-800">Git 워크플로우</span>
          {command && (
            <code className="text-xs bg-orange-100 px-2 py-1 rounded text-orange-700">
              git {String(command)}
            </code>
          )}
        </div>

        {status && (
          <div className="mb-2 text-sm text-orange-700">
            <span className="font-medium">상태:</span> {String(status)}
          </div>
        )}

        {Array.isArray(files) && files.length > 0 && (
          <details className="mb-2">
            <summary className="cursor-pointer text-orange-700 font-medium text-sm">
              변경된 파일 ({files.length}개)
            </summary>
            <div className="mt-2 space-y-1">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="text-xs font-mono text-orange-800 bg-orange-100 px-2 py-1 rounded"
                >
                  {String(file)}
                </div>
              ))}
            </div>
          </details>
        )}

        {diff && (
          <details>
            <summary className="cursor-pointer text-orange-700 font-medium text-sm">
              Diff 보기
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">
              {String(diff)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div
      className={`border-l-2 ${
        message.isSidechain ? "border-orange-300" : "border-gray-200"
      } ${depth === 0 ? "border-t-4" : ""} ${hasParent ? "ml-4" : "ml-0"}`}
      // style={{ marginLeft: `${depth * 20}px` }}
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
                  return renderCommandContent(content, 0);
                }

                // Regular content rendering
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
              Array.isArray(message.content) && (
                <div className="mb-2">
                  {renderClaudeContentArray(message.content)}
                </div>
              )}

            {/* Special case: when content is null but toolUseResult exists */}
            {!getMessageContent(message) &&
              message.toolUseResult &&
              typeof message.toolUseResult === "object" &&
              Array.isArray(
                (message.toolUseResult as Record<string, unknown>).content
              ) && (
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
