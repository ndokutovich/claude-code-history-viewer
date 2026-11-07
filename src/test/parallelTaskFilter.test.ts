import { describe, it, expect } from "vitest";
import {
  DEFAULT_MESSAGE_FILTERS,
  isParallelTaskRow,
  hasActiveMessageFilters,
  filterMessages,
} from "../utils/messageFilters";
import type { UIMessage } from "../types";

const mk = (overrides: Partial<UIMessage> & { content?: unknown }): UIMessage =>
  ({
    uuid: "u1",
    id: "u1",
    type: "user",
    timestamp: "2026-01-01T00:00:00Z",
    content: "",
    ...overrides,
  }) as unknown as UIMessage;

describe("isParallelTaskRow (upstream #446)", () => {
  it("recognises a background task notification", () => {
    expect(
      isParallelTaskRow(mk({ content: "<task-notification>agent done</task-notification>" }))
    ).toBe(true);
  });

  it("recognises a Task launched in the background", () => {
    expect(
      isParallelTaskRow(
        mk({
          type: "assistant",
          content: [
            { type: "tool_use", id: "t1", name: "Task", input: { run_in_background: true } },
          ],
        })
      )
    ).toBe(true);
  });

  it("leaves ordinary prompts and foreground tasks alone", () => {
    expect(isParallelTaskRow(mk({ content: "fix the parser" }))).toBe(false);
    expect(
      isParallelTaskRow(
        mk({
          type: "assistant",
          content: [{ type: "tool_use", id: "t1", name: "Task", input: { prompt: "x" } }],
        })
      )
    ).toBe(false);
  });
});

describe("parallel-task filter", () => {
  const notification = mk({
    uuid: "n1",
    content: "<task-notification>done</task-notification>",
  });

  const visible = (message: UIMessage, filters = DEFAULT_MESSAGE_FILTERS) =>
    filterMessages([message], filters).length === 1;

  it("is visible by default", () => {
    expect(visible(notification)).toBe(true);
    expect(
      hasActiveMessageFilters({ ...DEFAULT_MESSAGE_FILTERS, contentParallelTasks: false })
    ).toBe(true);
  });

  it("hides the row when the toggle is off", () => {
    expect(
      visible(notification, {
        ...DEFAULT_MESSAGE_FILTERS,
        contentParallelTasks: false,
      })
    ).toBe(false);
  });

  it("does not hide unrelated rows", () => {
    expect(
      visible(mk({ content: "plain prompt" }), {
        ...DEFAULT_MESSAGE_FILTERS,
        contentParallelTasks: false,
      })
    ).toBe(true);
  });
});
