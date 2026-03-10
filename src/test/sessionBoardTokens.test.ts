/**
 * Session Board Token Aggregation Bug Test
 *
 * Bug: Session board always shows 0 tokens despite correct message counts.
 *
 * Root cause: useSessionBoard.ts calls `invoke` directly, bypassing the adapter
 * layer that converts UniversalMessage → UIMessage. The backend returns
 * UniversalMessage format with `role`, `tokens`, `tokens.inputTokens` (camelCase),
 * but the board code checks UIMessage field names: `type`, `usage`, `usage.input_tokens`.
 *
 * This test verifies the token aggregation logic works with actual backend data shapes.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Simulated backend response shapes
// ---------------------------------------------------------------------------

/** What the Rust backend actually returns (UniversalMessage serialized JSON) */
function makeUniversalAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-001",
    sessionId: "session-001",
    projectId: "project-001",
    sourceId: "source-001",
    providerId: "claude",
    timestamp: "2025-01-15T10:00:00Z",
    sequenceNumber: 1,
    role: "assistant", // NOT "type"
    messageType: "message",
    content: [{ type: "text", data: "Hello world" }],
    model: "claude-opus-4-20250514",
    tokens: {
      // NOT "usage", and fields are camelCase NOT snake_case
      inputTokens: 1500,
      outputTokens: 500,
      totalTokens: 2000,
      cacheCreationTokens: 100,
      cacheReadTokens: 50,
    },
    originalFormat: "{}",
    providerMetadata: {},
    ...overrides,
  };
}

function makeUniversalUserMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg-000",
    sessionId: "session-001",
    projectId: "project-001",
    sourceId: "source-001",
    providerId: "claude",
    timestamp: "2025-01-15T09:59:00Z",
    sequenceNumber: 0,
    role: "user",
    messageType: "message",
    content: [{ type: "text", data: "Hi there" }],
    originalFormat: "{}",
    providerMetadata: {},
    ...overrides,
  };
}

