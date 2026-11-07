import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { createRef } from "react";

const openUrlMock = vi.fn();
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrlMock(...args),
}));

import { useExternalLinks } from "../hooks/useExternalLinks";

function mountWith(anchor: HTMLAnchorElement) {
  const container = document.createElement("div");
  container.appendChild(anchor);
  document.body.appendChild(container);
  const ref = createRef<HTMLDivElement>() as React.RefObject<HTMLElement | null>;
  (ref as { current: HTMLElement | null }).current = container;
  return { ref, container };
}

function click(anchor: HTMLAnchorElement) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  anchor.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  openUrlMock.mockReset();
  document.body.innerHTML = "";
});

describe("useExternalLinks (upstream #602/#613)", () => {
  it("opens http(s) links with the system browser", async () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "https://example.com/x");
    const { ref } = mountWith(anchor);
    const { unmount } = renderHook(() => useExternalLinks(ref));

    const event = click(anchor);

    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(openUrlMock).toHaveBeenCalledWith("https://example.com/x"));
    unmount();
  });

  it.each(["src/App.tsx#L42", "./README.md", "/etc/hosts", "file:///C:/repo/a.ts"])(
    "blocks in-app navigation for non-external link %s",
    (href) => {
      const anchor = document.createElement("a");
      anchor.setAttribute("href", href);
      const { ref } = mountWith(anchor);
      const { unmount } = renderHook(() => useExternalLinks(ref));

      const event = click(anchor);

      expect(event.defaultPrevented).toBe(true);
      expect(openUrlMock).not.toHaveBeenCalled();
      unmount();
    }
  );

  it("keeps in-page anchors working", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "#section-2");
    const { ref } = mountWith(anchor);
    const { unmount } = renderHook(() => useExternalLinks(ref));

    expect(click(anchor).defaultPrevented).toBe(false);
    unmount();
  });

  it("keeps programmatic blob downloads working", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "blob:tauri://localhost/1234");
    anchor.setAttribute("download", "export.json");
    const { ref } = mountWith(anchor);
    const { unmount } = renderHook(() => useExternalLinks(ref));

    expect(click(anchor).defaultPrevented).toBe(false);
    unmount();
  });

  it("blocks a blob link that is not a download", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", "blob:tauri://localhost/1234");
    const { ref } = mountWith(anchor);
    const { unmount } = renderHook(() => useExternalLinks(ref));

    expect(click(anchor).defaultPrevented).toBe(true);
    unmount();
  });
});
