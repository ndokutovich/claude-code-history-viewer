/**
 * Shared remark/rehype plugin configuration for every ReactMarkdown call
 * site (upstream #98186395 + #02ef981f).
 *
 * GFM tables/strikethrough plus LaTeX math: `$inline$` and `$$block$$`
 * render through KaTeX instead of staying plain text.
 */
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export const REMARK_PLUGINS = [remarkGfm, remarkMath];
export const REHYPE_PLUGINS = [rehypeKatex];
