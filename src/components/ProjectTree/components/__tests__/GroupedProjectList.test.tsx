/**
 * GroupedProjectList tests for the ProjectGroup component.
 *
 * Tests behaviour specific to group-header rendering, project/session
 * interaction callbacks, ARIA tree semantics, and edge cases such as empty
 * project lists and multiple groups.
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
import { ProjectGroup } from "../ProjectGroup";
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

function makeSession(overrides: Partial<UISession> = {}): UISession {
  return {
    session_id: "session-1",
    actual_session_id: "actual-1",
    file_path: "/path/to/session.jsonl",
    project_name: "alpha",
    message_count: 3,
    first_message_time: "2025-01-01T00:00:00Z",
    last_message_time: "2025-01-02T00:00:00Z",
    last_modified: "2025-01-02T00:00:00Z",
    has_tool_use: false,
    has_errors: false,
    is_problematic: false,
    summary: "A test session",
    ...overrides,
  };
}

const formatTimeAgo = () => "3 hours ago";

/** Minimal default props shared across tests */
function makeDefaultProps(
  projects: UIProject[],
  overrides: Partial<Parameters<typeof ProjectGroup>[0]> = {}
): Parameters<typeof ProjectGroup>[0] {
  return {
    groupName: "Claude Code",
    projects,
    showGroupHeader: false,
    expandedProjects: new Set<string>(),
    loadingProjects: new Set<string>(),
    selectedProject: null,
    selectedSession: null,
    isLoading: false,
    getSessionsForProject: () => [],
    onToggle: vi.fn(),
    onProjectSelect: vi.fn(),
    onSessionSelect: vi.fn(),
    onProjectContextMenu: vi.fn(),
    onSessionContextMenu: vi.fn(),
    onExpandRequest: vi.fn().mockResolvedValue(undefined),
    formatTimeAgo,
    t: mockT,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Group header visibility
  // -------------------------------------------------------------------------

  it("does NOT render the group header when showGroupHeader=false", () => {
    const project = makeProject({ name: "alpha" });
    render(<ProjectGroup {...makeDefaultProps([project], { showGroupHeader: false, groupName: "Claude Code" })} />);

    expect(screen.queryByText("Claude Code")).not.toBeInTheDocument();
  });

  it("DOES render the group header when showGroupHeader=true", () => {
    const project = makeProject({ name: "beta" });
    render(<ProjectGroup {...makeDefaultProps([project], { showGroupHeader: true, groupName: "Cursor IDE" })} />);

    expect(screen.getByText("Cursor IDE")).toBeInTheDocument();
  });

  it("project rows are still rendered when showGroupHeader=false", () => {
    const project = makeProject({ name: "visible-project" });
    render(<ProjectGroup {...makeDefaultProps([project], { showGroupHeader: false })} />);

    expect(screen.getByText("visible-project")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Project rows ARIA semantics
  // -------------------------------------------------------------------------

  it("renders project items with role=treeitem", () => {
    const project = makeProject({ name: "proj" });
    render(<ProjectGroup {...makeDefaultProps([project])} />);

    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems.length).toBeGreaterThan(0);
  });

  it("renders project items with aria-level=1", () => {
    const project = makeProject({ name: "proj" });
    render(<ProjectGroup {...makeDefaultProps([project])} />);

    const level1Items = screen
      .getAllByRole("treeitem")
      .filter((el) => el.getAttribute("aria-level") === "1");
    expect(level1Items.length).toBeGreaterThan(0);
  });

  it("renders multiple projects in the group", () => {
    const projects = [
      makeProject({ path: "/p1", name: "project-one" }),
      makeProject({ path: "/p2", name: "project-two" }),
      makeProject({ path: "/p3", name: "project-three" }),
    ];
    render(<ProjectGroup {...makeDefaultProps(projects)} />);

    expect(screen.getByText("project-one")).toBeInTheDocument();
    expect(screen.getByText("project-two")).toBeInTheDocument();
    expect(screen.getByText("project-three")).toBeInTheDocument();
  });

  it("handles an empty projects list gracefully (renders nothing)", () => {
    const { container } = render(<ProjectGroup {...makeDefaultProps([])} />);

    // No treeitems should appear
    expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
    // Container should still be present without errors
    expect(container.firstChild).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // onToggle callback
  // -------------------------------------------------------------------------

  it("calls onToggle with the project path when the expand chevron is clicked", () => {
    const onToggle = vi.fn();
    const project = makeProject({ path: "/projects/my-proj", name: "my-proj" });
    render(<ProjectGroup {...makeDefaultProps([project], { onToggle })} />);

    // The expand button has the title "Expand"
    const expandBtn = screen.getByTitle("Expand");
    fireEvent.click(expandBtn);

    expect(onToggle).toHaveBeenCalledWith("/projects/my-proj");
  });

  it("calls onToggle once per click (not multiple times)", () => {
    const onToggle = vi.fn();
    const project = makeProject({ path: "/p", name: "p" });
    render(<ProjectGroup {...makeDefaultProps([project], { onToggle })} />);

    fireEvent.click(screen.getByTitle("Expand"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // onProjectSelect callback
  // -------------------------------------------------------------------------

  it("calls onProjectSelect when a project row treeitem is clicked", () => {
    const onProjectSelect = vi.fn();
    const project = makeProject({ path: "/p", name: "clickable" });
    render(<ProjectGroup {...makeDefaultProps([project], { onProjectSelect })} />);

    // The project row treeitem (aria-level=1) is the clickable container
    const level1Item = screen
      .getAllByRole("treeitem")
      .find((el) => el.getAttribute("aria-level") === "1")!;
    fireEvent.click(level1Item);

    expect(onProjectSelect).toHaveBeenCalledWith(project);
  });

  // -------------------------------------------------------------------------
  // Session rows – expanded state
  // -------------------------------------------------------------------------

  it("renders session rows when the project is expanded", () => {
    const project = makeProject({ path: "/p1", name: "expanded-proj" });
    const session = makeSession({ session_id: "s1", summary: "My Session" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: (path) => (path === "/p1" ? [session] : []),
        })}
      />
    );

    expect(screen.getByText("My Session")).toBeInTheDocument();
  });

  it("does NOT render session rows when the project is collapsed", () => {
    const project = makeProject({ path: "/p1", name: "collapsed-proj" });
    const session = makeSession({ session_id: "s1", summary: "Hidden Session" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(), // empty – project is collapsed
          getSessionsForProject: () => [session],
        })}
      />
    );

    expect(screen.queryByText("Hidden Session")).not.toBeInTheDocument();
  });

  it("session treeitems have aria-level=2 inside an expanded project", () => {
    const project = makeProject({ path: "/p1" });
    const session = makeSession({ session_id: "s1" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: (path) => (path === "/p1" ? [session] : []),
        })}
      />
    );

    const level2Items = screen
      .getAllByRole("treeitem")
      .filter((el) => el.getAttribute("aria-level") === "2");
    expect(level2Items.length).toBeGreaterThan(0);
  });

  it("renders multiple session rows when multiple sessions exist in expanded project", () => {
    const project = makeProject({ path: "/p1", name: "multi-session-proj" });
    const sessions = [
      makeSession({ session_id: "s1", summary: "Session Alpha" }),
      makeSession({ session_id: "s2", summary: "Session Beta" }),
      makeSession({ session_id: "s3", summary: "Session Gamma" }),
    ];

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: (path) => (path === "/p1" ? sessions : []),
        })}
      />
    );

    expect(screen.getByText("Session Alpha")).toBeInTheDocument();
    expect(screen.getByText("Session Beta")).toBeInTheDocument();
    expect(screen.getByText("Session Gamma")).toBeInTheDocument();
  });

  it("calls onSessionSelect when a session row is clicked", () => {
    const onSessionSelect = vi.fn();
    const project = makeProject({ path: "/p1" });
    const session = makeSession({ session_id: "s1", summary: "Clickable Session" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: (path) => (path === "/p1" ? [session] : []),
          onSessionSelect,
        })}
      />
    );

    const level2Item = screen
      .getAllByRole("treeitem")
      .find((el) => el.getAttribute("aria-level") === "2")!;
    fireEvent.click(level2Item);

    expect(onSessionSelect).toHaveBeenCalledWith(session);
  });

  it("renders no session rows when expanded project has empty sessions list", () => {
    const project = makeProject({ path: "/p1", name: "empty-proj" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: () => [], // no sessions
        })}
      />
    );

    // Only the project row itself should be level 1; no level-2 items
    const allTreeitems = screen.getAllByRole("treeitem");
    const level2Items = allTreeitems.filter(
      (el) => el.getAttribute("aria-level") === "2"
    );
    expect(level2Items).toHaveLength(0);
  });

  it("does NOT render sessions for the collapsed project in a mixed-state multi-project group", () => {
    const expandedProject = makeProject({ path: "/p1", name: "expanded" });
    const collapsedProject = makeProject({ path: "/p2", name: "collapsed" });

    const expandedSession = makeSession({ session_id: "s1", summary: "Visible" });
    const collapsedSession = makeSession({ session_id: "s2", summary: "Invisible" });

    render(
      <ProjectGroup
        {...makeDefaultProps([expandedProject, collapsedProject], {
          expandedProjects: new Set(["/p1"]), // only p1 expanded
          getSessionsForProject: (path) => {
            if (path === "/p1") return [expandedSession];
            if (path === "/p2") return [collapsedSession];
            return [];
          },
        })}
      />
    );

    expect(screen.getByText("Visible")).toBeInTheDocument();
    expect(screen.queryByText("Invisible")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Selected session aria-selected
  // -------------------------------------------------------------------------

  it("session row has aria-selected=true when it is the selected session", () => {
    const project = makeProject({ path: "/p1" });
    const session = makeSession({ session_id: "selected-s" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: (path) => (path === "/p1" ? [session] : []),
          selectedSession: session,
        })}
      />
    );

    const level2Items = screen
      .getAllByRole("treeitem")
      .filter((el) => el.getAttribute("aria-level") === "2");
    expect(level2Items[0]).toHaveAttribute("aria-selected", "true");
  });

  it("session row has aria-selected=false when it is not the selected session", () => {
    const project = makeProject({ path: "/p1" });
    const session = makeSession({ session_id: "not-selected" });
    const otherSession = makeSession({ session_id: "other" });

    render(
      <ProjectGroup
        {...makeDefaultProps([project], {
          expandedProjects: new Set(["/p1"]),
          getSessionsForProject: (path) => (path === "/p1" ? [session] : []),
          selectedSession: otherSession,
        })}
      />
    );

    const level2Items = screen
      .getAllByRole("treeitem")
      .filter((el) => el.getAttribute("aria-level") === "2");
    expect(level2Items[0]).toHaveAttribute("aria-selected", "false");
  });
});
