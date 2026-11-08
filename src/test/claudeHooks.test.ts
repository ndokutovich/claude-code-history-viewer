import { describe, it, expect } from "vitest";
import {
  appendHookCommand,
  readHookCommands,
  removeHookCommand,
} from "../utils/claudeHooks";

const grouped = [
  { hooks: [{ type: "command", command: "node a.js", timeout: 600 }] },
  { matcher: "Bash", hooks: [{ type: "command", command: "b" }, { type: "command", command: "c" }] },
];

describe("readHookCommands", () => {
  it("flattens matcher groups and keeps the matcher", () => {
    const commands = readHookCommands(grouped);
    expect(commands.map((c) => c.command)).toEqual(["node a.js", "b", "c"]);
    expect(commands[0]?.timeout).toBe(600);
    expect(commands[1]?.matcher).toBe("Bash");
    expect(commands[0]?.matcher).toBeUndefined();
  });

  it("still reads the flat legacy shape", () => {
    const commands = readHookCommands([{ command: "npm test", args: ["--watch"] }]);
    expect(commands[0]?.command).toBe("npm test");
    expect(commands[0]?.args).toEqual(["--watch"]);
  });

  it("ignores malformed entries", () => {
    expect(readHookCommands([null, 4, { hooks: [] }, { command: "" }])).toEqual([]);
    expect(readHookCommands(undefined)).toEqual([]);
  });
});

describe("removeHookCommand", () => {
  it("removes the addressed command and leaves the rest byte-identical", () => {
    const remaining = removeHookCommand(grouped, 1);
    expect(remaining).toEqual([
      { hooks: [{ type: "command", command: "node a.js", timeout: 600 }] },
      { matcher: "Bash", hooks: [{ type: "command", command: "c" }] },
    ]);
  });

  it("drops a group that loses its last command", () => {
    const remaining = removeHookCommand(grouped, 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveProperty("matcher", "Bash");
  });

  it("removes a flat command", () => {
    expect(removeHookCommand([{ command: "x" }, { command: "y" }], 0)).toEqual([
      { command: "y" },
    ]);
  });
});

describe("appendHookCommand", () => {
  it("appends a matcher group, the shape Claude Code writes", () => {
    expect(appendHookCommand(grouped, "new --flag")).toEqual([
      ...grouped,
      { hooks: [{ type: "command", command: "new --flag" }] },
    ]);
  });

  it("starts an event that had no groups", () => {
    expect(appendHookCommand(undefined, "x")).toEqual([
      { hooks: [{ type: "command", command: "x" }] },
    ]);
  });
});
