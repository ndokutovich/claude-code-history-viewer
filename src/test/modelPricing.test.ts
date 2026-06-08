import { describe, it, expect } from "vitest";
import { calculateModelPrice } from "../components/AnalyticsDashboard/utils/calculations";

// Per-1M-token input cost for a given model (output/cache zeroed).
const inputRate = (model: string) =>
  calculateModelPrice(model, 1_000_000, 0, 0, 0);

describe("model pricing", () => {
  it("bills newer Opus 4.x (4-5..4-8) at the $5 tier, not the deprecated $15 Opus 4 rate", () => {
    // Regression: includes() match-order billed opus-4-6/4-7/4-8 at $15 (3x overcharge).
    for (const m of [
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-opus-4-5",
    ]) {
      expect(inputRate(m)).toBe(5);
    }
  });

  it("keeps the original Opus 4 at the deprecated $15 rate", () => {
    expect(inputRate("claude-opus-4")).toBe(15);
  });

  it("prices GPT-5.4 / GPT-5.5 explicitly instead of falling back to default", () => {
    expect(inputRate("gpt-5.5")).toBe(5);
    expect(inputRate("gpt-5.4")).toBe(2.5);
  });

  it("prices Sonnet 4.6 and Haiku 4.5", () => {
    expect(inputRate("claude-sonnet-4-6")).toBe(3);
    expect(inputRate("claude-haiku-4-5")).toBe(1);
  });
});
