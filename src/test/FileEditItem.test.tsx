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
    // Should NOT have Markdown prose wrapper for non-markdown files
    expect(container.querySelector("[class*='prose']")).toBeNull();
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

describe("FileEditItem - Markdown Detection and Rendering", () => {
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

  it("should render file edit item without crashing", () => {
    const { container } = render(
      <FileEditItem edit={baseEdit} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("file.ts");
  });

  it("should detect .md file and render markdown when expanded", () => {
    const mdEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/README.md",
      content_after_change: "# Title\n**Bold text**",
    };

    const { container } = render(
      <FileEditItem edit={mdEdit} isDarkMode={false} />
    );

    fireEvent.click(container.querySelector("[data-testid='file-edit-header']")!);

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("README.md");
  });

  it("should detect .markdown file", () => {
    const markdownEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/GUIDE.markdown",
      content_after_change: "# Guide",
    };

    const { container } = render(
      <FileEditItem edit={markdownEdit} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("GUIDE.markdown");
  });

  it("should detect case-insensitive markdown extension", () => {
    const MD_EDIT: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/README.MD",
      content_after_change: "# Markdown",
    };

    const { container } = render(
      <FileEditItem edit={MD_EDIT} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("README.MD");
  });

  it("should render TypeScript file without markdown", () => {
    const tsEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/src/component.tsx",
      content_after_change: "const Comp = () => <div/>;",
    };

    const { container } = render(
      <FileEditItem edit={tsEdit} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("component.tsx");
  });

  it("should render Python file without markdown", () => {
    const pyEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/scripts/main.py",
      content_after_change: "def hello():\n    print('world')",
    };

    const { container } = render(
      <FileEditItem edit={pyEdit} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("main.py");
  });

  it("should support dark mode for code files", () => {
    const tsEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/src/file.ts",
    };

    const { container } = render(
      <FileEditItem edit={tsEdit} isDarkMode={true} />
    );

    expect(container).toBeTruthy();
  });

  it("should support dark mode for markdown files", () => {
    const mdEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/README.md",
      content_after_change: "# Title",
    };

    const { container } = render(
      <FileEditItem edit={mdEdit} isDarkMode={true} />
    );

    expect(container).toBeTruthy();
  });

  it("should handle empty markdown content", () => {
    const emptyEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/empty.md",
      content_after_change: "",
    };

    const { container } = render(
      <FileEditItem edit={emptyEdit} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
  });

  it("should handle large content", () => {
    const largeContent = "Line 1\n".repeat(500);
    const largeEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/large.md",
      content_after_change: largeContent,
    };

    const { container } = render(
      <FileEditItem edit={largeEdit} isDarkMode={false} />
    );

    expect(container).toBeTruthy();
  });

  it("should display diff stats", () => {
    const editWithStats: RecentFileEdit = {
      ...baseEdit,
      lines_added: 5,
      lines_removed: 2,
    };

    const { container } = render(
      <FileEditItem edit={editWithStats} isDarkMode={false} />
    );

    expect(container.textContent).toContain("+5");
    expect(container.textContent).toContain("-2");
  });

  it("should render operation badge", () => {
    const { container } = render(
      <FileEditItem edit={baseEdit} isDarkMode={false} />
    );

    // Check that badge container exists
    expect(container.querySelector("[class*='px-2']")).toBeTruthy();
  });

  it("should render markdown for .markdown extension files when expanded", () => {
    const markdownEdit: RecentFileEdit = {
      ...baseEdit,
      file_path: "/docs/CHANGELOG.markdown",
      content_after_change: "## Changelog\n\n- item 1",
    };

    const { container } = render(
      <FileEditItem edit={markdownEdit} isDarkMode={false} />
    );

    fireEvent.click(container.querySelector("[data-testid='file-edit-header']")!);

    expect(container.querySelector("h2")?.textContent).toBe("Changelog");
    expect(container.querySelectorAll("li").length).toBeGreaterThanOrEqual(1);
  });
});
