# GitHub Actions Setup Guide

This guide will walk you through the manual steps required to set up GitHub Actions for automated building and releasing of the Claude Code History Viewer application across all platforms (Windows, macOS, Linux).

## Overview

The GitHub Actions workflow (`.github/workflows/updater-release.yml`) is configured to:
- Build the application for Windows, macOS, and Linux
- Generate signed installers with Tauri's updater support
- Create GitHub releases automatically when you push a version tag
- Generate updater metadata (`latest.json`) for automatic updates

## Prerequisites

Before the workflow can run successfully, you need to configure several secrets and generate signing keys.

---

## 🔐 Required Secrets (Mandatory)

### 1. Generate Tauri Signing Keys

Tauri uses a key pair to sign updates and verify their authenticity. You must generate this locally and add it to GitHub Secrets.

**Steps:**

1. **Install Tauri CLI** (if not already installed):
   ```bash
   pnpm install -g @tauri-apps/cli
   ```

2. **Generate a new signing key pair**:
   ```bash
   pnpm tauri signer generate
   ```

   This command will output:
   ```
   Public key: dW50cnVzdGVkIGNvbW1lbnQ6...
   Private key: dW50cnVzdGVkIGNvbW1lbnQ6...
   Password: <your-password>
   ```

3. **Save these values securely**:
   - Copy the **private key** (entire string)
   - Copy the **password** you set
   - Copy the **public key** (entire string)

4. **Update `src-tauri/tauri.conf.json`**:

   Replace the existing `pubkey` value with your newly generated **public key**:

   ```json
   "updater": {
     "active": true,
     "endpoints": [
       "https://github.com/ndokutovich/claude-code-history-viewer/releases/latest/download/latest.json"
     ],
     "dialog": false,
     "pubkey": "YOUR_NEW_PUBLIC_KEY_HERE"
   }
   ```

5. **Add to GitHub Secrets**:

   Go to your repository on GitHub:
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**

   Add these two secrets:

   | Secret Name | Value |
   |-------------|-------|
   | `TAURI_SIGNING_PRIVATE_KEY` | The entire private key string |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you set |

---

## 🍎 Optional: macOS Code Signing (Recommended for Distribution)

If you plan to distribute your application on macOS, you should sign and notarize it. This requires an **Apple Developer account** ($99/year).

### Why Sign on macOS?

- Unsigned apps show a scary warning to users
- macOS Gatekeeper may block unsigned apps
- Notarization allows your app to run on macOS 10.15+ without warnings

### Steps:

1. **Join the Apple Developer Program**:
   - Sign up at https://developer.apple.com/programs/

2. **Create a Developer Certificate**:
   - Open Xcode → Preferences → Accounts
   - Add your Apple ID
   - Manage Certificates → Create a "Developer ID Application" certificate
   - Export the certificate as a `.p12` file with a password

3. **Convert Certificate to Base64**:
   ```bash
   base64 -i YourCertificate.p12 | pbcopy
   ```

4. **Generate App-Specific Password**:
   - Go to https://appleid.apple.com/account/manage
   - Sign in with your Apple ID
   - Under "App-Specific Passwords", generate a new password
   - Save this password securely

5. **Find Your Team ID**:
   - Go to https://developer.apple.com/account
   - Your Team ID is shown in the top right corner

6. **Add to GitHub Secrets**:

   | Secret Name | Value |
   |-------------|-------|
   | `APPLE_CERTIFICATE` | Base64-encoded certificate (from step 3) |
   | `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` file |
   | `APPLE_SIGNING_IDENTITY` | Name of your certificate (e.g., "Developer ID Application: Your Name (TEAM_ID)") |
   | `APPLE_ID` | Your Apple ID email |
   | `APPLE_PASSWORD` | App-specific password (from step 4) |
   | `APPLE_TEAM_ID` | Your Apple Team ID (from step 5) |

> **Note:** If you skip macOS signing, the workflow will still run but macOS builds won't be signed. Users will need to bypass Gatekeeper manually.

---

## 🪟 Optional: Windows Code Signing

For Windows, code signing is optional but recommended for professional distribution.

### Why Sign on Windows?

- Windows SmartScreen may block unsigned executables
- Signed apps appear more trustworthy to users

### Requirements:

- A valid **Code Signing Certificate** from a Certificate Authority (CA) like DigiCert, Sectigo, etc.
- Cost: ~$100-400/year depending on the CA

### Steps:

1. **Purchase a Code Signing Certificate**:
   - Buy from a trusted CA (DigiCert, Sectigo, etc.)
   - Complete identity verification process
   - Receive your certificate file (`.pfx` or `.p12`)

2. **Extract Certificate Thumbprint**:
   ```powershell
   # On Windows PowerShell
   $cert = Get-PfxCertificate -FilePath "YourCertificate.pfx"
   $cert.Thumbprint
   ```

