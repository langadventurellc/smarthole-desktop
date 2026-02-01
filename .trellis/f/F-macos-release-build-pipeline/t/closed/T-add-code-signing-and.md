---
id: T-add-code-signing-and
title: Add code signing and notarization to forge config
status: done
priority: high
parent: F-macos-release-build-pipeline
prerequisites: []
affectedFiles:
  src/entitlements.plist: "Created new macOS entitlements file with required
    permissions: allow-jit, allow-unsigned-executable-memory,
    disable-library-validation, and device.audio-input"
  forge.config.ts: Added osxSign configuration with identity from APPLE_IDENTITY
    env var and entitlements via optionsForFile. Added osxNotarize configuration
    that requires all three env vars (APPLE_ID, APPLE_ID_PASSWORD,
    APPLE_TEAM_ID) to be present before activating
log:
  - Added macOS code signing and notarization configuration to Electron Forge.
    Created entitlements.plist with required permissions (JIT, unsigned memory,
    library validation disabled, audio input). Updated forge.config.ts to
    configure osxSign with identity from APPLE_IDENTITY env var and entitlements
    via optionsForFile callback. Added osxNotarize configuration that activates
    when APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID are all present. Without
    credentials, signing and notarization are skipped, preserving the existing
    dev workflow.
schema: v1.0
childrenIds: []
created: 2026-02-01T17:21:21.872Z
updated: 2026-02-01T17:21:21.872Z
---

# Add Code Signing and Notarization to Forge Config

Configure Electron Forge to sign and notarize macOS builds.

## Changes Required

### 1. Create Entitlements File

Create `src/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
</dict>
</plist>
```

### 2. Update forge.config.ts

Add to `packagerConfig`:

```typescript
packagerConfig: {
  asar: true,
  name: "SmartHole",
  osxSign: {
    identity: process.env.APPLE_IDENTITY,
    entitlements: "src/entitlements.plist",
    entitlementsInherit: "src/entitlements.plist",
  },
  osxNotarize: process.env.APPLE_ID ? {
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  } : undefined,
}
```

### Environment Variables

**For local signed builds:**

- `APPLE_IDENTITY` - Signing identity (e.g., "Developer ID Application: Your Name (TEAMID)")
- `APPLE_ID` - Apple Developer account email
- `APPLE_ID_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - 10-character Team ID

**For CI (additional):**

- `APPLE_CERTIFICATE_BASE64` - Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` - Password for .p12 file

### Behavior

- When `APPLE_IDENTITY` is not set, signing is skipped (dev builds work as before)
- When `APPLE_ID` is not set, notarization is skipped
- Both signing and notarization happen automatically when credentials are present

## Acceptance Criteria

1. `mise run build` without env vars produces unsigned DMG (current behavior preserved)
2. `mise run build` with `APPLE_IDENTITY` produces signed DMG
3. `mise run build` with all credentials produces signed and notarized DMG
4. Entitlements file grants required permissions (JIT, unsigned memory, audio input, library loading)

## Testing

After implementation, test locally:

1. Run `mise run build` - should produce unsigned DMG without errors
2. With credentials set, run build and verify signing with: `codesign -dv --verbose=4 out/SmartHole-darwin-arm64/SmartHole.app`
