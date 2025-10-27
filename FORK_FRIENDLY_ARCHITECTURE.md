# Fork-Friendly Architecture

## Problem Statement

The repository currently has **10 hardcoded references** to the owner/repository name:
- `package.json` (4 locations: author, repository URL, bugs URL, homepage)
- `Cargo.toml` (2 locations: authors, repository)
- `tauri.conf.json` (1 location: updater endpoint)
- `src-tauri/src/commands/feedback.rs` (1 location: GitHub issues URL)
- `src-tauri/src/commands/update.rs` (1 location: GitHub API releases endpoint)
- `src/hooks/useGitHubUpdater.ts` (1 location: GitHub API releases endpoint)

**Current Issue**: Forks must manually modify these files, causing **merge conflicts** when syncing with upstream.

## Solution: Build-Time Injection via GitHub Actions Variables

### Strategy

1. **Keep defaults in code** (original repo: `ndokutovich/claude-code-history-viewer`)
2. **Substitute at build time** using GitHub Actions environment variables
3. **Forks only configure GitHub repository variables** (no file modifications)
4. **Zero merge conflicts** when syncing with upstream

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Repository Variables (Configured in Settings)           │
│  - REPO_OWNER (defaults to github.repository_owner)             │
│  - REPO_NAME (defaults to github.event.repository.name)         │
│  - REPO_AUTHOR (optional)                                       │
│  - FEEDBACK_EMAIL (optional)                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Build Time (GitHub Actions or local)                           │
│  1. scripts/inject-repo-info.cjs reads env variables            │
│  2. Generates src/constants/repo.ts                             │
│  3. Generates src-tauri/src/constants/repo.rs                   │
│  4. Updates package.json, Cargo.toml, tauri.conf.json          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Application Code                                               │
│  - Uses constants from generated files                          │
│  - All URLs point to correct fork                               │
│  - Updater, feedback, issues all work automatically             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Step 1: Create Build-Time Injection Script

**File: `scripts/inject-repo-info.cjs`**

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get from environment or use defaults (original repo)
const REPO_OWNER = process.env.REPO_OWNER || 'ndokutovich';
const REPO_NAME = process.env.REPO_NAME || 'claude-code-history-viewer';
const REPO_AUTHOR = process.env.REPO_AUTHOR || 'JaeHyeok Lee, ndokutovich, and others (see commits history)';
const FEEDBACK_EMAIL = process.env.FEEDBACK_EMAIL || 'feedback@claude-history-viewer.app';

console.log(`📦 Building for: ${REPO_OWNER}/${REPO_NAME}`);

// URLs derived from owner/name
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const ISSUES_URL = `${REPO_URL}/issues`;
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const UPDATER_URL = `${REPO_URL}/releases/latest/download/latest.json`;

// 1. Update package.json (for metadata only)
const packagePath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

packageJson.author = REPO_AUTHOR;
packageJson.repository.url = `${REPO_URL}.git`;
packageJson.bugs.url = `${ISSUES_URL}`;
packageJson.homepage = `${REPO_URL}#readme`;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✓ Updated package.json');

// 2. Update Cargo.toml
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoPath, 'utf8');

cargoToml = cargoToml.replace(
  /^authors = \[.*\]$/m,
  `authors = ["${REPO_AUTHOR}"]`
);
cargoToml = cargoToml.replace(
  /^repository = ".*"$/m,
  `repository = "${REPO_URL}"`
);

fs.writeFileSync(cargoPath, cargoToml);
console.log('✓ Updated Cargo.toml');

// 3. Update tauri.conf.json (updater endpoint)
const tauriConfigPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

tauriConfig.plugins.updater.endpoints = [UPDATER_URL];

fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + '\n');
console.log('✓ Updated tauri.conf.json');

// 4. Generate TypeScript constants
const tsConstantsDir = path.join(__dirname, '..', 'src', 'constants');
if (!fs.existsSync(tsConstantsDir)) {
  fs.mkdirSync(tsConstantsDir, { recursive: true });
}

