---
id: F-macos-release-build-pipeline
title: macOS Release Build Pipeline
status: done
priority: high
parent: none
prerequisites: []
affectedFiles:
  src/entitlements.plist: "Created new macOS entitlements file with required
    permissions: allow-jit, allow-unsigned-executable-memory,
    disable-library-validation, and device.audio-input"
  forge.config.ts: Added osxSign configuration with identity from APPLE_IDENTITY
    env var and entitlements via optionsForFile. Added osxNotarize configuration
    that requires all three env vars (APPLE_ID, APPLE_ID_PASSWORD,
    APPLE_TEAM_ID) to be present before activating
  .github/workflows/release.yml: Created new GitHub Actions workflow for macOS
    release builds with code signing, notarization, and GitHub Release creation
  docs/release-setup.md: Created comprehensive release setup documentation
    covering prerequisites, certificate export, base64 encoding, app-specific
    passwords, Team ID, signing identity, GitHub secrets configuration, release
    workflow instructions, local builds, and troubleshooting
log:
  - "Auto-completed: All child tasks are complete"
schema: v1.0
childrenIds:
  - T-add-code-signing-and
  - T-create-github-actions-release
  - T-create-release-setup
created: 2026-02-01T17:08:44.563Z
updated: 2026-02-01T17:08:44.563Z
---

# macOS Release Build Pipeline

Enable building signed, notarized macOS DMG releases that can be distributed and installed without Gatekeeper warnings.

## Context

The SmartHole MVP is functional but cannot be installed as a proper macOS application. Running in dev mode doesn't allow global shortcuts to work reliably because macOS requires accessibility permissions to be granted to a signed application bundle. Users need to install the app to get proper accessibility permissions for the hotkey system to function.

## Scope

- **Architecture**: Apple Silicon (arm64) only
- **Distribution**: Manual GitHub Releases with DMG attachment
- **Trigger**: Manual workflow dispatch from tags on main branch

## Requirements

### 1. Code Signing Configuration

Update `forge.config.ts` to include macOS code signing:

- Configure `osxSign` in `packagerConfig` with signing identity from environment
- Sign with Developer ID Application certificate
- Environment variables for local builds: `APPLE_IDENTITY` (signing identity name)
- Environment variables for CI: `APPLE_CERTIFICATE_BASE64`, `APPLE_CERTIFICATE_PASSWORD`

### 2. Notarization Configuration

Add notarization hook to `forge.config.ts`:

- Use `@electron/notarize` (already available as transitive dependency)
- Configure `osxNotarize` in `packagerConfig`
- Environment variables: `APPLE_ID`, `APPLE_ID_PASSWORD` (app-specific password), `APPLE_TEAM_ID`
- Notarization should be skipped when credentials are not present (for local dev builds)

### 3. Entitlements File

Create `src/entitlements.plist` with required capabilities:

- `com.apple.security.cs.allow-jit` - Required for Electron/V8
- `com.apple.security.cs.allow-unsigned-executable-memory` - Required for native modules (uiohook-napi, keytar)
- `com.apple.security.device.audio-input` - Required for voice recording feature
- `com.apple.security.cs.disable-library-validation` - Required for loading native modules

Reference entitlements in `forge.config.ts` `osxSign` configuration.

### 4. GitHub Actions Release Workflow

Create `.github/workflows/release.yml`:

- **Trigger**: `workflow_dispatch` only (manual trigger from GitHub UI)
- **Runs on**: `macos-latest` (Apple Silicon)
- **Steps**:
  1. Checkout code
  2. Verify running on a tag (fail if not)
  3. Setup mise
  4. Install dependencies (`npm ci`)
  5. Import certificate from base64 secret into temporary keychain
  6. Run `mise run build` with signing/notarization environment variables
  7. Create GitHub Release using the tag name
  8. Upload DMG artifact to the release
  9. Clean up keychain

- **Required Secrets**:
  - `APPLE_CERTIFICATE_BASE64` - Base64-encoded .p12 certificate
  - `APPLE_CERTIFICATE_PASSWORD` - Password for the .p12 file
  - `APPLE_ID` - Apple Developer account email
  - `APPLE_ID_PASSWORD` - App-specific password (NOT account password)
  - `APPLE_TEAM_ID` - 10-character Team ID from Apple Developer account

### 5. Documentation

Create `docs/release-setup.md` with:

- How to export Developer ID Application certificate as .p12 from Keychain Access
  - Open Keychain Access
  - Find "Developer ID Application: [Your Name]" certificate
  - Right-click → Export
  - Choose .p12 format, set a strong password
- How to base64 encode the certificate: `base64 -i certificate.p12 | pbcopy`
- How to generate app-specific password at appleid.apple.com
- How to find Team ID in Apple Developer account (Membership details)
- How to configure GitHub repository secrets
- How to trigger the release workflow (create tag, go to Actions, select workflow, run)

## Acceptance Criteria

1. Running `mise run build` locally with proper environment variables produces a signed, notarized DMG
2. The GitHub Actions workflow can be manually triggered on a tagged commit
3. The workflow creates a GitHub Release with the DMG attached
4. The DMG can be downloaded and installed on a fresh Mac without Gatekeeper warnings ("cannot be opened because the developer cannot be verified")
5. After installation, global hotkeys work after granting accessibility permissions in System Preferences
6. After installation, voice recording works after granting microphone permissions
7. Building without credentials (normal dev workflow) still works and produces unsigned builds

## Technical Notes

- The signing packages (`@electron/osx-sign`, `@electron/notarize`) are already available as transitive dependencies of `@electron-forge/maker-dmg`
- Native modules (`keytar`, `uiohook-napi`) will be signed as part of the app bundle
- The FusesPlugin security settings in forge.config.ts are already configured appropriately

## Out of Scope

- Windows builds (future work)
- Intel Mac support (future work)
- Auto-update mechanism (future work)
- Custom DMG appearance (icon, background image)
