import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { SimpleUpdateModal } from "@/components/SimpleUpdateModal";
import type { UseGitHubUpdaterReturn } from "@/hooks/useGitHubUpdater";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode;
    open: boolean;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function createUpdater(
  stateOverrides: Partial<UseGitHubUpdaterReturn["state"]> = {}
): UseGitHubUpdaterReturn {
  return {
    state: {
      isChecking: false,
      hasUpdate: true,
      isDownloading: false,
      isInstalling: false,
      downloadProgress: 0,
      error: null,
      updateInfo: null,
      releaseInfo: {
        tag_name: "v1.5.1",
        name: "v1.5.1",
        body: "Bug fixes and improvements",
        published_at: "2026-02-21T00:00:00.000Z",
        html_url: "https://github.com/example/repo/releases/tag/v1.5.1",
        assets: [],
      },
      currentVersion: "1.5.0",
      ...stateOverrides,
    },
    checkForUpdates: vi.fn(async () => {}),
    downloadAndInstall: vi.fn(async () => {}),
    dismissUpdate: vi.fn(),
  };
}

describe("SimpleUpdateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when update is available and visible", () => {
    const updater = createUpdater();
    render(
      <SimpleUpdateModal
        updater={updater}
        isVisible={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("update.newUpdateAvailable")).toBeInTheDocument();
  });

  it("does not render when not visible", () => {
    const updater = createUpdater();
    const { container } = render(
      <SimpleUpdateModal
        updater={updater}
        isVisible={false}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("does not render when no releaseInfo", () => {
    const updater = createUpdater({ releaseInfo: null });
    const { container } = render(
      <SimpleUpdateModal
        updater={updater}
        isVisible={true}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("shows error when error is present", () => {
    const updater = createUpdater({ error: "Download failed" });
    render(
      <SimpleUpdateModal
        updater={updater}
        isVisible={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/update.errorOccurred/)).toBeInTheDocument();
  });

  it("calls dismissUpdate when skip version is clicked", () => {
    const updater = createUpdater();
    const onClose = vi.fn();
    render(
      <SimpleUpdateModal
        updater={updater}
        isVisible={true}
        onClose={onClose}
      />
    );

    // Find and click the skip button (t('update.skipVersion'))
    const skipBtn = screen.getByText("update.skipVersion");
    fireEvent.click(skipBtn);

    expect(updater.dismissUpdate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls downloadAndInstall when download button is clicked", () => {
    const updater = createUpdater();
    render(
      <SimpleUpdateModal
        updater={updater}
        isVisible={true}
        onClose={vi.fn()}
      />
    );

    const downloadBtn = screen.getByText("update.downloadAndInstall");
    fireEvent.click(downloadBtn);

    expect(updater.downloadAndInstall).toHaveBeenCalledTimes(1);
  });
});
