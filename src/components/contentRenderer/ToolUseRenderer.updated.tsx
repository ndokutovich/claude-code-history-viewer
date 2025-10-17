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
  FilePlus,
} from "lucide-react";
import { ToolIcon } from "../ToolIcon";
import { useState } from "react";
import { Renderer } from "../../shared/RendererHeader";
import { COLORS, HEX_COLORS } from "../../constants/colors";
import { useTranslation } from "react-i18next";

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

  // Detect language from file extension
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
      case "rb":
        return "ruby";
      case "php":
        return "php";
      case "c":
        return "c";
      case "cpp":
        return "cpp";
      case "h":
        return "c";
      case "hpp":
        return "cpp";
      case "cs":
        return "csharp";
      case "swift":
        return "swift";
      case "kt":
        return "kotlin";
      case "html":
        return "html";
      case "css":
        return "css";
      case "scss":
        return "scss";
      case "json":
        return "json";
      case "yaml":
      case "yml":
        return "yaml";
      case "xml":
        return "xml";
      case "sh":
      case "bash":
        return "bash";
      default:
        return "text";
    }
  };

  // Check if it's an Edit tool
  const isEditTool = (
    input: unknown
  ): input is { file_path: string; old_string: string; new_string: string } => {
    return !!(
      input &&
      typeof input === "object" &&
      "old_string" in input &&
      "new_string" in input
    );
  };

  // Check if it's a Write tool
  const isWriteTool = (
    input: unknown
  ): input is { file_path: string; content: string } => {
    return !!(
      toolName === "Write" &&
      input &&
      typeof input === "object" &&
      "content" in input &&
      "file_path" in input
    );
  };

  // Check if it's a Claude Assistant prompt
  const isAssistantPrompt = (
    input: unknown
  ): input is { description: string; prompt: string } => {
    return !!(
      input &&
      typeof input === "object" &&
      "description" in input &&
      "prompt" in input
    );
  };

  // Write tool specific rendering
  if (isWriteTool(toolInput)) {
    const { file_path: filePath, content } = toolInput;
    const language = getLanguageFromPath(filePath);

    return (
      <div
        className={`mt-2 p-3 ${COLORS.tools.file.bg} border ${COLORS.tools.file.border} rounded-lg`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <FilePlus className={`w-4 h-4 ${COLORS.tools.file.icon}`} />
            <span className={`font-medium ${COLORS.tools.file.text}`}>
              {t("tools.fileCreate")}
            </span>
          </div>
          {toolId && (
            <code
              className={`text-xs ${COLORS.tools.file.bgDark} px-2 py-1 rounded ${COLORS.tools.file.icon}`}
            >
              ID: {String(toolId)}
            </code>
          )}
        </div>

        {/* File path */}
        <div
          className={`mb-3 p-2 ${COLORS.ui.background.primary} rounded border`}
        >
          <div className="flex items-center space-x-2">
            <FileText className={`w-3 h-3 ${COLORS.ui.text.muted}`} />
            <code className={`text-sm font-mono ${COLORS.ui.text.secondary}`}>
              {filePath}
            </code>
          </div>
        </div>

        {/* File content */}
        <div>
          <div
            className={`text-xs font-medium ${COLORS.tools.file.icon} mb-2 flex items-center space-x-1`}
          >
            <CheckCircle className={`w-4 h-4 ${COLORS.tools.file.icon}`} />
            <span>{t("tools.createdContent")}</span>
          </div>
          <div
            className={`rounded overflow-hidden border ${COLORS.tools.file.border} max-h-96 overflow-y-auto`}
          >
            <SyntaxHighlighter
              language={language}
              style={oneLight}
              customStyle={{
                margin: 0,
                fontSize: "0.75rem",
                backgroundColor: HEX_COLORS.light.codeBackground,
                border: `1px solid ${HEX_COLORS.light.codeBorder}`,
              }}
            >
              {content}
            </SyntaxHighlighter>
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
        className={`mt-2 p-3 bg-linear-to-r from-purple-50 to-blue-50 border ${COLORS.tools.search.border} rounded-lg`}
      >
        {/* Header */}
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
              className={`w-4 h-4 ${COLORS.tools.search.text} ${
                openRender ? "rotate-90" : ""
              }`}
            />
            <MessageSquare className={`w-4 h-4 ${COLORS.tools.search.icon}`} />
            <span
              className={`font-bold ${COLORS.tools.search.text} text-medium`}
            >
              Task
            </span>
          </div>
          {toolId && (
            <div
              className={`flex items-center space-x-2 text-sm ${COLORS.tools.search.icon}`}
            >
              <Hash className="w-3 h-3" />
              <span className="font-mono">ID: {String(toolId)}</span>
            </div>
          )}
        </div>
        {openRender ? (
          <>
            <div className="mb-4">
              <div
                className={`text-sm font-semibold ${COLORS.tools.search.text} mb-2`}
              >
                {t("tools.taskDescription")}
              </div>
              <div
                className={`p-3 bg-white rounded-lg border ${COLORS.tools.search.bgDark} ${COLORS.ui.text.secondary}`}
              >
                {promptInput.description}
              </div>
            </div>

            {/* Prompt section */}
            <div>
              <div
                className={`text-sm font-semibold ${COLORS.tools.search.text} mb-2`}
              >
                {t("tools.detailedInstructions")}
              </div>
              <div
                className={`p-3 bg-white rounded-lg border ${COLORS.tools.search.bgDark}`}
              >
                <div
                  className={`whitespace-pre-wrap ${COLORS.ui.text.secondary} text-sm leading-relaxed`}
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

  // Edit tool specific rendering
  if (isEditTool(toolInput)) {
    const {
      file_path: filePath,
      old_string: oldString,
      new_string: newString,
    } = toolInput;
    const language = getLanguageFromPath(filePath);

    return (
      <div
        className={`mt-2 p-3 ${COLORS.tools.code.bg} border ${COLORS.tools.code.border} rounded-lg`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Edit3 className={`w-4 h-4 ${COLORS.tools.code.icon}`} />
            <span className={`font-medium ${COLORS.tools.code.text}`}>
              {t("tools.fileEdit")}
            </span>
          </div>
          {toolId && (
            <code
              className={`text-xs ${COLORS.tools.code.bgDark} px-2 py-1 rounded ${COLORS.tools.code.icon}`}
            >
              ID: {String(toolId)}
            </code>
          )}
        </div>

        {/* File path */}
        <div
          className={`mb-3 p-2 ${COLORS.ui.background.primary} rounded border`}
        >
          <div className="flex items-center space-x-2">
            <FileText className={`w-3 h-3 ${COLORS.ui.text.muted}`} />
            <code className={`text-sm font-mono ${COLORS.ui.text.secondary}`}>
              {filePath}
            </code>
          </div>
        </div>

        {/* Display changes */}
        <div className="space-y-3">
          {/* Previous code */}
          <div>
            <div
              className={`text-xs font-medium ${COLORS.semantic.error.icon} mb-1 flex items-center space-x-1`}
            >
              <X className={`w-4 h-4 ${COLORS.semantic.error.icon}`} />
              <span>{t("tools.removedCode")}</span>
            </div>
            <div
              className={`rounded overflow-hidden border ${COLORS.semantic.error.border}`}
            >
              <SyntaxHighlighter
                language={language}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  fontSize: "0.75rem",
                  backgroundColor: HEX_COLORS.light.errorLight,
                  border: `1px solid ${HEX_COLORS.light.errorBorder}`,
                }}
              >
                {oldString}
              </SyntaxHighlighter>
            </div>
          </div>

          {/* New code */}
          <div>
            <div
              className={`text-xs font-medium ${COLORS.tools.file.icon} mb-1 flex items-center space-x-1`}
            >
              <CheckCircle className={`w-4 h-4 ${COLORS.tools.file.icon}`} />
              <span>{t("tools.addedCode")}</span>
            </div>
            <div
              className={`rounded overflow-hidden border ${COLORS.tools.file.border}`}
            >
              <SyntaxHighlighter
                language={language}
                style={oneLight}
                customStyle={{
                  margin: 0,
                  fontSize: "0.75rem",
                  backgroundColor: HEX_COLORS.light.successLight,
                  border: `1px solid ${HEX_COLORS.light.successBorder}`,
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

  // Default tool rendering
  return (
    <Renderer className={`${COLORS.tools.code.bg} ${COLORS.tools.code.border}`}>
      <Renderer.Header
        title={toolName as string}
        icon={
          <ToolIcon
            toolName={toolName as string}
            className={COLORS.tools.code.icon}
          />
        }
        titleClassName={COLORS.tools.code.text}
        rightContent={
          toolId && (
            <code
              className={`text-xs ${COLORS.tools.code.bgDark} px-2 py-1 rounded ${COLORS.tools.code.icon}`}
            >
              ID: {String(toolId)}
            </code>
          )
        }
      />

      <Renderer.Content>
        <div className="rounded overflow-hidden max-h-96 overflow-y-auto">
          <div
            className={`${COLORS.ui.background.dark} px-3 py-1 text-xs ${COLORS.ui.text.inverse}`}
          >
            {t("tools.inputParameters")}
          </div>
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              fontSize: "0.75rem",
              maxHeight: "24rem",
            }}
            wrapLongLines={true}
          >
            {JSON.stringify(toolInput, null, 2)}
          </SyntaxHighlighter>
        </div>
      </Renderer.Content>
    </Renderer>
  );
};
