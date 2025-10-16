# Testing Guide

Complete guide for running tests in the Claude Code History Viewer project.

## Quick Start

```bash
# Install dependencies (if not done already)
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## Test Types

### 1. Unit Tests (Vitest)

Unit tests for React components and utility functions.

**Run Commands:**
```bash
# Watch mode (recommended for development)
pnpm test

# Run once
pnpm test:run

# With UI
pnpm test:ui

# Specific test file
pnpm test src/utils/messageAdapter.test.ts
```

**Location:** Throughout `src/` directory with `.test.ts` or `.test.tsx` extensions

**Current Status:** Minimal coverage - needs expansion

### 2. E2E Tests (Playwright)

End-to-end behavioral tests for the full Tauri application.

**Run Commands:**
```bash
# Run all E2E tests
pnpm test:e2e

# Interactive UI mode (best for development)
pnpm test:e2e:ui

# Headed mode (see browser window)
pnpm test:e2e:headed

# Debug mode (with Playwright Inspector)
pnpm test:e2e:debug

# View last test report
pnpm test:e2e:report

# Run specific test file
pnpm exec playwright test e2e/tests/navigation.spec.ts

# Run tests matching pattern
pnpm exec playwright test --grep "should expand project"
```

**Location:** `e2e/tests/` directory

**Documentation:** See `e2e/README.md` for detailed E2E testing guide

## E2E Testing Requirements

### Prerequisites

**⚠️ CRITICAL WINDOWS REQUIREMENTS:** E2E tests require BOTH Visual Studio C++ Build Tools and Rust.

**Windows:**
- Node.js 18+
- npm or pnpm package manager
- **Microsoft Visual Studio C++ Build Tools (REQUIRED)** - Install FIRST before Rust
  - Download "Build Tools for Visual Studio 2022" from https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
  - Run the installer and select "Desktop development with C++"
  - This installs the MSVC compiler (`link.exe`) that Rust needs on Windows
  - Verify: Open new terminal and run `link.exe` (should show Microsoft Linker)
  - **Without this, Rust compilation will fail with "linking with link.exe failed"**
- **Rust toolchain (REQUIRED for Tauri)** - Install AFTER VS Build Tools
  - Download from https://rustup.rs/
  - Run `rustup-init.exe` and follow prompts
  - The installer will detect VS Build Tools automatically
  - After installation, restart terminal and verify: `cargo --version`
- Microsoft Edge WebView2 Runtime (usually pre-installed on Windows 10/11)

### First-Time Setup

```bash
# 1. Install project dependencies
pnpm install

# 2. Install Playwright browsers
pnpm exec playwright install chromium

# 3. Verify Tauri can build
pnpm tauri:build

# 4. Run tests
pnpm test:e2e
```

### Environment Variables

E2E tests use these environment variables:

- `TAURI_TEST_MODE` - Set to `production` to test built binary (default: development)
- `DEBUG` - Set to `1` or `pw:api` to enable debug output
- `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` - Set automatically by test fixture
- `WEBVIEW2_USER_DATA_FOLDER` - Set automatically for test isolation

## Test Structure

### E2E Test Organization

```
e2e/
├── fixtures/
│   ├── tauri.ts              # Main test fixture for Tauri app
│   └── mockClaudeData.ts     # Mock data generator
├── tests/
│   ├── app-initialization.spec.ts   # ~10 tests
│   ├── navigation.spec.ts           # ~10 tests
│   └── ui-interactions.spec.ts      # ~15 tests
└── README.md                 # Detailed E2E guide
```

### Test Coverage

**Currently Tested:**
- ✅ App initialization and loading
- ✅ Project tree navigation
- ✅ Session selection
- ✅ View switching (messages, analytics, token stats)
- ✅ Theme toggling (light/dark)
- ✅ Language switching (5 languages)
- ✅ Settings dropdown
- ✅ Refresh functionality
- ✅ Keyboard navigation basics
- ✅ Scroll behavior

**Not Yet Tested:**
- ❌ Message content rendering
- ❌ Analytics visualizations
- ❌ Token statistics details
- ❌ Error handling scenarios
- ❌ Update system
- ❌ Search functionality (UI not implemented)

## Development Workflow

### Running Tests During Development

**Unit Tests:**
```bash
# Start test watcher
pnpm test

# Write code and tests
# Tests auto-rerun on file changes
```

**E2E Tests:**
```bash
# Use UI mode for interactive development
pnpm test:e2e:ui

# Or headed mode to see the app
pnpm test:e2e:headed
```

### Writing New Tests

**Unit Test Example:**
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

**E2E Test Example:**
```typescript
import { test, expect } from '../fixtures/tauri';

