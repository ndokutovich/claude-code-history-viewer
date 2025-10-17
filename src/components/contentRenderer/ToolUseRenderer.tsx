"use client";

import { Highlight, themes } from "prism-react-renderer";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("components");
  const [openRender, setOpenRender] = useState(false);
  const toolName = toolUse.name || "Unknown Tool";
  const toolId = toolUse.id || "";
  const toolInput = toolUse.input || {};

  const toggleOpenRender = () => {
    setOpenRender(!openRender);
  };

  // Detect language from file extension - used only for Write tool
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

  // Check if it's a Claude Assistant prompt format
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

  // Check if it's a Write tool
  const isWriteTool =
    toolName === "Write" ||
    (typeof toolInput === "object" &&
      toolInput !== null &&
      "file_path" in toolInput &&
      "content" in toolInput);

  // Check if it's an Edit tool
  const isEditTool =
    toolName === "Edit" ||
    (typeof toolInput === "object" &&
      toolInput !== null &&
      "file_path" in toolInput &&
      "old_string" in toolInput &&
      "new_string" in toolInput);

  // Write tool specific rendering
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
              {t("toolUseRenderer.fileCreation")}
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

        {/* File path */}
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

        {/* File content */}
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
            <span>{t("toolUseRenderer.createdContent")}</span>
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

  // Claude Assistant prompt specific rendering
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
        {/* Header */}
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
              {t("toolUseRenderer.task")}
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
                {t("toolUseRenderer.taskDescription")}
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

            {/* Prompt section */}
            <div>
              <div
                className={cn(
                  "text-sm font-semibold mb-2",
                  COLORS.semantic.info.text
                )}
              >
                {t("toolUseRenderer.detailedInstructions")}
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

  // Edit tool specific rendering - uses FileEditRenderer
  if (isEditTool && typeof toolInput === "object" && toolInput !== null) {
    const editToolInput = toolInput as Record<string, unknown>;
    const filePath = (editToolInput.file_path as string) || "";
    const oldString = (editToolInput.old_string as string) || "";
    const newString = (editToolInput.new_string as string) || "";
    const replaceAll = (editToolInput.replace_all as boolean) || false;

    // Convert data to format expected by FileEditRenderer
    const toolResult = {
      filePath,
      oldString,
      newString,
      replaceAll,
      originalFile: "", // Original file content not provided in tool use
      userModified: false, // No user modifications yet in tool use stage
    };

    return <FileEditRenderer toolResult={toolResult} />;
  }

  // Default tool rendering
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
            {t("toolUseRenderer.toolInputParameters")}
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
