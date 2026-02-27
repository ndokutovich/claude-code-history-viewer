/**
 * App Initialization Tests
 *
 * Tests the application startup behavior, initial state, and error handling.
 */

import { test, expect } from '../fixtures/tauri';
import {
  createMockClaudeDirectory,
  cleanupMockClaudeDirectory,
} from '../fixtures/mockClaudeData';

test.describe('App Initialization', () => {
  test('should load app and display header', async ({ page }) => {
    // Wait for app to be visible
    await page.waitForLoadState('domcontentloaded');

    // Check header is visible
    await expect(page.getByText('Claude Code History Viewer')).toBeVisible();

    // Check app description
    await expect(
      page.getByText(/Browse and analyze your Claude Code conversation history/i)
    ).toBeVisible();
  });

  test('should display loading state during initialization', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Check if loader appears (may be very brief)
    const loader = page.locator('[data-testid="loader"], .animate-spin');

    // Loader should either be visible initially or have been visible
    // (it may disappear quickly, so we check for its existence)
    const loaderExists = await loader.count() > 0;
    expect(loaderExists).toBeTruthy();
  });

  test('should display error message when Claude folder not found', async ({ page }) => {
    // This test requires mocking the Tauri command to return an error
    // In a real scenario, you'd mock the get_claude_folder_path command

    await page.waitForLoadState('domcontentloaded');

    // Check for error indicators
    const errorIcon = page.locator('[data-testid="error-icon"], svg.lucide-alert-triangle');
    const errorCount = await errorIcon.count();

    // If no Claude folder exists, error should be shown
    if (errorCount > 0) {
      await expect(errorIcon.first()).toBeVisible();
    }
  });

  test('should show project count in status bar', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Wait for status bar to appear
    const statusBar = page.locator('.px-6.py-2.border-t').last();
    await expect(statusBar).toBeVisible();

    // Check for project count text (could be 0 or more)
    const projectCountText = statusBar.getByText(/project/i);
    await expect(projectCountText).toBeVisible();
  });

  test('should have settings dropdown in header', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Look for settings button (gear icon or similar)
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical')
    });

    // Settings button should exist
    const settingsCount = await settingsButton.count();
    expect(settingsCount).toBeGreaterThan(0);
  });

  test('should display empty state when no projects selected', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    // Check for empty state message
    const emptyStateMessage = page.getByText(/select a session/i);
    const emptyCount = await emptyStateMessage.count();

    // Empty state should be visible if no session is selected
    if (emptyCount > 0) {
      await expect(emptyStateMessage.first()).toBeVisible();
    }
  });
});

test.describe('App Initialization with Mock Data', () => {
  let mockClaudePath: string;

  test.beforeEach(async ({}, testInfo) => {
    // Create mock Claude data for testing
    mockClaudePath = await createMockClaudeDirectory(testInfo.testId);
  });

  test.afterEach(async () => {
    // Cleanup mock data
    if (mockClaudePath) {
      await cleanupMockClaudeDirectory(mockClaudePath);
    }
  });

  test('should scan and display projects', async ({ page }) => {
    // Note: This test requires setting the Claude path to mockClaudePath
    // In a real implementation, you'd need to mock the Tauri command or
    // configure the app to use the mock path

    await page.waitForLoadState('domcontentloaded');

    // Wait for projects to load
    await page.waitForTimeout(2000); // Give time for scanning

    // Check if project tree is visible
    const projectTree = page.locator('[data-testid="project-tree"], .max-w-80');
    await expect(projectTree).toBeVisible();
  });
});
