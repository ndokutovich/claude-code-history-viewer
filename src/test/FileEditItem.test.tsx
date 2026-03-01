import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FileEditItem } from "@/components/RecentEditsViewer/FileEditItem";
import type { RecentFileEdit } from "@/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Our fork's RecentFileEdit type — note: no `content_before_change` field.
// `operation_type` is "edit" | "write" (no "create" variant).
const baseEdit: RecentFileEdit = {
  file_path: "/path/to/file.ts",
  timestamp: "2025-02-26T10:00:00Z",
  session_id: "test-session-id",
  operation_type: "edit",
  content_after_change: "const x = 2;",
  lines_added: 1,
  lines_removed: 1,
};

describe("FileEditItem", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("should render file name and diff stats", () => {
    const edit: RecentFileEdit = { ...baseEdit, lines_added: 5, lines_removed: 2 };
    const { container } = render(
      <FileEditItem edit={edit} isDarkMode={false} />
    );

    expect(container.textContent).toContain("file.ts");
    expect(container.textContent).toContain("+5");
    expect(container.textContent).toContain("-2");
  });

  it("should render code with Prism when expanded", () => {
    const { container } = render(
      <FileEditItem edit={baseEdit} isDarkMode={false} />
    );

    fireEvent.click(container.querySelector("[data-testid='file-edit-header']")!);

    // Prism renders <pre> with code tokens
    expect(container.querySelector("pre")).toBeTruthy();
  });

  it("should show file name from path", () => {
    const edit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/src/utils/myHelper.ts",
    };
    const { container } = render(
      <FileEditItem edit={edit} isDarkMode={false} />
    );

    expect(container.textContent).toContain("myHelper.ts");
  });

  it("should not render stats when lines are zero", () => {
    const edit: RecentFileEdit = { ...baseEdit, lines_added: 0, lines_removed: 0 };
    const { container } = render(
      <FileEditItem edit={edit} isDarkMode={false} />
    );

    expect(container.textContent).not.toContain("+0");
    expect(container.textContent).not.toContain("-0");
  });
});
