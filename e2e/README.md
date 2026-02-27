# E2E Testing with Playwright

This directory contains end-to-end (E2E) behavioral tests for the Claude Code History Viewer Tauri application using Playwright.

## Overview

These tests use Playwright to test the Tauri application by connecting to WebView2 via Chrome DevTools Protocol (CDP). This allows us to test the full application stack including Rust backend, IPC communication, and React frontend.

## Architecture

```
e2e/
├── fixtures/
│   ├── tauri.ts          # Tauri app launcher and Playwright connection
│   └── mockClaudeData.ts # Mock Claude data generator
├── tests/
│   ├── app-initialization.spec.ts  # App startup and initial state
│   ├── navigation.spec.ts           # Project/session navigation
│   └── ui-interactions.spec.ts      # Theme, language, UI state
└── README.md
```

## Prerequisites

**⚠️ CRITICAL WINDOWS REQUIREMENTS:** E2E tests require BOTH Visual Studio C++ Build Tools and Rust.

### Windows

1. **Node.js 18+** and **npm/pnpm**
2. **Microsoft Visual Studio C++ Build Tools (REQUIRED)** - Install FIRST before Rust
   - Download "Build Tools for Visual Studio 2022" from https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Run the installer and select "Desktop development with C++"
   - This installs the MSVC compiler (`link.exe`) that Rust needs on Windows
   - Restart terminal after installation and verify: `link.exe` (should show Microsoft Linker)
   - **Without this, Rust compilation fails with "linking with link.exe failed"**
3. **Rust toolchain (REQUIRED)** - Install AFTER VS Build Tools
   - Download from https://rustup.rs/
   - Run `rustup-init.exe` and follow prompts
   - The installer will detect VS Build Tools automatically
   - Restart terminal after installation and verify: `cargo --version`
   - This is REQUIRED for Tauri to build and run
4. **Microsoft Edge WebView2 Runtime** (usually pre-installed on Windows 10/11)

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers (Chromium for CDP connection)
pnpm exec playwright install chromium
```

## Running Tests

### Development Mode

Run tests against the development build (using `tauri dev`):

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI mode (interactive)
pnpm test:e2e:ui

# Run in headed mode (see browser window)
pnpm test:e2e:headed

# Run with debugger
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test e2e/tests/navigation.spec.ts
```

### Production Mode

Run tests against the built binary:

```bash
# Build the app first
pnpm tauri:build

# Set environment variable and run tests
set TAURI_TEST_MODE=production
pnpm test:e2e
```

## Test Structure

### Test Fixtures

**`fixtures/tauri.ts`**
- Launches Tauri app with WebView2 remote debugging enabled
- Connects Playwright to the app via CDP
- Provides `tauriApp`, `page`, and `context` fixtures
- Handles app lifecycle (startup/shutdown)

**`fixtures/mockClaudeData.ts`**
- Creates temporary `.claude` directory with mock data
- Generates realistic conversation history for testing
- Cleans up test data after tests complete

### Test Suites

**`app-initialization.spec.ts`**
- App startup and loading states
- Error handling when Claude folder not found
- Initial UI state verification
- Status bar and empty states

**`navigation.spec.ts`**
- Project tree navigation
- Session selection
- View switching (messages, analytics, token stats)
- Breadcrumb updates
- Status bar updates

**`ui-interactions.spec.ts`**
- Theme switching (light/dark mode)
- Language switching (5 languages supported)
- Settings dropdown interactions
- Session refresh
- Scroll and pagination
- Keyboard navigation

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../fixtures/tauri';

test.describe('My Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000); // Wait for initial data load
  });

  test('should do something', async ({ page }) => {
    // Your test code here
    await expect(page.getByText('Some Text')).toBeVisible();
  });
});
```

### Using Mock Data

```typescript
import { test, expect } from '../fixtures/tauri';
import { createMockClaudeDirectory, cleanupMockClaudeDirectory } from '../fixtures/mockClaudeData';

