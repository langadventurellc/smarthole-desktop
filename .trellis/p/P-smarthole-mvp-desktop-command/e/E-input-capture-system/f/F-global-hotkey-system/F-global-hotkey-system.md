---
id: F-global-hotkey-system
title: Global Hotkey System
status: open
priority: high
parent: E-input-capture-system
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
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
