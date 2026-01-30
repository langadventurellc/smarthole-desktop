---
id: F-global-hotkey-system
title: Global Hotkey System
status: done
priority: high
parent: E-input-capture-system
prerequisites: []
affectedFiles:
  src/services/hotkey-manager.ts: Created hotkey manager service with singleton
    pattern, EventEmitter for events, Electron globalShortcut integration,
    uiohook-napi for key up detection, and macOS accessibility permission
    handling; Refactored to use lazy loading for uiohook-napi - removed
    top-level import, added loadUiohook() for dynamic import,
    buildAcceleratorToKeycodeMap() for lazy keycode map creation,
    setupUiohookListeners() called lazily after first registerHotkeys() call
  src/services/hotkey-manager.test.ts: Added unit tests for initialization,
    registration, event emission, unregistration, and accessibility permissions
  src/services/index.ts: Added export for hotkey-manager module; Added export for
    input-state service module
  package.json: Added uiohook-napi dependency (via npm install)
  src/types/input.ts: "Created input state types: InputState enum, InputStateInfo
    interface, InputStateChangedEvent, InputModeChangedEvent, and
    InputStateEvents interface"
  src/types/index.ts: Added export for input types module
  src/services/input-state.ts: Created InputStateService with singleton pattern,
    validated state machine, EventEmitter for events, mode tracking
  src/services/input-state.test.ts: Added unit tests for state machine
    transitions, event emission, mode changes, and getStateInfo
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
  docs/global-hotkey-system.md: Created comprehensive documentation for the global
    hotkey system covering architecture, services (HotkeyManager, InputState),
    IPC channels, renderer API, types, configuration, platform notes, and error
    handling
  CLAUDE.md: Updated services list to include hotkey-manager and input-state;
    added link to global-hotkey-system.md in Detailed Documentation section
