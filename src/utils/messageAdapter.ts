import type { RawClaudeMessage, ClaudeMessage } from "../types";

/**
 * Converts raw JSONL message format to UI-friendly format
 * This adapter handles the difference between the actual data structure
 * documented in CLAUDE.md and the expected UI structure
 */
export function adaptRawMessage(raw: RawClaudeMessage): ClaudeMessage {
  return {
    uuid: raw.uuid,
    parentUuid: raw.parentUuid,
    sessionId: raw.sessionId,
    timestamp: raw.timestamp,
    type: raw.type,
    // Extract content from message.content
    content: raw.message?.content,
    toolUse: raw.toolUse,
    toolUseResult: raw.toolUseResult,
    isSidechain: raw.isSidechain,
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
