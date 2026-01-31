---
id: T-add-input-menu-items-and
title: Add input menu items and dynamic state to tray menu
status: done
priority: medium
parent: F-tray-input-integration
prerequisites: []
affectedFiles:
  src/main.ts: Extended buildTrayMenu() to add input state detection and input
    menu items (Open Text Input, Start/Stop Recording toggle). Added
    stateChanged event subscription after input state initialization to trigger
    menu updates. Menu items have dynamic labels and enabled states based on
    current input state.
log:
  - >-
    Implementation completed:


    1. Added input state detection in buildTrayMenu() with try/catch for safe
    service access during early initialization

    2. Added "Open Text Input" menu item that calls getTextInputPopup().show()
    on click

    3. Added recording toggle menu item ("Start Recording" / "Stop Recording")
    with:
       - Dynamic label based on isRecording() state
       - Enabled/disabled state based on currentInputState (only enabled in IDLE/RECORDING respectively)
       - Click handlers that call startRecording()/stopRecording() with try/catch for safety
    4. Inserted input menu items between clients section separator and "About
    SmartHole"

    5. Added stateChanged subscription after input state service initialization
    to trigger updateTrayMenu() on state changes


    All quality checks pass (lint, format, type-check). All 34 test files pass.
  - Added input menu items (Open Text Input, Start/Stop Recording) to the tray
    menu with dynamic state updates. The recording menu item shows "Start
    Recording" when idle and "Stop Recording" when recording, with appropriate
    enabled/disabled states based on the input state machine. Menu automatically
    rebuilds when input state changes via the stateChanged event subscription.
schema: v1.0
childrenIds: []
created: 2026-01-31T03:00:39.386Z
updated: 2026-01-31T03:00:39.386Z
---

# Add input menu items and dynamic state to tray menu

## Context

The tray menu currently displays connected clients and standard items (About, Quit). This task adds input-related menu items that allow users to trigger text input and voice recording from the tray, with dynamic state that updates based on the current input state.

**Parent Feature**: F-tray-input-integration
**Prerequisites**: F-global-hotkey-system, F-voice-recording-service, F-text-input-popup-window (all completed)

## Current State

- `buildTrayMenu()` in `src/main.ts:187-248` builds the context menu
- `updateTrayMenu()` in `src/main.ts:254-260` rebuilds menu when called
- `InputStateService` in `src/services/input-state.ts` emits `stateChanged` events
- `TextInputPopupService` has `show()` method for opening text input
- `AudioCaptureService` has `startRecording()`, `stopRecording()`, `isRecording()` methods
- Registry events already trigger `updateTrayMenu()` on client changes (lines 461-466)

## Implementation Requirements

### 1. Extend buildTrayMenu() to include input items

Add input-related menu items between the clients section and "About SmartHole":

```
[Connected Clients section - existing]
---
Open Text Input
Start Recording / Stop Recording
---
About SmartHole
Quit
```

**Menu item specifications:**

- **"Open Text Input"**: Calls `getTextInputPopup().show()` on click
- **"Start Recording" / "Stop Recording"**:
  - Label depends on current `isRecording()` state
  - "Start Recording" calls `getAudioCapture().startRecording()`
  - "Stop Recording" calls `getAudioCapture().stopRecording()`
  - Disabled when transitioning (e.g., during PROCESSING state)

### 2. Subscribe to input state changes

In `app.whenReady()`, after initializing `inputState.inputStateService`, subscribe to `stateChanged` events to trigger `updateTrayMenu()`:

```typescript
inputState.inputStateService.on("stateChanged", () => {
  updateTrayMenu();
});
```

This ensures the menu reflects current state (idle, recording, processing).

### 3. Menu item state logic

Implement state-aware menu items in `buildTrayMenu()`:

```typescript
// Get current input state
let currentInputState = InputState.IDLE;
let isRecording = false;
try {
  currentInputState = getInputState().getCurrentState();
  isRecording = getAudioCapture().isRecording();
} catch {
  // Services not initialized yet
}

// Recording menu item
const recordingItem: Electron.MenuItemConstructorOptions = isRecording
  ? {
      label: "Stop Recording",
      click: () => getAudioCapture().stopRecording(),
      enabled: currentInputState === InputState.RECORDING,
    }
  : {
      label: "Start Recording",
      click: () => getAudioCapture().startRecording(),
      enabled: currentInputState === InputState.IDLE,
    };
```

## Technical Approach

1. Import `InputState` type and `getAudioCapture` at top of main.ts
2. Add state detection logic at start of `buildTrayMenu()`
3. Create menu items for "Open Text Input" and recording toggle
4. Insert items into template array before "About SmartHole" separator
5. Add `stateChanged` subscription after input state initialization
6. Test menu updates by triggering hotkeys and observing menu changes

## Acceptance Criteria

1. [ ] "Open Text Input" menu item appears in tray menu
2. [ ] Clicking "Open Text Input" opens the text input popup
3. [ ] "Start Recording" menu item appears when not recording
4. [ ] "Stop Recording" menu item appears when recording
5. [ ] Recording menu item is disabled during PROCESSING state
6. [ ] Menu updates immediately when input state changes
7. [ ] Services initialized safely with try/catch for early initialization
8. [ ] Existing menu functionality (clients, about, quit) unchanged

## Testing Requirements

- Unit tests for menu building logic with different input states
- Test menu item click handlers trigger correct service methods
- Test menu rebuilds on state change events

## Out of Scope

- Tray icon changes (handled by separate task T-tray-icon-state-management)
- Windows-specific icon handling
- macOS template image handling for state icons
- Adding new npm packages
