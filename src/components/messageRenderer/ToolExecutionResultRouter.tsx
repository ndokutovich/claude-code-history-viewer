import React from "react";
import { Check } from "lucide-react";
import {
  ClaudeSessionHistoryRenderer,
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
  FileListRenderer,
  FallbackRenderer,
} from "../toolResultRenderer";
import { FileContent } from "../FileContent";
import { CommandOutputDisplay } from "./CommandOutputDisplay";
import { formatClaudeErrorOutput } from "../../utils/messageUtils";
import { Renderer } from "../../shared/RendererHeader";

interface ToolExecutionResultRouterProps {
  toolResult: Record<string, unknown> | string;
  depth: number;
}

export const ToolExecutionResultRouter: React.FC<
  ToolExecutionResultRouterProps
> = ({ toolResult }) => {
  // Helper function to check if content is JSONL Claude session history
  const isClaudeSessionHistory = (content: string): boolean => {
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

    // Check if string content is JSONL Claude session history
    if (isClaudeSessionHistory(toolResult)) {
      return <ClaudeSessionHistoryRenderer content={toolResult} />;
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
  if (toolResult.newTodos !== undefined || toolResult.oldTodos !== undefined) {
    return <TodoUpdateRenderer todoData={toolResult} />;
  }

  // Handle file list results
  if (
    Array.isArray(toolResult.filenames) &&
    toolResult.filenames.length > 0 &&
    typeof toolResult.numFiles === "number"
  ) {
    return <FileListRenderer toolResult={toolResult} />;
  }

  // Handle file object parsing
  if (toolResult.file && typeof toolResult.file === "object") {
    const fileData = toolResult.file as Record<string, unknown>;

    // Check if file content is JSONL Claude session history
    if (
      fileData.content &&
      typeof fileData.content === "string" &&
      isClaudeSessionHistory(fileData.content)
    ) {
      return <ClaudeSessionHistoryRenderer content={fileData.content} />;
    }

    return <FileContent fileData={fileData} title="파일 내용" />;
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

  // Handle direct content that might be JSONL Claude session history
  if (
    toolResult.content &&
    typeof toolResult.content === "string" &&
    isClaudeSessionHistory(toolResult.content)
  ) {
    return <ClaudeSessionHistoryRenderer content={toolResult.content} />;
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
  const stdout = typeof toolResult.stdout === "string" ? toolResult.stdout : "";
  const stderr = typeof toolResult.stderr === "string" ? toolResult.stderr : "";
  const filePath =
    typeof toolResult.filePath === "string" ? toolResult.filePath : "";
  const interrupted =
    typeof toolResult.interrupted === "boolean" ? toolResult.interrupted : null;
  const isImage =
    typeof toolResult.isImage === "boolean" ? toolResult.isImage : null;

  // 메타데이터가 있는지 확인
  const hasMetadata = interrupted !== null || isImage !== null;
  const hasOutput =
    stdout.length > 0 || stderr.length > 0 || filePath.length > 0;

  // Handle completely generic objects (fallback)
  if (!hasOutput && !hasMetadata && Object.keys(toolResult).length > 0) {
    return <FallbackRenderer toolResult={toolResult} />;
  }

  return (
    <Renderer
      className="bg-green-50 border-green-200"
      hasError={hasError as boolean}
    >
      <Renderer.Header
        title="도구 실행 결과"
        titleClassName="text-green-800"
        icon={<Check className="w-4 h-4 text-green-500" />}
      />
      <Renderer.Content>
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
            <CommandOutputDisplay stdout={stdout} />
          </div>
        )}

        {stderr.length > 0 && (
          <div className="mb-2">
            <div className="text-xs font-medium text-red-600 mb-1">에러:</div>
            <pre className="text-sm text-red-700 whitespace-pre-wrap bg-white p-2 rounded border max-h-96 overflow-y-auto">
              {formatClaudeErrorOutput(stderr)}
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
      </Renderer.Content>
    </Renderer>
  );
};
