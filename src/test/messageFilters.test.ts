/**
 * @fileoverview Tests for the advanced message filter predicate
 * (role + content-type visibility toggles) layered on top of the existing
 * exclusive "only" filters. Defaults must preserve current behavior (all shown).
 */
import { describe, it, expect } from "vitest";
import {
  filterMessages,
  hasActiveMessageFilters,
  DEFAULT_MESSAGE_FILTERS,
} from "../utils/messageFilters";
import type { MessageFilters, UIMessage } from "../types";

function makeMessage(overrides: Partial<UIMessage>): UIMessage {
  return {
    uuid: "uuid",
    sessionId: "session",
    timestamp: "2026-03-22T00:00:00Z",
    type: "user",
    ...overrides,
  };
}

const userText = makeMessage({ uuid: "u", type: "user", content: "hello" });
const assistantText = makeMessage({ uuid: "a", type: "assistant", content: "hi there" });
const systemMsg = makeMessage({ uuid: "s", type: "system", content: "system note" });
const toolUseMsg = makeMessage({
  uuid: "tu",
  type: "assistant",
  content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } }],
});
const toolResultMsg = makeMessage({
  uuid: "tr",
  type: "user",
  content: [{ type: "tool_result", tool_use_id: "t1", content: "output" }],
});
const thinkingMsg = makeMessage({
  uuid: "th",
  type: "assistant",
  content: [{ type: "thinking", thinking: "reasoning..." }],
});

const all = [userText, assistantText, systemMsg, toolUseMsg, toolResultMsg, thinkingMsg];

function withFilters(overrides: Partial<MessageFilters>): MessageFilters {
  return { ...DEFAULT_MESSAGE_FILTERS, ...overrides };
}

describe("filterMessages — advanced role/content-type filters", () => {
  it("returns all messages with default filters (behavior preserved)", () => {
    expect(filterMessages(all, DEFAULT_MESSAGE_FILTERS)).toEqual(all);
  });

  it("hides user-role messages when roleUser is off", () => {
    const result = filterMessages(all, withFilters({ roleUser: false }));
    expect(result.find((m) => m.uuid === "u")).toBeUndefined();
    // tool_result message is type "user" too → hidden by role filter
    expect(result.find((m) => m.uuid === "tr")).toBeUndefined();
    expect(result.find((m) => m.uuid === "a")).toBeDefined();
  });

  it("hides assistant-role messages when roleAssistant is off", () => {
    const result = filterMessages(all, withFilters({ roleAssistant: false }));
    expect(result.find((m) => m.uuid === "a")).toBeUndefined();
    expect(result.find((m) => m.uuid === "tu")).toBeUndefined();
    expect(result.find((m) => m.uuid === "u")).toBeDefined();
  });

  it("maps non user/assistant types into the system bucket", () => {
    const result = filterMessages(all, withFilters({ roleSystem: false }));
    expect(result.find((m) => m.uuid === "s")).toBeUndefined();
    expect(result.find((m) => m.uuid === "u")).toBeDefined();
  });

  it("hides text-only messages when contentText is off but keeps tool/thinking messages", () => {
    const result = filterMessages(all, withFilters({ contentText: false }));
    expect(result.find((m) => m.uuid === "u")).toBeUndefined();
    expect(result.find((m) => m.uuid === "a")).toBeUndefined();
    expect(result.find((m) => m.uuid === "tu")).toBeDefined();
    expect(result.find((m) => m.uuid === "tr")).toBeDefined();
    expect(result.find((m) => m.uuid === "th")).toBeDefined();
  });

  it("keeps only thinking messages when only contentThinking is enabled", () => {
    const result = filterMessages(
      all,
      withFilters({
        contentText: false,
        contentToolUse: false,
        contentToolResult: false,
        contentThinking: true,
      })
    );
    expect(result.map((m) => m.uuid)).toEqual(["th"]);
  });

  it("combines role and content-type filters (AND semantics)", () => {
    const result = filterMessages(
      all,
      withFilters({ roleAssistant: false, contentText: false })
    );
    // assistant removed by role; remaining must contain a non-text content type
    expect(result.map((m) => m.uuid)).toEqual(["tr"]);
  });
});

describe("hasActiveMessageFilters", () => {
  it("is false for defaults", () => {
    expect(hasActiveMessageFilters(DEFAULT_MESSAGE_FILTERS)).toBe(false);
  });

  it("is true when a role is hidden", () => {
    expect(hasActiveMessageFilters(withFilters({ roleUser: false }))).toBe(true);
  });

  it("is true when a content type is hidden", () => {
    expect(hasActiveMessageFilters(withFilters({ contentToolUse: false }))).toBe(true);
  });

  it("is true when an exclusive filter is active", () => {
    expect(hasActiveMessageFilters(withFilters({ showBashOnly: true }))).toBe(true);
  });
});
