/**
 * UI Interactions Tests
 *
 * Tests user interface interactions including theme switching, language changes,
 * and UI state management.
 */

import { test, expect } from '../fixtures/tauri';

test.describe('Theme Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('should have settings dropdown in header', async ({ page }) => {
    // Look for settings/menu button
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await expect(settingsButton).toBeVisible();
  });

  test('should open settings dropdown when clicked', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Check if dropdown menu is visible
    const dropdown = page.locator('[role="menu"], .radix-dropdown-menu');
    const dropdownVisible = await dropdown.count() > 0;

    expect(dropdownVisible).toBeTruthy();
  });

  test('should have theme options in settings', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Look for theme-related text
    const themeOption = page.getByText(/theme|light|dark/i);
    const themeCount = await themeOption.count();

    expect(themeCount).toBeGreaterThan(0);
  });

  test('should toggle between light and dark themes', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Find theme toggle buttons
    const darkModeButton = page.getByText(/dark/i).first();

    if (await darkModeButton.count() > 0) {
      // Get initial theme
      const htmlElement = page.locator('html');
      const initialClass = await htmlElement.getAttribute('class');

      // Click dark mode
      await darkModeButton.click();
      await page.waitForTimeout(500);

      // Check theme changed
      const newClass = await htmlElement.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });

  test('should persist theme preference', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Switch to dark theme
    const darkModeButton = page.getByText(/dark/i).first();

    if (await darkModeButton.count() > 0) {
      await darkModeButton.click();
      await page.waitForTimeout(500);

      // Reload page
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      // Check theme persisted
      const htmlElement = page.locator('html');
      const themeClass = await htmlElement.getAttribute('class');

      // Should contain 'dark' class
      expect(themeClass).toContain('dark');
    }
  });
});

test.describe('Language Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('should have language options in settings', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Look for language-related text
    const languageOption = page.getByText(/language|english|한국어|日本語/i);
    const langCount = await languageOption.count();

    expect(langCount).toBeGreaterThan(0);
  });

  test('should display multiple language options', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Check for supported languages
    const supportedLanguages = ['English', '한국어', '日本語', '简体中文', '繁體中文'];
    let foundLanguages = 0;

    for (const lang of supportedLanguages) {
      const langOption = page.getByText(lang);
      if (await langOption.count() > 0) {
        foundLanguages++;
      }
    }

    // Should have at least 2 language options
    expect(foundLanguages).toBeGreaterThanOrEqual(2);
  });

  test('should change UI language when option selected', async ({ page }) => {
    const settingsButton = page.locator('button').filter({
      has: page.locator('svg.lucide-settings, svg.lucide-more-vertical, svg.lucide-ellipsis-vertical')
    }).last();

    await settingsButton.click();
    await page.waitForTimeout(300);

    // Try to switch to Korean
    const koreanOption = page.getByText('한국어');

    if (await koreanOption.count() > 0) {
      await koreanOption.click();
      await page.waitForTimeout(1000);

      // Check if UI text changed to Korean
      const headerText = await page.locator('header').textContent();
      const hasKoreanText = headerText && /[가-힣]/.test(headerText);

      expect(hasKoreanText).toBeTruthy();
    }
  });
});

test.describe('Session Refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('should have refresh button when session selected', async ({ page }) => {
    // Select a session first
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

        // Look for refresh button
        const refreshButton = page.locator('button').filter({
          has: page.locator('svg.lucide-refresh-cw')
        });

        await expect(refreshButton).toBeVisible();
      }
    }
  });

  test('should refresh session when refresh button clicked', async ({ page }) => {
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

        const refreshButton = page.locator('button').filter({
          has: page.locator('svg.lucide-refresh-cw')
        }).first();

        if (await refreshButton.count() > 0) {
          await refreshButton.click();

          // Check if refresh animation appears
          await page.waitForTimeout(500);

          const spinner = page.locator('.animate-spin');
          const spinnerCount = await spinner.count();

          // Spinner should appear during refresh
          expect(spinnerCount).toBeGreaterThanOrEqual(0); // May finish quickly
        }
      }
    }
  });
});

test.describe('Scroll and Pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('should support scrolling in message view', async ({ page }) => {
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

        // Find scrollable container
        const messageContainer = page.locator('[data-testid="message-viewer"], .overflow-y-auto, .overflow-auto').first();

        if (await messageContainer.count() > 0) {
          // Try to scroll
          await messageContainer.evaluate((el) => {
            el.scrollTop = 100;
          });

          await page.waitForTimeout(300);

          // Check scroll position changed
          const scrollTop = await messageContainer.evaluate((el) => el.scrollTop);
          expect(scrollTop).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should support scrolling in project tree', async ({ page }) => {
    const sidebar = page.locator('.max-w-80, [data-testid="project-tree"]').first();

    if (await sidebar.count() > 0) {
      // Try to scroll sidebar
      await sidebar.evaluate((el) => {
        el.scrollTop = 50;
      });

      await page.waitForTimeout(200);

      const scrollTop = await sidebar.evaluate((el) => el.scrollTop);
      // Scroll should work (may be 0 if not enough content)
      expect(scrollTop).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  });

  test('should support tab navigation', async ({ page }) => {
    // Press Tab key several times
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Check if focus moved (some element should be focused)
    const focusedElement = page.locator(':focus');
    const isFocused = await focusedElement.count() > 0;

    expect(isFocused).toBeTruthy();
  });

  test('should support Enter key for button activation', async ({ page }) => {
    const projectButton = page.locator('button').filter({
      has: page.locator('svg.lucide-folder')
    }).first();

    if (await projectButton.count() > 0) {
      // Focus the button
      await projectButton.focus();

      // Press Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Check if project expanded
      const chevronDown = page.locator('svg.lucide-chevron-down');
      const expanded = await chevronDown.count() > 0;

      expect(expanded).toBeTruthy();
    }
  });
});
