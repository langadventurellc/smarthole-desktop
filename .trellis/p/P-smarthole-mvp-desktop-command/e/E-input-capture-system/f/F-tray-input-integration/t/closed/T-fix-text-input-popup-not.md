---
id: T-fix-text-input-popup-not
title: Fix text input popup not appearing when triggered from tray menu
status: done
priority: high
parent: F-tray-input-integration
prerequisites: []
affectedFiles:
  src/windows/text-input-popup.ts: Added isShowing flag to prevent blur during
    show, added activateAndShow() private method, modified show() to wait for
    content load and use isShowing protection, modified blur handler to check
    isShowing flag, updated destroy() to reset isShowing
  src/windows/text-input-popup.test.ts: Added isLoading and once mocks to
    webContents, updated blur event test to use fake timers, added new test for
    blur-during-show race condition prevention
log:
  - >-
    Fixed text input popup not appearing:


    Root cause: The blur event handler was firing immediately during window
    activation, before the window had a chance to gain focus properly. This
    caused the popup to hide immediately after being shown.


    Changes:

    1. Added `isShowing` flag to track when popup is in the middle of showing

    2. Modified blur handler to ignore blur events during the initial show phase

    3. Modified show() to check if content is loaded before showing window

    4. Added 100ms delay before clearing isShowing flag to allow focus to settle

    5. Updated tests to account for new behavior:
       - Added isLoading and once methods to webContents mock
       - Added test for blur-during-show race condition prevention
       - Updated existing blur event test to use fake timers

    All 803 tests passing, quality checks pass.
  - Fixed text input popup not appearing by preventing a race condition in the
    blur handler. Added an isShowing flag that prevents the blur handler from
    hiding the popup during the initial window activation phase, and ensured
    content is loaded before showing the window.
schema: v1.0
childrenIds: []
created: 2026-01-31T04:58:49.668Z
updated: 2026-01-31T04:58:49.668Z
---

# Fix Text Input Popup Not Appearing

## Problem

When clicking "Open Text Input" from the tray menu, no UI appears on screen. The tray menu closes (as expected when clicking an item), but the text input popup window is not visible.

## Context

The text input popup is implemented in `src/windows/text-input-popup.ts`. It creates a frameless, transparent `BrowserWindow` that should appear centered on the active display (like Spotlight/Alfred).

The popup is configured as:

- `frame: false` - No window chrome
- `transparent: true` - Transparent background
- `alwaysOnTop: true` - Should appear above other windows
- `show: false` - Created hidden, shown on `show()` call
- Size: 600x60 pixels

## Possible Causes to Investigate

1. **Blur handler hiding immediately**: Lines 186-190 in `text-input-popup.ts` hide the popup on blur. The window might be losing focus immediately after showing.

2. **Content not rendering**: The window is transparent, so if the popup HTML/React content fails to load or render, the window would be invisible.

3. **URL loading error**: The popup loads content via `getPopupUrl()` which uses either a Vite dev server URL or a production file path. Check if the URL is resolving correctly.

4. **Preload script issues**: The popup uses a separate preload script (`preload-popup.js`). If this fails to load, the popup may not function.

5. **Window position off-screen**: `calculateCenteredPosition()` calculates position based on cursor location and display work area. Could be positioning incorrectly.

## Files to Investigate

- `src/windows/text-input-popup.ts` - Popup window management
- `src/popup/` - Popup React UI (if content rendering issue)
- `src/preload-popup.ts` - Popup preload script
- `vite.renderer.popup.config.ts` - Vite config for popup renderer

## Debugging Steps

1. Add console/logger output to `show()` method to confirm it's being called
2. Check if window is created (`this.window` not null after `createWindow()`)
3. Log the URL being loaded (`getPopupUrl()` result)
4. Check for errors in popup webContents (add `webContents.on('did-fail-load')` handler)
5. Log window position after `centerOnActiveDisplay()` to verify it's on-screen
6. Temporarily remove the blur handler to see if popup stays visible

## Acceptance Criteria

1. [ ] Clicking "Open Text Input" from tray menu shows the text input popup
2. [ ] Popup appears centered on the active display
3. [ ] Popup input field is focused and ready for typing
4. [ ] No errors in dev console or logs when showing popup
5. [ ] Works in both dev mode (`mise run dev`) and production build

## Testing Requirements

- Manual testing in dev mode with logging enabled
- Test on both primary and secondary displays (if available)
- Verify popup appears when triggered via tray menu

## Out of Scope

- Changes to popup styling or UX
- Adding new features to the popup
- Fixing issues with text submission (separate concern)
