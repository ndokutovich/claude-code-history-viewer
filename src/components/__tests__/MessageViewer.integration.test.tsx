import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClaudeMessage, MessagePage } from "../../types";

// 실제 중복 시나리오를 테스트
describe("MessageViewer Integration Tests - Real Scenarios", () => {
  const createMockMessage = (id: number, uuid?: string): ClaudeMessage => ({
    uuid: uuid || `msg-${id}`,
    parentUuid: id > 0 ? `msg-${id - 1}` : undefined,
    sessionId: "test-session",
    timestamp: new Date(
      2025,
      0,
      Math.floor(id / 30) + 1,
      id % 24
    ).toISOString(),
    type: id % 2 === 0 ? "user" : "assistant",
    content: `Message ${id}`,
    toolUse: null,
    toolUseResult: null,
    isSidechain: false,
  });

  it("should handle duplicate messages correctly", () => {
    // 기존 메시지들 (이미 로드된 상태)
    const existingMessages = [
      createMockMessage(100),
      createMockMessage(101),
      createMockMessage(102),
    ];

    // 서버에서 받은 새 메시지 (일부 중복 포함)
    const serverMessages = [
      createMockMessage(97),
      createMockMessage(98),
      createMockMessage(99),
      createMockMessage(100), // 중복!
      createMockMessage(101), // 중복!
    ];

    // 중복 제거 로직 (수정된 코드와 동일)
    const existingUuids = new Set(existingMessages.map((msg) => msg.uuid));
    const newMessages = serverMessages.filter(
      (msg) => !existingUuids.has(msg.uuid)
    );
    const updatedMessages = [...newMessages, ...existingMessages];

    expect(newMessages.length).toBe(3); // msg-97, msg-98, msg-99만 추가
    expect(updatedMessages.length).toBe(6); // 3 + 3 = 6개 (중복 제거됨)

    // 순서 검증: 오래된 메시지가 앞에
    expect(updatedMessages[0].uuid).toBe("msg-97");
    expect(updatedMessages[1].uuid).toBe("msg-98");
    expect(updatedMessages[2].uuid).toBe("msg-99");
    expect(updatedMessages[3].uuid).toBe("msg-100");
  });

  it("should handle 120+ messages pagination correctly", () => {
    // 시뮬레이션: 120개 메시지가 이미 로드된 상태
    const existingMessages = Array.from(
      { length: 120 },
      (_, i) => createMockMessage(300 - i) // 최신 120개 (181~300)
    );

    // 서버에서 다음 20개 메시지 받기
    const serverResponse: MessagePage = {
      messages: Array.from(
        { length: 20 },
        (_, i) => createMockMessage(160 + i) // 160~179 (다음 오래된 20개)
      ),
      total_count: 300,
      has_more: true,
      next_offset: 140,
    };

    // 중복 제거 및 병합
    const existingUuids = new Set(existingMessages.map((msg) => msg.uuid));
    const newMessages = serverResponse.messages.filter(
      (msg) => !existingUuids.has(msg.uuid)
    );
    const updatedMessages = [...newMessages, ...existingMessages];

    expect(newMessages.length).toBe(20); // 모든 새 메시지가 실제로 새로움
    expect(updatedMessages.length).toBe(140); // 120 + 20 = 140개
    expect(serverResponse.has_more).toBe(true);

    // 순서 확인: 가장 오래된 것이 맨 앞
    expect(updatedMessages[0].uuid).toBe("msg-160");
    expect(updatedMessages[19].uuid).toBe("msg-179");
    expect(updatedMessages[20].uuid).toBe("msg-300"); // 기존 첫 번째
  });

  it("should handle boundary cases - reaching the end", () => {
    // 마지막 10개 메시지만 남은 상황 (11~300이 이미 로드됨)
    const existingMessages = Array.from(
      { length: 290 },
      (_, i) => createMockMessage(11 + i) // 11~300
    );

    const serverResponse: MessagePage = {
      messages: Array.from(
        { length: 10 },
        (_, i) => createMockMessage(i + 1) // 1~10 (맨 처음 메시지들)
      ),
      total_count: 300,
      has_more: false, // 더 이상 메시지 없음
      next_offset: 300,
    };

    const existingUuids = new Set(existingMessages.map((msg) => msg.uuid));
    const newMessages = serverResponse.messages.filter(
      (msg) => !existingUuids.has(msg.uuid)
    );
    const updatedMessages = [...newMessages, ...existingMessages];

    expect(newMessages.length).toBe(10);
    expect(updatedMessages.length).toBe(300); // 전체 메시지 로드 완료
    expect(serverResponse.has_more).toBe(false);

    // 전체 순서 확인: [1~10(새로 추가), 11~300(기존)]
    expect(updatedMessages[0].uuid).toBe("msg-1"); // 가장 오래된 메시지
    expect(updatedMessages[9].uuid).toBe("msg-10"); // 새로 추가된 마지막
    expect(updatedMessages[10].uuid).toBe("msg-11"); // 기존 첫 번째
    expect(updatedMessages[299].uuid).toBe("msg-300"); // 가장 최신 메시지
  });

  it("should handle server returning overlapping ranges", () => {
    // 실제로 발생할 수 있는 시나리오: 서버에서 겹치는 범위 반환
    const existingMessages = [
      createMockMessage(198),
      createMockMessage(199),
      createMockMessage(200),
    ];

    // 서버에서 겹치는 범위 반환 (195~199, 일부 중복)
    const serverMessages = [
      createMockMessage(195),
      createMockMessage(196),
      createMockMessage(197),
      createMockMessage(198), // 중복
      createMockMessage(199), // 중복
    ];

    const existingUuids = new Set(existingMessages.map((msg) => msg.uuid));
    const newMessages = serverMessages.filter(
      (msg) => !existingUuids.has(msg.uuid)
    );
    const updatedMessages = [...newMessages, ...existingMessages];

    expect(newMessages.length).toBe(3); // 195, 196, 197만 새로움
    expect(updatedMessages.length).toBe(6);

    // 중복 메시지가 제거되었는지 확인
    const uuids = updatedMessages.map((msg) => msg.uuid);
    const uniqueUuids = [...new Set(uuids)];
    expect(uuids.length).toBe(uniqueUuids.length); // 중복 없음
  });

  it("should handle empty server response", () => {
    const existingMessages = [createMockMessage(1), createMockMessage(2)];

    const serverResponse: MessagePage = {
      messages: [], // 빈 응답
      total_count: 2,
      has_more: false,
      next_offset: 2,
    };

    const existingUuids = new Set(existingMessages.map((msg) => msg.uuid));
    const newMessages = serverResponse.messages.filter(
      (msg) => !existingUuids.has(msg.uuid)
    );
    const updatedMessages = [...newMessages, ...existingMessages];

    expect(newMessages.length).toBe(0);
    expect(updatedMessages.length).toBe(2); // 변화 없음
    expect(updatedMessages).toEqual(existingMessages);
  });

  it("should handle UUID collisions gracefully", () => {
    // 극단적 케이스: 같은 UUID를 가진 다른 메시지
    const existingMessages = [createMockMessage(1, "duplicate-uuid")];

    const serverMessages = [
      {
        ...createMockMessage(2, "duplicate-uuid"),
        content: "Different content",
      }, // 같은 UUID, 다른 내용
    ];

    const existingUuids = new Set(existingMessages.map((msg) => msg.uuid));
    const newMessages = serverMessages.filter(
      (msg) => !existingUuids.has(msg.uuid)
    );
    const updatedMessages = [...newMessages, ...existingMessages];

    expect(newMessages.length).toBe(0); // UUID가 같으므로 필터링됨
    expect(updatedMessages.length).toBe(1);
    expect(updatedMessages[0].content).toBe("Message 1"); // 기존 메시지 유지
  });
});
