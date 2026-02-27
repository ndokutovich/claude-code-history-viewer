/**
 * Utility for parsing Claude Code message paths
 * Format: C:\path\to\session.jsonl#message-uuid
 */

export interface ParsedMessagePath {
  sessionPath: string;
  messageId?: string;
}

/**
 * Parse a Claude Code message path
 * @param path - Path in format: session.jsonl#message-uuid or just session.jsonl
 * @returns Parsed components
 */
export function parseMessagePath(path: string): ParsedMessagePath | null {
  if (!path || typeof path !== 'string') {
    return null;
  }

  const trimmed = path.trim();

  // Check if path contains a hash (message ID)
  const hashIndex = trimmed.indexOf('#');

  if (hashIndex === -1) {
    // No message ID, just session path
    return {
      sessionPath: trimmed,
      messageId: undefined,
    };
  }

  // Split by hash
  const sessionPath = trimmed.substring(0, hashIndex);
  const messageId = trimmed.substring(hashIndex + 1);

  // Validate session path is not empty
  if (!sessionPath) {
    return null;
  }

  // Validate message ID format (UUID) if present
  if (messageId && !isValidUUID(messageId)) {
    return null;
  }

  return {
    sessionPath,
    messageId: messageId || undefined,
  };
}

/**
 * Validate UUID format (loose validation)
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Extract session path from a message path
 */
export function extractSessionPath(messagePath: string): string | null {
  const parsed = parseMessagePath(messagePath);
  return parsed?.sessionPath || null;
}

/**
 * Extract message ID from a message path
 */
export function extractMessageId(messagePath: string): string | null {
  const parsed = parseMessagePath(messagePath);
  return parsed?.messageId || null;
}
