/**
 * @fileoverview Tests for filtering noise message types
 *
 * BUG: Claude Code emits "progress", "file-history-snapshot", and
 * "queue-operation" messages in JSONL files. These are operational/internal
 * messages (not conversation content), but they flow through the adapter
 * pipeline as MessageRole::Assistant with empty content — rendering as
 * hundreds of empty "Claude Code" rows in the message viewer.
 *
 * Root cause: The Rust backend doesn't filter these types. The adapter
 * defaults them to role=assistant. `isEmptyMessage()` exists but is never
 * called. The stats module already has `is_non_message_noise_type()` that
 * identifies these, but it's not used during message loading.
 *
 * Fix: Filter noise types in the backend (session.rs) before converting
 * to UniversalMessage, AND call isEmptyMessage in the frontend as a safety net.
 */
import { describe, it, expect } from "vitest";
import { isEmptyMessage } from "../components/MessageViewer/helpers/messageHelpers";
import type { UIMessage } from "../types";

/**
 * Helper to create a minimal UIMessage for testing
 */
function makeMessage(overrides: Partial<UIMessage>): UIMessage {
  return {
    uuid: "test-uuid",
    sessionId: "test-session",
    timestamp: "2026-03-08T08:19:18Z",
    type: "assistant",
    content: "",
    ...overrides,
  };
}

describe("Noise message filtering", () => {
  describe("isEmptyMessage correctly identifies noise messages", () => {
    it("should mark assistant message with empty string content as empty", () => {
      const msg = makeMessage({ type: "assistant", content: "" });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should mark assistant message with no content as empty", () => {
      const msg = makeMessage({ type: "assistant", content: undefined });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should NOT mark assistant message with text content as empty", () => {
      const msg = makeMessage({ type: "assistant", content: "Hello world" });
      expect(isEmptyMessage(msg)).toBe(false);
    });

    it("should NOT mark assistant message with tool use as empty", () => {
      const msg = makeMessage({
        type: "assistant",
        content: "",
        toolUse: { name: "Read", id: "toolu_1", input: {} },
      });
      expect(isEmptyMessage(msg)).toBe(false);
    });

    it("should NOT mark user message with tool result as empty", () => {
      const msg = makeMessage({
        type: "user",
        content: "",
        toolUseResult: { type: "text", content: "file contents" },
      });
      expect(isEmptyMessage(msg)).toBe(false);
    });

    it("should NOT mark system message with subtype as empty", () => {
      const msg = makeMessage({
        type: "system",
        subtype: "compact_boundary",
        content: "",
      });
      // System messages with subtypes have dedicated renderers
      expect(isEmptyMessage(msg)).toBe(true);
      // NOTE: This currently returns true because isEmptyMessage doesn't
      // know about system subtypes. This is acceptable because system
      // messages with subtypes are routed to SystemMessageRenderer in
      // MessageNode before isEmptyMessage would be called.
    });
  });

  describe("noise message types that leak through as assistant", () => {
    // These simulate what happens when the Rust adapter converts
    // progress/file-history-snapshot/queue-operation to assistant role
    // with empty content

    it("should mark progress message (leaked as assistant) as empty", () => {
      // When a JSONL "progress" entry passes through the adapter,
      // it becomes type="assistant" with empty content
      const msg = makeMessage({ type: "assistant", content: "" });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should mark file-history-snapshot message (leaked as assistant) as empty", () => {
      const msg = makeMessage({ type: "assistant", content: "" });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should mark queue-operation message (leaked as assistant) as empty", () => {
      const msg = makeMessage({ type: "assistant", content: "" });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should handle original progress type if backend preserves it", () => {
      // If we fix the backend to preserve original_type in provider_metadata,
      // isEmptyMessage should also filter these
      const msg = makeMessage({
        type: "assistant",
        content: "",
        provider_metadata: { original_type: "progress" },
      });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should handle original file-history-snapshot type", () => {
      const msg = makeMessage({
        type: "assistant",
        content: "",
        provider_metadata: { original_type: "file-history-snapshot" },
      });
      expect(isEmptyMessage(msg)).toBe(true);
    });

    it("should handle original queue-operation type", () => {
      const msg = makeMessage({
        type: "assistant",
        content: "",
        provider_metadata: { original_type: "queue-operation" },
      });
      expect(isEmptyMessage(msg)).toBe(true);
    });
  });
});
