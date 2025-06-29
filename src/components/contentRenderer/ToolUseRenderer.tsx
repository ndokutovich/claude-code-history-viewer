"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  FileText,
  Edit3,
  MessageSquare,
  Hash,
  ChevronRight,
  X,
  CheckCircle,
} from "lucide-react";
import { ToolIcon } from "../ToolIcon";
import { useState } from "react";
import { Renderer } from "../../shared/RendererHeader";

type Props = {
  toolUse: Record<string, unknown>;
};

export const ToolUseRenderer = ({ toolUse }: Props) => {
  const [openRender, setOpenRender] = useState(false);
  const toolName = toolUse.name || "Unknown Tool";
  const toolId = toolUse.id || "";
  const toolInput = toolUse.input || {};

  const toggleOpenRender = () => {
    setOpenRender(!openRender);
  };

  // Claude Assistant 프롬프트 형태인지 확인
  const isAssistantPrompt = (input: unknown): boolean => {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return (
      "description" in obj &&
      "prompt" in obj &&
      typeof obj.description === "string" &&
      typeof obj.prompt === "string"
    );
  };

  // Claude Assistant 프롬프트 전용 렌더링
  if (isAssistantPrompt(toolInput)) {
    const promptInput = toolInput as { description: string; prompt: string };

    return (
      <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
        {/* 헤더 */}
        <div
          className={`flex items-center justify-between ${
            openRender ? "mb-4" : ""
          }`}
        >
          <div
            className="flex items-center space-x-2 cursor-pointer"
            onClick={toggleOpenRender}
          >
            <ChevronRight
              className={`w-4 h-4 text-purple-800 ${
                openRender ? "rotate-90" : ""
              }`}
            />
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <span className="font-bold text-purple-800 text-medium">Task</span>
          </div>
          {toolId && (
            <div className="flex items-center space-x-2 text-sm text-purple-700">
              <Hash className="w-3 h-3" />
              <span className="font-mono">ID: {String(toolId)}</span>
            </div>
          )}
        </div>
        {openRender ? (
          <>
            <div className="mb-4">
              <div className="text-sm font-semibold text-purple-800 mb-2">
                📋 작업 설명
              </div>
              <div className="p-3 bg-white rounded-lg border border-purple-100 text-gray-700">
                {promptInput.description}
              </div>
            </div>

            {/* 프롬프트 섹션 */}
            <div>
              <div className="text-sm font-semibold text-purple-800 mb-2">
                💬 상세 지시사항
              </div>
              <div className="p-3 bg-white rounded-lg border border-purple-100">
                <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {promptInput.prompt}
                </div>
              </div>
            </div>
          </>
        ) : null}
        {/* 설명 섹션 */}
      </div>
    );
  }

  // Edit 도구인지 확인
  const isEditTool =
    toolName === "Edit" ||
    (typeof toolInput === "object" &&
      toolInput !== null &&
      "file_path" in toolInput &&
      "old_string" in toolInput &&
      "new_string" in toolInput);

  // Edit 도구 전용 렌더링
  if (isEditTool && typeof toolInput === "object" && toolInput !== null) {
    const editToolInput = toolInput as Record<string, unknown>;
    const filePath = (editToolInput.file_path as string) || "";
    const oldString = (editToolInput.old_string as string) || "";
    const newString = (editToolInput.new_string as string) || "";

    // 파일 확장자로 언어 감지
    const getLanguageFromPath = (path: string): string => {
      const ext = path.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "ts":
          return "typescript";
        case "tsx":
          return "typescript";
        case "js":
          return "javascript";
        case "jsx":
          return "javascript";
        case "py":
          return "python";
        case "java":
          return "java";
        case "rs":
          return "rust";
        case "go":
          return "go";
        case "php":
          return "php";
        case "rb":
          return "ruby";
        default:
          return "text";
      }
    };

    const language = getLanguageFromPath(filePath);

    return (
      <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800">파일 편집</span>
          </div>
          {toolId && (
            <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-700">
              ID: {String(toolId)}
            </code>
          )}
        </div>

        {/* 파일 경로 */}
        <div className="mb-3 p-2 bg-gray-50 rounded border">
          <div className="flex items-center space-x-2">
            <FileText className="w-3 h-3 text-gray-500" />
            <code className="text-sm font-mono text-gray-700">{filePath}</code>
          </div>
        </div>

        {/* 변경 내용 */}
        <div className="space-y-3">
          {/* 기존 코드 */}
          <div>
            <div className="text-xs font-medium text-red-700 mb-1 flex items-center space-x-1">
              <X className="w-5 h-5 text-red-700" />
              <span>제거된 코드</span>
            </div>
            <div className="rounded overflow-hidden border border-red-200">
              <SyntaxHighlighter
                language={language}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  fontSize: "0.75rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
                {oldString}
              </SyntaxHighlighter>
            </div>
          </div>

          {/* 새로운 코드 */}
          <div>
            <div className="text-xs font-medium text-green-700 mb-1 flex items-center space-x-1">
              <CheckCircle className="w-4 h-4 text-green-700" />
              <span>추가된 코드</span>
            </div>
            <div className="rounded overflow-hidden border border-green-200">
              <SyntaxHighlighter
                language={language}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  fontSize: "0.75rem",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                }}
              >
                {newString}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 기본 도구 렌더링
  return (
    <Renderer className="bg-blue-50 border-blue-200 ">
      <Renderer.Header
        title={toolName as string}
        icon={<ToolIcon toolName={toolName as string} />}
        titleClassName="text-blue-800"
        rightContent={
          toolId && (
            <code className="text-xs bg-blue-100 px-2 py-1 rounded text-blue-700">
              ID: {String(toolId)}
            </code>
          )
        }
      />

      <Renderer.Content>
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
      </Renderer.Content>
    </Renderer>
  );
};
