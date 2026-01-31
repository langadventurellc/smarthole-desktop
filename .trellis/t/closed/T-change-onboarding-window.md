---
id: T-change-onboarding-window
title: Change onboarding window close to always transition to tray mode
status: done
priority: high
parent: none
prerequisites:
  - T-add-ipc-channel-to-close
affectedFiles:
  src/main.ts: Changed window close handler (lines 927-947) to always transition
    to tray mode. Removed app.quit() branch, added auto-marking of
    firstRunCompleted when closing without completion.
log:
  - >-
    Research complete. Found:

    - Window close handler at lines 927-946 in src/main.ts

    - checkSetupIncomplete() function at lines 219-231 checks for missing
    Anthropic API key

    - initializeNormalOperation() at lines 237-254 sets setupIncomplete flag and
    creates tray

    - Current behavior: quits app when firstRunCompleted is false on window
    close


    Starting implementation of the new close handler.
  - >-
    Modified the onboarding window close handler in src/main.ts to always
    transition to tray mode instead of quitting the app. The key changes are:


    1. Removed the app.quit() branch that previously triggered when
    firstRunCompleted was false

    2. Added auto-marking of firstRunCompleted=true when user closes the window
    without completing onboarding

    3. Always calls initializeNormalOperation() to transition to tray mode


    The existing checkSetupIncomplete() function will detect missing credentials
    and set the setupIncomplete flag, which displays the "Setup Incomplete"
    reminder in the tray menu to prompt users to finish configuration.
schema: v1.0
childrenIds: []
created: 2026-01-31T17:49:59.189Z
updated: 2026-01-31T17:49:59.189Z
---

# Change Onboarding Window Close to Always Transition to Tray Mode

## Context

Currently, when the onboarding window is closed (via X button or any other means), the app checks if `firstRunCompleted` is set. If not, it quits the application entirely (`src/main.ts:936-939`):

```typescript
} else {
  // User closed without completing - quit the app
  logger.info("Onboarding closed without completion, quitting");
  app.quit();
}
```

The expected behavior is: closing the onboarding window should **always** transition to normal tray mode, regardless of whether the user completed setup. The existing "Setup Incomplete" tray menu reminder (already implemented) will prompt users to finish configuration.

### Related Issues

- Part of F-first-run-experience feature
- Depends on T-add-ipc-channel-to-close (IPC for closing window from renderer)

### Existing Implementation

- `src/main.ts:919-942` - Current window close handler with quit logic
- `src/main.ts:217-230` - `checkSetupIncomplete()` function already checks for missing credentials
- `src/tray-menu.ts` - "Setup Incomplete" menu item already implemented

## Implementation Requirements

### 1. Modify Window Close Handler (`src/main.ts`)

Change the `browserWindow.on("closed", ...)` handler (around lines 922-942) from:

```typescript
browserWindow.on("closed", () => {
  logger.info("Onboarding window closed");
  onboardingState.isOnboarding = false;

  // Check if firstRunCompleted was set (user finished or skipped)
  const updatedConfig = getConfigManager().getConfig();
  if (updatedConfig.firstRunCompleted) {
    logger.info("Onboarding completed, transitioning to normal operation");
    initializeNormalOperation().catch((error) => {
      logger.error("Failed to initialize normal operation", {
        error: error instanceof Error ? error.message : String(error),
      });
      app.quit();
    });
  } else {
    // User closed without completing - quit the app
    logger.info("Onboarding closed without completion, quitting");
    app.quit();
  }
});
```

To:

```typescript
browserWindow.on("closed", () => {
  logger.info("Onboarding window closed");
  onboardingState.isOnboarding = false;

  // Always transition to tray mode, regardless of completion status
  // The setupIncomplete flag in tray menu will remind user to configure
  const updatedConfig = getConfigManager().getConfig();
  if (!updatedConfig.firstRunCompleted) {
    logger.info("Onboarding closed without completion, marking first run complete");
    // Mark first run complete so onboarding doesn't show again
    getConfigManager().setConfig({ firstRunCompleted: true });
  }

  logger.info("Transitioning to normal operation");
  initializeNormalOperation().catch((error) => {
    logger.error("Failed to initialize normal operation", {
      error: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  });
});
```

### Key Behavior Changes

1. **Never quit on window close** - Always transition to tray mode
2. **Auto-mark firstRunCompleted** - If user closes without completing, mark it complete so onboarding doesn't show again on next launch
3. **Rely on setupIncomplete reminder** - The `checkSetupIncomplete()` function in `initializeNormalOperation()` will detect missing credentials and show the tray menu reminder

### Why This Works

The existing flow already handles incomplete setup gracefully:

- `initializeNormalOperation()` calls `checkSetupIncomplete()` (line 243-249)
- `checkSetupIncomplete()` checks for missing Anthropic API key
- If incomplete, sets `onboardingState.setupIncomplete = true`
- Tray menu shows "Setup Incomplete" item when `setupIncomplete` is true

## Testing Requirements

### Manual Testing Scenarios

1. **Complete flow**: Go through full wizard, click "Finish Setup"
   - Expected: Window closes, app in tray, no "Setup Incomplete" reminder (if API key entered)

2. **Close via X button mid-wizard**: Close window at any step before completion
   - Expected: Window closes, app in tray, "Setup Incomplete" shows in tray menu

3. **Close via X on completion screen**: Get to final screen but click X instead of "Finish Setup"
   - Expected: Same as #2 - app transitions to tray

4. **Relaunch after incomplete close**: After closing via X, quit and relaunch app
   - Expected: App starts directly in tray mode (no onboarding), "Setup Incomplete" shows

5. **Complete setup from tray**: Click "Setup Incomplete" in tray menu
   - Expected: Settings window opens for user to finish configuration

### Unit Tests

The main.ts file doesn't have dedicated unit tests for the startup flow (it's integration-level). Focus on manual testing for this change.

## Acceptance Criteria

- [ ] Closing onboarding window via X button transitions to tray mode (not quit)
- [ ] Closing onboarding window via "Finish Setup" transitions to tray mode
- [ ] `firstRunCompleted` is auto-set to `true` when window closes without explicit completion
- [ ] "Setup Incomplete" shows in tray menu when credentials are missing
- [ ] App launches directly to tray on subsequent runs (no repeat onboarding)
- [ ] `mise run quality` passes

## Out of Scope

- Adding new IPC channels (handled by T-add-ipc-channel-to-close)
- Changes to the onboarding UI components
- Changes to the "Setup Incomplete" tray menu item behavior
- Adding ability to re-run onboarding from settings
