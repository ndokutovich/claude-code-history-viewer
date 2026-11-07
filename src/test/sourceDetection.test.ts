/**
 * Regression: a fresh install dropped Claude Code from auto-detection while
 * other providers were found.
 *
 * Root causes this pins:
 * 1. `detectAllProviders` validated each probed path through
 *    `adapterRegistry.detectProvider`, which runs EVERY adapter's validate
 *    on EVERY path (9x9 Tauri calls) inside one 5s budget — one slow
 *    adapter silently dropped unrelated providers.
 * 2. `AdapterRegistry.initialize()` threw on a second call, which StrictMode
 *    triggers, aborting source loading.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async () => undefined,
    set: async () => undefined,
    save: async () => undefined,
  }),
}));

vi.mock("react-i18next", () => ({
  default: { t: (k: string) => k, use: () => undefined },
  initReactI18next: { type: "3rdParty", init: () => undefined },
}));

import { adapterRegistry } from "../adapters/registry/AdapterRegistry";

const providerPaths: Record<string, string> = {
  get_claude_folder_path: "C:/fake/.claude",
  get_cursor_path: "C:/fake/Cursor",
  get_gemini_path: "C:/fake/.gemini",
  get_codex_path: "C:/fake/.codex/sessions",
  get_opencode_path: "C:/fake/opencode",
  get_cline_path: "C:/fake/cline",
  get_aider_path: "C:/fake/aider",
  get_forgecode_path: "C:/fake/forgecode",
  get_antigravity_path: "C:/fake/.gemini/antigravity",
};

const validateCommands: Record<string, string> = {
  "C:/fake/.claude": "validate_claude_folder",
  "C:/fake/.gemini": "validate_gemini_folder",
  "C:/fake/.codex/sessions": "validate_codex_folder",
  "C:/fake/opencode": "validate_opencode_folder",
  "C:/fake/cline": "validate_cline_folder",
  "C:/fake/.gemini/antigravity": "validate_antigravity_folder",
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args?: { path?: string }) => {
    if (command in providerPaths) return providerPaths[command];
    const path = args?.path ?? "";
    if (command === validateCommands[path]) return true;
    // Every other validate says "not my store" (false), never hangs.
    return false;
  });
});

describe("adapter registry initialization", () => {
  it("is idempotent — a second call must not throw", async () => {
    await adapterRegistry.initialize();
    await expect(adapterRegistry.initialize()).resolves.toBeUndefined();
  });
});

describe("detectAllProviders", () => {
  it("finds Claude Code even when another provider's validate is slow", async () => {
    const { useSourceStore } = await import("../store/useSourceStore");
    await adapterRegistry.initialize();

    const realInvoke = invokeMock.getMockImplementation()!;
    invokeMock.mockImplementation(async (command: string, args?: { path?: string }) => {
      // Aider hangs for 4s: with the old design this ate the shared budget.
      if (command === "validate_aider_folder") {
        await new Promise((r) => setTimeout(r, 4000));
        return false;
      }
      return realInvoke(command, args);
    });

    const found = await useSourceStore.getState().detectAllProviders();

    expect(found).toContain("C:/fake/.claude");
    expect(found).toContain("C:/fake/.gemini/antigravity");
  }, 30_000);

  it("reports an invalid store when its own adapter says no", async () => {
    const { useSourceStore } = await import("../store/useSourceStore");
    await adapterRegistry.initialize();

    invokeMock.mockImplementation(async (command: string) => {
      if (command in providerPaths) return providerPaths[command];
      if (command === "validate_claude_folder") return false; // broken store
      return false;
    });

    const found = await useSourceStore.getState().detectAllProviders();
    expect(found).not.toContain("C:/fake/.claude");
  }, 30_000);
});
