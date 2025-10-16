/**
 * Tauri Test Fixture
 *
 * This fixture handles launching the Tauri application with WebView2 debugging
 * enabled and connecting Playwright to it via Chrome DevTools Protocol (CDP).
 *
 * Usage in tests:
 * ```ts
 * import { test } from './fixtures/tauri';
 *
 * test('my test', async ({ tauriApp, page }) => {
 *   // page is connected to Tauri app
 *   await page.getByText('Claude Code History Viewer').isVisible();
 * });
 * ```
 */

import { test as base, type Page, type BrowserContext, chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const REMOTE_DEBUGGING_PORT = 9222;
const TAURI_STARTUP_TIMEOUT = 30000; // 30 seconds
const TAURI_SHUTDOWN_TIMEOUT = 5000; // 5 seconds

export interface TauriAppFixture {
  /**
   * The spawned Tauri process
   */
  process: ChildProcess;

  /**
   * The CDP endpoint URL
   */
  cdpUrl: string;
}

export const test = base.extend<{
  tauriApp: TauriAppFixture;
  page: Page;
  context: BrowserContext;
}>({
  tauriApp: async ({}, use, testInfo) => {
    let tauriProcess: ChildProcess | null = null;

    try {
      // Create unique user data directory for test isolation
      const testDataDir = path.join(
        process.cwd(),
        'e2e',
        '.test-data',
        `test-${testInfo.testId}`
      );

      if (!fs.existsSync(testDataDir)) {
        fs.mkdirSync(testDataDir, { recursive: true });
      }

      // Set environment variables for WebView2 debugging
      const env = {
        ...process.env,
        // Enable remote debugging on port 9222
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${REMOTE_DEBUGGING_PORT}`,
        // Use unique user data folder for test isolation
        WEBVIEW2_USER_DATA_FOLDER: testDataDir,
        // Disable GPU to avoid issues in CI
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS_2: '--disable-gpu',
        // Skip update check during tests
        SKIP_UPDATE_CHECK: '1',
      };

      console.log(`[Tauri] Launching app with debugging on port ${REMOTE_DEBUGGING_PORT}...`);
      console.log(`[Tauri] User data directory: ${testDataDir}`);

      // Determine the Tauri binary path
      // In development: use `tauri dev` command
      // In CI/production: use built binary
      const isDev = process.env.TAURI_TEST_MODE !== 'production';

      if (isDev) {
        // Launch via npm run tauri:dev
        tauriProcess = spawn('npm', ['run', 'tauri:dev'], {
          env,
          shell: true,
          detached: false,
        });
      } else {
        // Launch built binary (adjust path for your platform)
        const binaryPath = path.join(
          process.cwd(),
          'src-tauri',
          'target',
          'release',
          'claude-code-history-viewer.exe'
        );

        if (!fs.existsSync(binaryPath)) {
          throw new Error(`Tauri binary not found at ${binaryPath}. Run 'npm run tauri:build' first.`);
        }

        tauriProcess = spawn(binaryPath, [], {
          env,
          detached: false,
        });
      }

      // Collect process output for debugging
      const processOutput: string[] = [];
      tauriProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        processOutput.push(output);
        if (process.env.DEBUG) {
          console.log('[Tauri stdout]', output);
        }
      });

      tauriProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        processOutput.push(output);
        if (process.env.DEBUG) {
          console.error('[Tauri stderr]', output);
        }
      });

      // Wait for Tauri to start and CDP to be available
      const cdpUrl = `http://localhost:${REMOTE_DEBUGGING_PORT}`;
      const startTime = Date.now();
      let connected = false;

      while (Date.now() - startTime < TAURI_STARTUP_TIMEOUT) {
        try {
          // Try to fetch CDP endpoint
          const response = await fetch(cdpUrl + '/json/version');
          if (response.ok) {
            connected = true;
            console.log('[Tauri] CDP endpoint ready');
            break;
          }
        } catch (error) {
          // CDP not ready yet, wait and retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!connected) {
        throw new Error(
          `Tauri failed to start within ${TAURI_STARTUP_TIMEOUT}ms.\n` +
          `Process output:\n${processOutput.join('\n')}`
        );
      }

      // Provide fixture to test
      await use({
        process: tauriProcess,
        cdpUrl,
      });

    } finally {
      // Cleanup: Kill Tauri process
      if (tauriProcess && !tauriProcess.killed) {
        console.log('[Tauri] Shutting down...');

        // Try graceful shutdown first
        tauriProcess.kill('SIGTERM');

        // Wait for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, TAURI_SHUTDOWN_TIMEOUT));

        // Force kill if still running
        if (!tauriProcess.killed) {
          console.log('[Tauri] Force killing process...');
          tauriProcess.kill('SIGKILL');
        }

        console.log('[Tauri] Shutdown complete');
      }
    }
  },

  context: async ({ tauriApp }, use) => {
    // Connect to Tauri via CDP
    console.log('[Playwright] Connecting to Tauri via CDP...');

    const browser = await chromium.connectOverCDP(tauriApp.cdpUrl);
    const contexts = browser.contexts();

    if (contexts.length === 0) {
      throw new Error('No browser contexts found in Tauri app');
    }

    // Use the first context (Tauri's main window)
    const context = contexts[0];
    console.log('[Playwright] Connected to browser context');

    await use(context);

    // Cleanup: Close browser connection
    await browser.close();
  },

  page: async ({ context }, use) => {
    // Get the first page from the context (Tauri's main window)
    const pages = context.pages();

    if (pages.length === 0) {
      throw new Error('No pages found in Tauri app');
    }

    const page = pages[0];
    console.log('[Playwright] Using page:', page.url());

    await use(page);

    // No need to close page - it's managed by the Tauri app
  },
});

export { expect } from '@playwright/test';
