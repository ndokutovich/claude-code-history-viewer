import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { ToolIcon } from "../ToolIcon";
import { COLORS } from "../../constants/colors";
import { cn } from "../../utils/cn";

interface ClaudeToolUseDisplayProps {
  toolUse: Record<string, unknown>;
}

export const ClaudeToolUseDisplay: React.FC<ClaudeToolUseDisplayProps> = ({
  toolUse,
}) => {
  const toolName = toolUse.name || toolUse.tool || "Unknown Tool";

  return (
    <div
      className={cn(
        "mt-2 p-3 rounded-lg",
        COLORS.message.system.bg,
        COLORS.ui.border.medium
      )}
    >
      <div className="flex items-center space-x-2 mb-2">
        <ToolIcon
          toolName={toolName as string}
          className={COLORS.message.system.text}
        />
        <span className={cn("font-medium", COLORS.message.system.text)}>
          {String(toolName)}{" "}
          {typeof toolUse.description === "string" &&
            `- ${toolUse.description}`}
        </span>
      </div>
      <div className="rounded overflow-hidden max-h-96 overflow-y-auto">
        <Highlight
          theme={themes.vsDark}
          code={JSON.stringify(toolUse.parameters || toolUse, null, 2)}
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
    </div>
  );
};
