import type { ClaudeMessage } from "../types";

export const formatTime = (timestamp: string) => {
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

export const extractClaudeMessageContent = (message: ClaudeMessage) => {
  if (message.content === null || message.content === undefined) {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content;
  } else if (message.content && typeof message.content === "object") {
    // Check if it's a content array (Claude API format)
    if (Array.isArray(message.content)) {
      // Extract text from content array for assistant messages
      if (message.type === "assistant") {
        const textContent = message.content
          .filter((item: Record<string, unknown>) => item.type === "text")
          .map((item: Record<string, unknown>) => item.text as string)
          .join("\n");
        return textContent || "";
      }
      return null; // Will be handled by renderClaudeContentArray for non-assistant messages
    }
    return JSON.stringify(message.content, null, 2);
  }
  return "";
};

export const formatClaudeErrorOutput = (error: string) => {
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