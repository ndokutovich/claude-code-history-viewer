import { test, expect } from "@playwright/test";

test.describe("Pagination E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // 앱 시작 및 프로젝트 선택
    await page.goto("http://localhost:1420");
    await page.waitForLoadState("networkidle");
  });

  test("should load initial 20 messages", async ({ page }) => {
    // 프로젝트 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);

    // 세션 선택
    await page.click('[data-testid="session-item"]:first-child');
    await page.waitForTimeout(1000);

    // 메시지가 로드되었는지 확인
    const messages = await page.locator('[data-testid="message-item"]').count();
    expect(messages).toBeGreaterThan(0);
    expect(messages).toBeLessThanOrEqual(20); // 초기 로드는 20개 이하
  });

  test("should load more messages when clicking load more button", async ({
    page,
  }) => {
    // 프로젝트 및 세션 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);
    await page.click('[data-testid="session-item"]:first-child');
    await page.waitForTimeout(1000);

    // 초기 메시지 개수 확인
    const initialCount = await page
      .locator('[data-testid="message-item"]')
      .count();

    // 더보기 버튼 클릭
    const loadMoreButton = page.locator('button:has-text("이전 메시지")');
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click();
      await page.waitForTimeout(1000);

      // 메시지가 추가되었는지 확인
      const afterCount = await page
        .locator('[data-testid="message-item"]')
        .count();
      expect(afterCount).toBeGreaterThan(initialCount);
    }
  });

  test("should handle 120+ messages pagination correctly", async ({ page }) => {
    // 많은 메시지가 있는 세션 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);

    // 메시지가 많은 세션 찾기 (200개 이상)
    const sessionWithManyMessages = page
      .locator('[data-testid="session-item"]')
      .filter({ hasText: /200|300|400|500/ })
      .first();

    if (await sessionWithManyMessages.isVisible()) {
      await sessionWithManyMessages.click();
      await page.waitForTimeout(1000);

      // 6번 더보기 클릭 (20 * 6 = 120개)
      for (let i = 0; i < 6; i++) {
        const loadMoreButton = page.locator('button:has-text("이전 메시지")');
        if (await loadMoreButton.isVisible()) {
          await loadMoreButton.click();
          await page.waitForTimeout(500);
        }
      }

      // 120개 이상 로드되었는지 확인
      const messageCount = await page
        .locator('[data-testid="message-item"]')
        .count();
      expect(messageCount).toBeGreaterThanOrEqual(120);

      // 더보기 버튼이 여전히 작동하는지 확인
      const loadMoreButton = page.locator('button:has-text("이전 메시지")');
      if (await loadMoreButton.isVisible()) {
        const beforeCount = await page
          .locator('[data-testid="message-item"]')
          .count();
        await loadMoreButton.click();
        await page.waitForTimeout(1000);

        const afterCount = await page
          .locator('[data-testid="message-item"]')
          .count();
        expect(afterCount).toBeGreaterThan(beforeCount);
      }
    }
  });

  test("should maintain scroll position after loading more", async ({
    page,
  }) => {
    // 프로젝트 및 세션 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);
    await page.click('[data-testid="session-item"]:first-child');
    await page.waitForTimeout(1000);

    // 스크롤 컨테이너 찾기
    const scrollContainer = page.locator('[data-testid="message-container"]');

    // 중간으로 스크롤
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });

    const scrollTopBefore = await scrollContainer.evaluate(
      (el) => el.scrollTop
    );

    // 더보기 클릭
    const loadMoreButton = page.locator('button:has-text("이전 메시지")');
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click();
      await page.waitForTimeout(1000);

      // 스크롤 위치가 적절히 조정되었는지 확인
      const scrollTopAfter = await scrollContainer.evaluate(
        (el) => el.scrollTop
      );
      expect(scrollTopAfter).toBeGreaterThanOrEqual(scrollTopBefore);
    }
  });

  test('should show "all messages loaded" when no more messages', async ({
    page,
  }) => {
    // 메시지가 적은 세션 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);

    const sessionWithFewMessages = page
      .locator('[data-testid="session-item"]')
      .filter({ hasText: /^[1-9]개|1[0-9]개/ })
      .first();

    if (await sessionWithFewMessages.isVisible()) {
      await sessionWithFewMessages.click();
      await page.waitForTimeout(1000);

      // 모든 메시지가 로드되면 메시지 표시
      const allLoadedMessage = page.locator(
        "text=/모든 메시지가 로드되었습니다/"
      );
      await expect(allLoadedMessage).toBeVisible();

      // 더보기 버튼이 없어야 함
      const loadMoreButton = page.locator('button:has-text("이전 메시지")');
      await expect(loadMoreButton).not.toBeVisible();
    }
  });

  test("should prevent duplicate API calls on rapid clicks", async ({
    page,
  }) => {
    // 네트워크 요청 모니터링 설정
    const apiCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("load_session_messages_paginated")) {
        apiCalls.push(request.url());
      }
    });

    // 프로젝트 및 세션 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);
    await page.click('[data-testid="session-item"]:first-child');
    await page.waitForTimeout(1000);

    // 더보기 버튼 빠르게 3번 클릭
    const loadMoreButton = page.locator('button:has-text("이전 메시지")');
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click();
      await loadMoreButton.click();
      await loadMoreButton.click();

      await page.waitForTimeout(1500);

      // 1초 내 중복 호출은 1번만 발생해야 함
      const recentCalls = apiCalls.filter(
        (_, index) => index >= apiCalls.length - 3
      );
      expect(recentCalls.length).toBeLessThanOrEqual(1);
    }
  });

  test("should handle error gracefully", async ({ page }) => {
    // 네트워크 에러 시뮬레이션
    await page.route("**/load_session_messages_paginated", (route) => {
      route.abort("failed");
    });

    // 프로젝트 및 세션 선택
    await page.click('[data-testid="project-item"]:first-child');
    await page.waitForTimeout(500);
    await page.click('[data-testid="session-item"]:first-child');
    await page.waitForTimeout(1000);

    // 에러 메시지 확인
    const errorMessage = page.locator("text=/오류|에러|실패/");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
