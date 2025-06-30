"use client";

import { Highlight, themes } from "prism-react-renderer";
import {
  FileText,
  MessageSquare,
  Hash,
  ChevronRight,
  CheckCircle,
  FilePlus,
} from "lucide-react";
import { ToolIcon } from "../ToolIcon";
import { useState } from "react";
import { Renderer } from "../../shared/RendererHeader";
import { cn } from "../../utils/cn";
import { COLORS } from "../../constants/colors";
import { FileEditRenderer } from "../toolResultRenderer/FileEditRenderer";

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

  // 파일 확장자로 언어 감지 - Write 도구에서만 사용
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

  // Write 도구인지 확인
  const isWriteTool =
    toolName === "Write" ||
    (typeof toolInput === "object" &&
      toolInput !== null &&
      "file_path" in toolInput &&
      "content" in toolInput);

  // Edit 도구인지 확인
  const isEditTool =
    toolName === "Edit" ||
    (typeof toolInput === "object" &&
      toolInput !== null &&
      "file_path" in toolInput &&
      "old_string" in toolInput &&
      "new_string" in toolInput);

  // Write 도구 전용 렌더링
  if (isWriteTool && typeof toolInput === "object" && toolInput !== null) {
    const writeToolInput = toolInput as Record<string, unknown>;
    const filePath = (writeToolInput.file_path as string) || "";
    const content = (writeToolInput.content as string) || "";
    const language = getLanguageFromPath(filePath);

    return (
      <div
        className={cn(
          "mt-2 p-3 rounded-lg",
          COLORS.semantic.success.bg,
          COLORS.semantic.success.border
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FilePlus className={cn("w-4 h-4", COLORS.semantic.success.icon)} />
            <span className={cn("font-medium", COLORS.semantic.success.text)}>
              파일 작성
            </span>
          </div>
          {toolId && (
            <code
              className={cn(
                "text-xs px-2 py-1 rounded",
                COLORS.semantic.success.bg,
                COLORS.semantic.success.text
              )}
            >
              ID: {String(toolId)}
            </code>
          )}
        </div>

        {/* 파일 경로 */}
        <div
          className={cn(
            "mb-3 p-2 rounded border",
            COLORS.semantic.info.bg,
            COLORS.semantic.info.border
          )}
        >
          <div className="flex items-center space-x-2">
            <FileText className={cn("w-3 h-3", COLORS.semantic.info.icon)} />
            <code
              className={cn("text-sm font-mono", COLORS.semantic.info.text)}
            >
              {filePath}
            </code>
          </div>
        </div>

        {/* 파일 내용 */}
        <div>
          <div
            className={cn(
              "text-xs font-medium mb-2 flex items-center space-x-1",
              COLORS.semantic.success.text
            )}
          >
            <CheckCircle
              className={cn("w-4 h-4", COLORS.semantic.success.icon)}
            />
            <span>작성된 내용</span>
          </div>
          <div
            className={cn(
              "rounded overflow-hidden max-h-96 overflow-y-auto",
              COLORS.semantic.success.bg,
              COLORS.semantic.success.border
            )}
          >
            <Highlight
              theme={themes.vsLight}
              code={content}
              language={language}
            >
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  className={className}
                  style={{
                    ...style,
                    margin: 0,
                    fontSize: "0.75rem",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "0.5rem",
                  }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line, key: i })}>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token, key })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          </div>
        </div>
      </div>
    );
  }

  // Claude Assistant 프롬프트 전용 렌더링
  if (isAssistantPrompt(toolInput)) {
    const promptInput = toolInput as { description: string; prompt: string };

    return (
      <div
        className={cn(
          "mt-2 p-3 rounded-lg",
          COLORS.semantic.info.bg,
          COLORS.semantic.info.border
        )}
      >
        {/* 헤더 */}
        <div
          className={cn(
            "flex items-center justify-between",
            openRender && "mb-4"
          )}
        >
          <div
            className={cn(
              "flex items-center space-x-2 cursor-pointer",
              COLORS.semantic.info.text
            )}
            onClick={toggleOpenRender}
          >
            <ChevronRight
              className={cn(
                "w-4 h-4",
                COLORS.semantic.info.text,
                openRender && "rotate-90"
              )}
            />
            <MessageSquare
              className={cn("w-4 h-4", COLORS.semantic.info.icon)}
            />
            <span
              className={cn("font-bold text-medium", COLORS.semantic.info.text)}
            >
              Task
            </span>
          </div>
          {toolId && (
            <div
              className={cn(
                "flex items-center space-x-2 text-sm",
                COLORS.semantic.info.text
              )}
            >
              <Hash className={cn("w-3 h-3", COLORS.semantic.info.icon)} />
              <span className={cn("font-mono", COLORS.semantic.info.text)}>
                ID: {String(toolId)}
              </span>
            </div>
          )}
        </div>
        {openRender ? (
          <>
            <div className="mb-4">
              <div
                className={cn(
                  "text-sm font-semibold mb-2",
                  COLORS.semantic.info.text
                )}
              >
                📋 작업 설명
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg",
                  COLORS.semantic.info.bg,
                  COLORS.semantic.info.border,
                  COLORS.semantic.info.text
                )}
              >
                {promptInput.description}
              </div>
            </div>

            {/* 프롬프트 섹션 */}
            <div>
              <div
                className={cn(
                  "text-sm font-semibold mb-2",
                  COLORS.semantic.info.text
                )}
              >
                💬 상세 지시사항
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg",
                  COLORS.semantic.info.bg,
                  COLORS.semantic.info.border,
                  COLORS.semantic.info.text
                )}
              >
                <div
                  className={cn(
                    "whitespace-pre-wrap text-sm leading-relaxed",
                    COLORS.semantic.info.text
                  )}
                >
                  {promptInput.prompt}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // Edit 도구 전용 렌더링 - FileEditRenderer 사용
  if (isEditTool && typeof toolInput === "object" && toolInput !== null) {
    const editToolInput = toolInput as Record<string, unknown>;
    const filePath = (editToolInput.file_path as string) || "";
    const oldString = (editToolInput.old_string as string) || "";
    const newString = (editToolInput.new_string as string) || "";
    const replaceAll = (editToolInput.replace_all as boolean) || false;
    
    // FileEditRenderer가 기대하는 형식으로 데이터 변환
    const toolResult = {
      filePath,
      oldString,
      newString,
      replaceAll,
      originalFile: "", // 원본 파일 내용은 tool use에서는 제공되지 않음
      userModified: false, // tool use 단계에서는 아직 사용자 수정이 없음
    };
    
    return <FileEditRenderer toolResult={toolResult} />;
  }

  // 기본 도구 렌더링
  return (
    <Renderer
      className={cn(COLORS.semantic.info.bg, COLORS.semantic.info.border)}
    >
      <Renderer.Header
        title={toolName as string}
        icon={
          <ToolIcon
            toolName={toolName as string}
            className={COLORS.semantic.info.icon}
          />
        }
        titleClassName={cn(COLORS.semantic.info.text)}
        rightContent={
          toolId && (
            <code
              className={cn(
                "text-xs px-2 py-1 rounded",
                COLORS.semantic.info.bg,
                COLORS.semantic.info.text
              )}
            >
              ID: {String(toolId)}
            </code>
          )
        }
      />

      <Renderer.Content>
        <div className="rounded overflow-hidden max-h-96 overflow-y-auto">
          <div
            className={cn(
              "px-3 py-1 text-xs",
              COLORS.ui.background.dark,
              COLORS.ui.text.inverse
            )}
          >
            도구 입력 매개변수
          </div>
          <Highlight
            theme={themes.vsDark}
            code={JSON.stringify(toolInput, null, 2)}
            language="json"
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={className}
                style={{
                  ...style,
                  margin: 0,
                  fontSize: "0.75rem",
                  padding: "0.5rem",
                }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line, key: i })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token, key })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      </Renderer.Content>
    </Renderer>
  );
};
