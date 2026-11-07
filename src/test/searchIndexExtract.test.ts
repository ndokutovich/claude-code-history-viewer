import { describe, it, expect } from "vitest";
import { extractSearchableText } from "../utils/searchIndex";
import type { UIMessage } from "../types";

const mkMessage = (content: unknown): UIMessage =>
  ({
    id: "m1",
    type: "user",
    content,
  }) as unknown as UIMessage;

describe("extractSearchableText (upstream #437/#396)", () => {
  it("indexes tool_use argument values, not just the tool name", () => {
    const text = extractSearchableText(
      mkMessage([
        {
          type: "tool_use",
          id: "t1",
          name: "Read",
          input: { file_path: "w:/_proj/keystone/resolver.ts" },
        },
      ])
    );
    expect(text).toContain("Read");
    expect(text).toContain("resolver.ts");
  });

  it("skips empty tool_use argument values", () => {
    const text = extractSearchableText(
      mkMessage([
        { type: "tool_use", id: "t1", name: "Grep", input: { pattern: "  " } },
      ])
    );
    expect(text).toContain("Grep");
    expect(text.trim()).not.toContain("  ");
  });

  it("indexes text blocks inside array-form tool_result content", () => {
    const text = extractSearchableText(
      mkMessage([
        {
          type: "tool_result",
          tool_use_id: "t1",
          content: [{ type: "text", text: "keystone artifact output" }],
        },
      ])
    );
    expect(text).toContain("keystone artifact output");
  });

  it("indexes string tool_result content as before", () => {
    const text = extractSearchableText(
      mkMessage([
        { type: "tool_result", tool_use_id: "t1", content: "plain result body" },
      ])
    );
    expect(text).toContain("plain result body");
  });
});
