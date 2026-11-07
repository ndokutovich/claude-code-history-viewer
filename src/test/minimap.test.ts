import { describe, it, expect } from "vitest";
import {
  viewportFraction,
  fractionToScrollTop,
  fractionToRowIndex,
  rowBand,
} from "../components/MessageViewer/helpers/minimap";

describe("viewportFraction (upstream #634)", () => {
  it("reports a full viewport for empty content", () => {
    expect(viewportFraction(0, 0, 0)).toEqual({ start: 0, size: 1 });
  });

  it("maps scroll position and window size onto the document", () => {
    // 1000px document, 200px window, scrolled a quarter of the way.
    expect(viewportFraction(250, 200, 1000)).toEqual({ start: 0.25, size: 0.2 });
  });

  it("clamps the box inside the strip at the bottom", () => {
    const { start, size } = viewportFraction(1000, 200, 1000);
    expect(size).toBeCloseTo(0.2);
    expect(start).toBeCloseTo(0.8, 5); // 1 - size, never past the end
  });

  it("never lets a short document produce a box taller than the strip", () => {
    expect(viewportFraction(0, 5000, 1000).size).toBe(1);
  });
});

describe("fractionToScrollTop", () => {
  it("centres the viewport on the click", () => {
    // Clicking the middle of a 1000px document with a 200px window → 400px.
    expect(fractionToScrollTop(0.5, 200, 1000)).toBe(400);
  });

  it("clamps to the document edges", () => {
    expect(fractionToScrollTop(0, 200, 1000)).toBe(0);
    expect(fractionToScrollTop(1, 200, 1000)).toBe(800);
  });

  it("returns 0 for empty content", () => {
    expect(fractionToScrollTop(0.5, 0, 0)).toBe(0);
  });
});

describe("fractionToRowIndex", () => {
  it("maps a fraction onto an equal-band row", () => {
    expect(fractionToRowIndex(0, 10)).toBe(0);
    expect(fractionToRowIndex(0.55, 10)).toBe(5);
    expect(fractionToRowIndex(1, 10)).toBe(9); // clamped to the last row
  });

  it("returns null without rows", () => {
    expect(fractionToRowIndex(0.5, 0)).toBeNull();
  });
});

describe("rowBand", () => {
  it("splits the strip evenly", () => {
    expect(rowBand(0, 4)).toEqual({ top: 0, size: 0.25 });
    expect(rowBand(3, 4)).toEqual({ top: 0.75, size: 0.25 });
  });

  it("is empty without rows", () => {
    expect(rowBand(0, 0)).toEqual({ top: 0, size: 0 });
  });
});
