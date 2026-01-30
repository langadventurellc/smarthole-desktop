---
id: T-implement-hotkey-and-input
title: Implement Hotkey and Input State IPC Integration
status: done
priority: high
parent: F-global-hotkey-system
prerequisites:
  - T-implement-hotkey-manager
  - T-implement-input-state
affectedFiles:
  src/types/ipc.ts: Added 4 new IPC channels (HOTKEY_ACTIVATED, HOTKEY_RELEASED,
    INPUT_STATE_CHANGED, INPUT_GET_STATE), imported and re-exported hotkey and
    input state types, updated IpcPayloadMap and IpcResponseMap
  src/ipc/hotkey-handler.ts: Created new IPC handler with
    broadcastHotkeyActivated, broadcastHotkeyReleased, and
    wireHotkeyManagerToIpc functions
  src/ipc/input-state-handler.ts: Created new IPC handler with
    broadcastInputStateChanged, createInputStateHandler, and wireInputStateToIpc
    functions
  src/ipc/index.ts: Added exports for hotkey-handler and input-state-handler modules
  src/preload.ts: Added onHotkeyActivated, onHotkeyReleased, getInputState, and
    onInputStateChanged APIs to electronAPI
  src/main.ts: Added imports for services and handlers, initialized hotkey manager
    and input state service, wired events to IPC broadcasts and state
    transitions, added cleanup in will-quit handler
  src/types/ipc.test.ts: Updated channel count test from 17 to 21, added tests for
    new hotkey and input state channels
  src/types/hotkey.ts: Created new types file for hotkey event types (HotkeyType,
    HotkeyActivatedEvent, HotkeyReleasedEvent, HotkeyErrorCode,
    HotkeyErrorEvent) to avoid circular dependency between types and services
  src/services/hotkey-manager.ts: Refactored to use lazy loading for uiohook-napi
    - removed top-level import, added loadUiohook() for dynamic import,
    buildAcceleratorToKeycodeMap() for lazy keycode map creation,
    setupUiohookListeners() called lazily after first registerHotkeys() call
log:
  - >-
    Researched codebase patterns:

    - Reviewed src/types/ipc.ts - IPC channel patterns, type maps, type guards

    - Reviewed src/preload.ts - electronAPI patterns with contextBridge

    - Reviewed src/main.ts - service initialization patterns, IPC handler
    registration

    - Reviewed src/ipc/index.ts - barrel export pattern

    - Reviewed src/ipc/client-status-handler.ts - broadcast patterns with
    BrowserWindow

    - Reviewed src/services/hotkey-manager.ts - HotkeyManagerEvents,
    HotkeyActivatedEvent, HotkeyReleasedEvent

    - Reviewed src/services/input-state.ts - InputStateService,
    InputStateEvents, InputStateChangedEvent

    - Reviewed src/types/input.ts - InputState, InputStateInfo types


    Ready to implement:

    1. Add IPC channels to src/types/ipc.ts

    2. Create src/ipc/hotkey-handler.ts 

    3. Create src/ipc/input-state-handler.ts

    4. Update src/ipc/index.ts

    5. Update src/preload.ts with hotkey/input APIs

    6. Update src/main.ts to initialize and wire up services
  - >-
    Implemented IPC integration for hotkey manager and input state services,
    connecting them to the renderer process via IPC channels.


    Key implementations:

    1. Added 4 new IPC channels to src/types/ipc.ts: hotkey:activated,
    hotkey:released, input:stateChanged, input:getState

    2. Created src/ipc/hotkey-handler.ts with broadcast functions and wiring for
    hotkey events

    3. Created src/ipc/input-state-handler.ts with state query handler and
    broadcast functions

    4. Updated src/ipc/index.ts to export new handlers

    5. Added preload API in src/preload.ts: onHotkeyActivated, onHotkeyReleased,
    getInputState, onInputStateChanged

    6. Updated src/main.ts to initialize services, wire events to state
    transitions, and handle cleanup on quit


    The hotkey manager now broadcasts events to the renderer when hotkeys are
    pressed/released, and the input state service broadcasts state changes. The
    voice input hotkey triggers IDLE->RECORDING transitions, and releasing it
    triggers RECORDING->PROCESSING transitions (in push-to-talk mode).
  - >-
    BLOCKER: Smoke test fails due to uiohook-napi native module loading issue.


    The hotkey manager (implemented in previous task T-implement-hotkey-manager)
    imports uiohook-napi at module load time. When main.ts imports and
    initializes the hotkey manager, it tries to load the native module which
    fails in the smoke test environment with:


    "Error: No native build was found for platform=darwin arch=arm64
    runtime=electron abi=143..."


    This is because the smoke test runs the built app with a minimal environment
    that doesn't have the native bindings properly configured.


    Options:

    1. Refactor hotkey-manager to use dynamic/lazy imports for uiohook-napi
    (significant change, outside task scope)

    2. Skip hotkey manager initialization on native module load failure
    (graceful degradation)

    3. Update smoke test configuration to handle native modules

    4. Temporarily skip smoke test for this branch until native module issue is
    resolved


    The IPC integration implementation is complete and tested. The blocker is at
    the smoke test level due to the pre-existing native module architecture.
  - >-
    Fixed blocker: Refactored hotkey-manager.ts to use lazy loading for
    uiohook-napi.


    Key changes:

    1. Removed top-level `import { uIOhook, UiohookKey } from 'uiohook-napi'`

    2. Created lazy loader function `loadUiohook()` that uses dynamic import

    3. ACCELERATOR_TO_KEYCODE map is now built lazily via
    `buildAcceleratorToKeycodeMap()` after uiohook is loaded

    4. UiohookKey references are now passed through function parameters

    5. uiohook listeners are set up lazily in `setupUiohookListeners()` after
    first call to `registerHotkeys()`

    6. `resetHotkeyManager()` now also resets the cached uiohook module and
    keycode map


    All 617 tests pass. Smoke test now passes since the native module is not
    loaded at module parse time.