const tsConstants = `// Auto-generated at build time - DO NOT EDIT MANUALLY
// Values injected from GitHub Actions variables or defaults

export const REPO_CONFIG = {
  owner: "${REPO_OWNER}",
  repo: "${REPO_NAME}",
  repoUrl: "${REPO_URL}",
  apiUrl: "${API_URL}",
  issuesUrl: "${ISSUES_URL}",
  releasesApiUrl: "${API_URL}/releases/latest",
  feedbackEmail: "${FEEDBACK_EMAIL}",
} as const;
`;

fs.writeFileSync(
  path.join(tsConstantsDir, 'repo.ts'),
  tsConstants
);
console.log('✓ Generated src/constants/repo.ts');

// 5. Generate Rust constants
const rsConstantsDir = path.join(__dirname, '..', 'src-tauri', 'src', 'constants');
if (!fs.existsSync(rsConstantsDir)) {
  fs.mkdirSync(rsConstantsDir, { recursive: true });
}

const rsConstants = `// Auto-generated at build time - DO NOT EDIT MANUALLY
// Values injected from GitHub Actions variables or defaults

pub const REPO_OWNER: &str = "${REPO_OWNER}";
pub const REPO_NAME: &str = "${REPO_NAME}";
pub const REPO_URL: &str = "${REPO_URL}";
pub const ISSUES_URL: &str = "${ISSUES_URL}/new";
pub const API_RELEASES_URL: &str = "${API_URL}/releases/latest";
pub const FEEDBACK_EMAIL: &str = "${FEEDBACK_EMAIL}";
`;

fs.writeFileSync(
  path.join(rsConstantsDir, 'repo.rs'),
  rsConstants
);
console.log('✓ Generated src-tauri/src/constants/repo.rs');

// 6. Create/update mod.rs for constants module
const modRsPath = path.join(rsConstantsDir, 'mod.rs');
const modRsContent = 'pub mod repo;\n';
fs.writeFileSync(modRsPath, modRsContent);

// 7. Add mod declaration to lib.rs if not exists
const libRsPath = path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs');
let libRs = fs.readFileSync(libRsPath, 'utf8');

if (!libRs.includes('mod constants;')) {
  // Add after other mod declarations
  const modInsertPoint = libRs.indexOf('mod commands;');
  if (modInsertPoint !== -1) {
    libRs = libRs.slice(0, modInsertPoint) + 'mod constants;\n' + libRs.slice(modInsertPoint);
    fs.writeFileSync(libRsPath, libRs);
    console.log('✓ Added constants module to lib.rs');
  }
}

console.log('\n✅ Repository info injected successfully!');
console.log(`   Owner: ${REPO_OWNER}`);
console.log(`   Repo: ${REPO_NAME}`);
console.log(`   Issues: ${ISSUES_URL}`);
console.log(`   Updater: ${UPDATER_URL}\n`);
```

### Step 2: Update Source Files to Use Constants

**File: `src-tauri/src/commands/feedback.rs`**

Replace line 75:
```rust
// OLD:
let github_url = "https://github.com/ndokutovich/claude-code-history-viewer/issues/new";

// NEW:
use crate::constants::repo::{ISSUES_URL, FEEDBACK_EMAIL};

#[tauri::command]
pub async fn open_github_issues() -> Result<(), String> {
    tauri_plugin_opener::open_url(ISSUES_URL, None::<String>)
        .map_err(|e| format!("Failed to open GitHub: {}", e))
}
```

Replace line 47-48:
```rust
// OLD:
let feedback_email = std::env::var("FEEDBACK_EMAIL")
    .unwrap_or_else(|_| "feedback@claude-history-viewer.app".to_string());

// NEW:
let feedback_email = std::env::var("FEEDBACK_EMAIL")
    .unwrap_or_else(|_| FEEDBACK_EMAIL.to_string());
```

**File: `src-tauri/src/commands/update.rs`**

Add import at top:
```rust
use crate::constants::repo::API_RELEASES_URL;
```

Replace line 97:
```rust
// OLD:
.get("https://api.github.com/repos/ndokutovich/claude-code-history-viewer/releases/latest")

// NEW:
.get(API_RELEASES_URL)
```

**File: `src/hooks/useGitHubUpdater.ts`**

Add import at top:
```typescript
import { REPO_CONFIG } from '../constants/repo';
```

Replace line 67:
```typescript
// OLD:
"https://api.github.com/repos/ndokutovich/claude-code-history-viewer/releases/latest",

