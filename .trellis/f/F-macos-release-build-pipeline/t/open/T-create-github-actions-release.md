---
id: T-create-github-actions-release
title: Create GitHub Actions release workflow
status: open
priority: high
parent: F-macos-release-build-pipeline
prerequisites:
  - T-add-code-signing-and
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T17:21:42.487Z
updated: 2026-02-01T17:21:42.487Z
---

# Create GitHub Actions Release Workflow

Create a manually-triggered GitHub Actions workflow that builds signed, notarized DMGs and creates GitHub Releases.

## Create `.github/workflows/release.yml`

```yaml
name: Release

on:
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Verify tag
        run: |
          if [[ ! $(git describe --exact-match --tags HEAD 2>/dev/null) ]]; then
            echo "Error: This workflow must be run on a tagged commit"
            echo "Create a tag first: git tag v1.0.0 && git push origin v1.0.0"
            exit 1
          fi

      - name: Get version from tag
        id: version
        run: echo "VERSION=$(git describe --exact-match --tags HEAD)" >> $GITHUB_OUTPUT

      - name: Setup mise
        uses: jdx/mise-action@v2

      - name: Install dependencies
        run: npm ci

      - name: Import certificate
        env:
          APPLE_CERTIFICATE_BASE64: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          # Create temporary keychain
          KEYCHAIN_PATH=$RUNNER_TEMP/build.keychain
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)

          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

          # Import certificate
          echo "$APPLE_CERTIFICATE_BASE64" | base64 --decode > $RUNNER_TEMP/certificate.p12
          security import $RUNNER_TEMP/certificate.p12 -P "$APPLE_CERTIFICATE_PASSWORD" \
            -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"

          # Set key partition list
          security set-key-partition-list -S apple-tool:,apple:,codesign: \
            -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

          # Add to search list
          security list-keychain -d user -s "$KEYCHAIN_PATH" login.keychain

      - name: Build and notarize
        env:
          APPLE_IDENTITY: ${{ secrets.APPLE_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: mise run build

      - name: Find DMG
        id: dmg
        run: |
          DMG_PATH=$(find out/make -name "*.dmg" | head -1)
          echo "DMG_PATH=$DMG_PATH" >> $GITHUB_OUTPUT
          echo "DMG_NAME=$(basename $DMG_PATH)" >> $GITHUB_OUTPUT

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.VERSION }}
          name: SmartHole ${{ steps.version.outputs.VERSION }}
          draft: false
          prerelease: false
          files: ${{ steps.dmg.outputs.DMG_PATH }}
          generate_release_notes: true

      - name: Cleanup keychain
        if: always()
        run: security delete-keychain $RUNNER_TEMP/build.keychain || true
```

## Required GitHub Secrets

The following secrets must be configured in the repository settings:

| Secret                       | Description                                                             |
| ---------------------------- | ----------------------------------------------------------------------- |
| `APPLE_IDENTITY`             | Signing identity name (e.g., "Developer ID Application: Name (TEAMID)") |
| `APPLE_CERTIFICATE_BASE64`   | Base64-encoded .p12 certificate                                         |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file                                              |
| `APPLE_ID`                   | Apple Developer account email                                           |
| `APPLE_ID_PASSWORD`          | App-specific password from appleid.apple.com                            |
| `APPLE_TEAM_ID`              | 10-character Team ID                                                    |

## Workflow Behavior

1. **Manual trigger only** - Must be run via GitHub Actions UI
2. **Tag required** - Fails if not run on a tagged commit
3. **Creates keychain** - Imports certificate into temporary keychain
4. **Builds signed DMG** - Uses mise run build with signing credentials
5. **Creates release** - Publishes GitHub Release with DMG attached
6. **Cleanup** - Deletes temporary keychain even on failure

## Acceptance Criteria

1. Workflow file is valid YAML and passes GitHub Actions syntax validation
2. Workflow fails gracefully if run on non-tagged commit with clear error message
3. Workflow creates GitHub Release with DMG attached when run on tag
4. Keychain is cleaned up even if build fails

## Testing

After secrets are configured:

1. Create and push a tag: `git tag v0.1.0 && git push origin v0.1.0`
2. Go to Actions → Release → Run workflow
3. Select the tagged commit
4. Verify release is created with DMG attached
