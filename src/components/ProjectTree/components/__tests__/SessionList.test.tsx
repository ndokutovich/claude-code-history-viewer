/**
 * SessionList tests for FlatSessionsList and SessionRow components.
 *
 * Tests rendering, ARIA semantics, interaction callbacks, and edge cases for
 * the flat all-sessions view and individual session rows used throughout the
 * ProjectTree.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../icons/ProviderIcons", () => ({
  ProviderIcon: () => <span data-testid="provider-icon" />,
  getProviderColorClass: () => "",
}));

vi.mock("../../../../utils/cn", () => ({
  cn: (...args: unknown[]) => (args.filter(Boolean) as string[]).join(" "),
}));

vi.mock("../../../../utils/sessionUtils", () => ({
  getSessionTitle: (session: { summary?: string; session_id: string }) =>
    session.summary ?? session.session_id,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { FlatSessionsList } from "../FlatSessionsList";
import type { FlatSession } from "../FlatSessionsList";
import { SessionRow } from "../SessionRow";
import type { UIProject, UISession } from "../../../../types";
import type { TFunction } from "i18next";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const mockT = vi.fn(
  (key: string, fallbackOrOpts?: string | Record<string, unknown>) => {
    if (typeof fallbackOrOpts === "string") return fallbackOrOpts;
    return key;
  }
) as unknown as TFunction;

function makeSession(overrides: Partial<UISession> = {}): UISession {
  return {
    session_id: "session-1",
    actual_session_id: "actual-1",
    file_path: "/path/to/session.jsonl",
    project_name: "my-project",
    message_count: 5,
    first_message_time: "2025-01-01T00:00:00Z",
    last_message_time: "2025-01-02T00:00:00Z",
    last_modified: "2025-01-02T00:00:00Z",
    has_tool_use: false,
    has_errors: false,
    is_problematic: false,
    summary: "Test session",
    ...overrides,
  };
}

function makeFlatSession(
  sessionOverrides: Partial<UISession> = {},
  projectPath = "/projects/p1",
  projectName = "p1"
): FlatSession {
  return {
    ...makeSession(sessionOverrides),
    projectPath,
    projectName,
  };
}

function makeProject(overrides: Partial<UIProject> = {}): UIProject {
  return {
    path: "/projects/p1",
    name: "p1",
    session_count: 0,
    message_count: 0,
    lastModified: new Date().toISOString(),
    providerName: "Claude Code",
    providerId: "claude",
    ...overrides,
  };
}

const formatTimeAgo = () => "1 hour ago";

// ---------------------------------------------------------------------------
// FlatSessionsList tests
// ---------------------------------------------------------------------------

describe("FlatSessionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("renders empty state message when no sessions are provided", () => {
    render(
      <FlatSessionsList
        sessions={[]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("No sessions found")).toBeInTheDocument();
  });

  it("does NOT render any treeitems when sessions list is empty", () => {
    render(
      <FlatSessionsList
        sessions={[]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // ARIA semantics
  // -------------------------------------------------------------------------

  it("renders session items with role=treeitem", () => {
    const sessions = [makeFlatSession({ session_id: "s1" })];
    render(
      <FlatSessionsList
        sessions={sessions}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toBeInTheDocument();
  });

  it("renders session items with aria-level=1", () => {
    const sessions = [makeFlatSession({ session_id: "s1" })];
    render(
      <FlatSessionsList
        sessions={sessions}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-level", "1");
  });

  it("renders all sessions when multiple are provided", () => {
    const sessions = [
      makeFlatSession({ session_id: "s1", summary: "First" }, "/p1", "p1"),
      makeFlatSession({ session_id: "s2", summary: "Second" }, "/p2", "p2"),
      makeFlatSession({ session_id: "s3", summary: "Third" }, "/p3", "p3"),
    ];
    render(
      <FlatSessionsList
        sessions={sessions}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getAllByRole("treeitem")).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // Selected session
  // -------------------------------------------------------------------------

  it("marks the selected session with aria-selected=true", () => {
    const session = makeSession({ session_id: "sel" });
    const flatSession = makeFlatSession({ session_id: "sel" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={session}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-selected", "true");
  });

  it("does NOT mark unselected sessions with aria-selected=true", () => {
    const otherSession = makeSession({ session_id: "other" });
    const flatSession = makeFlatSession({ session_id: "not-sel" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={otherSession}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-selected", "false");
  });

  it("marks only the matching session as selected when multiple exist", () => {
    const selected = makeSession({ session_id: "selected" });
    const sessions = [
      makeFlatSession({ session_id: "selected", summary: "Selected" }, "/p1", "p1"),
      makeFlatSession({ session_id: "not-sel-a", summary: "Other A" }, "/p1", "p1"),
      makeFlatSession({ session_id: "not-sel-b", summary: "Other B" }, "/p1", "p1"),
    ];

    render(
      <FlatSessionsList
        sessions={sessions}
        selectedSession={selected}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    const treeitems = screen.getAllByRole("treeitem");
    const selectedItems = treeitems.filter(
      (el) => el.getAttribute("aria-selected") === "true"
    );
    expect(selectedItems).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // onSessionSelect callback
  // -------------------------------------------------------------------------

  it("calls onSessionSelect when a session item is clicked", () => {
    const onSessionSelect = vi.fn();
    const flatSession = makeFlatSession({ session_id: "click-me", summary: "Clickable" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={onSessionSelect}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onSessionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "click-me" })
    );
  });

  it("calls onSessionSelect exactly once per click", () => {
    const onSessionSelect = vi.fn();
    const flatSession = makeFlatSession({ session_id: "s1" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={onSessionSelect}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onSessionSelect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // onProjectSelect callback
  // -------------------------------------------------------------------------

  it("calls onProjectSelect with the matching project when a session is clicked", () => {
    const onProjectSelect = vi.fn();
    const project = makeProject({ path: "/p1", name: "p1" });
    const flatSession = makeFlatSession({ session_id: "s1" }, "/p1", "p1");

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[project]}
        onSessionSelect={vi.fn()}
        onProjectSelect={onProjectSelect}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onProjectSelect).toHaveBeenCalledWith(project);
  });

  it("does NOT call onProjectSelect when no matching project is found", () => {
    const onProjectSelect = vi.fn();
    // Session points to a project path that does not exist in projects array
    const flatSession = makeFlatSession({ session_id: "s1" }, "/non-existent", "orphan");

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[makeProject({ path: "/p1" })]}
        onSessionSelect={vi.fn()}
        onProjectSelect={onProjectSelect}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onProjectSelect).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Context menu
  // -------------------------------------------------------------------------

  it("calls onContextMenu when a session item is right-clicked", () => {
    const onContextMenu = vi.fn();
    const flatSession = makeFlatSession({ session_id: "s1" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={onContextMenu}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.contextMenu(screen.getByRole("treeitem"));
    expect(onContextMenu).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Session metadata display
  // -------------------------------------------------------------------------

  it("displays the session title", () => {
    const flatSession = makeFlatSession({ session_id: "s1", summary: "Important Conversation" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("Important Conversation")).toBeInTheDocument();
  });

  it("displays the formatted time", () => {
    const customFormatTimeAgo = () => "5 days ago";
    const flatSession = makeFlatSession({ session_id: "s1" });

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={customFormatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("5 days ago")).toBeInTheDocument();
  });

  it("displays the project name for each session", () => {
    const flatSession = makeFlatSession({ session_id: "s1" }, "/p1", "my-project-name");

    render(
      <FlatSessionsList
        sessions={[flatSession]}
        selectedSession={null}
        projects={[]}
        onSessionSelect={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("my-project-name")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SessionRow tests
// ---------------------------------------------------------------------------

describe("SessionRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // ARIA semantics
  // -------------------------------------------------------------------------

  it("renders with role=treeitem", () => {
    const session = makeSession();
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toBeInTheDocument();
  });

  it("has aria-level=2 by default", () => {
    const session = makeSession();
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-level", "2");
  });

  it("respects a custom ariaLevel prop", () => {
    const session = makeSession();
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
        ariaLevel={1}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-level", "1");
  });

  it("has aria-selected=false when the session is not selected", () => {
    const session = makeSession({ session_id: "s1" });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-selected", "false");
  });

  it("has aria-selected=true when the session is selected", () => {
    const session = makeSession({ session_id: "sel" });
    render(
      <SessionRow
        session={session}
        selectedSession={session}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-selected", "true");
  });

  // -------------------------------------------------------------------------
  // onSessionSelect callbacks
  // -------------------------------------------------------------------------

  it("calls onSessionSelect with the session when clicked (not selected)", () => {
    const onSessionSelect = vi.fn();
    const session = makeSession({ session_id: "s1" });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={onSessionSelect}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onSessionSelect).toHaveBeenCalledWith(session);
  });

  it("calls onSessionSelect with null (deselect) when the already-selected session is clicked", () => {
    const onSessionSelect = vi.fn();
    const session = makeSession({ session_id: "sel" });
    render(
      <SessionRow
        session={session}
        selectedSession={session}
        onSessionSelect={onSessionSelect}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onSessionSelect).toHaveBeenCalledWith(null);
  });

  it("calls onSessionSelect exactly once per click", () => {
    const onSessionSelect = vi.fn();
    const session = makeSession();
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={onSessionSelect}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onSessionSelect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Context menu
  // -------------------------------------------------------------------------

  it("calls onContextMenu when right-clicked", () => {
    const onContextMenu = vi.fn();
    const session = makeSession();
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={onContextMenu}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.contextMenu(screen.getByRole("treeitem"));
    expect(onContextMenu).toHaveBeenCalled();
  });

  it("passes the session to onContextMenu callback", () => {
    const onContextMenu = vi.fn();
    const session = makeSession({ session_id: "ctx-s" });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={onContextMenu}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    fireEvent.contextMenu(screen.getByRole("treeitem"));
    // onContextMenu receives (event, session)
    expect(onContextMenu).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ session_id: "ctx-s" })
    );
  });

  // -------------------------------------------------------------------------
  // Metadata display
  // -------------------------------------------------------------------------

  it("displays the session title from the summary field", () => {
    const session = makeSession({ summary: "My Important Session" });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("My Important Session")).toBeInTheDocument();
  });

  it("falls back to session_id when summary is undefined", () => {
    const session = makeSession({ summary: undefined, session_id: "fallback-id" });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("fallback-id")).toBeInTheDocument();
  });

  it("displays the formatted time returned by formatTimeAgo", () => {
    const customFormat = () => "just now";
    const session = makeSession();
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={customFormat}
        t={mockT}
      />
    );

    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Status icons
  // -------------------------------------------------------------------------

  it("renders the tool-use icon when has_tool_use=true", () => {
    const session = makeSession({ has_tool_use: true });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByTitle("Tool used")).toBeInTheDocument();
  });

  it("does NOT render the tool-use icon when has_tool_use=false", () => {
    const session = makeSession({ has_tool_use: false });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.queryByTitle("Tool used")).not.toBeInTheDocument();
  });

  it("renders the error icon when has_errors=true", () => {
    const session = makeSession({ has_errors: true });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByTitle("Error occurred")).toBeInTheDocument();
  });

  it("does NOT render the error icon when has_errors=false", () => {
    const session = makeSession({ has_errors: false });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.queryByTitle("Error occurred")).not.toBeInTheDocument();
  });

  it("renders the problematic icon when is_problematic=true", () => {
    const session = makeSession({ is_problematic: true });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(
      screen.getByTitle("Session not resumable (fix available)")
    ).toBeInTheDocument();
  });

  it("does NOT render the problematic icon when is_problematic=false", () => {
    const session = makeSession({ is_problematic: false });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(
      screen.queryByTitle("Session not resumable (fix available)")
    ).not.toBeInTheDocument();
  });

  it("can display all three status icons simultaneously", () => {
    const session = makeSession({
      has_tool_use: true,
      has_errors: true,
      is_problematic: true,
    });
    render(
      <SessionRow
        session={session}
        selectedSession={null}
        onSessionSelect={vi.fn()}
        onContextMenu={vi.fn()}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByTitle("Tool used")).toBeInTheDocument();
    expect(screen.getByTitle("Error occurred")).toBeInTheDocument();
    expect(screen.getByTitle("Session not resumable (fix available)")).toBeInTheDocument();
  });
});
