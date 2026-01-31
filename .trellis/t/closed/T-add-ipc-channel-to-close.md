---
id: T-add-ipc-channel-to-close
title: Add IPC channel to close onboarding window from renderer
status: done
priority: high
parent: none
prerequisites: []
affectedFiles:
  src/types/ipc.ts: Added ONBOARDING_CLOSE channel constant and void payload type
    to IpcPayloadMap
  src/types/ipc.test.ts: Updated channel count assertion from 40 to 41
  src/ipc/onboarding-handler.ts: Created new handler file with
    createOnboardingCloseHandler and registerOnboardingHandlers functions
  src/ipc/onboarding-handler.test.ts: Created unit tests for onboarding handler (5 test cases)
  src/ipc/index.ts: Added export for onboarding-handler module
  src/preload/main.ts: Added closeOnboardingWindow() method to electronAPI
  src/onboarding/OnboardingApp.tsx: Changed handleFinish to use
    window.electronAPI.closeOnboardingWindow() instead of window.close()
  src/main.ts: Added import for registerOnboardingHandlers and registered handlers
    after onboarding window initialization
log:
  - >-
    Starting implementation. Research complete:

    - Verified existing patterns in text-input-handler.ts and preload/main.ts

    - Confirmed IPC_CHANNELS has 40 channels currently

    - Confirmed handler registration happens in main.ts after onboarding window
    initialization

    - OnboardingApp.tsx currently uses window.close() on line 104
  - Implemented IPC channel for closing onboarding window from renderer. Added
    ONBOARDING_CLOSE channel constant and payload type to IPC definitions.
    Created onboarding-handler.ts with createOnboardingCloseHandler and
    registerOnboardingHandlers functions following the text-input-handler
    pattern. Added closeOnboardingWindow() method to the main preload API.
    Updated OnboardingApp.tsx to use the new IPC method instead of
    window.close(). Registered the handler in main.ts after onboarding window
    initialization. Created comprehensive unit tests that verify handler
    behavior and registration.
schema: v1.0
childrenIds: []
created: 2026-01-31T17:49:32.929Z
updated: 2026-01-31T17:49:32.929Z
---

# Add IPC Channel to Close Onboarding Window from Renderer

## Context

The onboarding wizard's "Finish Setup" button (`src/onboarding/OnboardingApp.tsx:102-105`) calls `window.close()` which does not work in Electron's renderer context when `contextIsolation: true` is enabled. This is because the renderer runs in a sandboxed environment and `window.close()` only works for windows opened by scripts, not for BrowserWindows.

The text input popup has a working pattern for this: `src/preload/popup.ts` exposes `popupAPI.dismiss()` which sends an IPC message, and `src/ipc/text-input-handler.ts` handles it by calling `popup.hide()` on the main process.

### Related Issues

- Part of F-first-run-experience feature (already marked done, but this bug was discovered during testing)

### Existing Patterns to Follow

- `src/preload/popup.ts:35-37` - Example of IPC-based window dismissal
- `src/ipc/text-input-handler.ts:59-68` - Handler pattern for window close
- `src/types/ipc.ts` - IPC channel definitions with type safety

## Implementation Requirements

### 1. Add IPC Channel Definition (`src/types/ipc.ts`)

Add a new channel constant:

```typescript
ONBOARDING_CLOSE: "onboarding:close", // Request to close onboarding window
```

Add to `IpcPayloadMap`:

```typescript
[IPC_CHANNELS.ONBOARDING_CLOSE]: void;
```

Update the channel count test assertion in `src/types/ipc.test.ts` (increment by 1).

### 2. Create IPC Handler (`src/ipc/onboarding-handler.ts`)

Create a new handler file following the pattern from `text-input-handler.ts`:

```typescript
import { IpcMainEvent } from "electron";
import { IPC_CHANNELS } from "../types";
import { OnboardingWindowService } from "../windows/onboarding-window";
import { Logger } from "../services/logger";

export function createOnboardingCloseHandler(
  onboardingGetter: () => OnboardingWindowService,
  logger: Logger
): (event: IpcMainEvent) => void {
  return (_event: IpcMainEvent): void => {
    logger.debug("Onboarding close requested via IPC");
    const onboarding = onboardingGetter();
    onboarding.hide();
  };
}

export function registerOnboardingHandlers(
  ipcMain: Electron.IpcMain,
  onboardingGetter: () => OnboardingWindowService,
  logger: Logger
): void {
  ipcMain.on(IPC_CHANNELS.ONBOARDING_CLOSE, createOnboardingCloseHandler(onboardingGetter, logger));
  logger.info("Onboarding IPC handlers registered");
}
```

Add export in `src/ipc/index.ts`.

### 3. Add Method to Preload (`src/preload/main.ts`)

Add to the `electronAPI` object:

```typescript
/**
 * Close the onboarding window.
 * Called when user completes or skips onboarding setup.
 */
closeOnboardingWindow: (): void => {
  ipcRenderer.send(IPC_CHANNELS.ONBOARDING_CLOSE);
},
```

Import `IPC_CHANNELS.ONBOARDING_CLOSE` is already available via the existing import.

### 4. Update OnboardingApp.tsx (`src/onboarding/OnboardingApp.tsx`)

Change the `handleFinish` callback from:

```typescript
const handleFinish = useCallback(() => {
  window.close();
}, []);
```

To:

```typescript
const handleFinish = useCallback(() => {
  window.electronAPI.closeOnboardingWindow();
}, []);
```

### 5. Register Handler in Main Process (`src/main.ts`)

After the onboarding window is initialized (around line 906), register the handler:

```typescript
// Register onboarding IPC handlers
const onboardingLogger = logger.child({ component: "OnboardingIPC" });
registerOnboardingHandlers(ipcMain, () => getOnboardingWindow(), onboardingLogger);
```

Add import at top of file:

```typescript
import { registerOnboardingHandlers } from "./ipc/onboarding-handler";
```

## Testing Requirements

### Unit Tests (`src/ipc/onboarding-handler.test.ts`)

Create tests covering:

1. `createOnboardingCloseHandler` calls `onboarding.hide()` when invoked
2. `registerOnboardingHandlers` registers the handler on the correct channel
3. Handler logs appropriately

Follow the pattern from `src/ipc/text-input-handler.test.ts`.

### Manual Testing

1. Run the app with first-run state (delete config or set `firstRunCompleted: false`)
2. Go through wizard to the Complete step
3. Click "Finish Setup" button
4. Verify window closes and app transitions to tray mode

## Acceptance Criteria

- [ ] `ONBOARDING_CLOSE` IPC channel defined in `src/types/ipc.ts`
- [ ] `src/types/ipc.test.ts` channel count updated
- [ ] `src/ipc/onboarding-handler.ts` created with handler and registration function
- [ ] `src/ipc/index.ts` exports the new module
- [ ] `closeOnboardingWindow()` method added to `src/preload/main.ts`
- [ ] `OnboardingApp.tsx` updated to use new API
- [ ] Handler registered in `src/main.ts`
- [ ] Unit tests pass
- [ ] `mise run quality` passes
- [ ] Manual test: "Finish Setup" button closes window

## Out of Scope

- Changing window close behavior when X button is clicked (separate task)
- Adding skip functionality changes
- Any UI changes to the onboarding wizard
- Changes to CompleteStep.tsx (it already correctly saves config before calling onFinish)
