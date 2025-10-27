import { saveAs } from "file-saver";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";
import type { UIMessage, ContentItem, MessageFilters } from "@/types";
import { extractBashCommand } from "@/utils/messageFilters";

export type ExportMode = "formatted" | "raw";
export type ExportTheme = "light" | "dark";

/**
 * Extract text content from a message (RAW mode - simple text extraction)
 */
function extractTextContent(message: UIMessage): string {
  if (!message.content) return "";

  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item: ContentItem) => {
        if (item.type === "text") return item.text;
        if (item.type === "thinking") return `[Thinking]\n${item.thinking}`;
        if (item.type === "tool_use")
          return `[Tool: ${item.name}]\n${JSON.stringify(item.input, null, 2)}`;
        if (item.type === "tool_result") {
          const c = typeof item.content === "string" ? item.content : JSON.stringify(item.content, null, 2);
          return `[Tool Result]\n${c}`;
        }
        return "";
      })
      .join("\n\n");
  }

  return JSON.stringify(message.content, null, 2);
}

/**
 * Extract FORMATTED content from a message (for Formatted export mode)
 * Returns array of content blocks with type information for rich rendering
 */
interface FormattedContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "code";
  content: string;
  toolName?: string;
  language?: string;
}

function extractFormattedContent(message: UIMessage): FormattedContentBlock[] {
  const blocks: FormattedContentBlock[] = [];

  if (!message.content) return blocks;

  if (typeof message.content === "string") {
    // Check for code blocks in string content
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(message.content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = message.content.slice(lastIndex, match.index).trim();
        if (textBefore) {
          blocks.push({ type: "text", content: textBefore });
        }
      }

      // Add code block
      blocks.push({
        type: "code",
        content: match[2],
        language: match[1] || "text",
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < message.content.length) {
      const remaining = message.content.slice(lastIndex).trim();
      if (remaining) {
        blocks.push({ type: "text", content: remaining });
      }
    }

    if (blocks.length === 0) {
      blocks.push({ type: "text", content: message.content });
    }

    return blocks;
  }

  if (Array.isArray(message.content)) {
    message.content.forEach((item: ContentItem) => {
      if (item.type === "text") {
        // Parse text for code blocks
        const textBlocks = extractFormattedContent({ ...message, content: item.text });
        blocks.push(...textBlocks);
      } else if (item.type === "thinking") {
        blocks.push({ type: "thinking", content: item.thinking });
      } else if (item.type === "tool_use") {
        blocks.push({
          type: "tool_use",
          content: JSON.stringify(item.input, null, 2),
          toolName: item.name,
        });
      } else if (item.type === "tool_result") {
        blocks.push({
          type: "tool_result",
          content: typeof item.content === "string" ? item.content : JSON.stringify(item.content, null, 2),
        });
      }
    });
  }

  return blocks;
}

/**
 * Extract file attachments from messages (tool results with file content)
 */
export function extractFileAttachments(messages: UIMessage[]): Map<string, string> {
  const files = new Map<string, string>();

  messages.forEach((message) => {
    // Check tool use results for file content
    if (message.toolUseResult) {
      const result = message.toolUseResult;

      // File read results
      if (result && typeof result === "object" && "file" in (result as Record<string, unknown>)) {
        const fileData = (result as { file?: { filePath?: string; content?: string } }).file ?? ({} as {
          filePath?: string;
          content?: string;
        });
        if (fileData.filePath && fileData.content) {
          files.set(fileData.filePath, fileData.content);
        }
      }

      // Multi-edit results
      if (result && typeof result === "object" && "filePath" in (result as Record<string, unknown>) && "originalFileContents" in (result as Record<string, unknown>)) {
        const editData = result as {
          filePath?: string;
          originalFileContents?: string;
        };
        if (editData.filePath && editData.originalFileContents) {
          files.set(editData.filePath, editData.originalFileContents);
        }
      }
    }
  });

  return files;
}

/**
 * Export conversation to Markdown format
 */
export async function exportToMarkdown(
  messages: UIMessage[],
  sessionTitle: string,
  includeAttachments: boolean = false,
  mode: ExportMode = "formatted",
  theme: ExportTheme = "light", // Theme not used in Markdown, but kept for consistency
  filters?: MessageFilters
): Promise<string> {
  const isCommandOnly = filters?.showCommandOnly ?? false;

  let markdown = `# ${sessionTitle}\n\n`;
  markdown += `Generated: ${new Date().toISOString()}\n`;
  if (isCommandOnly) {
    markdown += `Mode: Command Only (Bash commands)\n`;
  }
  markdown += `\n---\n\n`;

  if (isCommandOnly) {
    // Command only mode - just list bash commands
    markdown += `## Bash Commands\n\n`;
    markdown += `\`\`\`bash\n`;
    messages.forEach((message) => {
      const command = extractBashCommand(message);
      if (command) {
        const timestamp = new Date(message.timestamp).toLocaleString();
        markdown += `# ${timestamp}\n${command}\n\n`;
      }
    });
    markdown += `\`\`\`\n`;
  } else {
    // Normal export with full message content
    messages.forEach((message, index) => {
      const role = message.type === "user" ? "👤 User" : "🤖 Assistant";
      const timestamp = new Date(message.timestamp).toLocaleString();

      markdown += `## Message ${index + 1}: ${role}\n`;
      markdown += `**Time:** ${timestamp}\n\n`;

      const content = extractTextContent(message);
      if (content) {
        markdown += `${content}\n\n`;
      }

      // Add tool usage info
      if (message.toolUse) {
        markdown += `### Tool Use\n\`\`\`json\n${JSON.stringify(message.toolUse, null, 2)}\n\`\`\`\n\n`;
      }

      if (message.toolUseResult) {
        markdown += `### Tool Result\n\`\`\`json\n${JSON.stringify(message.toolUseResult, null, 2)}\n\`\`\`\n\n`;
      }

      // Add token usage for assistant messages
      if (message.usage) {
        markdown += `**Tokens:** Input: ${message.usage.input_tokens || 0}, Output: ${message.usage.output_tokens || 0}\n\n`;
      }

      markdown += `---\n\n`;
    });
  }

  // Add attachments section if requested
  if (includeAttachments) {
    const files = extractFileAttachments(messages);
    if (files.size > 0) {
      markdown += `\n\n## Attachments\n\n`;
      files.forEach((content, path) => {
        markdown += `### ${path}\n\`\`\`\n${content}\n\`\`\`\n\n`;
      });
    }
  }

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const filename = `${sanitizeFilename(sessionTitle)}.md`;
  saveAs(blob, filename);
  return filename;
}

/**
 * Export conversation to HTML format
 */
export async function exportToHTML(
  messages: UIMessage[],
  sessionTitle: string,
  includeAttachments: boolean = false,
  mode: ExportMode = "formatted",
  theme: ExportTheme = "light",
  filters?: MessageFilters
): Promise<string> {
  const isCommandOnly = filters?.showCommandOnly ?? false;
  // Theme colors
  const isDark = theme === "dark";
  const colors = isDark ? {
    bg: "#0f172a",
    cardBg: "#1e293b",
    text: "#e2e8f0",
    textSecondary: "#94a3b8",
    border: "#334155",
    codeBg: "#1e293b",
    codeText: "#e2e8f0",
    userColor: "#10b981",
    assistantColor: "#3b82f6",
    thinkingBg: "#312e81",
    thinkingBorder: "#6366f1",
    toolBg: "#422006",
    toolBorder: "#f59e0b",
    heading: "#f1f5f9",
    headingBorder: "#3b82f6",
  } : {
    bg: "#f9fafb",
    cardBg: "#ffffff",
    text: "#1f2937",
    textSecondary: "#6b7280",
    border: "#e5e7eb",
    codeBg: "#f3f4f6",
    codeText: "#1f2937",
    userColor: "#059669",
    assistantColor: "#3b82f6",
    thinkingBg: "#ede9fe",
    thinkingBorder: "#8b5cf6",
    toolBg: "#fef3c7",
    toolBorder: "#f59e0b",
    heading: "#1f2937",
    headingBorder: "#3b82f6",
  };

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(sessionTitle)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: ${colors.text};
      background: ${colors.bg};
    }
    h1 {
      color: ${colors.heading};
      border-bottom: 3px solid ${colors.headingBorder};
      padding-bottom: 10px;
    }
    .message {
      background: ${colors.cardBg};
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.${isDark ? '3' : '1'});
      border: 1px solid ${colors.border};
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid ${colors.border};
    }
    .role {
      font-weight: 600;
      font-size: 1.1em;
    }
    .user { color: ${colors.userColor}; }
    .assistant { color: ${colors.assistantColor}; }
    .timestamp {
      color: ${colors.textSecondary};
      font-size: 0.9em;
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
      margin-bottom: 10px;
    }
    .content-block {
      margin: 15px 0;
    }
    .thinking-block {
      background: ${colors.thinkingBg};
      border-left: 4px solid ${colors.thinkingBorder};
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
      font-style: italic;
    }
    .thinking-title {
      font-weight: 600;
      color: ${colors.thinkingBorder};
      margin-bottom: 10px;
      font-style: normal;
    }
    .tool-section {
      background: ${colors.toolBg};
      border-left: 4px solid ${colors.toolBorder};
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .tool-title {
      font-weight: 600;
      color: ${colors.toolBorder};
      margin-bottom: 10px;
    }
    pre, code {
      background: ${colors.codeBg};
      color: ${colors.codeText};
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.9em;
      font-family: 'Courier New', Consolas, monospace;
      border: 1px solid ${colors.border};
    }
    code {
      padding: 2px 6px;
      display: inline;
    }
    .language-label {
      font-size: 0.75em;
      color: ${colors.textSecondary};
      margin-bottom: 5px;
      font-weight: 600;
    }
    .tokens {
      color: ${colors.textSecondary};
      font-size: 0.9em;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid ${colors.border};
    }
    .attachment {
      background: ${colors.toolBg};
      border-left: 4px solid ${colors.toolBorder};
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .attachment-title {
      font-weight: 600;
      color: ${colors.toolBorder};
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(sessionTitle)}</h1>
  <p style="color: ${colors.textSecondary};">Generated: ${new Date().toLocaleString()}${isCommandOnly ? " | Mode: Command Only (Bash commands)" : ` | Export Mode: ${mode === "formatted" ? "Formatted" : "Raw"}`} | Theme: ${theme === "dark" ? "Dark" : "Light"}</p>
`;

  if (isCommandOnly) {
    // Command only mode - list bash commands in a code block
    html += `
  <div class="message">
    <div class="message-header">
      <span class="role assistant">🔧 Bash Commands</span>
    </div>
    <pre style="white-space: pre-wrap;">`;

    messages.forEach((message) => {
      const command = extractBashCommand(message);
      if (command) {
        const timestamp = new Date(message.timestamp).toLocaleString();
        html += `<span style="color: ${colors.textSecondary};"># ${escapeHtml(timestamp)}</span>\n${escapeHtml(command)}\n\n`;
      }
    });

    html += `</pre>
  </div>
`;
  } else {
    // Normal export with full message content
    messages.forEach((message) => {
      const role = message.type === "user" ? "user" : "assistant";
      const roleLabel = message.type === "user" ? "👤 User" : "🤖 Assistant";
      const timestamp = new Date(message.timestamp).toLocaleString();

      html += `
  <div class="message">
    <div class="message-header">
      <span class="role ${role}">${escapeHtml(roleLabel)}</span>
      <span class="timestamp">${escapeHtml(timestamp)}</span>
    </div>
`;

      // Render content based on mode
      if (mode === "formatted") {
        const contentBlocks = extractFormattedContent(message);

        contentBlocks.forEach((block) => {
          if (block.type === "text") {
            html += `    <div class="content">${escapeHtml(block.content)}</div>\n`;
          } else if (block.type === "code") {
            html += `    <div class="content-block">
      <div class="language-label">${escapeHtml(block.language || "text")}</div>
      <pre>${escapeHtml(block.content)}</pre>
    </div>\n`;
          } else if (block.type === "thinking") {
            html += `    <div class="thinking-block">
      <div class="thinking-title">💭 Thinking</div>
      <div>${escapeHtml(block.content)}</div>
    </div>\n`;
          } else if (block.type === "tool_use") {
            html += `    <div class="tool-section">
      <div class="tool-title">🔧 Tool: ${escapeHtml(block.toolName || "Unknown")}</div>
      <pre>${escapeHtml(block.content)}</pre>
    </div>\n`;
          } else if (block.type === "tool_result") {
            html += `    <div class="tool-section">
      <div class="tool-title">📋 Tool Result</div>
      <pre>${escapeHtml(block.content)}</pre>
    </div>\n`;
          }
        });
      } else {
        // Raw mode - simple text extraction
        html += `    <div class="content">${escapeHtml(extractTextContent(message))}</div>\n`;
      }

      // Add tool use/result for raw mode (already included in formatted mode)
      if (mode === "raw") {
        if (message.toolUse) {
          html += `
    <div class="tool-section">
      <div class="tool-title">Tool Use</div>
      <pre>${escapeHtml(JSON.stringify(message.toolUse, null, 2))}</pre>
    </div>
`;
        }

        if (message.toolUseResult) {
          html += `
    <div class="tool-section">
      <div class="tool-title">Tool Result</div>
      <pre>${escapeHtml(JSON.stringify(message.toolUseResult, null, 2))}</pre>
    </div>
`;
        }
      }

      if (message.usage) {
        html += `
    <div class="tokens">
      Tokens: Input: ${message.usage.input_tokens || 0}, Output: ${message.usage.output_tokens || 0}
    </div>
`;
      }

      html += `  </div>\n`;
    });
  }

  // Add attachments
  if (includeAttachments) {
    const files = extractFileAttachments(messages);
    if (files.size > 0) {
      html += `\n  <h2>Attachments</h2>\n`;
      files.forEach((content, path) => {
        html += `
  <div class="attachment">
    <div class="attachment-title">${escapeHtml(path)}</div>
    <pre>${escapeHtml(content)}</pre>
  </div>
`;
      });
    }
  }

  html += `
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const filename = `${sanitizeFilename(sessionTitle)}.html`;
  saveAs(blob, filename);
  return filename;
}

/**
 * Export conversation to DOCX format
 */
export async function exportToDocx(
  messages: UIMessage[],
  sessionTitle: string,
  includeAttachments: boolean = false,
  mode: ExportMode = "formatted",
  theme: ExportTheme = "light", // Theme not used in DOCX, but kept for consistency
  filters?: MessageFilters
): Promise<string> {
  const isCommandOnly = filters?.showCommandOnly ?? false;
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: sessionTitle,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    })
  );

  // Metadata
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString()}${isCommandOnly ? " | Mode: Command Only (Bash commands)" : ""}`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  if (isCommandOnly) {
    // Command only mode - list bash commands
    children.push(
      new Paragraph({
        text: "Bash Commands",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      })
    );

    messages.forEach((message) => {
      const command = extractBashCommand(message);
      if (command) {
        const timestamp = new Date(message.timestamp).toLocaleString();

        // Timestamp comment
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `# ${timestamp}`,
                italics: true,
                color: "666666",
              }),
            ],
            spacing: { before: 200, after: 50 },
          })
        );

        // Command
        command.split("\n").forEach((line) => {
          children.push(
            new Paragraph({
              text: line,
              spacing: { after: 50 },
              indent: { left: convertInchesToTwip(0.25) },
            })
          );
        });
      }
    });
  } else {
    // Normal export with full message content
    messages.forEach((message, index) => {
      const role = message.type === "user" ? "👤 User" : "🤖 Assistant";
      const timestamp = new Date(message.timestamp).toLocaleString();

      // Message header
      children.push(
        new Paragraph({
          text: `Message ${index + 1}: ${role}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Time: ${timestamp}`,
              italics: true,
              color: "666666",
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // Content
      const content = extractTextContent(message);
      if (content) {
        content.split("\n").forEach((line) => {
          children.push(
            new Paragraph({
              text: line,
              spacing: { after: 100 },
            })
          );
        });
      }

      // Tool usage
      if (message.toolUse) {
        children.push(
          new Paragraph({
            text: "Tool Use:",
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
        children.push(
          new Paragraph({
            text: JSON.stringify(message.toolUse, null, 2),
            spacing: { after: 200 },
            indent: { left: convertInchesToTwip(0.5) },
          })
        );
      }

      if (message.toolUseResult) {
        children.push(
          new Paragraph({
            text: "Tool Result:",
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
        children.push(
          new Paragraph({
            text: JSON.stringify(message.toolUseResult, null, 2),
            spacing: { after: 200 },
            indent: { left: convertInchesToTwip(0.5) },
          })
        );
      }

      // Token usage
      if (message.usage) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Tokens: Input: ${message.usage.input_tokens || 0}, Output: ${message.usage.output_tokens || 0}`,
                italics: true,
                color: "666666",
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    });
  }

  // Attachments
  if (includeAttachments) {
    const files = extractFileAttachments(messages);
    if (files.size > 0) {
      children.push(
        new Paragraph({
          text: "Attachments",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 600, after: 300 },
        })
      );

      files.forEach((content, path) => {
        children.push(
          new Paragraph({
            text: path,
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 400, after: 100 },
          })
        );
        content.split("\n").forEach((line) => {
          children.push(
            new Paragraph({
              text: line,
              spacing: { after: 50 },
              indent: { left: convertInchesToTwip(0.5) },
            })
          );
        });
      });
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // Generate and save
  const { Packer } = await import("docx");
  const blob = await Packer.toBlob(doc);
  const filename = `${sanitizeFilename(sessionTitle)}.docx`;
  saveAs(blob, filename);
  return filename;
}

/**
 * Sanitize filename for safe file system usage
 */
function sanitizeFilename(filename: string): string {
  const sanitized = filename
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .substring(0, 200)
    .trim();

  // Fallback to "session" if empty or only contains dashes/underscores
  return sanitized && sanitized.replace(/[-_]/g, "").length > 0 ? sanitized : "session";
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
