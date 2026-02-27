// ============================================================================
// MESSAGE TRANSFORMATION UTILITIES (v1.5.0)
// ============================================================================
// Converts between UIMessage and MessageBuilder formats
// Reference: .claude/CLEAN_CODE_PATTERNS.md - Violation Category 4

import type { UIMessage, MessageBuilder } from '@/types';
import type { ExtendedUIMessage } from '@/types/storeExtensions';

/**
 * Converts a single UIMessage to MessageBuilder format
 * Handles content type conversion (string or JSON stringified)
 *
 * @param msg - UIMessage from the UI/store
 * @returns MessageBuilder ready for session creation
 */
export function convertUIMessageToBuilder(msg: UIMessage): MessageBuilder {
  const ext = msg as unknown as ExtendedUIMessage;
  return {
    id: `imported-${msg.uuid}`,
    role: msg.type as MessageBuilder['role'], // UIMessage uses 'type' for role
    content: typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content),
    parent_id: msg.parentUuid,
    model: ext.model,
    usage: ext.usage as MessageBuilder['usage'],
    isExpanded: false,
  };
}

/**
 * Converts an array of UIMessages to MessageBuilder format
 * Batch conversion for importing messages from existing sessions
 *
 * @param messages - Array of UIMessages
 * @returns Array of MessageBuilders
 */
export function convertUIMessagesToBuilders(messages: UIMessage[]): MessageBuilder[] {
  return messages.map(convertUIMessageToBuilder);
}
