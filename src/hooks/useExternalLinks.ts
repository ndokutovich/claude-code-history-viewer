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

    const handleClick = async (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("http://") || href.startsWith("https://")) {
        e.preventDefault();
        e.stopPropagation();
        try {
          await openUrl(href);
        } catch (err) {
          console.error("Failed to open external URL:", err);
        }
        return;
      }

      // Never let the WebView navigate away from the app: a relative path, a
      // file:// URL or a bare path in a transcript is a reference, not a
      // destination (upstream #602). In-page anchors still scroll, and
      // programmatic blob:/data: downloads keep working.
      const isInPageAnchor = href.startsWith("#");
      const hasDownload = anchor.hasAttribute("download");
      const isDownloadableScheme =
        href.startsWith("blob:") || href.startsWith("data:");
      if (isInPageAnchor || (hasDownload && isDownloadableScheme)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [containerRef]);
}
