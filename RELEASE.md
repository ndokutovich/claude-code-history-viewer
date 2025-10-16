# Release Process

This document describes how to create a new release for Claude Code History Viewer.

## Quick Release

To create a new release, simply run:

```bash
pnpm release <version>
```

Example:
```bash
pnpm release 1.0.6
```

## What the Release Script Does

The `pnpm release` command automatically:

1. ✅ **Updates version** in all necessary files:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. ✅ **Creates Git commit** with message: `chore: bump version to X.X.X`

3. ✅ **Creates Git tag**: `vX.X.X`

4. ✅ **Shows push instructions** for main branch and tag

## Step-by-Step Release Guide

### 1. Ensure Clean Working Directory

```bash
git status
```

Make sure all changes are committed before creating a release.

### 2. Run Release Script

```bash
pnpm release 1.0.6
```

The script validates:
- Version format (must be semver: `major.minor.patch`)
- File existence
- Git operations

### 3. Push to Remote

After the script completes, push the changes:

```bash
git push origin main
git push origin v1.0.6
```

### 4. Build Release Artifacts

Build the application for distribution:

```bash
# For current platform
pnpm tauri:build

# For specific platforms
pnpm tauri:build:windows   # Windows (x86_64)
pnpm tauri:build:mac        # macOS (Universal binary)
pnpm tauri:build:linux      # Linux (x86_64)
```

Release artifacts will be in: `src-tauri/target/release/bundle/`

### 5. Create GitHub Release

1. Go to: https://github.com/ndokutovich/claude-code-history-viewer/releases
2. Click "Draft a new release"
3. Select the tag you just pushed (e.g., `v1.0.6`)
4. Fill in the release notes
5. Upload the build artifacts from `src-tauri/target/release/bundle/`
6. Publish the release

## Release Script Options

### Skip Git Operations

If you want to update versions without creating a commit/tag:

```bash
pnpm release 1.0.6 --no-git
```

This is useful for:
- Testing the release process
- Manual version updates
- CI/CD pipelines that handle git operations separately

## Version Format

The version **must** follow [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backwards-compatible)
- **PATCH**: Bug fixes (backwards-compatible)

Examples:
- ✅ `1.0.5` - Valid
- ✅ `2.1.0` - Valid
- ✅ `0.1.0` - Valid
- ❌ `1.0` - Invalid (missing patch)
- ❌ `v1.0.5` - Invalid (no 'v' prefix)
- ❌ `1.0.5-beta` - Invalid (prerelease not supported yet)

## Troubleshooting

### "Version format is invalid"

Make sure you're using the correct format: `MAJOR.MINOR.PATCH`

```bash
# ❌ Wrong
pnpm release v1.0.5
pnpm release 1.0.5-beta

# ✅ Correct
pnpm release 1.0.5
```

### "You have uncommitted changes"

The script will warn you but continue. Commit your changes first for a clean release:

```bash
git add .
git commit -m "your changes"
pnpm release 1.0.5
```

### Push failed with SSH error

Make sure your SSH key is set up correctly:

```bash
# Test SSH connection
ssh -T git@github.com

# If needed, switch to HTTPS
git remote set-url origin https://github.com/ndokutovich/claude-code-history-viewer.git
```

## Related Scripts

- `pnpm sync-version` - Manually sync version from package.json to Cargo.toml
- `pnpm build` - Build frontend only
- `pnpm tauri:build` - Build full application with installers

## Release Checklist

Before releasing:

- [ ] All tests pass (`pnpm test:all`)
- [ ] Build works (`pnpm build`)
- [ ] Tauri build works (`pnpm tauri:build`)
- [ ] CHANGELOG.md is updated (if exists)
- [ ] All features are documented
- [ ] No critical bugs

After releasing:

- [ ] GitHub release created with artifacts
- [ ] Release notes published
- [ ] Social media announcements (if applicable)
- [ ] Documentation updated (if needed)