3. **Add to GitHub Secrets**:

   | Secret Name | Value |
   |-------------|-------|
   | `WINDOWS_CERTIFICATE` | Base64-encoded certificate |
   | `WINDOWS_CERTIFICATE_PASSWORD` | Certificate password |

4. **Update workflow file** (`.github/workflows/updater-release.yml`):

   Add these environment variables to the `tauri-action` step:
   ```yaml
   WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
   WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
   ```

> **Note:** If you skip Windows signing, the workflow will still run but Windows builds won't be signed.

---

## 🚀 How to Trigger a Release

Once all secrets are configured, you can trigger a release by pushing a version tag:

1. **Update version in `src-tauri/tauri.conf.json`**:
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. **Commit and push**:
   ```bash
   git add src-tauri/tauri.conf.json
   git commit -m "chore: bump version to 1.0.1"
   git push origin main
   ```

3. **Create and push a tag**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. **Monitor the workflow**:
   - Go to **Actions** tab on GitHub
   - Watch the "Release with Updater Metadata" workflow run
   - When complete, check the **Releases** page for your new release

---

## 📦 What Gets Built

When the workflow completes successfully, you'll have installers for:

### macOS
- `*.dmg` - Disk image installer
- `*.dmg.sig` - Signature file for auto-updates
- `*.app.tar.gz` - Application bundle (archived)

### Windows
- `*.msi` - Windows Installer package
- `*.msi.sig` - Signature file for auto-updates
- `*.exe` - NSIS installer

### Linux
- `*.AppImage` - Universal Linux executable
- `*.AppImage.sig` - Signature file for auto-updates
- `*.deb` - Debian/Ubuntu package
- `*.rpm` - Fedora/RHEL package (if rpmbuild available)

### Updater
- `latest.json` - Metadata file for Tauri's auto-updater

---

## 🔍 Verification Checklist

Before your first release, verify:

- ✅ Git remote is set to your fork: `git@github.com:ndokutovich/claude-code-history-viewer.git`
- ✅ `tauri.conf.json` has your repository URL
- ✅ `tauri.conf.json` has `createUpdaterArtifacts: true`
- ✅ `tauri.conf.json` has your new **public key**
- ✅ `TAURI_SIGNING_PRIVATE_KEY` secret is set in GitHub
- ✅ `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret is set in GitHub
- ✅ (Optional) macOS secrets are configured if you want signed macOS builds
- ✅ (Optional) Windows secrets are configured if you want signed Windows builds

---

## 🐛 Troubleshooting

### Re-running Failed Workflows

The workflow is now **idempotent** - you can safely re-run it multiple times for the same tag. It will:
- Detect if a release already exists for that tag
- Use the existing release instead of trying to create a duplicate
- Upload new build artifacts to the existing release

**To re-run a workflow:**
1. Go to **Actions** tab on GitHub
2. Click on the failed workflow run
3. Click **Re-run all jobs** or **Re-run failed jobs**

**To trigger a new build for an existing tag:**
```bash
# Delete the remote tag (be careful!)
git push origin --delete v1.0.1

# Delete the local tag
git tag -d v1.0.1

# Create and push the tag again
git tag v1.0.1
git push origin v1.0.1
```

### Workflow fails with "signature not found"
- Make sure `createUpdaterArtifacts: true` in `tauri.conf.json`
- Verify your Tauri signing keys are correctly set in GitHub Secrets

### Workflow fails with "already_exists" error
- This should no longer happen with the updated workflow
- The workflow now checks if a release exists before creating it
- If you still see this error, try re-running the workflow

### macOS build fails
- Ensure you have all Apple secrets configured
- Check that your Apple Developer account is active
- Verify certificate hasn't expired

### Windows build fails
- Check that WebView2 dependencies are available
- Ensure Windows runner has necessary build tools

### Linux build fails
- Verify all Linux dependencies are installed in the workflow
- Check `libwebkit2gtk-4.1-dev` is available

### Build succeeds but updater doesn't work
- Verify the public key in `tauri.conf.json` matches your private key
- Check that `.sig` files are being uploaded to the release
- Ensure `latest.json` exists in the release assets
- Verify the updater endpoint URL is correct

---

## 🔗 Useful Links

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Tauri Updater Guide](https://tauri.app/v1/guides/distribution/updater)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [Code Signing for Windows](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)

---

## 📝 Summary

**Minimum Required Steps:**
1. Generate Tauri signing keys
2. Update public key in `tauri.conf.json`
3. Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to GitHub Secrets
4. Push a version tag to trigger the workflow

**Optional (but recommended for production):**
- Configure macOS code signing for professional distribution
- Configure Windows code signing for professional distribution

Once configured, every tagged version will automatically build and release installers for all platforms! 🎉
