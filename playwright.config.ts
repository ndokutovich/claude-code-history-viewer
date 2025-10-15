import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Tauri E2E tests
 *
 * This configuration is specifically designed for testing Tauri applications
 * using WebView2 on Windows. The approach:
 *
 * 1. Launch Tauri app with remote debugging port enabled
 * 2. Connect Playwright to the WebView2 via Chrome DevTools Protocol (CDP)
 * 3. Run tests against the connected app
 *
 * See: https://playwright.dev/docs/webview2
 * See: https://v2.tauri.app/develop/tests/
 */

export default defineConfig({
  testDir: './e2e/tests',

  // Maximum time one test can run
  timeout: 60 * 1000,

  // Test timeout will be enforced by default
  expect: {
    timeout: 10 * 1000,
  },

  // Run tests in files in parallel
  fullyParallel: false, // Tauri app can only have one instance

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/test-results.json' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for page.goto()
    // Note: Not used for CDP connection, but can be useful for debugging
    // baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: 'retain-on-failure',
  },

  // Configure projects for different test scenarios
  projects: [
    {
      name: 'tauri-windows',
      use: {
        ...devices['Desktop Chrome'],
        // Tauri uses WebView2, which is Chromium-based
      },
    },
  ],

  // Global setup/teardown
  // globalSetup: require.resolve('./e2e/global-setup.ts'),
  // globalTeardown: require.resolve('./e2e/global-teardown.ts'),
});
