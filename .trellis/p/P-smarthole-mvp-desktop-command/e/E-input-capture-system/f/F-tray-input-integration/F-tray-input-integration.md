---
id: F-tray-input-integration
title: Tray Input Integration
status: in-progress
priority: medium
parent: E-input-capture-system
prerequisites:
  - F-global-hotkey-system
  - F-voice-recording-service
  - F-text-input-popup-window
affectedFiles:
  src/main.ts: Extended buildTrayMenu() to add input state detection and input
    menu items (Open Text Input, Start/Stop Recording toggle). Added
    stateChanged event subscription after input state initialization to trigger
    menu updates. Menu items have dynamic labels and enabled states based on
    current input state.; Updated to import buildTrayMenuTemplate from
    tray-menu.ts. Added enabled state to Open Text Input menu item during
    PROCESSING. Added stateChanged event subscription for menu updates.
  src/tray-menu.ts: "New module: Extracted tray menu template building logic for
    testability. Contains TrayMenuState, TrayMenuActions, MenuItemOptions
    interfaces and buildTrayMenuTemplate() function."
  src/tray-menu.test.ts: "New test file: 22 unit tests for tray menu template
    building logic covering all input states and menu structure."
log:
  - >-
    Started feature implementation. Created feature branch
    feature/F-tray-input-integration.


    Execution order:

    1. T-add-input-menu-items-and (no prerequisites)

    2. T-add-tray-icon-state (depends on #1)


    Starting with T-add-input-menu-items-and first.
  - >-
    Resuming feature implementation. Currently on branch
    feature/F-tray-input-integration.


    Both tasks are open:

    1. T-add-input-menu-items-and - ready to start

    2. T-add-tray-icon-state - blocked by T-add-input-menu-items-and


    Starting implementation of T-add-input-menu-items-and.
  - |-
    T-add-input-menu-items-and completed:
    - Added input menu items (Open Text Input, Start/Stop Recording)
    - Added dynamic state updates via stateChanged subscription
    - Review findings addressed (disabled state for PROCESSING, unit tests)
    - Created src/tray-menu.ts module with 22 unit tests

    Committing task changes.
schema: v1.0
childrenIds:
  - T-add-tray-icon-state
  - T-add-input-menu-items-and
created: 2026-01-30T22:15:47.857Z
updated: 2026-01-30T22:15:47.857Z
---

# Tray Input Integration

## Purpose

Enhance the existing system tray menu with input-related controls and visual state indicators. This provides mouse-based access to input features and gives users visibility into the current application state (idle, recording, processing).

## Scope

### Menu Items

- **"Open Text Input"**: Opens the text input popup window
- **"Start Recording" / "Stop Recording"**: Toggle for voice recording (label changes based on state)
- **Separator**: Visual separation from existing menu items (clients, about, quit)

### Visual State Indicators

- **Tray icon changes** to reflect current state:
  - Idle: Default icon
  - Recording: Recording indicator (e.g., red dot overlay or different icon)
  - Processing: Processing indicator (optional, if distinct from idle)
- **Menu item states**: Disabled items when actions not available (e.g., "Stop Recording" disabled when not recording)

### State Subscription

- **Subscribe to input state changes** from F-global-hotkey-system
- **Update menu dynamically** when state changes
- **Update tray icon** when state changes

## Technical Approach

1. **Extend existing tray code**: Modify `createTray()` and `buildTrayMenu()` in main.ts
2. **State subscription**: Listen to input state service events
3. **Dynamic menu rebuild**: Call `updateTrayMenu()` on state changes (pattern already exists for client changes)
4. **Icon management**: Create/swap NativeImage for different states

## Menu Structure

```
[Connected Clients section - existing]
---
Open Text Input
Start Recording / Stop Recording
---
About SmartHole
Quit
```

## Files to Create/Modify

- `src/main.ts` - Extend `buildTrayMenu()` with input items, add icon state management
- `src/assets/` - Additional tray icons for recording/processing states (if using distinct icons)
- `src/services/input-state.ts` - Ensure events are emitted for tray to subscribe

## Dependencies

- **F-global-hotkey-system**: Subscribes to input state for menu/icon updates
- **F-voice-recording-service**: "Start/Stop Recording" triggers recording
- **F-text-input-popup-window**: "Open Text Input" opens popup
- **No new npm packages**

## Acceptance Criteria

1. [ ] "Open Text Input" menu item opens text popup
2. [ ] "Start Recording" menu item initiates voice recording
3. [ ] Menu item label changes to "Stop Recording" while recording
4. [ ] "Stop Recording" stops current recording
5. [ ] Tray icon changes to indicate recording state
6. [ ] Menu items disabled when action not available
7. [ ] Menu updates immediately when state changes
8. [ ] Icons display correctly on macOS (template images) and Windows

## Testing Requirements

- Unit tests for menu building logic
- Manual testing for icon appearance and menu behavior

## Security Considerations

- Menu actions trigger same code paths as hotkeys (no bypass)
- No sensitive information displayed in menu

## Performance Requirements

- Menu rebuilds quickly (< 50ms)
- Icon changes immediately on state change
- No flickering during updates