test('should display header', async ({ page }) => {
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Claude Code History Viewer')).toBeVisible();
});
```

## CI/CD Integration

### GitHub Actions

Example workflow for running tests in CI:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:run

  e2e-tests:
    runs-on: windows-latest  # E2E requires Windows for WebView2
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm tauri:build
      - run: pnpm test:e2e
        env:
          TAURI_TEST_MODE: production
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Debugging Tests

### Unit Tests

```bash
# Use Vitest UI for visual debugging
pnpm test:ui

# Use console.log in tests
# Use debugger statement with Node.js inspector
```

### E2E Tests

**Interactive Debugging:**
```bash
# Best option: UI mode
pnpm test:e2e:ui

# Playwright Inspector
pnpm test:e2e:debug

# Headed mode (see what's happening)
pnpm test:e2e:headed
```

**Debug Output:**
```bash
# Windows
set DEBUG=pw:api
pnpm test:e2e

# Or
set DEBUG=1
pnpm test:e2e
```

**Screenshots and Videos:**
- Screenshots: Captured on failure
- Videos: Recorded on failure
- Traces: Collected on first retry
- View with: `pnpm test:e2e:report`

## Troubleshooting

### Common Issues

**"Cannot find Playwright browsers"**
```bash
pnpm exec playwright install chromium
```

**"failed to run 'cargo metadata' command: program not found"**
- **Cause**: Rust toolchain is not installed
- **Fix**: Install Rust from https://rustup.rs/
  - Windows: Download and run `rustup-init.exe`
  - After installation, restart your terminal
  - Verify installation: `cargo --version`
  - Then run: `npm run tauri:build` to build the app
- **Note**: E2E tests REQUIRE Rust because they launch the Tauri app

**"linking with link.exe failed" or "error: could not compile"**
- **Cause**: Visual Studio C++ Build Tools are not installed
- **Fix**: Install VS Build Tools BEFORE Rust
  - Download "Build Tools for Visual Studio 2022" from https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
  - Run installer and select "Desktop development with C++"
  - This installs MSVC compiler that Rust needs on Windows
  - Restart terminal after installation
  - Verify: Run `link.exe` (should output "Microsoft (R) Incremental Linker")
  - If Rust was already installed, re-run `rustup-init.exe` to detect VS tools
- **Error example**: `note: in the Visual Studio installer, ensure the "C++ build tools" workload is selected`

**"Tauri app failed to start"**
- Check that app builds: `pnpm tauri:build`
- Verify Rust is installed: `cargo --version`
- Verify WebView2 is installed
- Check port 9222 is not in use
- Run in headed mode to see errors: `pnpm test:e2e:headed`

**"Tests timing out"**
- Increase timeout in `playwright.config.ts`
- Check app performance
- Verify Tauri logs for errors

**"Module not found" errors**
- Run `pnpm install`
- Clear node_modules and reinstall
- Check package.json for missing dependencies

### Getting Help

1. Check `e2e/README.md` for E2E-specific issues
2. Enable debug output: `set DEBUG=1`
3. Run in headed mode: `pnpm test:e2e:headed`
4. Check Playwright logs in test results
5. Review Tauri app logs

## Test Maintenance

### Adding New E2E Tests

1. Create test file in `e2e/tests/`
2. Import fixtures: `import { test, expect } from '../fixtures/tauri'`
3. Write tests following existing patterns
4. Run to verify: `pnpm test:e2e`
5. Update this guide if adding new test suite

### Updating Test Fixtures

- `e2e/fixtures/tauri.ts` - Modify Tauri launch behavior
- `e2e/fixtures/mockClaudeData.ts` - Add more mock data patterns
- Test fixture changes affect all tests

### Best Practices

1. **Keep tests independent** - Each test should work alone
2. **Clean up resources** - Use `afterEach` hooks
3. **Use descriptive names** - Test names should explain what they test
4. **Avoid hardcoded waits** - Use Playwright's built-in waiters
5. **Test user behavior** - Click buttons, not internal methods
6. **Handle async properly** - Always await async operations
7. **Check multiple states** - Verify both positive and negative cases

## Performance

### Test Execution Times

**Unit Tests:**
- Individual test: ~10-50ms
- Full suite: ~1-5 seconds

**E2E Tests:**
- Individual test: ~3-10 seconds
- Full suite: ~5-10 minutes
- App startup: ~5-10 seconds per test

### Optimization Tips

1. Use `fullyParallel: false` for Tauri (only one instance allowed)
2. Reuse browser context when possible
3. Avoid unnecessary page reloads
4. Use efficient selectors
5. Combine related assertions

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Playwright WebView2 Guide](https://playwright.dev/docs/webview2)
- [Tauri Testing Guide](https://v2.tauri.app/develop/tests/)
- [Testing Library](https://testing-library.com/)

## Contributing

When contributing tests:
1. Follow existing patterns and conventions
2. Add tests for new features
3. Update this guide if needed
4. Ensure tests pass locally before submitting PR
5. Include test coverage in PR description
