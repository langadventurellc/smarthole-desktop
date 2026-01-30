---
id: T-implement-hotkey-and-input
title: Implement Hotkey and Input State IPC Integration
status: open
priority: high
parent: F-global-hotkey-system
prerequisites:
  - T-implement-hotkey-manager
  - T-implement-input-state
affectedFiles: {}
log: []
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
