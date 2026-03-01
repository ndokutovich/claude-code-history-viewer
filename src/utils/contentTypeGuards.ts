/**
 * Content Type Guards Utility
 *
 * Runtime type checking for Claude content types.
 * These guards accept `unknown` for flexible runtime validation,
 * complementing the ContentItem-specific guards in typeGuards.ts.
 *
 * @see src/utils/typeGuards.ts for message-level type guards
 */

import type {
  ContentItem,
  TextContent,
  ThinkingContent,
  ToolUseContent,
  ToolResultContent,
  DocumentContent,
  SearchResultContent,
  Base64PDFSource,
  PlainTextSource,
  URLPDFSource,
} from "@/types";

import type { MCPToolUseContent, MCPToolResultContent } from "@/types/mcp.types";

// ============================================================================
// Base Content Type Guard
// ============================================================================

/**
 * Base type guard - checks if value is a valid content item structure
 */
export function isContentItem(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && "type" in (item as object);
}

// ============================================================================
// Content Type Extractor
// ============================================================================

/**
 * Safely extracts the content type from an unknown value.
 * Returns the content type string, or null if invalid.
 */
export function getContentType(item: unknown): string | null {
  if (!isContentItem(item)) return null;
  return typeof item.type === "string" ? item.type : null;
}

// ============================================================================
// Basic Content Type Guards
// ============================================================================

/**
 * Type guard for text content blocks
 */
export function isTextContent(item: unknown): item is TextContent {
  return (
    isContentItem(item) &&
    item.type === "text" &&
    typeof (item as Record<string, unknown>).text === "string"
  );
}

/**
 * Type guard for thinking content blocks
 */
export function isThinkingContent(item: unknown): item is ThinkingContent {
  return (
    isContentItem(item) &&
    item.type === "thinking" &&
    typeof (item as Record<string, unknown>).thinking === "string"
  );
}

// ============================================================================
// Document Type Guards
// ============================================================================

/**
 * Type guard for document content blocks
 */
export function isDocumentContent(item: unknown): item is DocumentContent {
  return (
    isContentItem(item) &&
    item.type === "document" &&
    "source" in item &&
    item.source !== null &&
    typeof item.source === "object"
  );
}

/**
 * Type guard for base64 PDF sources
 */
export function isBase64PDFSource(source: unknown): source is Base64PDFSource {
  return (
    source !== null &&
    typeof source === "object" &&
    "type" in (source as object) &&
    (source as Record<string, unknown>).type === "base64" &&
    "media_type" in (source as object) &&
    (source as Record<string, unknown>).media_type === "application/pdf" &&
    "data" in (source as object) &&
    typeof (source as Record<string, unknown>).data === "string"
  );
}

/**
 * Type guard for plain text sources
 */
export function isPlainTextSource(source: unknown): source is PlainTextSource {
  return (
    source !== null &&
    typeof source === "object" &&
    "type" in (source as object) &&
    (source as Record<string, unknown>).type === "text" &&
    "data" in (source as object) &&
    typeof (source as Record<string, unknown>).data === "string"
  );
}

/**
 * Type guard for URL PDF sources
 */
export function isURLPDFSource(source: unknown): source is URLPDFSource {
  return (
    source !== null &&
    typeof source === "object" &&
    "type" in (source as object) &&
    (source as Record<string, unknown>).type === "url" &&
    "url" in (source as object) &&
    typeof (source as Record<string, unknown>).url === "string"
  );
}

// ============================================================================
// Search Result Type Guard
// ============================================================================

/**
 * Type guard for search result content blocks
 */
export function isSearchResultContent(item: unknown): item is SearchResultContent {
  return (
    isContentItem(item) &&
    item.type === "search_result"
  );
}

// ============================================================================
// Tool Use Type Guards
// ============================================================================

/**
 * Type guard for tool use content blocks
 */
export function isToolUseContent(item: unknown): item is ToolUseContent {
  return (
    isContentItem(item) &&
    item.type === "tool_use" &&
    "id" in item &&
    typeof (item as Record<string, unknown>).id === "string" &&
    "name" in item &&
    typeof (item as Record<string, unknown>).name === "string" &&
    "input" in item &&
    item.input !== null &&
    typeof item.input === "object"
  );
}

/**
 * Type guard for tool result content blocks
 */
