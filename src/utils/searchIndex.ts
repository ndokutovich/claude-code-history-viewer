import FlexSearch from "flexsearch";
import type { UIMessage } from "../types";
import type { SearchFilterType } from "../store/slices/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FlexSearchDocumentIndex = any;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasStringProperty = (obj: Record<string, unknown>, key: string): boolean =>
  key in obj && typeof obj[key] === "string";

const MAX_TEXT_LENGTH = 10000;

const extractSearchableText = (message: UIMessage): string => {
  const parts: string[] = [];

  try {
    if (message.content) {
      if (typeof message.content === "string") {
        parts.push(message.content);
      } else if (Array.isArray(message.content)) {
        for (const item of message.content) {
          if (typeof item === "string") {
            parts.push(item);
          } else if (isRecord(item)) {
            const itemType = item.type as string | undefined;

            if (itemType === "image") continue;

            if (hasStringProperty(item, "text")) {
              parts.push((item.text as string).slice(0, MAX_TEXT_LENGTH));
            }
            if (hasStringProperty(item, "thinking")) {
              parts.push((item.thinking as string).slice(0, MAX_TEXT_LENGTH));
            }
            if (itemType === "tool_use" && hasStringProperty(item, "name")) {
              parts.push(item.name as string);
            }
            if (itemType === "tool_result" && hasStringProperty(item, "content")) {
              parts.push(item.content as string);
            }
            if (itemType === "server_tool_use" && hasStringProperty(item, "name")) {
              parts.push(item.name as string);
            }
            if (itemType === "mcp_tool_use") {
              if (hasStringProperty(item, "server_name")) parts.push(item.server_name as string);
              if (hasStringProperty(item, "tool_name")) parts.push(item.tool_name as string);
            }
            if (itemType === "document") {
              if (hasStringProperty(item, "title")) parts.push(item.title as string);
              if (hasStringProperty(item, "context")) parts.push(item.context as string);
            }
            if (itemType === "web_fetch_tool_result" && isRecord(item.content)) {
              const content = item.content as Record<string, unknown>;
              if (hasStringProperty(content, "url")) parts.push(content.url as string);
            }
            if (itemType === "code_execution_tool_result" && isRecord(item.content)) {
              const content = item.content as Record<string, unknown>;
              if (hasStringProperty(content, "stdout")) parts.push(content.stdout as string);
              if (hasStringProperty(content, "stderr")) parts.push(content.stderr as string);
            }
            if (itemType === "bash_code_execution_tool_result" && isRecord(item.content)) {
              const content = item.content as Record<string, unknown>;
              if (hasStringProperty(content, "stdout")) parts.push(content.stdout as string);
              if (hasStringProperty(content, "stderr")) parts.push(content.stderr as string);
            }
          }
        }
      }
    }

    const MAX_CONTENT_LENGTH = 5000;
    if (message.toolUseResult) {
      const result = message.toolUseResult as Record<string, unknown> | string;
      if (typeof result === "string") {
        parts.push(result.slice(0, MAX_CONTENT_LENGTH));
      } else if (isRecord(result)) {
        if (hasStringProperty(result, "stdout")) {
          parts.push((result.stdout as string).slice(0, MAX_CONTENT_LENGTH));
        }
        if (hasStringProperty(result, "stderr")) {
          parts.push((result.stderr as string).slice(0, MAX_CONTENT_LENGTH));
        }
        if (hasStringProperty(result, "content")) {
          parts.push((result.content as string).slice(0, MAX_CONTENT_LENGTH));
        }
      }
    }
  } catch (error) {
    console.error("[SearchIndex] Error extracting searchable text:", error);
  }

  return parts.join(" ");
};

const extractToolIds = (message: UIMessage): string => {
  const ids: string[] = [];

  try {
    if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (isRecord(item)) {
          if (item.type === "tool_use" && hasStringProperty(item, "id")) {
            ids.push(item.id as string);
          }
          if (item.type === "tool_result" && hasStringProperty(item, "tool_use_id")) {
            ids.push(item.tool_use_id as string);
          }
        }
      }
    }

    if (isRecord(message.toolUse) && hasStringProperty(message.toolUse, "id")) {
      ids.push(message.toolUse.id as string);
    }
  } catch (error) {
    console.error("[SearchIndex] Error extracting tool IDs:", error);
  }

  return ids.join(" ");
};

interface SearchDocument {
  uuid: string;
  messageIndex: number;
  text: string;
}

interface EnrichedResult {
  id: string;
  doc?: SearchDocument;
}