test.describe('With Mock Data', () => {
  let mockClaudePath: string;

  test.beforeEach(async ({}, testInfo) => {
    mockClaudePath = await createMockClaudeDirectory(testInfo.testId);
    // Note: You'll need to configure the app to use mockClaudePath
  });

  test.afterEach(async () => {
    await cleanupMockClaudeDirectory(mockClaudePath);
  });

  test('should work with mock data', async ({ page }) => {
    // Test with mock Claude data
  });
});
```

## Debugging Tests

### Visual Debugging

```bash
# Run in headed mode to see the app window
pnpm test:e2e:headed

# Run with Playwright Inspector
pnpm test:e2e:debug

# Run with UI mode (best for debugging)
pnpm test:e2e:ui
```

### Debug Output

Enable debug output:

```bash
# Windows
set DEBUG=pw:api
pnpm test:e2e

# Or use Playwright's built-in debugging
set DEBUG=1
pnpm test:e2e
```

### Screenshots and Videos

Tests automatically capture:
- **Screenshots**: On failure
- **Videos**: On failure (retained)
- **Traces**: On first retry

View results:

```bash
pnpm test:e2e:report
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build Tauri app
        run: pnpm tauri:build

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          TAURI_TEST_MODE: production

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Common Issues

**"failed to run 'cargo metadata' command: program not found"**
- **Cause**: Rust toolchain is not installed
- **Fix**: Install Rust from https://rustup.rs/
  - Windows: Download and run `rustup-init.exe`
  - Restart terminal after installation
  - Verify: `cargo --version`
- **Critical**: Without Rust, E2E tests CANNOT run because they need to launch the Tauri app

**"linking with link.exe failed" or "error: could not compile"**
- **Cause**: Visual Studio C++ Build Tools are not installed
- **Fix**: Install VS Build Tools BEFORE Rust
  - Download "Build Tools for Visual Studio 2022" from https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
  - Run installer and select "Desktop development with C++"
  - This installs MSVC compiler (`link.exe`) that Rust needs on Windows
  - Restart terminal after installation
  - Verify: Run `link.exe` (should output "Microsoft (R) Incremental Linker")
  - If Rust was already installed, re-run `rustup-init.exe` to detect VS tools
- **Error example**: `note: in the Visual Studio installer, ensure the "C++ build tools" workload is selected`
- **Common error**: `link: extra operand '*.o'` - This means link.exe is not found

**"Connection refused" or "CDP endpoint not ready"**
- Tauri app failed to start
- Check that Rust is installed: `cargo --version`
- Check that `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` is set correctly
- Increase `TAURI_STARTUP_TIMEOUT` in `fixtures/tauri.ts`

**"No pages found in Tauri app"**
- App started but window not created
- Check Tauri logs for errors
- Verify app is visible in headed mode

**Tests timing out**
- Increase test timeout in `playwright.config.ts`
- Add more wait conditions in tests
- Check app performance

**WebView2 not found**
- Install Microsoft Edge WebView2 Runtime
- Download from: https://developer.microsoft.com/microsoft-edge/webview2/

### Debug Checklist

1. ✅ Tauri app builds successfully (`pnpm tauri:build`)
2. ✅ Playwright installed (`pnpm exec playwright install chromium`)
3. ✅ WebView2 runtime installed (Windows)
4. ✅ Port 9222 not in use by another process
5. ✅ Environment variables set correctly
6. ✅ No firewall blocking local connections

## Test Coverage

Current coverage:
- ✅ App initialization and startup
- ✅ Project and session navigation
- ✅ View switching (messages, analytics, tokens)
- ✅ Theme management (light/dark)
- ✅ Language switching (5 languages)
- ✅ Settings interactions
- ✅ Keyboard navigation basics

TODO:
- ❌ Message rendering and display
- ❌ Analytics data visualization
- ❌ Token statistics display
- ❌ Error handling scenarios
- ❌ Update system
- ❌ Search functionality (when UI implemented)

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright WebView2 Guide](https://playwright.dev/docs/webview2)
- [Tauri Testing Guide](https://v2.tauri.app/develop/tests/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

## Contributing

When adding new tests:
1. Follow existing test structure and patterns
2. Use descriptive test names
3. Add comments for complex test logic
4. Clean up resources in `afterEach` hooks
5. Update this README if adding new test suites
