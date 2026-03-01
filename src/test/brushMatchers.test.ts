/**
 * Brush Matching Utilities Tests
 * Tests for the SessionBoard attribute brushing predicate logic
 */

import { describe, it, expect } from "vitest";
import { matchesBrush } from "../utils/brushMatchers";
import type { BrushableCard } from "../types/board.types";

// Factory for creating test cards with defaults.
// Our fork's BrushableCard has additional fields (hasHook, shellCommands, mcpServers)
// compared to upstream, so we default them to safe empty values.
const createCard = (overrides: Partial<BrushableCard> = {}): BrushableCard => ({
    role: "assistant",
    model: "claude-sonnet-4-20250514",
    variant: "neutral",
    isError: false,
    isCancelled: false,
    isCommit: false,
    isGit: false,
    isShell: false,
    isFileEdit: false,
    editedFiles: [],
    hasHook: false,
    shellCommands: [],
    mcpServers: [],
    ...overrides,
});

describe("matchesBrush", () => {
    describe("null brush (no filter)", () => {
        it("should match all cards when brush is null", () => {
            expect(matchesBrush(null, createCard())).toBe(true);
            expect(matchesBrush(null, createCard({ isError: true }))).toBe(true);
            expect(matchesBrush(null, createCard({ variant: "terminal" }))).toBe(true);
        });
    });

    describe("model brush", () => {
        it("should match cards by model substring", () => {
            const brush = { type: "model" as const, value: "sonnet" };

            expect(matchesBrush(brush, createCard({ model: "claude-sonnet-4-20250514" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ model: "claude-opus-4-20250514" }))).toBe(false);
            expect(matchesBrush(brush, createCard({ model: undefined }))).toBe(false);
        });

        it("should match opus models", () => {
            const brush = { type: "model" as const, value: "opus" };

            expect(matchesBrush(brush, createCard({ model: "claude-opus-4-20250514" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ model: "claude-sonnet-4-20250514" }))).toBe(false);
        });

        it("should match haiku models", () => {
            const brush = { type: "model" as const, value: "haiku" };

            expect(matchesBrush(brush, createCard({ model: "claude-haiku-3-20250514" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ model: "claude-sonnet-4-20250514" }))).toBe(false);
        });
    });

    describe("tool brush", () => {
        it("should match cards by variant", () => {
            const brush = { type: "tool" as const, value: "terminal" };

            expect(matchesBrush(brush, createCard({ variant: "terminal" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ variant: "code" }))).toBe(false);
        });

        it("should match search variant", () => {
            const brush = { type: "tool" as const, value: "search" };

            expect(matchesBrush(brush, createCard({ variant: "search" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ variant: "file" }))).toBe(false);
        });

        it("should match web variant", () => {
            const brush = { type: "tool" as const, value: "web" };

            expect(matchesBrush(brush, createCard({ variant: "web" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ variant: "terminal" }))).toBe(false);
        });

        it("should match mcp variant", () => {
            const brush = { type: "tool" as const, value: "mcp" };

            expect(matchesBrush(brush, createCard({ variant: "mcp" }))).toBe(true);
            expect(matchesBrush(brush, createCard({ variant: "code" }))).toBe(false);
        });

        describe("special 'document' handling", () => {
            it("should match document variant", () => {
                const brush = { type: "tool" as const, value: "document" };

                expect(matchesBrush(brush, createCard({ variant: "document" }))).toBe(true);
            });

            it("should match cards editing markdown files", () => {
                const brush = { type: "tool" as const, value: "document" };

                expect(matchesBrush(brush, createCard({
                    variant: "code",
                    editedFiles: ["/path/to/README.md"]
                }))).toBe(true);

                expect(matchesBrush(brush, createCard({
                    variant: "code",
                    editedFiles: ["/docs/guide.markdown"]
                }))).toBe(true);
            });

            it("should not match non-markdown files", () => {
                const brush = { type: "tool" as const, value: "document" };

                expect(matchesBrush(brush, createCard({
                    variant: "code",
                    editedFiles: ["/src/index.ts"]
                }))).toBe(false);
            });
        });

        describe("special 'code' handling", () => {
            it("should match code variant", () => {
                const brush = { type: "tool" as const, value: "code" };

                expect(matchesBrush(brush, createCard({ variant: "code" }))).toBe(true);
            });

            it("should match file edits regardless of variant", () => {
                const brush = { type: "tool" as const, value: "code" };

                // create_file has variant: file, but isFileEdit should still match
                expect(matchesBrush(brush, createCard({
                    variant: "file",
                    isFileEdit: true
                }))).toBe(true);
            });

            it("should not match non-code tools without file edits", () => {
                const brush = { type: "tool" as const, value: "code" };

                expect(matchesBrush(brush, createCard({ variant: "terminal" }))).toBe(false);
                expect(matchesBrush(brush, createCard({ variant: "search" }))).toBe(false);
            });
        });

        describe("special 'git' handling", () => {
            it("should match git variant", () => {
                const brush = { type: "tool" as const, value: "git" };

                expect(matchesBrush(brush, createCard({ variant: "git" }))).toBe(true);
            });

            it("should match cards with isGit flag", () => {
                const brush = { type: "tool" as const, value: "git" };

                // Terminal commands that are git operations
                expect(matchesBrush(brush, createCard({
                    variant: "terminal",
                    isGit: true
                }))).toBe(true);
            });

            it("should not match terminal without git", () => {
                const brush = { type: "tool" as const, value: "git" };

                expect(matchesBrush(brush, createCard({
                    variant: "terminal",
                    isGit: false
                }))).toBe(false);
            });
        });
    });

    describe("status brush", () => {
        it("should match error status", () => {
            const brush = { type: "status" as const, value: "error" };

            expect(matchesBrush(brush, createCard({ isError: true }))).toBe(true);
            expect(matchesBrush(brush, createCard({ isError: false }))).toBe(false);
        });

        it("should match cancelled status", () => {
            const brush = { type: "status" as const, value: "cancelled" };

            expect(matchesBrush(brush, createCard({ isCancelled: true }))).toBe(true);
            expect(matchesBrush(brush, createCard({ isCancelled: false }))).toBe(false);
        });

        it("should match commit status", () => {
            const brush = { type: "status" as const, value: "commit" };

            expect(matchesBrush(brush, createCard({ isCommit: true }))).toBe(true);
            expect(matchesBrush(brush, createCard({ isCommit: false }))).toBe(false);
        });

        it("should return false for unknown status", () => {
            const brush = { type: "status" as const, value: "unknown" };

            expect(matchesBrush(brush, createCard())).toBe(false);
        });
    });

    describe("file brush", () => {
        it("should match exact file paths", () => {
            const brush = { type: "file" as const, value: "/src/index.ts" };

            expect(matchesBrush(brush, createCard({
                editedFiles: ["/src/index.ts"]
            }))).toBe(true);

            expect(matchesBrush(brush, createCard({
                editedFiles: ["/src/other.ts"]
            }))).toBe(false);
        });

        it("should match partial paths (endsWith)", () => {
            const brush = { type: "file" as const, value: "index.ts" };

            expect(matchesBrush(brush, createCard({
                editedFiles: ["/src/index.ts"]
            }))).toBe(true);

            expect(matchesBrush(brush, createCard({
                editedFiles: ["/src/index.tsx"]
            }))).toBe(false);
        });

        it("should match any file in editedFiles array", () => {
            const brush = { type: "file" as const, value: "README.md" };

            expect(matchesBrush(brush, createCard({
                editedFiles: ["/src/index.ts", "/docs/README.md", "/package.json"]
            }))).toBe(true);
        });

        it("should return false for empty editedFiles", () => {
            const brush = { type: "file" as const, value: "index.ts" };

            expect(matchesBrush(brush, createCard({ editedFiles: [] }))).toBe(false);
        });
    });

    describe("unknown brush type", () => {
        it("should return false for unknown brush types", () => {
            // Type assertion to test runtime behavior with invalid type
            const brush = { type: "unknown" as "model", value: "test" };

            expect(matchesBrush(brush, createCard())).toBe(false);
        });
    });

    describe("edge cases", () => {
        it("should handle cards with all flags false", () => {
            const card = createCard();

            expect(matchesBrush({ type: "status", value: "error" }, card)).toBe(false);
            expect(matchesBrush({ type: "status", value: "cancelled" }, card)).toBe(false);
            expect(matchesBrush({ type: "status", value: "commit" }, card)).toBe(false);
        });

        it("should handle cards with multiple flags true", () => {
            const card = createCard({
                isError: true,
                isCancelled: true,
                isCommit: true,
                isGit: true,
            });

            expect(matchesBrush({ type: "status", value: "error" }, card)).toBe(true);
            expect(matchesBrush({ type: "status", value: "cancelled" }, card)).toBe(true);
            expect(matchesBrush({ type: "status", value: "commit" }, card)).toBe(true);
            expect(matchesBrush({ type: "tool", value: "git" }, card)).toBe(true);
        });
    });
});
