import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateSignature, selectPlatformAssets, buildManifest } = require(
  "../updater-manifest.cjs"
);

// A real Tauri .sig file is base64 whose decoded form starts with
// "untrusted comment:". Build one for the happy path.
const realSig = Buffer.from(
  "untrusted comment: signature from tauri secret key\n" +
    "RUQGplEJXdwyCNLEP5ZL2QmyUB9vOOw8JSRFvwvSOMEABCDEF1234567890abcdef\n"
).toString("base64");

describe("updater-manifest.validateSignature", () => {
  it("rejects the 404 'Not Found' body that caused the broken updater", () => {
    // Reproduces v1.10.3: browser_download_url returned "Not Found" and it was
    // stored as the signature. validateSignature must refuse it.
    expect(() => validateSignature("Not Found", "windows-x86_64")).toThrow(
      /error response/i
    );
  });

  it("rejects empty / whitespace signatures", () => {
    expect(() => validateSignature("", "darwin-universal")).toThrow(/empty/i);
    expect(() => validateSignature("   \n", "darwin-universal")).toThrow(/empty/i);
  });

  it("rejects content that is not a minisign signature", () => {
    const notMinisign = Buffer.from(
      "this is not a signature at all, just a long block of arbitrary text " +
        "that is well over the minimum length threshold but lacks the header"
    ).toString("base64");
    expect(() => validateSignature(notMinisign, "linux-x86_64")).toThrow(
      /not a minisign/i
    );
  });

  it("returns a real signature verbatim (no double base64 encoding)", () => {
    const out = validateSignature(realSig, "windows-x86_64");
    expect(out).toBe(realSig); // unchanged — NOT Buffer.from(realSig).toString('base64')
    expect(Buffer.from(out, "base64").toString("utf8")).toMatch(/^untrusted comment:/);
  });

  it("trims surrounding whitespace/newlines from the .sig file", () => {
    expect(validateSignature(`\n${realSig}\n`, "windows-x86_64")).toBe(realSig);
  });
});

describe("updater-manifest.selectPlatformAssets", () => {
  const assets = [
    { name: "App_1.0.0_x64_en-US.msi" },
    { name: "App_1.0.0_x64_en-US.msi.sig" },
    { name: "App_1.0.0_universal.dmg" }, // NOT the updater artifact
    { name: "App_universal.app.tar.gz" },
    { name: "App_universal.app.tar.gz.sig" },
    { name: "App_1.0.0_amd64.AppImage" },
    { name: "App_1.0.0_amd64.AppImage.sig" },
  ];

  it("uses the .app.tar.gz (not .dmg) for macOS updater", () => {
    const sel = selectPlatformAssets(assets);
    expect(sel["darwin-universal"].asset.name).toBe("App_universal.app.tar.gz");
    expect(sel["darwin-universal"].sigAsset.name).toBe(
      "App_universal.app.tar.gz.sig"
    );
  });

  it("pairs each platform artifact with its exact .sig", () => {
    const sel = selectPlatformAssets(assets);
    expect(sel["windows-x86_64"].sigAsset.name).toBe("App_1.0.0_x64_en-US.msi.sig");
    expect(sel["linux-x86_64"].sigAsset.name).toBe("App_1.0.0_amd64.AppImage.sig");
  });
});

describe("updater-manifest.buildManifest", () => {
  it("refuses to build an empty manifest (no platforms)", () => {
    expect(() =>
      buildManifest({ version: "1.0.0", notes: "", pubDate: "x", platforms: {} })
    ).toThrow(/empty manifest/i);
  });

  it("assembles a valid manifest", () => {
    const m = buildManifest({
      version: "1.0.0",
      notes: "n",
      pubDate: "2026-01-01",
      platforms: { "windows-x86_64": { signature: realSig, url: "http://x/app.msi" } },
    });
    expect(m).toEqual({
      version: "1.0.0",
      notes: "n",
      pub_date: "2026-01-01",
      platforms: { "windows-x86_64": { signature: realSig, url: "http://x/app.msi" } },
    });
  });
});