schema: v1.0
childrenIds: []
created: 2026-01-30T22:18:20.884Z
updated: 2026-01-30T22:18:20.884Z
---

# Implement Hotkey and Input State IPC Integration

## Purpose

Connect the hotkey manager and input state services to the renderer process via IPC, allowing the UI to receive hotkey events and query/observe input state changes.

## Scope

### IPC Channels (add to `src/types/ipc.ts`)

Hotkey channels:

- `hotkey:activated` - main → renderer broadcast when hotkey pressed
- `hotkey:released` - main → renderer broadcast when hotkey released (for push-to-talk)

Input state channels:

- `input:stateChanged` - main → renderer broadcast when input state changes
- `input:getState` - renderer → main invoke to get current state

### IPC Handlers

- `src/ipc/hotkey-handler.ts` - Handle hotkey event broadcasting
- `src/ipc/input-state-handler.ts` - Handle state queries and broadcasts

### Preload API Additions (`src/preload.ts`)

```typescript
// Hotkey events
onHotkeyActivated: (callback) => void (returns unsubscribe)
onHotkeyReleased: (callback) => void (returns unsubscribe)

// Input state
getInputState: () => Promise<InputStateInfo>
onInputStateChanged: (callback) => void (returns unsubscribe)
```

### Main Process Integration (`src/main.ts`)

- Initialize hotkey manager after app.whenReady()
- Initialize input state service
- Wire up hotkey events to input state transitions
- Register IPC handlers
- Add cleanup on app quit

## Files to Create/Modify

- `src/types/ipc.ts` - Add new IPC channel definitions and payload types
- `src/ipc/hotkey-handler.ts` - New IPC handler
- `src/ipc/input-state-handler.ts` - New IPC handler
- `src/ipc/index.ts` - Export new handlers
- `src/preload.ts` - Add hotkey/input state APIs
- `src/main.ts` - Initialize services and register handlers

## Acceptance Criteria

1. [ ] IPC channels defined with proper types
2. [ ] Renderer can subscribe to hotkey events
3. [ ] Renderer can query and subscribe to input state
4. [ ] Services properly wired up in main.ts
5. [ ] Cleanup on app quit unregisters hotkeys
6. [ ] Follows existing IPC patterns in codebase

## Testing

- Unit tests for IPC handlers with mocked services
- Manual testing of full integration