// NEW:
REPO_CONFIG.releasesApiUrl,
```

### Step 3: Update Build Scripts

**File: `package.json`**

Update scripts section:
```json
{
  "scripts": {
    "prebuild": "node scripts/inject-repo-info.cjs",
    "build": "node scripts/run-with-pm.cjs sync-version && tsc -b && vite build",
    "tauri:build": "node scripts/inject-repo-info.cjs && node scripts/run-with-pm.cjs sync-version && tauri build",
    "tauri:build:mac": "node scripts/inject-repo-info.cjs && node scripts/run-with-pm.cjs sync-version && tauri build --target universal-apple-darwin",
    "tauri:build:windows": "node scripts/inject-repo-info.cjs && node scripts/run-with-pm.cjs sync-version && tauri build --target x86_64-pc-windows-msvc",
    "tauri:build:linux": "node scripts/inject-repo-info.cjs && node scripts/run-with-pm.cjs sync-version && tauri build --target x86_64-unknown-linux-gnu",
    "prerelease": "node scripts/inject-repo-info.cjs"
  }
}
```

### Step 4: Update .gitignore

**File: `.gitignore`**

Add:
```gitignore
# Auto-generated constants (regenerated at build time)
# Committed fallback versions exist, but these are overwritten during builds
src/constants/repo.ts
src-tauri/src/constants/
```

### Step 5: Create Fallback Constants (Committed)

These provide defaults for local development without setup.

**File: `src/constants/repo.ts`** (commit this):

```typescript
// Default fallback - will be replaced at build time
// These values work for the original repo without configuration
export const REPO_CONFIG = {
  owner: "ndokutovich",
  repo: "claude-code-history-viewer",
  repoUrl: "https://github.com/ndokutovich/claude-code-history-viewer",
  apiUrl: "https://api.github.com/repos/ndokutovich/claude-code-history-viewer",
  issuesUrl: "https://github.com/ndokutovich/claude-code-history-viewer/issues",
  releasesApiUrl: "https://api.github.com/repos/ndokutovich/claude-code-history-viewer/releases/latest",
  feedbackEmail: "feedback@claude-history-viewer.app",
} as const;
```

**File: `src-tauri/src/constants/mod.rs`** (commit this):

```rust
pub mod repo;
```

**File: `src-tauri/src/constants/repo.rs`** (commit this):

```rust
// Default fallback - will be replaced at build time
// These values work for the original repo without configuration
pub const REPO_OWNER: &str = "ndokutovich";
pub const REPO_NAME: &str = "claude-code-history-viewer";
pub const REPO_URL: &str = "https://github.com/ndokutovich/claude-code-history-viewer";
pub const ISSUES_URL: &str = "https://github.com/ndokutovich/claude-code-history-viewer/issues/new";
pub const API_RELEASES_URL: &str = "https://api.github.com/repos/ndokutovich/claude-code-history-viewer/releases/latest";
pub const FEEDBACK_EMAIL: &str = "feedback@claude-history-viewer.app";
```

### Step 6: Update GitHub Actions Workflow

**File: `.github/workflows/updater-release.yml`**

Add at the top after `on:`:
```yaml
env:
  # Auto-detect from GitHub context, allow override with repository variables
  REPO_OWNER: ${{ vars.REPO_OWNER || github.repository_owner }}
  REPO_NAME: ${{ vars.REPO_NAME || github.event.repository.name }}
  REPO_AUTHOR: ${{ vars.REPO_AUTHOR || 'Repository Contributors' }}
  FEEDBACK_EMAIL: ${{ vars.FEEDBACK_EMAIL || secrets.FEEDBACK_EMAIL || 'noreply@example.com' }}
```

In the `build-tauri` job, add before "Build Tauri app":
```yaml
      - name: Inject repository info
        run: node scripts/inject-repo-info.cjs
        env:
          REPO_OWNER: ${{ env.REPO_OWNER }}
          REPO_NAME: ${{ env.REPO_NAME }}
          REPO_AUTHOR: ${{ env.REPO_AUTHOR }}
          FEEDBACK_EMAIL: ${{ env.FEEDBACK_EMAIL }}
