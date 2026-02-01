# Release Setup

Guide for setting up macOS code signing credentials and creating releases via GitHub Actions.

## Prerequisites

Before you begin, ensure you have:

- **Active Apple Developer Program membership** ($99/year) - [developer.apple.com/programs](https://developer.apple.com/programs)
- **Developer ID Application certificate** (not just a development certificate)
- **Admin access to the GitHub repository** (for configuring secrets)

## Export Developer ID Certificate

Export your signing certificate as a `.p12` file for use in CI:

1. Open **Keychain Access** on your Mac (Applications > Utilities > Keychain Access)
2. Select **login** keychain in the sidebar
3. Select **My Certificates** category
4. Find **"Developer ID Application: [Your Name] ([Team ID])"**
   - If you don't see this certificate, create one at [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates)
   - Choose "Developer ID Application" when creating a new certificate
5. Right-click the certificate and select **Export**
6. Choose format: **Personal Information Exchange (.p12)**
7. Save the file and set a strong password
8. **Keep this password** - you'll need it for the `APPLE_CERTIFICATE_PASSWORD` secret

## Base64 Encode the Certificate

The certificate must be base64-encoded for storage as a GitHub secret:

```bash
base64 -i /path/to/certificate.p12 | pbcopy
```

This copies the base64-encoded certificate directly to your clipboard, ready to paste into GitHub.

## Generate App-Specific Password

Apple notarization requires an app-specific password (not your regular Apple ID password):

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **Sign-In and Security** > **App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Enter a label (e.g., "SmartHole CI")
6. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

This password is used for the `APPLE_ID_PASSWORD` secret.

## Find Your Team ID

Your Team ID is a 10-character alphanumeric identifier:

1. Go to [developer.apple.com](https://developer.apple.com)
2. Sign in and navigate to **Account**
3. Click **Membership details** in the sidebar
4. Your **Team ID** is displayed on this page (e.g., `ABC123XYZ9`)

## Find Your Signing Identity

To get the exact signing identity string for your certificate:

```bash
security find-identity -v -p codesigning
```

Output looks like:

```
  1) A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0 "Developer ID Application: John Doe (ABC123XYZ)"
     1 valid identities found
```

The full quoted string (including `Developer ID Application:`) is your signing identity.

## Configure GitHub Secrets

Add the following secrets to your repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** for each:

| Secret Name                  | Value                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `APPLE_IDENTITY`             | Full signing identity (e.g., `Developer ID Application: John Doe (ABC123XYZ)`)            |
| `APPLE_CERTIFICATE_BASE64`   | Base64-encoded `.p12` content (from "Base64 Encode the Certificate" step)                 |
| `APPLE_CERTIFICATE_PASSWORD` | Password you set when exporting the `.p12` file                                           |
| `APPLE_ID`                   | Your Apple Developer account email address                                                |
| `APPLE_ID_PASSWORD`          | App-specific password from appleid.apple.com (from "Generate App-Specific Password" step) |
| `APPLE_TEAM_ID`              | 10-character Team ID (from "Find Your Team ID" step)                                      |

## Creating a Release

### 1. Create and Push a Tag

Releases are tied to git tags. Create a semantic version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 2. Run the Release Workflow

1. Go to your repository on GitHub
2. Navigate to **Actions** > **Release** workflow
3. Click **Run workflow**
4. Select the branch that contains your tag (usually `main`)
5. Click **Run workflow**

### 3. Monitor the Build

The workflow will:

1. Verify it's running on a tagged commit
2. Install dependencies
3. Import your certificate into a temporary keychain
4. Build the application with code signing
5. Notarize the app with Apple
6. Create a GitHub Release with the DMG attached
7. Clean up the temporary keychain

Build time is typically 5-10 minutes, with notarization taking 2-5 minutes of that.

### 4. Verify the Release

Once complete:

1. Go to the **Releases** page of your repository
2. Download the DMG
3. Install on a Mac and verify no Gatekeeper warnings appear

## Local Signed Builds (Optional)

For testing signed builds locally without CI:

```bash
export APPLE_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="your@email.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

mise run build
```

The build output will be in `out/make/`.

Without these environment variables, `mise run build` produces unsigned builds suitable for local development.

## Troubleshooting

### "No identity found"

Your certificate isn't installed or isn't a Developer ID certificate.

```bash
security find-identity -v -p codesigning
```

If no "Developer ID Application" certificate is listed:

1. Check that you've downloaded and installed the certificate from [developer.apple.com](https://developer.apple.com/account/resources/certificates)
2. Ensure you have both the certificate and its private key (shown as an expandable item in Keychain Access)
3. Verify it's in the **login** keychain, not System or other keychains

### Notarization Fails

Common causes:

- **Invalid app-specific password**: Generate a new one at [appleid.apple.com](https://appleid.apple.com)
- **Outdated agreements**: Sign in to [developer.apple.com](https://developer.apple.com) and accept any pending license agreements
- **Team ID mismatch**: Verify your Team ID matches the certificate's team

Check the workflow logs for specific error messages from `notarytool`.

### "Cannot be opened because the developer cannot be verified"

The app wasn't properly signed or notarized. Check:

1. All six GitHub secrets are configured correctly
2. The workflow completed without errors
3. The certificate hasn't expired (check in Keychain Access)

To inspect a DMG's signature:

```bash
codesign -dv --verbose=4 /path/to/SmartHole.app
spctl -a -v /path/to/SmartHole.app
```

### "The signature of the binary is invalid"

The app was modified after signing, or entitlements are incorrect. This can happen if:

1. The entitlements file path is wrong in `forge.config.ts`
2. A post-build script modified the app bundle
3. The certificate doesn't have the correct capabilities

### Certificate Expired

Developer ID certificates are valid for 5 years. To renew:

1. Create a new certificate at [developer.apple.com](https://developer.apple.com/account/resources/certificates)
2. Export the new certificate as `.p12`
3. Update `APPLE_CERTIFICATE_BASE64` and `APPLE_CERTIFICATE_PASSWORD` secrets
4. Update `APPLE_IDENTITY` if the identity string changed

## Related Documentation

- [Apple Developer - Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Apple Developer - Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/Introduction/Introduction.html)
- [Electron Forge - Auto Update + Code Signing](https://www.electronforge.io/guides/code-signing)
