import { describe, it, expect } from "vitest";
import { getResumeCommand, parseResumeExtraArgs } from "../utils/providers";

describe("parseResumeExtraArgs (upstream #595)", () => {
  it("splits flags and keeps flag-shaped tokens", () => {
    expect(parseResumeExtraArgs("--fast  --model=sonnet")).toEqual([
      "--fast",
      "--model=sonnet",
    ]);
  });

  it("strips every shell metacharacter from the tokens", () => {
    // `;`, `$()`, quotes and redirections are removed, so the remaining
    // tokens are inert arguments — never a second command.
    for (const raw of ["--fast; rm -rf /", "$(whoami)", "--a \"b c\"", "a|b", "a>b"]) {
      for (const token of parseResumeExtraArgs(raw)) {
        expect(token).toMatch(/^[A-Za-z0-9\-_.=/:,+]+$/);
      }
    }
  });

  it("ignores empty input", () => {
    expect(parseResumeExtraArgs("")).toEqual([]);
    expect(parseResumeExtraArgs(undefined)).toEqual([]);
    expect(parseResumeExtraArgs("   ")).toEqual([]);
  });

  it("caps the number of arguments", () => {
    const many = Array.from({ length: 40 }, (_, i) => `--f${i}`).join(" ");
    expect(parseResumeExtraArgs(many)).toHaveLength(32);
  });
});

describe("getResumeCommand with extra args", () => {
  it("appends validated arguments after the session id", () => {
    expect(getResumeCommand("claude", "abc-123", "/tmp/p", ["--fast"])).toBe(
      "cd '/tmp/p' && claude --resume abc-123 --fast"
    );
  });

  it("keeps the command unchanged without arguments", () => {
    expect(getResumeCommand("claude", "abc-123", "/tmp/p", [])).toBe(
      "cd '/tmp/p' && claude --resume abc-123"
    );
  });

  it("drops unsafe tokens before they reach the command", () => {
    expect(getResumeCommand("claude", "abc-123", "/tmp/p", ["--fast", "&& rm -rf /"])).toBe(
      "cd '/tmp/p' && claude --resume abc-123 --fast"
    );
  });
});
