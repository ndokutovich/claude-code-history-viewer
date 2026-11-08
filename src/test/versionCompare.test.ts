import { describe, it, expect } from "vitest";
import { compareVersions, isNewerVersion } from "../utils/versionCompare";

describe("compareVersions", () => {
  it("compares numerically, not as strings", () => {
    expect(compareVersions("1.10.10", "1.10.9")).toBe(1);
    expect(compareVersions("1.10.9", "1.10.10")).toBe(-1);
    expect(compareVersions("1.2.0", "1.10.0")).toBe(-1);
  });

  it("ignores a leading v and a pre-release suffix", () => {
    expect(compareVersions("v2.0.0", "1.99.99")).toBe(1);
    expect(compareVersions("1.2.0-beta.1", "1.2.0")).toBe(0);
  });

  it("treats missing components as zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBe(1);
  });

  it("reports equality", () => {
    expect(compareVersions("1.10.10", "1.10.10")).toBe(0);
  });
});

describe("isNewerVersion", () => {
  it("is true only for a strictly newer tag", () => {
    expect(isNewerVersion("v1.10.10", "1.10.9")).toBe(true);
    expect(isNewerVersion("v1.10.9", "1.10.9")).toBe(false);
    expect(isNewerVersion("v1.10.8", "1.10.9")).toBe(false);
  });

  it("is false without a current version", () => {
    expect(isNewerVersion("v1.10.10", "")).toBe(false);
  });
});