/** What the adapter-converted UIMessage looks like */
function makeUIAssistantMessage(overrides: Record<string, unknown> = {}) {
  return {
    uuid: "msg-001",
    parentUuid: undefined,
    sessionId: "session-001",
    timestamp: "2025-01-15T10:00:00Z",
    type: "assistant", // "type" not "role"
    content: "Hello world",
    model: "claude-opus-4-20250514",
    usage: {
      // "usage" not "tokens", snake_case not camelCase
      input_tokens: 1500,
      output_tokens: 500,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 50,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Aggregation logic extracted from useSessionBoard.ts (lines 230-243)
// ---------------------------------------------------------------------------

interface TokenStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Current (buggy) aggregation — uses UIMessage field names */
function aggregateTokensBuggy(messages: Record<string, unknown>[]): TokenStats {
  const stats: TokenStats = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  messages.forEach((msg) => {
    // This is the exact logic from useSessionBoard.ts:231-237
    const msgAny = msg as { type?: string; usage?: { input_tokens?: number; output_tokens?: number } };
    if (msgAny.type === "assistant" && msgAny.usage) {
      const usage = msgAny.usage;
      stats.inputTokens += usage.input_tokens || 0;
      stats.outputTokens += usage.output_tokens || 0;
      stats.totalTokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
    }
  });
  return stats;
}

/** Fixed aggregation — handles both UniversalMessage and UIMessage formats */
function aggregateTokensFixed(messages: Record<string, unknown>[]): TokenStats {
  const stats: TokenStats = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  messages.forEach((msg) => {
    // Support both formats: UniversalMessage (role/tokens) and UIMessage (type/usage)
    const role = (msg.role ?? msg.type) as string | undefined;
    if (role !== "assistant") return;

    // UniversalMessage format: tokens.inputTokens (camelCase)
    const tokens = msg.tokens as { inputTokens?: number; outputTokens?: number } | undefined;
    if (tokens) {
      stats.inputTokens += tokens.inputTokens || 0;
      stats.outputTokens += tokens.outputTokens || 0;
      stats.totalTokens += (tokens.inputTokens || 0) + (tokens.outputTokens || 0);
      return;
    }

    // UIMessage format: usage.input_tokens (snake_case)
    const usage = msg.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    if (usage) {
      stats.inputTokens += usage.input_tokens || 0;
      stats.outputTokens += usage.output_tokens || 0;
      stats.totalTokens += (usage.input_tokens || 0) + (usage.output_tokens || 0);
    }
  });
  return stats;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Session Board Token Aggregation Bug", () => {
  describe("buggy aggregation (current code)", () => {
    it("fails to extract tokens from UniversalMessage format", () => {
      const messages = [
        makeUniversalUserMessage(),
        makeUniversalAssistantMessage(),
        makeUniversalAssistantMessage({
          id: "msg-002",
          sequenceNumber: 2,
          tokens: { inputTokens: 3000, outputTokens: 1000, totalTokens: 4000 },
        }),
      ];

      const stats = aggregateTokensBuggy(messages);

      // BUG: tokens are 0 because the code checks msg.type (undefined on UniversalMessage)
      // and msg.usage (undefined — the field is called msg.tokens)
      expect(stats.totalTokens).toBe(0);
      expect(stats.inputTokens).toBe(0);
      expect(stats.outputTokens).toBe(0);
    });

    it("works correctly with UIMessage format (adapter-converted)", () => {
      const messages = [
        makeUIAssistantMessage(),
        makeUIAssistantMessage({
          uuid: "msg-002",
          usage: { input_tokens: 3000, output_tokens: 1000 },
        }),
      ];

      const stats = aggregateTokensBuggy(messages);

      // Works fine when data has been through the adapter
      expect(stats.inputTokens).toBe(4500);
      expect(stats.outputTokens).toBe(1500);
      expect(stats.totalTokens).toBe(6000);
    });
  });

  describe("fixed aggregation", () => {
    it("correctly extracts tokens from UniversalMessage format", () => {
      const messages = [
        makeUniversalUserMessage(),
        makeUniversalAssistantMessage(),
        makeUniversalAssistantMessage({
          id: "msg-002",
          sequenceNumber: 2,
          tokens: { inputTokens: 3000, outputTokens: 1000, totalTokens: 4000 },
        }),
      ];

      const stats = aggregateTokensFixed(messages);

      expect(stats.inputTokens).toBe(4500);
      expect(stats.outputTokens).toBe(1500);
      expect(stats.totalTokens).toBe(6000);
    });

    it("still works with UIMessage format (backward compatible)", () => {
      const messages = [
        makeUIAssistantMessage(),
        makeUIAssistantMessage({
          uuid: "msg-002",
          usage: { input_tokens: 3000, output_tokens: 1000 },
        }),
      ];

      const stats = aggregateTokensFixed(messages);

      expect(stats.inputTokens).toBe(4500);
      expect(stats.outputTokens).toBe(1500);
      expect(stats.totalTokens).toBe(6000);
    });

    it("handles messages with no tokens/usage gracefully", () => {
      const messages = [
        makeUniversalUserMessage(),
        makeUniversalAssistantMessage({ tokens: undefined }),
      ];

      const stats = aggregateTokensFixed(messages);

      expect(stats.totalTokens).toBe(0);
    });

    it("skips user messages correctly", () => {
      const messages = [
        makeUniversalUserMessage({ tokens: { inputTokens: 999, outputTokens: 999, totalTokens: 1998 } }),
        makeUniversalAssistantMessage(),
      ];

      const stats = aggregateTokensFixed(messages);

      // Should only count assistant tokens, not user
      expect(stats.inputTokens).toBe(1500);
      expect(stats.outputTokens).toBe(500);
    });
  });

  describe("isAssistantMessage field mismatch", () => {
    it("UniversalMessage has role=assistant, not type=assistant", () => {
      const msg = makeUniversalAssistantMessage() as Record<string, unknown>;
      // This is what isAssistantMessage() checks — it fails for UniversalMessage
      expect(msg.type).toBeUndefined();
      expect(msg.role).toBe("assistant");
    });

    it("UIMessage has type=assistant", () => {
      const msg = makeUIAssistantMessage();
      expect(msg.type).toBe("assistant");
    });
  });

  describe("uuid/id field mismatch", () => {
    it("UniversalMessage uses id, not uuid", () => {
      const msg = makeUniversalAssistantMessage({ id: "test-id-123" });
      expect((msg as Record<string, unknown>).uuid).toBeUndefined();
      expect(msg.id).toBe("test-id-123");
    });
  });
});
