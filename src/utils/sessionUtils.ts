import type { UISession, UIMessage } from "@/types";

/**
 * Extracts a readable title from a session
 * Prioritizes session summary, then first message content, then sessionId fallback
 */
export function getSessionTitle(
  session: UISession | null,
  messages?: UIMessage[],
  maxLength: number = 60
): string {
  // Use session summary if available
  if (session?.summary) {
    return session.summary.length > maxLength
      ? session.summary.substring(0, maxLength) + "..."
      : session.summary;
  }

  // Try to extract from first message
  const firstMsg = messages?.[0];
  if (firstMsg?.content) {
    let text = "";

    if (typeof firstMsg.content === "string") {
      text = firstMsg.content;
    } else if (Array.isArray(firstMsg.content)) {
      text = firstMsg.content
        .filter((c: any) => c.type === "text" && c.text)
        .map((c: any) => c.text)
        .join(" ");
    } else if (typeof firstMsg.content === "object") {
      // Handle object content (e.g., { text: "..." } or { content: "..." })
      const obj = firstMsg.content as any;
      if (obj.text) {
        text = obj.text;
      } else if (obj.content && typeof obj.content === "string") {
        text = obj.content;
      }
    }

    if (text.trim()) {
      return text.length > maxLength
        ? text.substring(0, maxLength) + "..."
        : text;
    }
  }

  // Fallback to session ID
  const sessionId = session?.actual_session_id || session?.session_id || "";
  return `Session ${sessionId.slice(-8)}`;
}
