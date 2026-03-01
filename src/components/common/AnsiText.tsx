import { useMemo } from "react";
import { ansiToHtml } from "@/utils/ansiToHtml";

interface AnsiTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with ANSI codes as styled HTML.
 *
 * Security: ansiToHtml() uses escapeXML: true which HTML-escapes all
 * user content before processing ANSI codes. The resulting HTML only
 * contains <span> tags with style attributes - no user-controlled HTML.
 * dangerouslySetInnerHTML is safe here because the sanitization is built
 * into the converter, not applied after the fact.
 */
export const AnsiText = ({ text, className }: AnsiTextProps) => {
  const html = useMemo(() => ansiToHtml(text), [text]);

  // The ansi-to-html library with escapeXML: true produces safe HTML.
  // All text content is HTML-escaped; only <span> tags with style props are added.
  return (
    <span
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: safe - ansiToHtml escapes all user content via escapeXML:true
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