export function isToolResultContent(item: unknown): item is ToolResultContent {
  return (
    isContentItem(item) &&
    item.type === "tool_result" &&
    "tool_use_id" in item &&
    typeof (item as Record<string, unknown>).tool_use_id === "string" &&
    "content" in item
  );
}

// ============================================================================
// MCP Type Guards
// ============================================================================

/**
 * Type guard for MCP tool use content blocks
 */
export function isMCPToolUseContent(item: unknown): item is MCPToolUseContent {
  return (
    isContentItem(item) &&
    item.type === "mcp_tool_use" &&
    "id" in item &&
    typeof (item as Record<string, unknown>).id === "string" &&
    "server_name" in item &&
    typeof (item as Record<string, unknown>).server_name === "string" &&
    "tool_name" in item &&
    typeof (item as Record<string, unknown>).tool_name === "string" &&
    "input" in item &&
    item.input !== null &&
    typeof item.input === "object"
  );
}

/**
 * Type guard for MCP tool result content blocks
 */
export function isMCPToolResultContent(item: unknown): item is MCPToolResultContent {
  return (
    isContentItem(item) &&
    item.type === "mcp_tool_result" &&
    "tool_use_id" in item &&
    typeof (item as Record<string, unknown>).tool_use_id === "string" &&
    "content" in item
  );
}

// ============================================================================
// Generic Extractor Factory
// ============================================================================

/**
 * Creates a type-safe extractor function for a given type guard.
 *
 * @template T The content type to extract
 * @param typeGuard The type guard function to use
 * @returns A function that returns the typed value if it matches, or null
 *
 * @example
 * ```typescript
 * const extractText = createExtractor(isTextContent);
 * const text = extractText(unknownContent); // TextContent | null
 * ```
 */
export function createExtractor<T>(
  typeGuard: (item: unknown) => item is T
): (item: unknown) => T | null {
  return (item) => (typeGuard(item) ? item : null);
}

// ============================================================================
// Pre-built Extractors
// ============================================================================

/** Extract text content from unknown value */
export const extractTextContent = createExtractor(isTextContent);

/** Extract thinking content from unknown value */
export const extractThinkingContent = createExtractor(isThinkingContent);

/** Extract document content from unknown value */
export const extractDocumentContent = createExtractor(isDocumentContent);

/** Extract search result content from unknown value */
export const extractSearchResultContent = createExtractor(isSearchResultContent);

/** Extract tool use content from unknown value */
export const extractToolUseContent = createExtractor(isToolUseContent);

/** Extract tool result content from unknown value */
export const extractToolResultContent = createExtractor(isToolResultContent);

/** Extract MCP tool use content from unknown value */
export const extractMCPToolUseContent = createExtractor(isMCPToolUseContent);

/** Extract MCP tool result content from unknown value */
export const extractMCPToolResultContent = createExtractor(isMCPToolResultContent);

// ============================================================================
// Multi-Type Filtering
// ============================================================================

/**
 * Filters an array to extract all content items of a specific type.
 *
 * @template T The content type to filter for
 * @param items Array of unknown items to filter
 * @param typeGuard The type guard to use for filtering
 * @returns Array containing only items that match the type guard
 *
 * @example
 * ```typescript
 * const textItems = filterContentByType(content, isTextContent);
 * ```
 */
export function filterContentByType<T extends ContentItem>(
  items: unknown[],
  typeGuard: (item: unknown) => item is T
): T[] {
  return items.filter(typeGuard);
}

/**
 * Finds the first content item of a specific type in an array.
 *
 * @template T The content type to find
 * @param items Array of unknown items to search
 * @param typeGuard The type guard to use for matching
 * @returns The first matching item, or null if none found
 *
 * @example
 * ```typescript
 * const firstThinking = findContentByType(content, isThinkingContent);
 * ```
 */
export function findContentByType<T extends ContentItem>(
  items: unknown[],
  typeGuard: (item: unknown) => item is T
): T | null {
  const found = items.find(typeGuard);
  return found !== undefined ? found : null;
}

/**
 * Checks if an array contains any content of a specific type.
 *
 * @param items Array of unknown items to check
 * @param typeGuard The type guard to use for matching
 * @returns True if at least one item matches the type guard
 *
 * @example
 * ```typescript
 * const hasThinking = hasContentOfType(content, isThinkingContent);
 * ```
 */
export function hasContentOfType(
  items: unknown[],
  typeGuard: (item: unknown) => boolean
): boolean {
  return items.some(typeGuard);
}