const extractUuidFromResult = (item: string | EnrichedResult): string =>
  typeof item === "string" ? item : item.id;

const createFlexSearchIndex = (): FlexSearchDocumentIndex =>
  new FlexSearch.Document({
    tokenize: "full",
    cache: 100,
    document: {
      id: "uuid",
      index: ["text"],
      store: ["uuid", "messageIndex"],
    },
  });

class MessageSearchIndex {
  private contentIndex: FlexSearchDocumentIndex;
  private toolIdIndex: FlexSearchDocumentIndex;
  private messageMap: Map<string, number> = new Map();
  private messages: UIMessage[] = [];
  private isBuilt = false;

  constructor() {
    this.contentIndex = createFlexSearchIndex();
    this.toolIdIndex = createFlexSearchIndex();
  }

  build(messages: UIMessage[]): void {
    this.clear();
    this.messages = messages;
    this.buildAsync(messages);
  }

  private buildAsync(messages: UIMessage[]): void {
    const CHUNK_SIZE = 20;
    let currentIndex = 0;

    const processChunk = () => {
      const endIndex = Math.min(currentIndex + CHUNK_SIZE, messages.length);

      for (let i = currentIndex; i < endIndex; i++) {
        const message = messages[i];
        if (!message) continue;

        const text = extractSearchableText(message);
        if (text.trim()) {
          this.contentIndex.add({
            uuid: message.uuid,
            messageIndex: i,
            text: text.toLowerCase(),
          });
        }

        const toolIds = extractToolIds(message);
        if (toolIds.trim()) {
          this.toolIdIndex.add({
            uuid: message.uuid,
            messageIndex: i,
            text: toolIds.toLowerCase(),
          });
        }

        this.messageMap.set(message.uuid, i);
      }

      currentIndex = endIndex;

      if (currentIndex < messages.length) {
        setTimeout(processChunk, 0);
      } else {
        this.isBuilt = true;
        if (import.meta.env.DEV) {
          console.log(`[SearchIndex] Built index for ${messages.length} messages`);
        }
      }
    };

    processChunk();
  }

  private findAllMatchesInText(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let count = 0;
    let pos = 0;

    while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
      count++;
      pos += lowerQuery.length;
    }

    return count;
  }

  search(
    query: string,
    filterType: SearchFilterType = "content"
  ): Array<{ messageUuid: string; messageIndex: number; matchIndex: number; matchCount: number }> {
    if (!this.isBuilt || !query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const index = filterType === "toolId" ? this.toolIdIndex : this.contentIndex;

    const results = index.search(lowerQuery, { limit: 1000, enrich: true });

    const matchedUuids = new Set<string>();
    results.forEach((fieldResult: { field: string; result: (string | EnrichedResult)[] }) => {
      if (fieldResult.result) {
        fieldResult.result.forEach((item: string | EnrichedResult) => {
          matchedUuids.add(extractUuidFromResult(item));
        });
      }
    });

    const allMatches: Array<{ messageUuid: string; messageIndex: number; matchIndex: number; matchCount: number }> = [];

    matchedUuids.forEach((uuid) => {
      const messageIndex = this.messageMap.get(uuid);
      if (messageIndex === undefined) return;

      const message = this.messages[messageIndex];
      if (!message) return;

      const messageText =
        filterType === "toolId"
          ? extractToolIds(message)
          : extractSearchableText(message);

      const matchCount = this.findAllMatchesInText(messageText, lowerQuery);

      for (let i = 0; i < matchCount; i++) {
        allMatches.push({ messageUuid: uuid, messageIndex, matchIndex: i, matchCount });
      }
    });

    allMatches.sort((a, b) => {
      if (a.messageIndex !== b.messageIndex) return b.messageIndex - a.messageIndex;
      return b.matchIndex - a.matchIndex;
    });

    return allMatches;
  }

  clear(): void {
    this.contentIndex = createFlexSearchIndex();
    this.toolIdIndex = createFlexSearchIndex();
    this.messageMap.clear();
    this.messages = [];
    this.isBuilt = false;
  }
}

export const messageSearchIndex = new MessageSearchIndex();

export const buildSearchIndex = (messages: UIMessage[]): void => {
  messageSearchIndex.build(messages);
};

export const searchMessages = (
  query: string,
  filterType: SearchFilterType = "content"
): Array<{ messageUuid: string; messageIndex: number; matchIndex: number; matchCount: number }> =>
  messageSearchIndex.search(query, filterType);

export const clearSearchIndex = (): void => {
  messageSearchIndex.clear();
};
