---
id: T-fix-settings-window-loading
title: Fix settings window loading blank
status: open
priority: high
parent: none
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T18:29:19.834Z
updated: 2026-01-31T18:29:19.834Z
---

# Fix Settings Window Loading Blank

## Problem

When clicking "Setup Incomplete" in the tray menu (or opening settings), the settings window opens but displays blank content - nothing is rendered.

## Context

The settings window uses the same preload pattern as the onboarding window:

- `src/windows/settings-window.ts:49-51` uses `path.join(__dirname, "main.js")`
- Settings UI is in `src/settings/` with React components

This bug was discovered while testing the onboarding flow. It may share the same root cause as the onboarding button issue (preload not loading correctly).

## Debugging Steps

1. Check browser dev tools in the settings window:
   - Open dev tools (Cmd+Option+I or View menu)
   - Look for JavaScript errors in console
   - Check if React is mounting at all

2. Verify content is loading:
   - Check logs for "Settings window content finished loading" message
   - Add console.log to `src/settings/SettingsApp.tsx` to verify it's executing

3. Check if this is a preload issue:
   - Log whether `window.electronAPI` exists
   - Compare with working windows (if any)

4. Check Vite build output:
   - Verify the settings renderer HTML/JS is being built
   - Check `SETTINGS_WINDOW_VITE_DEV_SERVER_URL` in dev mode
   - Verify file paths in production mode

5. Test in dev vs production:
   - Does it work in `mise run dev`?
   - Does it work in built app?

## Acceptance Criteria

- [ ] Settings window displays content when opened
- [ ] All settings tabs are visible and functional
- [ ] `mise run quality` passes
- [ ] `mise run test` passes
