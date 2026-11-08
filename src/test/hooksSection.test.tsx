/**
 * Claude Code writes a hook as a matcher group:
 *   { "matcher"?: string, "hooks": [{ "type": "command", "command": "…" }] }
 * The settings UI used to read `entry.command` from the group itself, so every
 * row rendered empty — five gray bars with no text (reported 2026-11-08).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      options?: { defaultValue?: string; count?: number } | string
    ) => {
      if (typeof options === "string") return options;
      if (options && typeof options.count === "number") {
        return `${options.count} command(s)`;
      }
      return options?.defaultValue ?? key;
    },
  }),
}));

import { HooksSection } from "@/components/SettingsManager/sections/HooksSection";
import type { ClaudeCodeSettings } from "@/types";

const matcherGroups = [
  {
    hooks: [
      {
        type: "command",
        command: "node session-vault.js",
        timeout: 600,
      },
    ],
  },
];

function renderSection(hooks: Record<string, unknown>) {
  return render(
    <HooksSection
      settings={{ hooks } as unknown as ClaudeCodeSettings}
      isExpanded
      onToggle={() => undefined}
      onChange={() => undefined}
      readOnly={false}
    />
  );
}

describe("HooksSection", () => {
  it("renders the command text from a matcher group", () => {
    renderSection({ Stop: matcherGroups });
    expect(screen.getByText(/node session-vault\.js/)).toBeTruthy();
  });

  it("shows the timeout of a grouped command", () => {
    renderSection({ Stop: matcherGroups });
    expect(screen.getByText(/600ms/)).toBeTruthy();
  });

  it("counts commands inside the groups, not the groups", () => {
    renderSection({
      Stop: [
        { hooks: [{ type: "command", command: "a" }] },
        { hooks: [{ type: "command", command: "b" }] },
      ],
    });
    expect(screen.getByText(/2 command/)).toBeTruthy();
  });
});
