import { saveAs } from "file-saver";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";
import type { UIMessage, ContentItem } from "@/types";

/**
 * Extract text content from a message
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
        if (item.type === "tool_result") return `[Tool Result]\n${item.content}`;
        return "";
      })
      .join("\n\n");
  }

  return JSON.stringify(message.content, null, 2);
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
      if (typeof result === "object" && "file" in result) {
        const fileData = result.file as {
          filePath?: string;
          content?: string;
        };
        if (fileData.filePath && fileData.content) {
          files.set(fileData.filePath, fileData.content);
        }
      }

      // Multi-edit results
      if (typeof result === "object" && "filePath" in result && "originalFileContents" in result) {
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
  includeAttachments: boolean = false
): Promise<void> {
  let markdown = `# ${sessionTitle}\n\n`;
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += `---\n\n`;

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
  saveAs(blob, `${sanitizeFilename(sessionTitle)}.md`);
}

/**
 * Export conversation to HTML format
 */
export async function exportToHTML(
  messages: UIMessage[],
  sessionTitle: string,
  includeAttachments: boolean = false
): Promise<void> {
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
      color: #333;
      background: #f9fafb;
    }
    h1 {
      color: #1f2937;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
    }
    .message {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .role {
      font-weight: 600;
      font-size: 1.1em;
    }
    .user { color: #059669; }
    .assistant { color: #3b82f6; }
    .timestamp {
      color: #6b7280;
      font-size: 0.9em;
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .tool-section {
      background: #f3f4f6;
      border-left: 4px solid #8b5cf6;
      padding: 15px;
      margin-top: 15px;
      border-radius: 4px;
    }
    .tool-title {
      font-weight: 600;
      color: #6b21a8;
      margin-bottom: 10px;
    }
    pre {
      background: #1f2937;
      color: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.9em;
    }
    .tokens {
      color: #6b7280;
      font-size: 0.9em;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
    }
    .attachment {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .attachment-title {
      font-weight: 600;
      color: #92400e;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(sessionTitle)}</h1>
  <p style="color: #6b7280;">Generated: ${new Date().toLocaleString()}</p>
`;

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
    <div class="content">${escapeHtml(extractTextContent(message))}</div>
`;

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

    if (message.usage) {
      html += `
    <div class="tokens">
      Tokens: Input: ${message.usage.input_tokens || 0}, Output: ${message.usage.output_tokens || 0}
    </div>
`;
    }

    html += `  </div>\n`;
  });

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
  saveAs(blob, `${sanitizeFilename(sessionTitle)}.html`);
}

/**
 * Export conversation to DOCX format
 */
export async function exportToDocx(
  messages: UIMessage[],
  sessionTitle: string,
  includeAttachments: boolean = false
): Promise<void> {
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
          text: `Generated: ${new Date().toLocaleString()}`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Messages
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
  saveAs(blob, `${sanitizeFilename(sessionTitle)}.docx`);
}

/**
 * Sanitize filename for safe file system usage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, "_")
    .substring(0, 200);
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
