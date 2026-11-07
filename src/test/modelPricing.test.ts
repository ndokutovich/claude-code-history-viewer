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

// ---------------------------------------------------------------------------
// Claude 5.x pricing (upstream model-pricing.json, audited 2026-10-10)
// ---------------------------------------------------------------------------
import { calculateModelPrice } from "../components/AnalyticsDashboard/utils/calculations";

const ONE_MILLION = 1_000_000;

describe("Claude 5.x pricing", () => {
  it("prices claude-opus-5-5 at $4/$20 with a $0.20 cache read", () => {
    const cost = calculateModelPrice("claude-opus-5-5", ONE_MILLION, ONE_MILLION, 0, ONE_MILLION);
    expect(cost).toBeCloseTo(4 + 20 + 0.2, 6);
  });

  it("does not bill Opus 5.5 at the Opus 5 rate", () => {
    const fiveFive = calculateModelPrice("claude-opus-5-5", ONE_MILLION, 0, 0, 0);
    const five = calculateModelPrice("claude-opus-5", ONE_MILLION, 0, 0, 0);
    expect(fiveFive).toBeCloseTo(4, 6);
    expect(five).toBeCloseTo(5, 6);
  });

  it("prices sonnet-5-5 with the cache-read cut", () => {
    expect(
      calculateModelPrice("claude-sonnet-5-5", 0, 0, 0, ONE_MILLION)
    ).toBeCloseTo(0.1, 6);
    expect(calculateModelPrice("claude-sonnet-5", 0, 0, 0, ONE_MILLION)).toBeCloseTo(0.2, 6);
  });

  it("matches dated and suffixed model ids", () => {
    expect(
      calculateModelPrice("claude-opus-5-5[1m]", ONE_MILLION, 0, 0, 0)
    ).toBeCloseTo(4, 6);
    expect(
      calculateModelPrice("claude-sonnet-5-5-20261010", ONE_MILLION, 0, 0, 0)
    ).toBeCloseTo(2, 6);
  });

  it("prices haiku-5-5 at the base row", () => {
    expect(
      calculateModelPrice("claude-haiku-5-5", ONE_MILLION, ONE_MILLION, 0, 0)
    ).toBeCloseTo(0.1 + 0.5, 6);
  });
});
