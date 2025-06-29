import type { RawClaudeMessage, ClaudeMessage } from "../types";

/**
 * Converts raw JSONL message format to UI-friendly format
 * This adapter handles the difference between the actual data structure
 * documented in CLAUDE.md and the expected UI structure
 */
export function adaptRawMessage(raw: RawClaudeMessage): ClaudeMessage {
  const { message, ...rest } = raw;

  return {
    ...rest,
    // Extract content and metadata from the nested message object
    content: message?.content,
    model: message?.model,
    stop_reason: message?.stop_reason,
    usage: message?.usage,
  };
}

/**
 * Process messages array from backend
 */
export function processMessages(
  rawMessages: RawClaudeMessage[]
): ClaudeMessage[] {
  return rawMessages.map(adaptRawMessage);
}
