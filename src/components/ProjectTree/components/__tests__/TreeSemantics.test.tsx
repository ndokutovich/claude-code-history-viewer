/**
 * ARIA semantics tests for extracted ProjectTree sub-components.
 *
 * Verifies that SessionRow, ProjectRow, FlatSessionsList, and ProjectGroup
 * render the correct ARIA roles and attributes for accessibility.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Minimal stubs so the components can render in jsdom without Tauri / i18n.
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
import { SessionRow } from "../SessionRow";
import { ProjectRow } from "../ProjectRow";
import { FlatSessionsList } from "../FlatSessionsList";
import { ProjectGroup } from "../ProjectGroup";
import type { UIProject, UISession } from "../../../../types";

// ---------------------------------------------------------------------------
// Shared test data helpers
// ---------------------------------------------------------------------------

/**
 * A minimal translation mock that handles both:
 *   t("key", "Fallback string")  → returns "Fallback string"
 *   t("key", { count: 5 })       → returns "key" (returns the key when opts is an object)
 */
const mockT = vi.fn((key: string, fallbackOrOpts?: string | Record<string, unknown>) => {
  if (typeof fallbackOrOpts === "string") return fallbackOrOpts;
  return key;
}) as unknown as import("i18next").TFunction;

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

function makeProject(overrides: Partial<UIProject> = {}): UIProject {
  return {
    path: "/projects/alpha",
    name: "alpha",
    session_count: 0,
    message_count: 0,
    lastModified: new Date().toISOString(),
    providerName: "Claude Code",
    providerId: "claude",
    ...overrides,
  };
}

const formatTimeAgo = () => "2 hours ago";

// ---------------------------------------------------------------------------
// SessionRow tests
// ---------------------------------------------------------------------------

