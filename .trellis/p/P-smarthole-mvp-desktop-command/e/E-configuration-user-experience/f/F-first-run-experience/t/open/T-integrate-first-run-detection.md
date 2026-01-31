---
id: T-integrate-first-run-detection
title: Integrate first-run detection and onboarding in main process
status: open
priority: high
parent: F-first-run-experience
prerequisites:
  - T-implement-onboarding-wizard
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T16:47:29.090Z
updated: 2026-01-31T16:47:29.090Z
---

# Integrate First-Run Detection and Onboarding in Main Process

## Overview

Modify the main process startup flow to detect first-run state and show the onboarding window before normal app initialization completes.

## Deliverables

### 1. First-Run Detection Logic (`src/main.ts`)

After config manager initialization, check `firstRunCompleted`:

```typescript
const config = configState.configManager.getConfig();
if (!config.firstRunCompleted) {
  // Show onboarding window
}
```

### 2. Onboarding Window Initialization

- Initialize onboarding window service in `app.whenReady()`
- If first-run detected:
  - Show onboarding window
  - Do NOT hide dock icon on macOS (user needs to interact with window)
  - Onboarding window should block normal tray-only behavior until complete

### 3. Onboarding Completion Handling

- Listen for onboarding completion (window close after `firstRunCompleted: true`)
- After completion:
  - Hide dock icon on macOS
  - Normal tray behavior resumes
  - Onboarding window service can be cleaned up

### 4. Skip Flow Handling

- If user skips onboarding:
  - `firstRunCompleted` is set to `true` but config may be incomplete
  - Add logic to detect incomplete essential settings (e.g., missing API keys)
  - Show reminder in tray menu if essential settings missing:
    - Add "Setup Incomplete" item that opens settings
    - Only show if `firstRunCompleted` but missing required credentials

### 5. Re-run Protection

- Ensure onboarding only shows on actual first run
- If config exists with `firstRunCompleted: true`, skip onboarding entirely
- Handle edge case: config file deleted but credentials remain in keychain

## Technical Notes

- Order of operations in `app.whenReady()`:
  1. Initialize logger
  2. Initialize config manager
  3. Check `firstRunCompleted`
  4. If true: proceed with normal initialization (tray, services)
  5. If false: show onboarding, defer tray creation until onboarding completes
- The dock icon visibility (`app.dock.hide()`) should be deferred until after onboarding on macOS
- Consider using an event emitter pattern for onboarding completion

## Acceptance Criteria

- [ ] First-run correctly detected via `firstRunCompleted` config field
- [ ] Onboarding window shown on first launch
- [ ] Dock icon visible during onboarding on macOS
- [ ] Normal tray behavior after onboarding completes
- [ ] Skip flow correctly marks first run complete
- [ ] Tray menu shows reminder if essential settings missing
- [ ] Re-running after completion goes straight to tray
- [ ] Clean startup/shutdown handling
