import { describe, it, expect } from "vitest";
import { isTurnStart, findPromptJumpIndex } from "../components/MessageViewer/helpers/promptJump";
import type { UIMessage } from "../types";

const mk = (overrides: Partial<UIMessage> & { content?: unknown }): UIMessage =>
  ({
    uuid: "u",
    id: "u",
    type: "user",
    timestamp: "2026-01-01T00:00:00Z",
    content: "",
    ...overrides,
  }) as unknown as UIMessage;

const row = (i: number, msg: UIMessage) => ({
  message: { ...msg, uuid: `row-${i}` },
  depth: 0,
  key: `row-${i}`,
});

describe("isTurnStart (upstream #629)", () => {
  it("starts a turn at a typed prompt", () => {
    expect(isTurnStart(mk({ content: "Scrub for pii" }))).toBe(true);
  });

  it("starts a turn at a slash-command invocation", () => {
    expect(
      isTurnStart(
        mk({
          content: "<command-message>wrap</command-message>\n<command-name>/wrap</command-name>",
        })
      )
    ).toBe(true);
  });

  it("does not start a turn at a local command's output", () => {
    expect(
      isTurnStart(mk({ content: "<local-command-stdout>Total cost: $0.42</local-command-stdout>" }))
    ).toBe(false);
  });

  it("does not start a turn at rows the user did not type", () => {
    expect(isTurnStart(mk({ content: "<system-reminder>Today is Friday.</system-reminder>" }))).toBe(false);
    expect(isTurnStart(mk({ content: "<task-notification>done</task-notification>" }))).toBe(false);
    expect(
      isTurnStart(mk({ type: "assistant", content: [{ type: "text", text: "Done." }] }))
    ).toBe(false);
  });

  it("does not start a turn at tool-result-only user rows", () => {
    expect(
      isTurnStart(mk({ content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }] }))
    ).toBe(false);
  });

  it("reads text blocks inside array content", () => {
    expect(isTurnStart(mk({ content: [{ type: "text", text: "array-form prompt" }] }))).toBe(true);
  });
});

describe("findPromptJumpIndex", () => {
  const rows = [
    row(0, mk({ content: "first prompt" })),
    row(1, mk({ type: "assistant", content: [{ type: "text", text: "answer" }] })),
    row(2, mk({ content: "<local-command-stdout>noise</local-command-stdout>" })),
    row(3, mk({ content: "second prompt" })),
  ];

  it("jumps forward past non-turn rows", () => {
    expect(findPromptJumpIndex(rows, 0, 1)).toBe(3);
  });

  it("jumps backward to the previous prompt", () => {
    expect(findPromptJumpIndex(rows, 3, -1)).toBe(0);
  });

  it("returns null at the edges", () => {
    expect(findPromptJumpIndex(rows, 3, 1)).toBeNull();
    expect(findPromptJumpIndex(rows, 0, -1)).toBeNull();
  });
});
