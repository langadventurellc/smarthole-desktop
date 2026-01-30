---
id: T-implement-hotkey-manager
title: Implement Hotkey Manager Service
status: done
priority: high
parent: F-global-hotkey-system
prerequisites: []
affectedFiles:
  src/services/hotkey-manager.ts: Created hotkey manager service with singleton
    pattern, EventEmitter for events, Electron globalShortcut integration,
    uiohook-napi for key up detection, and macOS accessibility permission
    handling
  src/services/hotkey-manager.test.ts: Added unit tests for initialization,
    registration, event emission, unregistration, and accessibility permissions
  src/services/index.ts: Added export for hotkey-manager module
  package.json: Added uiohook-napi dependency (via npm install)
log:
  - >-
    Started implementation. Research completed:

    - Reviewed existing singleton/EventEmitter patterns in client-registry.ts
    and notifications.ts

    - Reviewed HotkeyConfig type in config.ts (voiceInput string, optional
    textInput string)

    - Researched uiohook-napi API for key up detection

    - Researched macOS accessibility permission handling
    (systemPreferences.isTrustedAccessibilityClient)


    Implementation plan:

    1. Install uiohook-napi dependency

    2. Create src/services/hotkey-manager.ts with:
       - HotkeyManagerService interface
       - HotkeyManagerImpl class with singleton pattern
       - Use Electron globalShortcut for key down
       - Use uiohook-napi for key up detection
       - EventEmitter for hotkey:activated, hotkey:released, error events
       - macOS accessibility permission handling
    3. Export from src/services/index.ts

    4. Write unit tests with mocked dependencies
  - >-
    Implemented the hotkey manager service for system-wide keyboard shortcuts
    with push-to-talk support.


    Key features:

    1. Singleton pattern with initializeHotkeyManager()/getHotkeyManager()

    2. Uses Electron globalShortcut for key down detection

    3. Uses uiohook-napi for key up detection (essential for push-to-talk)

    4. EventEmitter pattern with hotkey:activated, hotkey:released, and error
    events

    5. macOS accessibility permission checking and prompting

    6. Automatic cleanup on app quit

    7. Graceful error handling for hotkey conflicts


    The service parses Electron accelerator format (e.g.,
    "CommandOrControl+Shift+Space") and maps to uiohook keycodes for key up
    detection. Comprehensive unit tests cover registration, event emission,
    unregistration, and accessibility permissions.
schema: v1.0
childrenIds: []
created: 2026-01-30T22:17:56.941Z
updated: 2026-01-30T22:17:56.941Z
---

# Implement Hotkey Manager Service

## Purpose

Create the core hotkey management service that registers system-wide keyboard shortcuts and emits events for both key down and key up events to support push-to-talk mode.

## Scope

### Core Implementation

- **Service file**: `src/services/hotkey-manager.ts`
- **Singleton pattern**: `initializeHotkeyManager()` / `getHotkeyManager()`
- **EventEmitter pattern**: emit events for state changes like existing services

### Hotkey Registration

- Use Electron's built-in `globalShortcut` module for key down detection
- Use `uiohook-napi` library for key up detection (required for push-to-talk)
- Read hotkey configuration from `HotkeyConfig` (already in `src/types/config.ts`)
- Cross-platform support (macOS and Windows)

### Key Features

1. **Register/unregister hotkeys** with Electron accelerator format
2. **Conflict detection** - gracefully handle when registration fails (hotkey in use)
3. **Key up/down events** - emit separate events for press and release
4. **macOS accessibility permission** - handle permission prompts appropriately
5. **Cleanup** - unregister all hotkeys on app quit

### Events Emitted

- `hotkey:activated` - when a registered hotkey is pressed
- `hotkey:released` - when a registered hotkey is released
- `error` - when registration fails

### Dependencies

- **npm install**: `uiohook-napi` (cross-platform keyboard hook library)

## Files to Create/Modify

- `src/services/hotkey-manager.ts` - New service (primary deliverable)
- `src/services/index.ts` - Export new service

## Acceptance Criteria

1. [ ] Hotkey registration succeeds on macOS and Windows
2. [ ] Hotkey triggers callback when app is not focused
3. [ ] Key down AND key up events are captured for push-to-talk support
4. [ ] Hotkey conflict gracefully handled with error logging
5. [ ] Service cleanup properly unregisters hotkeys on app quit
6. [ ] macOS accessibility permission prompt handled appropriately
7. [ ] Follows existing singleton/EventEmitter patterns

## Testing

- Unit tests with mocked Electron globalShortcut and uiohook-napi
- Manual testing required for actual OS-level hotkey capture
