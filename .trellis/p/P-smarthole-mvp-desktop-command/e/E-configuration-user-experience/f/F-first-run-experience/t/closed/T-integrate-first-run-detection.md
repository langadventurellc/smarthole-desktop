---
id: T-integrate-first-run-detection
title: Integrate first-run detection and onboarding in main process
status: done
priority: high
parent: F-first-run-experience
prerequisites:
  - T-implement-onboarding-wizard
affectedFiles:
  src/main.ts: Added onboarding window imports, onboardingState tracking,
    checkSetupIncomplete() function, initializeNormalOperation() function, and
    modified startup flow to detect first-run and show onboarding window.
    Integrated setupIncomplete state into tray menu building.
  src/tray-menu.ts: Added setupIncomplete field to TrayMenuState interface, added
    onSetupIncomplete action to TrayMenuActions interface, updated
    buildTrayMenuTemplate to show 'Setup Incomplete' item at top of menu when
    setupIncomplete is true.
  src/tray-menu.test.ts: "Added 6 new tests for setup incomplete reminder
    functionality: showing/hiding based on setupIncomplete flag, click handler
    behavior, and menu position."
log:
  - >-
    Research phase completed. Analyzed the following files:


    1. **src/main.ts** - Main entry point with `app.whenReady()` initialization
    flow:
       - Logger initialized first, then config manager, then other services
       - Currently hides dock icon immediately on macOS
       - Tray created at the end of initialization
       - Various service state objects track initialized services

    2. **src/windows/onboarding-window.ts** - Onboarding window service:
       - Singleton pattern matching other window services
       - `show()`, `hide()`, `isVisible()`, `getWindow()` methods
       - Already exported in `src/windows/index.ts`

    3. **src/types/config.ts** - Config types:
       - `firstRunCompleted: boolean` field exists in AppConfig
       - Default is `false`

    4. **src/services/credential-manager.ts** - Credential manager:
       - `hasCredential(key)` method for checking if credential exists
       - Keys: "anthropic-api-key", "stt-api-key"

    5. **src/tray-menu.ts** - Tray menu building:
       - Pure function `buildTrayMenuTemplate(state, actions)` for testability
       - `TrayMenuState` interface for input state

    6. **src/onboarding/components/CompleteStep.tsx** - Completion flow:
       - Calls `window.electronAPI.setConfig({ firstRunCompleted: true })` on Finish
       - Then calls `window.close()` to close the onboarding window

    Implementation plan:

    1. Add `setupIncomplete` field to TrayMenuState and show reminder in tray
    menu

    2. Modify main.ts startup flow:
       - After config manager initialization, check `firstRunCompleted`
       - If false: initialize onboarding window, show it, defer dock hide and tray creation
       - If true: proceed with normal initialization, check for missing credentials
    3. Add onboarding window state tracking in main.ts

    4. Listen for window close event to transition from onboarding to normal
    mode

    5. Add logic to detect missing essential credentials (anthropic-api-key)

    6. Add tests for the tray menu setup incomplete state
  - >-
    Integrated first-run detection and onboarding flow in the main process. The
    implementation:


    1. **First-Run Detection**: On app start, checks the `firstRunCompleted`
    config field. If false, shows the onboarding window instead of immediately
    hiding the dock and creating the tray.


    2. **Onboarding Window Flow**: 
       - Initializes the onboarding window service
       - Shows the onboarding window when first-run is detected
       - Listens for window close event
       - If user completed onboarding (firstRunCompleted is true), transitions to normal operation
       - If user closed without completing, quits the app

    3. **Normal Operation Transition**: After onboarding completes (or on
    subsequent launches), the `initializeNormalOperation()` function:
       - Hides the dock icon on macOS
       - Checks for missing essential credentials (Anthropic API key)
       - Sets `setupIncomplete` flag if credentials are missing
       - Creates the tray menu

    4. **Setup Incomplete Reminder**: Added to tray menu:
       - Shows "Setup Incomplete - Click to Configure" at the top of the menu
       - Only shown when `firstRunCompleted` is true but essential credentials are missing
       - Clicking opens the settings window

    5. **Tray Menu Updates**:
       - Added `setupIncomplete` field to `TrayMenuState`
       - Added optional `onSetupIncomplete` action to `TrayMenuActions`
       - Falls back to `onSettings` if `onSetupIncomplete` is not provided

    6. **Tests**: Added 6 new tests for the setup incomplete tray menu behavior.
schema: v1.0
childrenIds: []
created: 2026-01-31T16:47:29.090Z
updated: 2026-01-31T16:47:29.090Z
---

# Integrate First-Run Detection and Onboarding in Main Process

## Overview

Modify the main process startup flow to detect first-run state and show the onboarding window before normal app initialization completes.

## Deliverables

### 1. First-Run Detection Logic (`src/main.ts`)

After config manager initialization, check `firstRunCompleted`:

```typescript
const config = configState.configManager.getConfig();
if (!config.firstRunCompleted) {
  // Show onboarding window
}
```

### 2. Onboarding Window Initialization

- Initialize onboarding window service in `app.whenReady()`
- If first-run detected:
  - Show onboarding window
  - Do NOT hide dock icon on macOS (user needs to interact with window)
  - Onboarding window should block normal tray-only behavior until complete

### 3. Onboarding Completion Handling

- Listen for onboarding completion (window close after `firstRunCompleted: true`)
- After completion:
  - Hide dock icon on macOS
  - Normal tray behavior resumes
  - Onboarding window service can be cleaned up

### 4. Skip Flow Handling

- If user skips onboarding:
  - `firstRunCompleted` is set to `true` but config may be incomplete
  - Add logic to detect incomplete essential settings (e.g., missing API keys)
  - Show reminder in tray menu if essential settings missing:
    - Add "Setup Incomplete" item that opens settings
    - Only show if `firstRunCompleted` but missing required credentials

### 5. Re-run Protection

- Ensure onboarding only shows on actual first run
- If config exists with `firstRunCompleted: true`, skip onboarding entirely
- Handle edge case: config file deleted but credentials remain in keychain

## Technical Notes

- Order of operations in `app.whenReady()`:
  1. Initialize logger
  2. Initialize config manager
  3. Check `firstRunCompleted`
  4. If true: proceed with normal initialization (tray, services)
  5. If false: show onboarding, defer tray creation until onboarding completes
- The dock icon visibility (`app.dock.hide()`) should be deferred until after onboarding on macOS
- Consider using an event emitter pattern for onboarding completion

## Acceptance Criteria

- [ ] First-run correctly detected via `firstRunCompleted` config field
- [ ] Onboarding window shown on first launch
- [ ] Dock icon visible during onboarding on macOS
- [ ] Normal tray behavior after onboarding completes
- [ ] Skip flow correctly marks first run complete
- [ ] Tray menu shows reminder if essential settings missing
- [ ] Re-running after completion goes straight to tray
- [ ] Clean startup/shutdown handling
