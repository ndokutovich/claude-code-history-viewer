import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER_ID,
  calculateConversationBreakdownCoverage,
  hasAnyConversationBreakdownProvider,
  hasNonDefaultProvider,
  getProviderId,
  getProviderLabel,
  getResumeCommand,
  normalizeProviderIds,
  PROVIDER_IDS,
  supportsConversationBreakdown,
  supportsResumeCommand,
} from "@/utils/providers";

describe("getResumeCommand", () => {
  it("builds a claude resume command with cd prefix", () => {
    expect(getResumeCommand("claude", "abc-123", "/Users/jack/my project")).toBe(
      "cd '/Users/jack/my project' && claude --resume abc-123"
    );
  });

  it("builds a codex resume command with cd prefix", () => {
    expect(getResumeCommand("codex", "sess_42", "/tmp/work")).toBe(
      "cd '/tmp/work' && codex resume sess_42"
    );
  });

  it("omits the cd prefix when cwd is not provided", () => {
    expect(getResumeCommand("claude", "abc-123")).toBe("claude --resume abc-123");
  });

  it("escapes embedded apostrophes in the cwd", () => {
    expect(getResumeCommand("codex", "x1", "/a/it's here")).toBe(
      "cd '/a/it'\\''s here' && codex resume x1"
    );
  });

  it("returns null for providers without a resume command", () => {
    expect(getResumeCommand("cursor", "abc", "/tmp")).toBeNull();
    expect(getResumeCommand("gemini", "abc", "/tmp")).toBeNull();
    expect(getResumeCommand("opencode", "abc", "/tmp")).toBeNull();
  });

  it("fail-closes on session ids with shell metacharacters", () => {
    expect(getResumeCommand("claude", "abc; rm -rf /", "/tmp")).toBeNull();
    expect(getResumeCommand("codex", "a b", "/tmp")).toBeNull();
    expect(getResumeCommand("claude", "", "/tmp")).toBeNull();
  });

  it("reports resume-command support per provider", () => {
    expect(supportsResumeCommand("claude")).toBe(true);
    expect(supportsResumeCommand("codex")).toBe(true);
    expect(supportsResumeCommand("cursor")).toBe(false);
    expect(supportsResumeCommand(undefined)).toBe(false);
  });
});

describe("providers utils", () => {
  it("normalizes provider ids by canonical order", () => {
    // Our fork includes cursor and gemini providers in addition to upstream's three
    const ids = normalizeProviderIds(["opencode", "claude", "opencode"]);
    expect(ids).toEqual(["claude", "opencode"]);
  });

  it("falls back to default provider for unknown values", () => {
    expect(getProviderId(undefined)).toBe(DEFAULT_PROVIDER_ID);
    expect(getProviderId("invalid")).toBe(DEFAULT_PROVIDER_ID);
  });

  it("returns localized provider label", () => {
    const translate = (key: string, fallback: string) => `${key}:${fallback}`;
    expect(getProviderLabel(translate, "codex")).toBe(
      "common.provider.codex:Codex CLI"
    );
  });

  it("detects non-default provider selection", () => {
    expect(hasNonDefaultProvider(["claude"])).toBe(false);
    expect(hasNonDefaultProvider(["claude", "opencode"])).toBe(true);
  });

  it("keeps provider id list stable for all known providers (including fork additions)", () => {
    // Our fork adds cursor and gemini on top of upstream's three
    expect(PROVIDER_IDS).toEqual(["claude", "codex", "opencode", "cursor", "gemini"]);
  });

  it("knows which providers support conversation breakdown", () => {
    expect(supportsConversationBreakdown("claude")).toBe(true);
    expect(supportsConversationBreakdown("codex")).toBe(false);
    expect(supportsConversationBreakdown("opencode")).toBe(false);
    // Fork-added providers: cursor and gemini do not support breakdown
    expect(supportsConversationBreakdown("cursor")).toBe(false);
    expect(supportsConversationBreakdown("gemini")).toBe(false);
    expect(supportsConversationBreakdown("unknown")).toBe(false);
  });

  it("detects whether current scope has any supported provider", () => {
    expect(hasAnyConversationBreakdownProvider(["claude"])).toBe(true);
    expect(hasAnyConversationBreakdownProvider(["codex", "opencode"])).toBe(
      false
    );
    expect(hasAnyConversationBreakdownProvider([])).toBe(false);
    expect(hasAnyConversationBreakdownProvider(undefined)).toBe(false);
  });

  it("calculates conversation breakdown coverage by provider tokens", () => {
    const coverage = calculateConversationBreakdownCoverage([
      { provider_id: "claude", tokens: 70 },
      { provider_id: "codex", tokens: 20 },
      { provider_id: "opencode", tokens: 10 },
    ]);

    expect(coverage.totalTokens).toBe(100);
    expect(coverage.coveredTokens).toBe(70);
    expect(coverage.coveragePercent).toBe(70);
    expect(coverage.hasLimitedProviders).toBe(true);
  });

  it("returns 0% coverage when there are no tokens", () => {
    const coverage = calculateConversationBreakdownCoverage([
      { provider_id: "claude", tokens: 0 },
      { provider_id: "codex", tokens: 0 },
    ]);

    expect(coverage.totalTokens).toBe(0);
    expect(coverage.coveredTokens).toBe(0);
    expect(coverage.coveragePercent).toBe(0);
    expect(coverage.hasLimitedProviders).toBe(false);
  });
});