```

In the `generate-updater-metadata` job, update URL generation:
```yaml
      - name: Generate latest.json
        run: |
          cat > latest.json <<EOF
          {
            "version": "${GITHUB_REF#refs/tags/v}",
            "notes": "See release notes at ${{ github.server_url }}/${{ env.REPO_OWNER }}/${{ env.REPO_NAME }}/releases/tag/${GITHUB_REF#refs/tags/}",
            "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
            "platforms": {
              "darwin-universal": {
                "signature": "",
                "url": "${{ github.server_url }}/${{ env.REPO_OWNER }}/${{ env.REPO_NAME }}/releases/download/${GITHUB_REF#refs/tags/}/app-universal.app.tar.gz"
              },
              "linux-x86_64": {
                "signature": "",
                "url": "${{ github.server_url }}/${{ env.REPO_OWNER }}/${{ env.REPO_NAME }}/releases/download/${GITHUB_REF#refs/tags/}/app-amd64.AppImage.tar.gz"
              },
              "windows-x86_64": {
                "signature": "",
                "url": "${{ github.server_url }}/${{ env.REPO_OWNER }}/${{ env.REPO_NAME }}/releases/download/${GITHUB_REF#refs/tags/}/app-x64-setup.nsis.zip"
              }
            }
          }
          EOF
```

---

## Fork Setup Guide

Create **`FORK_SETUP.md`** for users who fork:

```markdown
# Fork Setup Guide

This repository is designed to be **fork-friendly with zero merge conflicts**.

## Quick Setup (5 Minutes)

### 1. Fork the Repository

Click **"Fork"** on GitHub.

### 2. Configure Repository Variables (Optional but Recommended)

Go to: **Settings → Secrets and variables → Actions → Variables**

Click **"New repository variable"** and add:

| Variable Name | Your Value | Example | Required? |
|---------------|------------|---------|-----------|
| `REPO_OWNER` | Your GitHub username | `johndoe` | Auto-detected if not set |
| `REPO_NAME` | Your fork name | `my-claude-viewer` | Auto-detected if not set |
| `REPO_AUTHOR` | Your name | `John Doe` | Optional |
| `FEEDBACK_EMAIL` | Your email | `john@example.com` | Optional |

**Auto-Detection**: If you don't set these, the build will automatically use:
- `REPO_OWNER` = Your GitHub username
- `REPO_NAME` = Your repository name
- `REPO_AUTHOR` = "Repository Contributors"
- `FEEDBACK_EMAIL` = "noreply@example.com"

### 3. Configure Code Signing Secrets (For Releases)

Go to: **Settings → Secrets and variables → Actions → Secrets**

Click **"New repository secret"** and add:

| Secret Name | Description |
|-------------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Your minisign private key content |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the private key |

**Generate signing keys:**

```bash
# macOS
brew install minisign

# Linux
sudo apt install minisign

# Generate key pair
minisign -G

# Copy ~/.minisign/minisign.key content to TAURI_SIGNING_PRIVATE_KEY
# Update tauri.conf.json pubkey with ~/.minisign/minisign.pub content
```

### 4. Done! 🎉

When you push a version tag (e.g., `v1.0.0`), GitHub Actions will:
- ✅ Automatically use your fork's owner/repo
- ✅ Build with your custom configuration
- ✅ Create releases under your fork
- ✅ Update checker points to your releases

**No code changes needed. No merge conflicts ever.**

---

## Local Development

### Default Build (Uses Fallback Values)

```bash
pnpm install
pnpm build  # Uses original repo defaults
```

### Custom Build (Override Values)

**Option 1: Environment Variables**

```bash
export REPO_OWNER=your-username
export REPO_NAME=your-fork
export FEEDBACK_EMAIL=you@example.com

pnpm build
```

**Option 2: Create `.env.local`** (gitignored)

```bash
REPO_OWNER=your-username
REPO_NAME=your-fork
REPO_AUTHOR=Your Name
FEEDBACK_EMAIL=you@example.com
```

Then:
```bash
source .env.local
pnpm build
```

---

## Syncing with Upstream

Stay up to date with the original repository:

