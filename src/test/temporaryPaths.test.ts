import { describe, it, expect } from "vitest";
import { isTemporaryPath, isProjectTemporary } from "../utils/temporaryPaths";

describe("isTemporaryPath (upstream #ccf7c19b)", () => {
  it("recognises Windows temp folders", () => {
    expect(isTemporaryPath("C:/Users/jack/AppData/Local/Temp/job")).toBe(true);
    expect(isTemporaryPath("C:/Windows/Temp/x")).toBe(true);
    // Backslash form, written without escape ambiguity.
    expect(isTemporaryPath(String.raw`C:\Users\jack\AppData\Local\Temp\job`)).toBe(true);
  });

  it("recognises unix scratch locations", () => {
    expect(isTemporaryPath("/tmp/build")).toBe(true);
    expect(isTemporaryPath("/private/var/folders/ab/cd/T/x")).toBe(true);
    expect(isTemporaryPath("/home/jack/.cache/thing")).toBe(true);
  });

  it("leaves real projects alone", () => {
    expect(isTemporaryPath("w:/_proj/_own/gemsbox")).toBe(false);
    expect(isTemporaryPath("/home/jack/src/app")).toBe(false);
    expect(isTemporaryPath("C:/Users/jack/Documents/proj")).toBe(false);
    expect(isTemporaryPath(undefined)).toBe(false);
  });
});

describe("isProjectTemporary", () => {
  it("uses the resolved folder first", () => {
    expect(isProjectTemporary({ actual_path: "/tmp/x", path: "/other" })).toBe(true);
  });

  it("falls back to the storage path", () => {
    expect(isProjectTemporary({ path: "C:/Users/a/AppData/Local/Temp/p" })).toBe(true);
    expect(isProjectTemporary({ actual_path: "w:/proj", path: "w:/proj" })).toBe(false);
    expect(isProjectTemporary(null)).toBe(false);
  });
});
