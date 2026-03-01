import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ClaudeContentArrayRenderer } from "@/components/contentRenderer/ClaudeContentArrayRenderer";

// Mock react-i18next completely
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

describe("ClaudeContentArrayRenderer - Markdown Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render content without crashing", () => {
    const content = [
      {
        type: "text",
        text: "Test content",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    expect(container).toBeTruthy();
    expect(container.textContent).toContain("Test content");
  });

  it("should render markdown table elements", () => {
    const content = [
      {
        type: "text",
        text: "| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    // Verify table is rendered by checking for table element
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
  });

  it("should render markdown formatting", () => {
    const content = [
      {
        type: "text",
        text: "Text with **bold** and *italic*.",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    // Verify formatting elements exist
    const strong = container.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toContain("bold");

    const em = container.querySelector("em");
    expect(em).toBeTruthy();
  });

  it("should render code blocks", () => {
    const content = [
      {
        type: "text",
        text: "Code:\n```javascript\nconst x = 1;\n```",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    const code = container.querySelector("code");
    expect(code).toBeTruthy();
  });

  it("should render lists", () => {
    const content = [
      {
        type: "text",
        text: "- Item 1\n- Item 2\n- Item 3",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    const list = container.querySelector("ul");
    expect(list).toBeTruthy();

    const items = container.querySelectorAll("li");
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("should render strikethrough (GFM)", () => {
    const content = [
      {
        type: "text",
        text: "~~strikethrough~~ text",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    const del = container.querySelector("del");
    expect(del).toBeTruthy();
    expect(del?.textContent).toContain("strikethrough");
  });

  it("should render plaintext without breaking", () => {
    const content = [
      {
        type: "text",
        text: "Simple plaintext without markdown.",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    expect(container.textContent).toContain("Simple plaintext");
  });

  it("should return null for empty content", () => {
    const { container } = render(
      <ClaudeContentArrayRenderer content={[]} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("should apply prose styling", () => {
    const content = [
      {
        type: "text",
        text: "**Bold**",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    const proseDiv = container.querySelector("[class*='prose']");
    expect(proseDiv).toBeTruthy();
  });

  it("should apply background and border classes", () => {
    const content = [
      {
        type: "text",
        text: "Test",
      },
    ];

    const { container } = render(
      <ClaudeContentArrayRenderer content={content} />
    );

    // Our component uses bg-gray-50 and border-gray-200 for text content wrappers
    const bgDiv = container.querySelector("[class*='bg-gray']");
    expect(bgDiv).toBeTruthy();

    const borderDiv = container.querySelector("[class*='border']");
    expect(borderDiv).toBeTruthy();
  });
});
