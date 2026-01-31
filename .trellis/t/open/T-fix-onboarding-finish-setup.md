---
id: T-fix-onboarding-finish-setup
title: Fix onboarding "Finish Setup" button not closing window
status: open
priority: high
parent: none
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T18:29:19.723Z
updated: 2026-01-31T18:29:19.723Z
---

# Fix Onboarding "Finish Setup" Button Not Closing Window

## Problem

The "Finish Setup" button at the end of the onboarding wizard does nothing when clicked. The window should close and transition to tray mode.

## Context from Previous Investigation

The implementation added:

- `ONBOARDING_CLOSE` IPC channel in `src/types/ipc.ts`
- Handler in `src/ipc/onboarding-handler.ts` that calls `onboarding.hide()`
- `closeOnboardingWindow()` method in `src/preload/main.ts`
- `OnboardingApp.tsx` calls `window.electronAPI.closeOnboardingWindow()`
- Handler registered in `src/main.ts`

The onboarding window is configured to use the main preload (`src/windows/onboarding-window.ts:49-51`):

```typescript
function getPreloadPath(): string {
  return path.join(__dirname, "main.js");
}
```

**Likely root cause**: The preload path resolution may not be correct in the Vite build output. The `__dirname` in the built output may not point where expected, causing the preload to not load (or load the wrong file).

## Debugging Steps

1. Add logging to verify the preload is being loaded:
   - Log the resolved preload path in `onboarding-window.ts`
   - Check if `window.electronAPI` exists in the onboarding renderer (add console.log in OnboardingApp.tsx)
   - Check if `closeOnboardingWindow` method exists on `electronAPI`

2. Verify the IPC handler is registered:
   - Check logs for "Onboarding IPC handlers registered" message
   - Add logging to the handler to see if it's ever called

3. Compare with settings window (which uses same preload pattern):
   - Does the settings window have access to `electronAPI`?
   - Is this a build/path issue specific to onboarding or affecting all windows?

4. Check Vite/Forge build configuration:
   - Verify preload entry points in `forge.config.ts`
   - Ensure `main.js` is output to the correct location

## Acceptance Criteria

- [ ] Clicking "Finish Setup" button closes the onboarding window
- [ ] App transitions to tray mode after window closes
- [ ] `mise run quality` passes
- [ ] `mise run test` passes
