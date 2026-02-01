---
id: T-create-release-setup
title: Create release setup documentation
status: open
priority: medium
parent: F-macos-release-build-pipeline
prerequisites:
  - T-add-code-signing-and
  - T-create-github-actions-release
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T17:22:04.584Z
updated: 2026-02-01T17:22:04.584Z
---

# Create Release Setup Documentation

Document the process for setting up code signing credentials and using the release workflow.

## Create `docs/release-setup.md`

The document should include these sections:

### 1. Prerequisites

- Active Apple Developer Program membership ($99/year)
- Developer ID Application certificate (not just development certificate)
- Access to GitHub repository settings

### 2. Export Developer ID Certificate

Step-by-step instructions:

1. Open **Keychain Access** on your Mac
2. Select **login** keychain in the sidebar
3. Select **My Certificates** category
4. Find **"Developer ID Application: [Your Name] ([Team ID])"**
   - If you don't see this certificate, you need to create one in Apple Developer portal
5. Right-click the certificate → **Export**
6. Choose format: **Personal Information Exchange (.p12)**
7. Save the file and set a strong password
8. **Important**: Keep this password - you'll need it for GitHub secrets

### 3. Base64 Encode the Certificate

```bash
base64 -i /path/to/certificate.p12 | pbcopy
```

This copies the base64-encoded certificate to your clipboard.

### 4. Generate App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to **Sign-In and Security** → **App-Specific Passwords**
4. Click **Generate** and name it "SmartHole CI"
5. Copy the generated password (format: xxxx-xxxx-xxxx-xxxx)

### 5. Find Your Team ID

1. Go to [developer.apple.com](https://developer.apple.com)
2. Sign in and go to **Account**
3. Click **Membership details** in the sidebar
4. Your **Team ID** is the 10-character alphanumeric code

### 6. Find Your Signing Identity

Run this command to see your available signing identities:

```bash
security find-identity -v -p codesigning
```

Look for the line with "Developer ID Application" - the full identity string is what you need.

### 7. Configure GitHub Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets:

| Secret Name                  | Value                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `APPLE_IDENTITY`             | Full signing identity (e.g., "Developer ID Application: John Doe (ABC123XYZ)") |
| `APPLE_CERTIFICATE_BASE64`   | Base64-encoded .p12 content (from step 3)                                      |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting .p12                                           |
| `APPLE_ID`                   | Your Apple Developer account email                                             |
| `APPLE_ID_PASSWORD`          | App-specific password (from step 4)                                            |
| `APPLE_TEAM_ID`              | 10-character Team ID (from step 5)                                             |

### 8. Creating a Release

1. **Create and push a tag:**

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Run the release workflow:**
   - Go to repository → **Actions** → **Release**
   - Click **Run workflow**
   - Select the branch/tag with your release
   - Click **Run workflow**

3. **Monitor the build** - it will:
   - Build the app
   - Sign with your Developer ID certificate
   - Notarize with Apple
   - Create a GitHub Release with the DMG attached

### 9. Local Signed Builds (Optional)

To build signed releases locally:

```bash
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

mise run build
```

### 10. Troubleshooting

**"No identity found"**: Run `security find-identity -v -p codesigning` to verify your certificate is installed.

**Notarization fails**: Ensure your app-specific password is correct and your Apple ID has accepted the latest developer agreements.

**"Cannot be opened because the developer cannot be verified"**: The app wasn't properly signed or notarized. Check the build logs.

## Acceptance Criteria

1. Documentation covers all steps needed to go from zero to working release
2. All commands are copy-pasteable
3. Includes troubleshooting for common issues
4. Links to official Apple documentation where appropriate

## Testing

Have someone unfamiliar with the process follow the documentation and verify they can:

1. Export their certificate
2. Configure GitHub secrets
3. Successfully trigger a release