log:
  - >-
    Started feature implementation. Created feature branch
    feature/F-global-hotkey-system.


    Execution order:

    1. T-implement-hotkey-manager (no prerequisites)

    2. T-implement-input-state (no prerequisites) 

    3. T-implement-hotkey-and-input (depends on #1 and #2)
  - >-
    Completed T-implement-hotkey-manager:

    - Created src/services/hotkey-manager.ts with singleton pattern

    - Uses Electron globalShortcut for key down, uiohook-napi for key up

    - EventEmitter events: hotkey:activated, hotkey:released, error

    - macOS accessibility permission handling

    - 13 unit tests passing


    Completed T-implement-input-state:

    - Created src/types/input.ts with InputState enum and InputStateInfo
    interface  

    - Created src/services/input-state.ts with validated state machine

    - Transitions: IDLE→RECORDING, RECORDING→PROCESSING, RECORDING→IDLE,
    PROCESSING→IDLE

    - EventEmitter events: stateChanged, modeChanged

    - 21 unit tests passing


    Both tasks passed code review. Ready to commit.
  - Committed trellis state (311bd72). Starting final task
    T-implement-hotkey-and-input which integrates hotkey manager and input state
    via IPC.
  - "Auto-completed: All child tasks are complete"
  - >-
    Documentation update completed:


    1. Created `docs/global-hotkey-system.md` with comprehensive documentation
    covering:
       - Overview of the hotkey and input state system
       - Architecture diagram showing service relationships
       - HotkeyManager service documentation (initialization, events, key features)
       - InputState service documentation (state machine diagram, states, events, modes)
       - IPC channels reference tables
       - Renderer API usage examples with code snippets
       - Complete type definitions for all events and interfaces
       - Configuration options
       - Platform-specific notes (macOS accessibility, Windows)
       - Dependencies list
       - IPC wiring instructions
       - Error handling patterns

    2. Updated `CLAUDE.md`:
       - Added hotkey-manager and input-state to services list in project structure
       - Added link to new documentation in "Detailed Documentation" section
  - >-
    All 3 tasks completed and reviewed:

    1. T-implement-hotkey-manager - Hotkey manager service with lazy-loaded
    uiohook-napi

    2. T-implement-input-state - Input state service with validated state
    machine

    3. T-implement-hotkey-and-input - IPC integration connecting services to
    renderer


    Documentation updated:

    - Created docs/global-hotkey-system.md

    - Updated CLAUDE.md with new services and docs link


    All tests pass (617 tests), all quality checks pass. Ready for final commit.
schema: v1.0
childrenIds:
  - T-implement-hotkey-and-input
  - T-implement-hotkey-manager
  - T-implement-input-state
created: 2026-01-30T22:14:48.821Z
updated: 2026-01-30T22:14:48.821Z
---

# Global Hotkey System

## Purpose

Implement system-wide hotkey registration that works even when the application is not focused, along with centralized input state management. This feature provides the core trigger mechanism for both voice recording and text input, plus the state machine that coordinates input modes.

## Scope

### Hotkey Manager Service

- **System-wide hotkey registration** using Electron's built-in `globalShortcut` module
- **Cross-platform support** for macOS and Windows
- **Configurable bindings** reading from `HotkeyConfig` (already defined in `src/types/config.ts`)
- **Hotkey conflict detection** with graceful error handling when registration fails
- **Support for key up/down events** - essential for push-to-talk mode (hold to record)
- **Modifier key support**: Cmd/Ctrl, Shift, Alt/Option in Electron accelerator format

### Input State Management

- **Centralized state** tracking: idle, recording, processing
- **Mode tracking**: push-to-talk vs toggle (from `VoiceInputMode` type)
- **State transitions with validation** (e.g., can't start recording while already recording)
- **Event emission** for state changes (EventEmitter pattern like existing services)

### IPC Integration

- **IPC channels** for renderer communication:
  - `hotkey:activated` - main → renderer broadcast when hotkey pressed
  - `hotkey:released` - main → renderer broadcast when hotkey released (for push-to-talk)
  - `input:stateChanged` - main → renderer broadcast when input state changes
  - `input:getState` - renderer → main invoke to get current state
- **Preload API** additions in `preload.ts`

## Technical Approach

1. **Service pattern**: Follow existing singleton pattern with `initializeHotkeyManager()` / `getHotkeyManager()`
2. **Electron globalShortcut**: Use built-in module (no additional dependencies)
3. **Key up detection**: Electron's globalShortcut only supports key down; for push-to-talk, use `uiohook-napi` library which provides key up events
4. **State machine**: Simple state enum with transition validation
5. **Event-driven**: Use Node's EventEmitter for state change notifications

## Files to Create/Modify

- `src/services/hotkey-manager.ts` - New hotkey service
- `src/services/input-state.ts` - New input state service
- `src/services/index.ts` - Export new services
- `src/types/ipc.ts` - Add new IPC channels
- `src/types/input.ts` - New input state types
- `src/types/index.ts` - Export new types
- `src/ipc/hotkey-handler.ts` - New IPC handlers
- `src/ipc/input-state-handler.ts` - New IPC handlers
- `src/ipc/index.ts` - Export new handlers
- `src/preload.ts` - Add hotkey/input APIs
- `src/main.ts` - Initialize services and register handlers

## Dependencies

- **npm package**: `uiohook-napi` for key up events (cross-platform keyboard hook)
- **Existing**: Uses `HotkeyConfig` and `VoiceInputMode` from `src/types/config.ts`

## Acceptance Criteria

1. [ ] Hotkey registration succeeds on macOS and Windows
2. [ ] Hotkey triggers callback when app is not focused
3. [ ] Key down AND key up events are captured for push-to-talk support
4. [ ] Hotkey conflict gracefully handled with error logging
5. [ ] Input state transitions are validated (no invalid state changes)
6. [ ] State changes emit events that other services can subscribe to
7. [ ] IPC channels expose state to renderer
8. [ ] Service cleanup properly unregisters hotkeys on app quit
9. [ ] macOS accessibility permission prompt handled appropriately

## Testing Requirements

- Unit tests for state machine transitions
- Unit tests for IPC handlers with mocked services
- Manual testing required for actual hotkey registration (OS-level)

## Security Considerations

- Hotkeys must not interfere with system shortcuts (Cmd+Q, Alt+F4, etc.)
- No sensitive data in hotkey events

## Performance Requirements

- Hotkey response time < 100ms from keypress to event emission
- Minimal CPU usage when idle (listening for hotkeys)
