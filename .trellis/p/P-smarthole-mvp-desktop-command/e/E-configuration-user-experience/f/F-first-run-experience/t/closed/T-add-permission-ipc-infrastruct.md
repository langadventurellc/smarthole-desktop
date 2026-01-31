---
id: T-add-permission-ipc-infrastruct
title: Add permission IPC infrastructure for first-run experience
status: done
priority: high
parent: F-first-run-experience
prerequisites: []
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
  - >-
    Completed research phase:

    - Reviewed IPC channel patterns in src/types/ipc.ts

    - Reviewed existing handlers: credential-handler.ts, config-handler.ts

    - Reviewed preload bridge structure in src/preload/main.ts  

    - Reviewed main.ts for handler registration patterns

    - Reviewed test patterns in credential-handler.test.ts and
    preload/main.test.ts


    Key patterns identified:

    1. IPC channels use domain:action naming (e.g.,
    "permission:checkMicrophone")

    2. Handlers follow createXXXHandler pattern with getService and logger
    injection

    3. Preload uses ipcRenderer.invoke for request/response and ipcRenderer.on
    for events

    4. Types defined in IpcPayloadMap and IpcResponseMap


    Starting implementation...
  - >-
    Implementation complete:


    1. Added IPC channel constants to src/types/ipc.ts:
       - PERMISSION_CHECK_MICROPHONE
       - PERMISSION_REQUEST_MICROPHONE  
       - PERMISSION_CHECK_ACCESSIBILITY
       - PERMISSION_OPEN_ACCESSIBILITY_SETTINGS

    2. Added permission types:
       - MicrophonePermissionStatus type
       - PermissionCheckMicrophoneResponse interface
       - PermissionRequestMicrophoneResponse interface
       - PermissionCheckAccessibilityResponse interface

    3. Created permission handler in src/ipc/permission-handler.ts:
       - createMicrophoneCheckHandler() - uses systemPreferences.getMediaAccessStatus
       - createMicrophoneRequestHandler() - uses systemPreferences.askForMediaAccess
       - createAccessibilityCheckHandler() - uses systemPreferences.isTrustedAccessibilityClient
       - createAccessibilitySettingsHandler() - uses shell.openExternal

    4. Added preload bridge methods in src/preload/main.ts:
       - checkMicrophonePermission()
       - requestMicrophonePermission()
       - checkAccessibilityPermission()
       - openAccessibilitySettings()

    5. Registered handlers in src/main.ts


    6. Added comprehensive unit tests (16 tests) in
    src/ipc/permission-handler.test.ts


    All 947 tests pass. Quality checks pass.
  - Added permission IPC infrastructure for the first-run experience.
    Implemented IPC channels, handlers, and preload bridge methods for checking
    and requesting microphone and accessibility permissions. The handlers
    properly handle platform differences (macOS-specific APIs vs Windows/Linux).
    All 16 new unit tests pass, along with all 947 existing tests.
schema: v1.0
childrenIds: []
created: 2026-01-31T16:47:28.631Z
updated: 2026-01-31T16:47:28.631Z
---

# Add Permission IPC Infrastructure

## Overview

Create the IPC channels, handlers, and preload bridge methods needed for checking and requesting system permissions (microphone, accessibility) in the onboarding flow.

## Deliverables

### 1. Add IPC Channel Constants (`src/types/ipc.ts`)

Add new permission channels to `IPC_CHANNELS`:

- `PERMISSION_CHECK_MICROPHONE` - Check current microphone permission status
- `PERMISSION_REQUEST_MICROPHONE` - Request microphone access
- `PERMISSION_CHECK_ACCESSIBILITY` - Check accessibility permission (macOS)
- `PERMISSION_OPEN_ACCESSIBILITY_SETTINGS` - Open System Preferences to Accessibility pane (macOS)

Add corresponding payload/response types to `IpcPayloadMap` and `IpcResponseMap`.

### 2. Create Permission Handler (`src/ipc/permission-handler.ts`)

Create handlers for each permission channel using Electron's `systemPreferences`:

- `createMicrophoneCheckHandler()` - Uses `systemPreferences.getMediaAccessStatus('microphone')`
- `createMicrophoneRequestHandler()` - Uses `systemPreferences.askForMediaAccess('microphone')`
- `createAccessibilityCheckHandler()` - Uses `systemPreferences.isTrustedAccessibilityClient(false)`
- `createAccessibilitySettingsHandler()` - Opens System Preferences using `shell.openExternal()`

### 3. Add Preload Bridge Methods (`src/preload/main.ts`)

Add to `electronAPI`:

- `checkMicrophonePermission(): Promise<PermissionStatus>`
- `requestMicrophonePermission(): Promise<boolean>`
- `checkAccessibilityPermission(): Promise<boolean>`
- `openAccessibilitySettings(): Promise<void>`

### 4. Register Handlers in Main Process (`src/main.ts`)

Register the permission IPC handlers in `app.whenReady()` callback.

## Technical Notes

- Microphone permission on Windows is typically always granted; focus on macOS behavior
- Accessibility permission cannot be requested programmatically on macOS; we can only check status and guide user
- For `shell.openExternal`, use the URL: `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`

## Acceptance Criteria

- [ ] Permission IPC channels defined in `src/types/ipc.ts`
- [ ] Permission handlers created in `src/ipc/permission-handler.ts`
- [ ] Preload bridge methods added
- [ ] Handlers registered in main process
- [ ] Unit tests for permission handlers
