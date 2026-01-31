---
id: F-first-run-experience
title: First-Run Experience & Permissions
status: in-progress
priority: medium
parent: E-configuration-user-experience
prerequisites:
  - F-configuration-storage-ipc
  - F-secure-credential-storage
affectedFiles:
  src/types/ipc.ts: Added 4 new permission IPC channels
    (PERMISSION_CHECK_MICROPHONE, PERMISSION_REQUEST_MICROPHONE,
    PERMISSION_CHECK_ACCESSIBILITY, PERMISSION_OPEN_ACCESSIBILITY_SETTINGS) with
    corresponding payload/response types in IpcPayloadMap and IpcResponseMap
  src/ipc/permission-handler.ts: "Created new file with 4 handler factory
    functions: createMicrophoneCheckHandler, createMicrophoneRequestHandler,
    createAccessibilityCheckHandler, createAccessibilitySettingsHandler"
  src/ipc/permission-handler.test.ts: Created new test file with 16 comprehensive
    unit tests covering all handlers across macOS, Windows, and Linux platforms
  src/ipc/index.ts: Added export for permission-handler module
  src/preload/main.ts: "Added 4 permission bridge methods:
    checkMicrophonePermission, requestMicrophonePermission,
    checkAccessibilityPermission, openAccessibilitySettings"
  src/main.ts: Registered permission IPC handlers in app.whenReady() callback
  src/types/ipc.test.ts: Updated channel count assertion from 36 to 40
log:
  - "Started orchestration. Created feature branch
    feature/F-first-run-experience. Tasks to execute in order:
    T-add-permission-ipc-infrastruct → T-create-onboarding-window →
    T-implement-onboarding-wizard → T-integrate-first-run-detection"
schema: v1.0
childrenIds:
  - T-add-permission-ipc-infrastruct
  - T-create-onboarding-window
  - T-implement-onboarding-wizard
  - T-integrate-first-run-detection
created: 2026-01-31T06:21:18.472Z
updated: 2026-01-31T06:21:18.472Z
---

# First-Run Experience & Permissions

## Purpose

Implement the first-launch detection and guided setup flow that helps new users configure SmartHole with required permissions and essential settings.

## Deliverables

### 1. First-Run Detection

- Check `firstRunCompleted` field from config (added in F-configuration-storage-ipc)
- Distinguish between "no config" and "config exists but setup incomplete"

### 2. Permission Requests

- **Microphone Access**:
  - Request via Electron's `systemPreferences.askForMediaAccess('microphone')`
  - macOS-specific: handle the permission dialog
  - Explain why microphone access is needed before requesting
- **Accessibility Permission** (macOS):
  - Check via `systemPreferences.isTrustedAccessibilityClient(false)`
  - Guide user to System Preferences > Security & Privacy > Accessibility
  - Explain why this is needed for global hotkeys
- **Permission Status Checking**:
  - Check current permission state on app start
  - Show appropriate UI for missing permissions

### 3. Onboarding Window Setup

- Create `src/onboarding/` directory with:
  - `index.html` - HTML template for onboarding window
  - `renderer.tsx` - React entry point
  - `index.css` - Styling
- Create onboarding BrowserWindow in `src/windows/onboarding-window.ts`:
  - Follow pattern from existing `text-input-popup.ts`
  - Separate window with appropriate size (e.g., 600x500)
  - Use main preload script (shares permission and credential IPC)
- Multi-step wizard flow:
  1. **Welcome**: Brief intro to SmartHole, what it does
  2. **Permissions**: Request microphone + explain accessibility needs
  3. **STT Setup**: Choose cloud vs local, enter API key if cloud
  4. **AI Configuration**: Enter Anthropic API key
  5. **Complete**: Success message, mention settings for future changes

### 4. React Components (`src/onboarding/`)

- `OnboardingApp.tsx` - Main container with step navigation
- `components/WelcomeStep.tsx`
- `components/PermissionsStep.tsx` - Shows permission status, request buttons
- `components/SttStep.tsx` - Backend selection and API key
- `components/AiStep.tsx` - Anthropic API key
- `components/CompleteStep.tsx`
- Progress indicator showing current step
- Back/Next navigation
- "Skip" option to configure later

### 5. IPC for Permissions

- Add permission channels to `src/types/ipc.ts`:
  - `PERMISSION_CHECK_MICROPHONE`
  - `PERMISSION_REQUEST_MICROPHONE`
  - `PERMISSION_CHECK_ACCESSIBILITY`
  - `PERMISSION_OPEN_ACCESSIBILITY_SETTINGS`
- Create `src/ipc/permission-handler.ts`
- Add permission methods to preload bridge in `src/preload/main.ts`

### 6. Window Management in Main Process

- In `main.ts`, after app ready:
  - Check `firstRunCompleted` from config
  - If false, show onboarding window instead of minimizing to tray
  - Onboarding blocks other windows until complete or skipped
- After completion, minimize to tray normally
- Mark `firstRunCompleted: true` in config

### 7. Skip Flow

- Allow users to skip at any step
- Skipping marks first run complete but with incomplete config
- Show gentle reminder in tray menu if essential settings missing

## Technical Notes

- Microphone permission on Windows is usually always available; focus macOS handling
- Accessibility permission cannot be requested programmatically; must guide user
- Keep onboarding flow under 2 minutes for typical user
- Save progress between steps in case window closes
- Vite config may need updating to build the onboarding entry point

## Dependencies

- F-configuration-storage-ipc (config storage, `firstRunCompleted` field)
- F-secure-credential-storage (API key storage)

## Acceptance Criteria

- [ ] Onboarding window and entry point created
- [ ] First-run detected correctly via `firstRunCompleted` config field
- [ ] Microphone permission requested with explanation
- [ ] Accessibility permission guidance shown (macOS)
- [ ] Onboarding wizard has all steps
- [ ] STT backend can be selected and configured
- [ ] Anthropic API key can be entered
- [ ] Skip option available at all steps
- [ ] firstRunCompleted flag set on completion
- [ ] Normal tray behavior after onboarding
- [ ] Re-running after completion goes straight to tray
