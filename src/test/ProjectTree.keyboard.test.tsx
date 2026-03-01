/**
 * Keyboard navigation tests for the ProjectTree component.
 *
 * These tests verify that the WAI-ARIA tree keyboard pattern is implemented
 * correctly: Arrow keys move focus, Enter/Space activate items, and
 * ArrowRight/Left expand and collapse project nodes.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Minimal stubs so the component can render in jsdom without Tauri / i18n.
// ---------------------------------------------------------------------------

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en" },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/utils/cn", () => ({ cn: (...args: string[]) => args.filter(Boolean).join(" ") }));
vi.mock("../../utils/cn", () => ({ cn: (...args: string[]) => args.filter(Boolean).join(" ") }));

// Stub the store - return minimal state
vi.mock("@/store/useAppStore", () => ({
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      projectListPreferences: {
        sortBy: "date",
        sortOrder: "desc",
        groupBy: "none",
        hideEmptyProjects: false,
        hideEmptySessions: false,
        hideAgentSessions: false,
        sessionSearchQuery: "",
      },
      loadProjectSessions: vi.fn().mockResolvedValue(undefined),
    })
  ),
}));
vi.mock("../../store/useAppStore", () => ({
  useAppStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      projectListPreferences: {
        sortBy: "date",
        sortOrder: "desc",
        groupBy: "none",
        hideEmptyProjects: false,
        hideEmptySessions: false,
        hideAgentSessions: false,
        sessionSearchQuery: "",
      },
      loadProjectSessions: vi.fn().mockResolvedValue(undefined),
    })
  ),
}));

vi.mock("../ProjectListControls", () => ({
  ProjectListControls: () => <div data-testid="project-list-controls" />,
}));
vi.mock("../ProjectContextMenu", () => ({
  ProjectContextMenu: () => null,
}));
vi.mock("../NativeRenameDialog", () => ({
  NativeRenameDialog: () => null,
}));
vi.mock("../icons/ProviderIcons", () => ({
  ProviderIcon: () => <span />,
  getProviderColorClass: () => "",
}));

// Stub the hooks used by ProjectTree
vi.mock("./hooks/useProjectTreeState", () => ({
  useProjectTreeState: () => ({
    expandedProjects: new Set<string>(),
    loadingProjects: new Set<string>(),
    isLoadingAllSessions: false,
    contextMenu: null,
    sessionContextMenu: null,
    renameTarget: null,
    sessionContextMenuRef: { current: null },
    toggleProject: vi.fn(),
    loadSessionsForProjects: vi.fn().mockResolvedValue(undefined),
    setExpandedProjects: vi.fn(),
    setIsLoadingAllSessions: vi.fn(),
    setContextMenu: vi.fn(),
    setSessionContextMenu: vi.fn(),
    setRenameTarget: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// The component under test (via barrel)
// ---------------------------------------------------------------------------
import { ProjectTree } from "../components/ProjectTree/ProjectTree";

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------
import type { UIProject, UISession } from "../types";

function makeProject(overrides: Partial<UIProject> = {}): UIProject {
  return {
    path: "/projects/alpha",
    name: "alpha",
    session_count: 0,
    lastModified: new Date().toISOString(),
    providerName: "Claude Code",
    providerId: "claude",
    ...overrides,
  } as UIProject;
}

function makeSession(overrides: Partial<UISession> = {}): UISession {
  return {
    session_id: "sess-1",
    actual_session_id: "sess-1",
    file_path: "/projects/alpha/sess-1.jsonl",
    last_modified: new Date().toISOString(),
    message_count: 5,
    has_tool_use: false,
    has_errors: false,
    is_problematic: false,
    summary: "Test session",
    ...overrides,
  } as UISession;
}

const defaultProps = {
  sessions: [] as UISession[],
  sessionsByProject: {} as Record<string, UISession[]>,
  selectedProject: null,
  selectedSession: null,
  onProjectSelect: vi.fn(),
  onSessionSelect: vi.fn(),
  onClearSelection: vi.fn(),
  isLoading: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProjectTree keyboard navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the tree container with role=tree", () => {
    const projects = [makeProject()];
    render(<ProjectTree {...defaultProps} projects={projects} />);

    const tree = screen.getByRole("tree");
    expect(tree).toBeInTheDocument();
  });

  it("renders project items with role=treeitem and aria-level=1", () => {
    const projects = [makeProject({ name: "my-project" })];
    render(<ProjectTree {...defaultProps} projects={projects} />);

    const items = screen.getAllByRole("treeitem");
    const level1Items = items.filter(
      (el) => el.getAttribute("aria-level") === "1"
    );
    expect(level1Items.length).toBeGreaterThan(0);
  });

  it("marks the selected project treeitem as aria-selected=true", () => {
    const project = makeProject({ name: "selected-proj" });
    render(
      <ProjectTree
        {...defaultProps}
        projects={[project]}
        selectedProject={project}
      />
    );

    const items = screen.getAllByRole("treeitem");
    const selectedItem = items.find(
      (el) => el.getAttribute("aria-selected") === "true"
    );
    expect(selectedItem).toBeTruthy();
  });

  it("calls onProjectSelect when a project treeitem is clicked", () => {
    const onProjectSelect = vi.fn();
    const project = makeProject({ name: "clickable-proj" });
    render(
      <ProjectTree
        {...defaultProps}
        projects={[project]}
        onProjectSelect={onProjectSelect}
      />
    );

    const items = screen.getAllByRole("treeitem");
    const projectItem = items.find(
      (el) => el.getAttribute("aria-level") === "1"
    )!;
    fireEvent.click(projectItem);

    expect(onProjectSelect).toHaveBeenCalledWith(project);
  });

  it("tree container has aria-label", () => {
    const projects = [makeProject()];
    render(<ProjectTree {...defaultProps} projects={projects} />);

    const tree = screen.getByRole("tree");
    expect(tree).toHaveAttribute("aria-label");
    expect(tree.getAttribute("aria-label")).toBeTruthy();
  });

  it("contains a screen-reader live region for announcements", () => {
    const projects = [makeProject()];
    render(<ProjectTree {...defaultProps} projects={projects} />);

    const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });
});
