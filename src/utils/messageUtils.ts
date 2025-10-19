import type { UIMessage } from "../types";

export const extractUIMessageContent = (
  message: UIMessage
): string | null => {
  // Direct string content
  if (typeof message.content === "string") {
    return message.content;
  }

  // Array content - extract text from first text block
  if (Array.isArray(message.content)) {
    const textBlock = message.content.find(
      (block): block is { type: "text"; text: string } => block.type === "text"
    );
    return textBlock?.text || null;
  }

  return null;
};

export const formatClaudeErrorOutput = (error: string) => {
  // Improve ESLint error formatting
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

// Image-related utility functions
export const isImageUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") return false;

  // Data URL format images
  if (url.startsWith("data:image/")) return true;

  // Determine image by file extension
  const imageExtensions = /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)(\?.*)?$/i;
  return imageExtensions.test(url);
};

export const isBase64Image = (data: string): boolean => {
  if (!data || typeof data !== "string") return false;
  return data.startsWith("data:image/");
};

export const extractImageFromContent = (content: unknown): string | null => {
  // If directly an image URL or base64
  if (typeof content === "string") {
    if (isImageUrl(content) || isBase64Image(content)) {
      return content;
    }
  }

  // Extract image from array-type content
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === "image" && item.source) {
        // Claude API format image object
        if (item.source.type === "base64") {
          return `data:${item.source.media_type};base64,${item.source.data}`;
        }
      }

      // If there's an image URL within text
      if (item.type === "text" && item.text) {
        const imageMatch = item.text.match(
          /(data:image\/[^;\s]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|svg|webp))/i
        );
        if (imageMatch) {
          return imageMatch[1];
        }
      }
    }
  }

  return null;
};

export const hasImageContent = (message: UIMessage): boolean => {
  return extractImageFromContent(message.content) !== null;
};
