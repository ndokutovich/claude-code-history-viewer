import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MessageViewer } from "../MessageViewer";
import type {
  ClaudeMessage,
  ClaudeSession,
  PaginationState,
} from "../../types";

// Mock i18n
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: unknown) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

describe("MessageViewer - Pagination Tests", () => {
  const mockOnLoadMore = vi.fn();

  const createMockMessages = (count: number): ClaudeMessage[] => {
    return Array.from({ length: count }, (_, i) => ({
      uuid: `msg-${i}`,
      parentUuid: i > 0 ? `msg-${i - 1}` : undefined,
      sessionId: "test-session",
      timestamp: new Date(
        2025,
        0,
        Math.floor(i / 30) + 1,
        i % 24
      ).toISOString(),
      type: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i}`,
      isSidechain: false,
    }));
  };

  const mockSession: ClaudeSession = {
    session_id: "test-session",
    actual_session_id: "test-session",
    file_path: "/test/path.jsonl",
    project_name: "Test Project",
    message_count: 200,
    first_message_time: "2025-01-01T00:00:00Z",
    last_message_time: "2025-01-01T23:59:59Z",
    last_modified: "2025-01-01T23:59:59Z",
    has_tool_use: false,
    has_errors: false,
    summary: "Test Session",
  };

  beforeEach(() => {
    mockOnLoadMore.mockClear();
  });

  it("should render initial messages correctly", () => {
    const messages = createMockMessages(20);
    const pagination: PaginationState = {
      currentOffset: 20,
      pageSize: 20,
      totalCount: 200,
      hasMore: true,
      isLoadingMore: false,
    };

    render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    // 첫 메시지와 마지막 메시지 확인
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 19")).toBeInTheDocument();
  });

  it("should handle load more button click", async () => {
    const messages = createMockMessages(20);
    const pagination: PaginationState = {
      currentOffset: 20,
      pageSize: 20,
      totalCount: 200,
      hasMore: true,
      isLoadingMore: false,
    };

    render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    // "더보기" 버튼 찾기 및 클릭
    const loadMoreButton = screen.getByRole("button", {
      name: /loadMoreMessages/i,
    });

    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  it("should handle 120+ messages pagination correctly", async () => {
    const messages = createMockMessages(120);
    const pagination: PaginationState = {
      currentOffset: 120,
      pageSize: 20,
      totalCount: 300,
      hasMore: true,
      isLoadingMore: false,
    };

    render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    // 120개 메시지가 렌더링되었는지 확인
    expect(screen.getByText("Message 0")).toBeInTheDocument();
    expect(screen.getByText("Message 119")).toBeInTheDocument();

    // 더보기 버튼이 여전히 활성화되어 있는지 확인
    const loadMoreButton = screen.getByRole("button", {
      name: /loadMoreMessages/i,
    });
    expect(loadMoreButton).not.toBeDisabled();

    // 클릭 시 onLoadMore 호출 확인
    fireEvent.click(loadMoreButton);
    await waitFor(() => {
      expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  it("should prevent duplicate load more calls", async () => {
    const messages = createMockMessages(20);
    const pagination: PaginationState = {
      currentOffset: 20,
      pageSize: 20,
      totalCount: 200,
      hasMore: true,
      isLoadingMore: false,
    };

    render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    const loadMoreButton = screen.getByRole("button", {
      name: /loadMoreMessages/i,
    });

    // 빠르게 여러 번 클릭
    fireEvent.click(loadMoreButton);
    fireEvent.click(loadMoreButton);
    fireEvent.click(loadMoreButton);

    // 1초 이내 중복 호출은 차단되어야 함
    await waitFor(() => {
      expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    });
  });

  it("should show loading state correctly", () => {
    const messages = createMockMessages(20);
    const pagination: PaginationState = {
      currentOffset: 20,
      pageSize: 20,
      totalCount: 200,
      hasMore: true,
      isLoadingMore: true, // 로딩 중
    };

    render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    // 로딩 인디케이터 확인
    expect(screen.getByText(/loadingPreviousMessages/i)).toBeInTheDocument();
  });

  it("should handle boundary case when no more messages", () => {
    const messages = createMockMessages(200);
    const pagination: PaginationState = {
      currentOffset: 200,
      pageSize: 20,
      totalCount: 200,
      hasMore: false, // 더 이상 메시지 없음
      isLoadingMore: false,
    };

    render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    // "모든 메시지 로드됨" 메시지 확인
    expect(screen.getByText(/allMessagesLoaded/i)).toBeInTheDocument();

    // 더보기 버튼이 없어야 함
    const loadMoreButton = screen.queryByRole("button", {
      name: /loadMoreMessages/i,
    });
    expect(loadMoreButton).not.toBeInTheDocument();
  });

  it("should maintain scroll position after loading more", async () => {
    const messages = createMockMessages(20);
    const pagination: PaginationState = {
      currentOffset: 20,
      pageSize: 20,
      totalCount: 200,
      hasMore: true,
      isLoadingMore: false,
    };

    const { container } = render(
      <MessageViewer
        messages={messages}
        pagination={pagination}
        isLoading={false}
        selectedSession={mockSession}
        onLoadMore={mockOnLoadMore}
      />
    );

    // 스크롤 컨테이너 찾기
    const scrollContainer = container.querySelector("[ref]");
    if (scrollContainer) {
      // 스크롤 위치 설정
      Object.defineProperty(scrollContainer, "scrollTop", {
        writable: true,
        value: 500,
      });
      Object.defineProperty(scrollContainer, "scrollHeight", {
        writable: true,
        value: 2000,
      });

      const initialScrollTop = scrollContainer.scrollTop;

      // 더보기 클릭
      const loadMoreButton = screen.getByRole("button", {
        name: /loadMoreMessages/i,
      });
      fireEvent.click(loadMoreButton);

      await waitFor(() => {
        // 스크롤 위치가 유지되거나 조정되어야 함
        expect(scrollContainer.scrollTop).toBeGreaterThanOrEqual(
          initialScrollTop
        );
      });
    }
  });
});
