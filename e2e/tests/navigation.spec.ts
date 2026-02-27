/**
 * Navigation Tests
 *
 * Tests navigation between projects, sessions, and different views.
 */

import { test, expect } from '../fixtures/tauri';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Wait for initial data load
  });

  test('should display project tree in sidebar', async ({ page }) => {
    // Check sidebar visibility
    const sidebar = page.locator('.max-w-80, [data-testid="project-tree"]').first();
    await expect(sidebar).toBeVisible();
  });

  test('should expand project when clicked', async ({ page }) => {
    // Find first project (if any exist)
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    const projectCount = await projectButton.count();

    if (projectCount > 0) {
      // Click to expand project
      await projectButton.click();

      // Wait for sessions to appear
      await page.waitForTimeout(500);

      // Check if chevron changed (indicates expansion)
      const chevronDown = page.locator('svg.lucide-chevron-down');
      const chevronDownCount = await chevronDown.count();

      expect(chevronDownCount).toBeGreaterThan(0);
    }
  });

  test('should select session when clicked', async ({ page }) => {
    // Find and click first project
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    const projectCount = await projectButton.count();

    if (projectCount > 0) {
      await projectButton.click();
      await page.waitForTimeout(500);

      // Find and click first session
      const sessionButton = page.locator('button').filter({
        has: page.locator('svg.lucide-message-circle')
      }).first();

      const sessionCount = await sessionButton.count();

      if (sessionCount > 0) {
        await sessionButton.click();
        await page.waitForTimeout(1000);

        // Check if main content area shows messages
        const mainContent = page.locator('[data-testid="message-viewer"], .flex-1.overflow-hidden').last();
        await expect(mainContent).toBeVisible();
      }
    }
  });

  test('should display session summary in header when selected', async ({ page }) => {
    // Select a session first (similar to above test)
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      await projectButton.click();
      await page.waitForTimeout(500);

      const sessionButton = page.locator('button').filter({
        has: page.locator('svg.lucide-message-circle')
      }).first();

      if (await sessionButton.count() > 0) {
        await sessionButton.click();
        await page.waitForTimeout(1000);

        // Check content header for conversation title
        const contentHeader = page.getByText(/conversation/i);
        await expect(contentHeader).toBeVisible();
      }
    }
  });

  test('should update breadcrumb in header when navigating', async ({ page }) => {
    // Look for header breadcrumb area
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      // Get project name
      const projectName = await projectButton.textContent();

      await projectButton.click();
      await page.waitForTimeout(500);

      const sessionButton = page.locator('button').filter({
        has: page.locator('svg.lucide-message-circle')
      }).first();

      if (await sessionButton.count() > 0) {
        await sessionButton.click();
        await page.waitForTimeout(1000);

        // Check if project name appears in header
        if (projectName) {
          const headerText = await header.textContent();
          expect(headerText).toContain(projectName.substring(0, 10)); // Partial match
        }
      }
    }
  });

  test('should show session count in status bar', async ({ page }) => {
    // Check status bar at bottom
    const statusBar = page.locator('.px-6.py-2.border-t').last();
    await expect(statusBar).toBeVisible();

    // Look for session count text
    const sessionCountText = statusBar.getByText(/session/i);
    await expect(sessionCountText).toBeVisible();
  });
});

test.describe('View Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('should have analytics button in header', async ({ page }) => {
    // Select a project first
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      await projectButton.click();
      await page.waitForTimeout(500);

      // Look for analytics button (bar chart icon)
      const analyticsButton = page.locator('button').filter({
        has: page.locator('svg.lucide-bar-chart-3')
      });

      await expect(analyticsButton).toBeVisible();
    }
  });

  test('should switch to analytics view when analytics button clicked', async ({ page }) => {
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      await projectButton.click();
      await page.waitForTimeout(500);

      const analyticsButton = page.locator('button').filter({
        has: page.locator('svg.lucide-bar-chart-3')
      }).first();

      if (await analyticsButton.count() > 0) {
        await analyticsButton.click();
        await page.waitForTimeout(1000);

        // Check if analytics content is displayed
        const analyticsText = page.getByText(/dashboard|analytics|activity/i);
        await expect(analyticsText.first()).toBeVisible();
      }
    }
  });

  test('should have token stats button in header', async ({ page }) => {
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      await projectButton.click();
      await page.waitForTimeout(500);

      // Look for activity/token stats button
      const tokenStatsButton = page.locator('button').filter({
        has: page.locator('svg.lucide-activity')
      });

      await expect(tokenStatsButton).toBeVisible();
    }
  });

  test('should switch to message view when message button clicked', async ({ page }) => {
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      await projectButton.click();
      await page.waitForTimeout(500);

      const sessionButton = page.locator('button').filter({
        has: page.locator('svg.lucide-message-circle')
      }).first();

      if (await sessionButton.count() > 0) {
        await sessionButton.click();
        await page.waitForTimeout(1000);

        // Click analytics first
        const analyticsButton = page.locator('button').filter({
          has: page.locator('svg.lucide-bar-chart-3')
        }).first();

        if (await analyticsButton.count() > 0) {
          await analyticsButton.click();
          await page.waitForTimeout(500);

          // Then click message view button
          const messageButton = page.locator('button').filter({
            has: page.locator('svg.lucide-message-square')
          }).first();

          if (await messageButton.count() > 0) {
            await messageButton.click();
            await page.waitForTimeout(500);

            // Check if back to message view
            const conversationText = page.getByText(/conversation/i);
            await expect(conversationText).toBeVisible();
          }
        }
      }
    }
  });
});