```bash
# Add upstream remote (one time)
git remote add upstream https://github.com/ndokutovich/claude-code-history-viewer.git

# Sync with upstream
git fetch upstream
git merge upstream/main

# Push to your fork
git push origin main
```

**No merge conflicts** because all customization is in GitHub variables, not code!

---

## Troubleshooting

### Build fails with "Cannot find module '../constants/repo'"

Run the injection script manually:
```bash
node scripts/inject-repo-info.cjs
```

### Auto-updater not working

1. Check that `REPO_OWNER` and `REPO_NAME` are correct in GitHub variables
2. Verify you've created at least one release with assets
3. Check `tauri.conf.json` has the correct updater endpoint

### Issues/Feedback buttons open wrong repository

The constants are generated at build time. Rebuild your app:
```bash
pnpm tauri:build
```
```

---

## Testing the Implementation

### Before Committing

1. **Test local build**:
   ```bash
   node scripts/inject-repo-info.cjs
   pnpm build
   ```

2. **Verify generated files**:
   - Check `src/constants/repo.ts` has correct values
   - Check `src-tauri/src/constants/repo.rs` has correct values
   - Check `package.json`, `Cargo.toml`, `tauri.conf.json` updated

3. **Test with custom values**:
   ```bash
   REPO_OWNER=testuser REPO_NAME=testfork node scripts/inject-repo-info.cjs
   cat src/constants/repo.ts  # Should show testuser/testfork
   ```

4. **Test fallback**:
   ```bash
   # Don't set env vars
   pnpm build
   # Should use original repo defaults
   ```

### After Deployment

1. **Create test fork**
2. **Set GitHub variables** in fork
3. **Push version tag** to trigger release workflow
4. **Verify**:
   - Release created under fork
   - Assets uploaded to fork
   - `latest.json` has correct fork URLs
   - Updater checks fork for updates

---

## Benefits

✅ **Zero Merge Conflicts** - No committed files need modification
✅ **Auto-Detection** - Uses GitHub context by default
✅ **Override Capable** - Forks can customize via variables
✅ **Works Locally** - Fallback constants work without setup
✅ **CI/CD Ready** - Automatic injection in GitHub Actions
✅ **Single Source** - All URLs derived from owner/repo
✅ **Future-Proof** - New URLs automatically use correct repo

---

## Migration Checklist

- [ ] Create `scripts/inject-repo-info.cjs`
- [ ] Update `src-tauri/src/commands/feedback.rs`
- [ ] Update `src-tauri/src/commands/update.rs`
- [ ] Update `src/hooks/useGitHubUpdater.ts`
- [ ] Update `package.json` scripts
- [ ] Update `.gitignore`
- [ ] Create fallback `src/constants/repo.ts`
- [ ] Create fallback `src-tauri/src/constants/repo.rs`
- [ ] Create fallback `src-tauri/src/constants/mod.rs`
- [ ] Update `src-tauri/src/lib.rs` (add `mod constants;`)
- [ ] Update `.github/workflows/updater-release.yml`
- [ ] Create `FORK_SETUP.md`
- [ ] Test local build
- [ ] Test with environment variables
- [ ] Test GitHub Actions workflow
- [ ] Update main README.md to mention fork-friendly design

---

## Implementation Priority

**Phase 1: Core Infrastructure** (Do First)
1. Create `scripts/inject-repo-info.cjs`
2. Create constants modules
3. Update `.gitignore`
4. Test local builds

**Phase 2: Update Source Files** (Do Second)
1. Update Rust commands
2. Update TypeScript hooks
3. Test application functionality

**Phase 3: CI/CD Integration** (Do Third)
1. Update GitHub Actions workflow
2. Test with version tag
3. Verify fork workflow

**Phase 4: Documentation** (Do Last)
1. Create `FORK_SETUP.md`
2. Update main README
3. Add migration guide to CHANGELOG

---

## Notes

- The `inject-repo-info.cjs` script is **idempotent** - safe to run multiple times
- Fallback constants are committed to git for local development convenience
- Generated files are gitignored but can be committed if preferred
- Environment variables always take precedence over defaults
- GitHub Actions auto-detection works without any variable configuration

---

**Document Version**: 1.0
**Last Updated**: 2025-10-20
**Status**: Ready for Implementation
