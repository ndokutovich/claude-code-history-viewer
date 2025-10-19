# Auto-Update System Documentation

## Overview

Claude Code History Viewer includes an optional auto-update system that allows users to receive automatic updates when new versions are released.

## Current Status

**Auto-updates are DISABLED** (`createUpdaterArtifacts: false`)

This is intentional for development builds to avoid requiring code signing keys.

## What Are Updater Artifacts?

Updater artifacts are special files that enable auto-update functionality:

### 1. Signature Files (`.sig`)
- Cryptographically signed checksums for each installer
- Example: `claude-code-history-viewer_1.0.0-4_x64_en-US.msi.sig`
- Ensures updates are authentic and haven't been tampered with

### 2. Update Manifest (`latest.json`)
- JSON file that describes the latest available version
- Hosted on GitHub releases
- Contains version info, download URLs, and signatures

Example `latest.json`:
```json
{
  "version": "1.0.0-4",
  "date": "2025-01-14T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVk...",
      "url": "https://github.com/ndokutovich/claude-code-history-viewer/releases/download/v1.0.0-4/installer.msi"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../app.dmg"
    }
  }
}
```

## How Auto-Update Works

```
1. App starts or user clicks "Check for Updates"
   ↓
2. App fetches latest.json from GitHub
   ↓
3. Compares current version with latest version
   ↓
4. If newer version found:
   - Shows update notification
   - Downloads installer
   - Verifies signature using public key
   ↓
5. If signature valid:
   - Installs update
   - Restarts app
```

## Security

### Public Key
Located in `tauri.conf.json`:
```json
"pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDg0RUExOEVGNTlEQzFDRDMKUldUVEhOeFo3eGpxaEZGYkZYcmFKTERPdys5dXh2c1Z5ZU1uTDREZ3RyWDF1bHhSc1JOeW05MzUK"
```

This public key verifies that updates are signed by the developer.

### Private Key
- **NOT** stored in the repository (security risk!)
- Required to sign updates
- Set as environment variable: `TAURI_SIGNING_PRIVATE_KEY`

## Configuration

### Current Settings (`src-tauri/tauri.conf.json`)

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/ndokutovich/claude-code-history-viewer/releases/latest/download/latest.json"
      ],
      "dialog": false,
      "pubkey": "..."
    }
  },
  "bundle": {
    "createUpdaterArtifacts": false  // ← Currently disabled
  }
}
```

- `active: true` - Updater plugin is enabled
- `dialog: false` - Custom UI instead of native dialog
- `createUpdaterArtifacts: false` - Don't generate `.sig` files during build

## Enabling Auto-Updates

### Step 1: Generate Signing Keys

```bash
pnpm tauri signer generate
```

This outputs:
- **Private key** (keep secret!)
- **Public key** (already in tauri.conf.json)

### Step 2: Set Environment Variable

**Windows PowerShell:**
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "your-private-key-here"
```

**Windows CMD:**
```cmd
set TAURI_SIGNING_PRIVATE_KEY=your-private-key-here
```

**Linux/macOS:**
```bash
export TAURI_SIGNING_PRIVATE_KEY="your-private-key-here"
```

### Step 3: Enable in Configuration

Edit `src-tauri/tauri.conf.json`:
```json
"createUpdaterArtifacts": true
```

### Step 4: Build

```bash
pnpm tauri:build
```

This will now generate:
- Installers (`.msi`, `.exe`, `.dmg`, etc.)
- Signature files (`.sig`)
- Update manifest (`latest.json`)

### Step 5: Upload to GitHub Releases

1. Create a new release on GitHub
2. Upload all files from `src-tauri/target/release/bundle/`
3. Users will automatically receive update notifications

## Version Format

### Windows MSI Requirement

Windows MSI installers require numeric-only pre-release identifiers:

✅ **Correct:**
- `1.0.0` (release version)
- `1.0.0-4` (pre-release with numeric identifier)
- `2.1.3-15` (valid)

❌ **Incorrect:**
- `1.0.0-beta.4` (text not allowed)
- `1.0.0-alpha.1` (text not allowed)
- `1.0.0-rc.2` (text not allowed)

### Current Version

```
1.0.0-4
```

This uses a numeric-only pre-release identifier that's compatible with all platforms.

## Troubleshooting

### Error: "A public key has been found, but no private key"

**Cause:** `createUpdaterArtifacts: true` but no private key set

**Solution:** Either:
1. Set `TAURI_SIGNING_PRIVATE_KEY` environment variable
2. Disable updater artifacts: `createUpdaterArtifacts: false`

### Error: "optional pre-release identifier must be numeric-only"

**Cause:** Version like `1.0.0-beta.4` with text

**Solution:** Change to numeric format like `1.0.0-4`

### Updates Not Working

**Check:**
1. Is `active: true` in updater config?
2. Is `latest.json` accessible at the endpoint URL?
3. Is the signature valid?
4. Is the app version older than the latest version?

## For Development

During development, it's recommended to keep `createUpdaterArtifacts: false` to avoid:
- Needing to set up signing keys
- Build failures due to missing keys
- Unnecessary artifact generation

Users can still manually download and install new versions.

## References

- [Tauri Updater Plugin Docs](https://tauri.app/v2/plugin/updater/)
- [GitHub Releases](https://github.com/ndokutovich/claude-code-history-viewer/releases)
- [UPDATER_ANALYSIS_REPORT.md](../UPDATER_ANALYSIS_REPORT.md) - Detailed analysis of the updater system
