import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { SimpleUpdateManager } from "../components/SimpleUpdateManager";
import type { UseGitHubUpdaterReturn } from "../hooks/useGitHubUpdater";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Create a mock updater matching our UseGitHubUpdaterReturn shape
function createUpdater(
  stateOverrides: Partial<UseGitHubUpdaterReturn["state"]> = {}
): UseGitHubUpdaterReturn {
  return {
    state: {
      isChecking: false,
      hasUpdate: false,
      isDownloading: false,
      isInstalling: false,
      downloadProgress: 0,
      error: null,
      updateInfo: null,
      releaseInfo: null,
      currentVersion: "1.0.0",
      ...stateOverrides,
    },
    checkForUpdates: vi.fn(async () => {}),
    downloadAndInstall: vi.fn(async () => {}),
    dismissUpdate: vi.fn(),
  };
}

const mockUpdater = createUpdater();

// Mock useSmartUpdater to return our controlled updater
vi.mock("../hooks/useSmartUpdater", () => ({
  useSmartUpdater: () => ({
    ...mockUpdater,
    state: mockUpdater.state,
    smartCheckForUpdates: mockUpdater.checkForUpdates,
    showIntroModal: false,
    onIntroClose: vi.fn(),
    shouldShowUpdateModal: mockUpdater.state.hasUpdate,
  }),
}));

vi.mock("../components/SimpleUpdateModal", () => ({
  SimpleUpdateModal: ({
    isVisible,
  }: {
    isVisible: boolean;
  }) => (
    <div data-testid="simple-update-modal" data-visible={isVisible ? "true" : "false"} />
  ),
}));

vi.mock("../components/UpdateConsentModal", () => ({
  UpdateIntroModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="update-intro-modal" /> : null,
}));

vi.mock("../components/UpToDateNotification", () => ({
  UpToDateNotification: ({ isVisible }: { isVisible: boolean }) =>
    isVisible ? <div data-testid="uptodate-notification" /> : null,
}));

describe("SimpleUpdateManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<SimpleUpdateManager />);
    expect(container).toBeTruthy();
  });

  it("renders the update modal placeholder", () => {
    render(<SimpleUpdateManager />);
    const modal = screen.getByTestId("simple-update-modal");
    expect(modal).toBeTruthy();
  });

  it("dispatches manual-update-check event without throwing", async () => {
    render(<SimpleUpdateManager />);

    await act(async () => {
      window.dispatchEvent(new Event("manual-update-check"));
    });

    // Component should still be mounted and functional
    expect(screen.getByTestId("simple-update-modal")).toBeTruthy();
  });
});
