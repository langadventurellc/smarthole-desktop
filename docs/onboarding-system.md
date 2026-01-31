# Onboarding System

First-run experience and guided setup for SmartHole.

## Overview

The onboarding system provides a wizard-style setup flow for new users, requesting necessary permissions and collecting essential configuration before the app starts in tray mode.

## Architecture

```
Main Process                              Renderer Process (Onboarding)
     |                                              |
     |-- checkSetupIncomplete() ------------------>|
     |   (checks firstRunCompleted config)         |
     |                                              |
     |-- show onboarding window ------------------>|
     |                                              |
     |<-- permission:checkMicrophone -------------|  (check status)
     |<-- permission:requestMicrophone -----------|  (request access)
     |<-- permission:checkAccessibility ----------|  (macOS only)
     |<-- credential:store -----------------------|  (save API keys)
     |<-- config:set { firstRunCompleted: true } -|  (mark complete)
     |                                              |
     |-- start normal tray operation              |
```

## First-Run Detection

On app startup, `main.ts` checks the `firstRunCompleted` config field:

```typescript
function checkSetupIncomplete(): boolean {
  const config = getConfigManager().getConfig();
  return !config.firstRunCompleted;
}
```

If `firstRunCompleted` is `false` (default), the onboarding window is shown instead of proceeding to normal tray operation.

## Wizard Steps

The onboarding wizard (`OnboardingApp.tsx`) has five steps:

| Step        | Component         | Purpose                                                |
| ----------- | ----------------- | ------------------------------------------------------ |
| Welcome     | `WelcomeStep`     | Brief intro to SmartHole, feature highlights           |
| Permissions | `PermissionsStep` | Request microphone access, check accessibility (macOS) |
| Speech      | `SttStep`         | Configure STT backend (cloud/local), API key           |
| AI          | `AiStep`          | Enter Anthropic API key for routing agent              |
| Complete    | `CompleteStep`    | Summary with status icons, finish button               |

### Skip Flow

Users can skip at any step (except Welcome and Complete). Skipping jumps to the Complete step but does not set `firstRunCompleted`. This allows users to exit onboarding and complete setup later via the Settings window.

When setup is incomplete, a "Setup Incomplete" item appears at the top of the tray menu.

## Permission IPC Channels

| Channel                                | Direction        | Description                                     |
| -------------------------------------- | ---------------- | ----------------------------------------------- |
| `permission:checkMicrophone`           | Renderer -> Main | Returns current microphone permission status    |
| `permission:requestMicrophone`         | Renderer -> Main | Triggers permission request dialog              |
| `permission:checkAccessibility`        | Renderer -> Main | Returns accessibility permission status (macOS) |
| `permission:openAccessibilitySettings` | Renderer -> Main | Opens System Preferences to Accessibility pane  |

### Permission Response Types

```typescript
interface PermissionCheckMicrophoneResponse {
  status: "granted" | "denied" | "not-determined" | "restricted" | "unknown";
  platform: NodeJS.Platform;
}

interface PermissionRequestMicrophoneResponse {
  granted: boolean;
  platform: NodeJS.Platform;
}

interface PermissionCheckAccessibilityResponse {
  isTrusted: boolean;
  platform: NodeJS.Platform;
}
```

### Platform Behavior

- **macOS**: Full permission handling via `systemPreferences` API
- **Windows**: Microphone permissions auto-granted; accessibility not applicable
- **Linux**: Permissions handled at OS level; returns appropriate defaults

## Onboarding Window Service

Singleton service in `src/windows/onboarding-window.ts`:

```typescript
import { initializeOnboardingWindow, getOnboardingWindow } from "./windows";

// Inside app.whenReady()
initializeOnboardingWindow();

// Show the wizard
getOnboardingWindow().show();
```

### API

| Method        | Description                                             |
| ------------- | ------------------------------------------------------- |
| `show()`      | Show the onboarding window, focusing if already visible |
| `hide()`      | Close the onboarding window                             |
| `isVisible()` | Check if window is currently visible                    |
| `getWindow()` | Get the BrowserWindow instance                          |

### Window Configuration

- **Size**: 600x500 pixels, fixed (non-resizable)
- **Frame**: Standard window frame with title bar
- **Preload**: Uses main preload script (shares IPC with settings window)
- **Close**: Escape key closes the window

## Integration with Main Process

The startup flow in `main.ts`:

1. Initialize services (logger, config, etc.)
2. Call `checkSetupIncomplete()`
3. If incomplete: show onboarding window, wait for close
4. If complete (or after onboarding): `initializeNormalOperation()` (tray, hotkeys, etc.)

## Tray Menu Integration

When `firstRunCompleted` is `false`, `buildTrayMenuTemplate` adds a "Setup Incomplete" item at the top of the menu that opens the onboarding window when clicked.

## File Structure

```
src/onboarding/
├── index.html              # HTML entry point
├── renderer.tsx            # React entry point
├── index.css               # Styles (light/dark theme support)
├── OnboardingApp.tsx       # Main wizard component with state
├── OnboardingApp.test.tsx  # Unit tests
└── components/
    ├── index.ts            # Barrel export
    ├── ProgressIndicator.tsx
    ├── StepLayout.tsx
    ├── WelcomeStep.tsx
    ├── PermissionsStep.tsx
    ├── SttStep.tsx
    ├── AiStep.tsx
    └── CompleteStep.tsx
```

## Testing

```bash
mise run test src/windows/onboarding-window.test.ts
mise run test src/ipc/permission-handler.test.ts
mise run test src/onboarding/OnboardingApp.test.tsx
```