describe("SessionRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("renders with aria-level=2 by default", () => {
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

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-level", "2");
  });

  it("respects custom ariaLevel prop", () => {
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

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-level", "1");
  });

  it("sets aria-selected=false when session is not selected", () => {
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

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-selected", "false");
  });

  it("sets aria-selected=true when session matches selectedSession", () => {
    const session = makeSession();
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

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-selected", "true");
  });

  it("calls onSessionSelect with the session when clicked (not selected)", () => {
    const session = makeSession();
    const onSessionSelect = vi.fn();
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

  it("calls onSessionSelect with null (deselect) when already selected session is clicked", () => {
    const session = makeSession();
    const onSessionSelect = vi.fn();
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

  it("calls onContextMenu when right-clicked", () => {
    const session = makeSession();
    const onContextMenu = vi.fn();
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

  it("renders wrench icon when has_tool_use=true", () => {
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

    // The wrench icon title is resolved by `t`
    const icon = screen.getByTitle("Tool used");
    expect(icon).toBeInTheDocument();
  });

  it("renders error icon when has_errors=true", () => {
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

    const icon = screen.getByTitle("Error occurred");
    expect(icon).toBeInTheDocument();
  });

  it("renders problematic icon when is_problematic=true", () => {
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

    const icon = screen.getByTitle("Session not resumable (fix available)");
    expect(icon).toBeInTheDocument();
  });

  it("displays the session title from summary", () => {
    const session = makeSession({ summary: "My Session Summary" });
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

    expect(screen.getByText("My Session Summary")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProjectRow tests
// ---------------------------------------------------------------------------

describe("ProjectRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the project name button with role=treeitem", () => {
    const project = makeProject({ name: "my-project" });
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toBeInTheDocument();
  });

  it("renders with aria-level=1", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-level", "1");
  });

  it("sets aria-expanded=false when collapsed", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-expanded", "false");
  });

  it("sets aria-expanded=true when expanded", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={true}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-expanded", "true");
  });

  it("sets aria-selected=false when project is not selected", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-selected", "false");
  });

  it("sets aria-selected=true when project is selected", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={project}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("aria-selected", "true");
  });

  it("calls onProjectSelect when the name button is clicked", () => {
    const project = makeProject({ name: "clickable" });
    const onProjectSelect = vi.fn();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={onProjectSelect}
        onContextMenu={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("treeitem"));
    expect(onProjectSelect).toHaveBeenCalledWith(project);
  });

  it("calls onToggle when the expand/collapse chevron button is clicked", () => {
    const project = makeProject();
    const onToggle = vi.fn();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={onToggle}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    // The chevron button has title "Expand" or "Collapse"
    const expandButton = screen.getByTitle("Expand");
    fireEvent.click(expandButton);
    expect(onToggle).toHaveBeenCalledWith(project.path);
  });

  it("shows Collapse title when expanded", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={true}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    expect(screen.getByTitle("Collapse")).toBeInTheDocument();
  });

  it("renders the project name", () => {
    const project = makeProject({ name: "project-alpha" });
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    expect(screen.getByText("project-alpha")).toBeInTheDocument();
  });

  it("has data-tree-expandable attribute on treeitem", () => {
    const project = makeProject();
    render(
      <ProjectRow
        project={project}
        isExpanded={false}
        isLoading={false}
        selectedProject={null}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onContextMenu={vi.fn()}
      />
    );

    const treeitem = screen.getByRole("treeitem");
    expect(treeitem).toHaveAttribute("data-tree-expandable", "true");
  });
});

// ---------------------------------------------------------------------------
// FlatSessionsList tests
// ---------------------------------------------------------------------------

describe("FlatSessionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all sessions as treeitems", () => {
    const sessions = [
      { ...makeSession({ session_id: "s1", summary: "Session 1" }), projectPath: "/p1", projectName: "p1" },
      { ...makeSession({ session_id: "s2", summary: "Session 2" }), projectPath: "/p2", projectName: "p2" },
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

    const items = screen.getAllByRole("treeitem");
    expect(items).toHaveLength(2);
  });

  it("renders each session with aria-level=1", () => {
    const sessions = [
      { ...makeSession({ session_id: "s1" }), projectPath: "/p1", projectName: "p1" },
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

    const item = screen.getByRole("treeitem");
    expect(item).toHaveAttribute("aria-level", "1");
  });

  it("marks the selected session as aria-selected=true", () => {
    const session = makeSession({ session_id: "selected-s" });
    const flatSession = { ...session, projectPath: "/p", projectName: "p" };
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

    const item = screen.getByRole("treeitem");
    expect(item).toHaveAttribute("aria-selected", "true");
  });

  it("renders an empty state message when sessions list is empty", () => {
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

  it("calls onSessionSelect when a session item is clicked", () => {
    const session = makeSession({ session_id: "click-me", summary: "Clickable" });
    const flatSession = { ...session, projectPath: "/p", projectName: "p" };
    const onSessionSelect = vi.fn();
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
    // The component passes the full flat session (which includes projectPath/projectName)
    expect(onSessionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "click-me" })
    );
  });
});

// ---------------------------------------------------------------------------
// ProjectGroup tests
// ---------------------------------------------------------------------------

describe("ProjectGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render a group header when showGroupHeader=false", () => {
    const project = makeProject({ name: "alpha" });
    render(
      <ProjectGroup
        groupName="Claude Code"
        projects={[project]}
        showGroupHeader={false}
        expandedProjects={new Set()}
        loadingProjects={new Set()}
        selectedProject={null}
        selectedSession={null}
        isLoading={false}
        getSessionsForProject={() => []}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onSessionSelect={vi.fn()}
        onProjectContextMenu={vi.fn()}
        onSessionContextMenu={vi.fn()}
        onExpandRequest={vi.fn().mockResolvedValue(undefined)}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.queryByText("Claude Code")).not.toBeInTheDocument();
    // Project name should still render
    expect(screen.getByText("alpha")).toBeInTheDocument();
  });

  it("renders the group header when showGroupHeader=true", () => {
    const project = makeProject({ name: "beta" });
    render(
      <ProjectGroup
        groupName="Claude Code"
        projects={[project]}
        showGroupHeader={true}
        expandedProjects={new Set()}
        loadingProjects={new Set()}
        selectedProject={null}
        selectedSession={null}
        isLoading={false}
        getSessionsForProject={() => []}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onSessionSelect={vi.fn()}
        onProjectContextMenu={vi.fn()}
        onSessionContextMenu={vi.fn()}
        onExpandRequest={vi.fn().mockResolvedValue(undefined)}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("Claude Code")).toBeInTheDocument();
  });

  it("renders all projects in the group", () => {
    const projects = [
      makeProject({ path: "/p1", name: "project-one" }),
      makeProject({ path: "/p2", name: "project-two" }),
    ];
    render(
      <ProjectGroup
        groupName="group"
        projects={projects}
        showGroupHeader={false}
        expandedProjects={new Set()}
        loadingProjects={new Set()}
        selectedProject={null}
        selectedSession={null}
        isLoading={false}
        getSessionsForProject={() => []}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onSessionSelect={vi.fn()}
        onProjectContextMenu={vi.fn()}
        onSessionContextMenu={vi.fn()}
        onExpandRequest={vi.fn().mockResolvedValue(undefined)}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("project-one")).toBeInTheDocument();
    expect(screen.getByText("project-two")).toBeInTheDocument();
  });

  it("renders session rows when project is expanded", () => {
    const project = makeProject({ path: "/p1", name: "expanded-project" });
    const session = makeSession({ session_id: "s1", summary: "My Session" });
    render(
      <ProjectGroup
        groupName="group"
        projects={[project]}
        showGroupHeader={false}
        expandedProjects={new Set(["/p1"])}
        loadingProjects={new Set()}
        selectedProject={null}
        selectedSession={null}
        isLoading={false}
        getSessionsForProject={(path) => (path === "/p1" ? [session] : [])}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onSessionSelect={vi.fn()}
        onProjectContextMenu={vi.fn()}
        onSessionContextMenu={vi.fn()}
        onExpandRequest={vi.fn().mockResolvedValue(undefined)}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.getByText("My Session")).toBeInTheDocument();
  });

  it("does not render session rows when project is not expanded", () => {
    const project = makeProject({ path: "/p1", name: "collapsed-project" });
    const session = makeSession({ session_id: "s1", summary: "Hidden Session" });
    render(
      <ProjectGroup
        groupName="group"
        projects={[project]}
        showGroupHeader={false}
        expandedProjects={new Set()} // not expanded
        loadingProjects={new Set()}
        selectedProject={null}
        selectedSession={null}
        isLoading={false}
        getSessionsForProject={(_path) => [session]}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onSessionSelect={vi.fn()}
        onProjectContextMenu={vi.fn()}
        onSessionContextMenu={vi.fn()}
        onExpandRequest={vi.fn().mockResolvedValue(undefined)}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    expect(screen.queryByText("Hidden Session")).not.toBeInTheDocument();
  });

  it("session treeitems have aria-level=2 inside expanded project group", () => {
    const project = makeProject({ path: "/p1" });
    const session = makeSession({ session_id: "s1" });
    render(
      <ProjectGroup
        groupName="group"
        projects={[project]}
        showGroupHeader={false}
        expandedProjects={new Set(["/p1"])}
        loadingProjects={new Set()}
        selectedProject={null}
        selectedSession={null}
        isLoading={false}
        getSessionsForProject={(path) => (path === "/p1" ? [session] : [])}
        onToggle={vi.fn()}
        onProjectSelect={vi.fn()}
        onSessionSelect={vi.fn()}
        onProjectContextMenu={vi.fn()}
        onSessionContextMenu={vi.fn()}
        onExpandRequest={vi.fn().mockResolvedValue(undefined)}
        formatTimeAgo={formatTimeAgo}
        t={mockT}
      />
    );

    const treeitems = screen.getAllByRole("treeitem");
    const level2Items = treeitems.filter(
      (el) => el.getAttribute("aria-level") === "2"
    );
    expect(level2Items.length).toBeGreaterThan(0);
  });
});
