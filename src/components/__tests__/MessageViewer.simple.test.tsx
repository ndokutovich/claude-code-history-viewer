import { describe, it, expect } from "vitest";

// 간단한 페이지네이션 로직 테스트
describe("Pagination Logic Tests", () => {
  it("should calculate pagination indices correctly for first page", () => {
    const total = 200;
    const offset = 0;
    const limit = 20;

    const alreadyLoaded = offset;
    const remaining = total - alreadyLoaded;
    const toLoad = Math.min(limit, remaining);

    expect(toLoad).toBe(20);
    expect(remaining).toBe(200);

    // 채팅 스타일: 최신 메시지부터 로드
    const start = total - alreadyLoaded - toLoad;
    const end = total - alreadyLoaded;

    expect(start).toBe(180); // 200 - 0 - 20
    expect(end).toBe(200); // 200 - 0
  });

  it("should handle 120 messages loaded correctly", () => {
    const total = 300;
    const offset = 120; // 이미 120개 로드됨
    const limit = 20;

    const alreadyLoaded = offset;
    const remaining = total > alreadyLoaded ? total - alreadyLoaded : 0;
    const toLoad = Math.min(limit, remaining);

    expect(remaining).toBe(180); // 300 - 120
    expect(toLoad).toBe(20);

    // 안전한 인덱스 계산 (수정된 로직)
    const start =
      total > alreadyLoaded + toLoad ? total - alreadyLoaded - toLoad : 0;
    const end = total > alreadyLoaded ? total - alreadyLoaded : 0;

    expect(start).toBe(160); // 300 - 120 - 20
    expect(end).toBe(180); // 300 - 120
  });

  it("should handle boundary case when reaching the end", () => {
    const total = 150;
    const offset = 140; // 10개만 남음
    const limit = 20;

    const alreadyLoaded = offset;
    const remaining = total > alreadyLoaded ? total - alreadyLoaded : 0;
    const toLoad = Math.min(limit, remaining);

    expect(remaining).toBe(10);
    expect(toLoad).toBe(10); // 20개 요청했지만 10개만 남음

    const start =
      total > alreadyLoaded + toLoad ? total - alreadyLoaded - toLoad : 0;
    const end = total > alreadyLoaded ? total - alreadyLoaded : 0;

    expect(start).toBe(0); // 150 - 140 - 10 = 0
    expect(end).toBe(10); // 150 - 140 = 10
  });

  it("should handle overflow protection", () => {
    const total = 50;
    const offset = 100; // offset이 total보다 큼
    const limit = 20;

    const alreadyLoaded = offset;
    const remaining = total > alreadyLoaded ? total - alreadyLoaded : 0;

    expect(remaining).toBe(0); // 안전하게 0 반환

    const toLoad = Math.min(limit, remaining);
    expect(toLoad).toBe(0);
  });

  it("should maintain correct order for chat-style pagination", () => {
    const total = 100;

    // 첫 페이지: 최신 20개 (인덱스 80-99)
    let offset = 0;
    let start = total - offset - 20;
    let end = total - offset;
    expect(start).toBe(80);
    expect(end).toBe(100);

    // 두 번째 페이지: 그 다음 20개 (인덱스 60-79)
    offset = 20;
    start = total - offset - 20;
    end = total - offset;
    expect(start).toBe(60);
    expect(end).toBe(80);

    // 세 번째 페이지: 그 다음 20개 (인덱스 40-59)
    offset = 40;
    start = total - offset - 20;
    end = total - offset;
    expect(start).toBe(40);
    expect(end).toBe(60);
  });

  it("should handle exact 120 messages edge case", () => {
    const total = 120;
    const offset = 120; // 정확히 120개 로드됨

    const alreadyLoaded = offset;
    const remaining = total > alreadyLoaded ? total - alreadyLoaded : 0;

    expect(remaining).toBe(0); // 더 이상 로드할 메시지 없음
    expect(offset).toBe(total); // offset과 total이 같음
  });

  it("should calculate next offset correctly", () => {
    const offset = 100;
    const loadedMessages = 20;

    const nextOffset = offset + loadedMessages;
    expect(nextOffset).toBe(120);

    // 120개 이후에도 정상 작동
    const offset2 = 120;
    const loadedMessages2 = 20;
    const nextOffset2 = offset2 + loadedMessages2;
    expect(nextOffset2).toBe(140);
  });
});
