import { useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Intercepts clicks on external links (<a href="http(s)://...">) within a
 * container and opens them in the system's default browser instead of the
 * WebView. Without this, Tauri's WebView navigates away from the app.
 */
export function useExternalLinks(
  containerRef: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only intercept external http(s) links
      if (href.startsWith("http://") || href.startsWith("https://")) {
        e.preventDefault();
        e.stopPropagation();
        openUrl(href).catch((err) =>
          console.error("Failed to open external URL:", err)
        );
      }
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [containerRef]);
}
