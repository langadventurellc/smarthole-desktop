---
id: T-add-tray-icon-state
title: Add tray icon state indication for recording
status: open
priority: medium
parent: F-tray-input-integration
prerequisites:
  - T-add-input-menu-items-and
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T03:00:59.510Z
updated: 2026-01-31T03:00:59.510Z
---

# Add tray icon state indication for recording

## Context

The tray icon should visually indicate when voice recording is active, providing users with clear feedback even without opening the tray menu. This task adds icon state management to reflect recording state.

**Parent Feature**: F-tray-input-integration
**Prerequisite Task**: T-add-input-menu-items-and (menu items and state subscription)

## Current State

- `createTrayIcon()` in `src/main.ts:155-179` creates a single 16x16 black square icon
- Icon is created once during `createTray()` and never updated
- No `src/assets/` directory exists for icon assets
- macOS template image support is already implemented (line 174-176)

## Implementation Requirements

### 1. Create icon generation functions for each state

Create functions to generate state-specific icons programmatically (no external asset files):

```typescript
function createIdleIcon(): Electron.NativeImage {
  // Current black square icon
}

function createRecordingIcon(): Electron.NativeImage {
  // Red filled circle or square to indicate recording
  // 16x16, red color (255, 0, 0)
}
```

**Icon specifications:**

- **Idle**: Current black filled square (16x16)
- **Recording**: Red filled circle or square (16x16) - visually distinct from idle

### 2. Add icon state management

Create a function to update the tray icon based on current state:

```typescript
function updateTrayIcon(state: InputState): void {
  if (!tray) return;

  const icon = state === InputState.RECORDING ? createRecordingIcon() : createIdleIcon();

  tray.setImage(icon);
}
```

### 3. Subscribe to state changes for icon updates

In the existing `stateChanged` subscription (added by T-add-input-menu-items-and), add icon update:

```typescript
inputState.inputStateService.on("stateChanged", (event) => {
  updateTrayMenu();
  updateTrayIcon(event.newState);
});
```

### 4. Handle macOS template images

Both icons should be marked as template images on macOS for proper menu bar theme adaptation:

```typescript
if (process.platform === "darwin") {
  icon.setTemplateImage(true);
}
```

Note: Red recording icon may not adapt well as a template image. Consider using a distinct shape (filled vs outline) rather than color for macOS, or skip template image for recording state.

## Technical Approach

1. Refactor `createTrayIcon()` into `createIdleIcon()` (same implementation)
2. Create `createRecordingIcon()` with red color buffer
3. Create `updateTrayIcon(state: InputState)` function
4. Update `createTray()` to use `createIdleIcon()`
5. Modify state change subscription to call `updateTrayIcon()`
6. Test icon changes by starting/stopping recording

## Acceptance Criteria

1. [ ] Idle state shows black square icon (current behavior preserved)
2. [ ] Recording state shows visually distinct icon (red indicator)
3. [ ] Icon changes immediately when recording starts
4. [ ] Icon returns to idle when recording stops
5. [ ] macOS template image handling preserved for idle icon
6. [ ] Icon displays correctly on both macOS and Windows
7. [ ] No external asset files required (programmatic generation)

## Testing Requirements

- Unit tests for icon generation functions return valid NativeImage
- Test `updateTrayIcon()` calls `tray.setImage()` with correct icon
- Manual testing for visual appearance on macOS and Windows

## Out of Scope

- Processing state icon (optional per feature spec, not implementing)
- External icon asset files in src/assets/
- Animated icons
- High-DPI icon variants (basic 16x16 sufficient)
- Menu item changes (handled by T-add-input-menu-items-and)
