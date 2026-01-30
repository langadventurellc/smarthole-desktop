---
id: T-add-text-input-ipc-handlers
title: Add text input IPC handlers and hotkey integration
status: open
priority: high
parent: F-text-input-popup-window
prerequisites:
  - T-add-text-input-popup-ipc
  - T-create-text-input-popup
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T23:42:28.512Z
updated: 2026-01-30T23:42:28.512Z
---

# Add Text Input IPC Handlers and Hotkey Integration

## Context

This task implements the IPC handlers for text input popup communication and wires up the text input hotkey to trigger the popup. This connects the popup window service to the IPC layer and hotkey system.

**Reference**:

- Feature spec: F-text-input-popup-window
- IPC patterns: `src/ipc/hotkey-handler.ts`, `src/ipc/input-state-handler.ts`
- Hotkey system: `src/services/hotkey-manager.ts`

## Implementation Requirements

### 1. Create IPC Handler Module

Create `src/ipc/text-input-handler.ts`:

```typescript
import { ipcMain, IpcMainEvent } from "electron";
import { IPC_CHANNELS, TextInputSubmitPayload } from "../types";
import { TextInputPopupService } from "../windows/text-input-popup";
import { Logger } from "../services/logger";

/**
 * Creates handler for text input submit events from popup.
 */
export function createTextInputSubmitHandler(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): (event: IpcMainEvent, payload: TextInputSubmitPayload) => void {
  return (_event, payload) => {
    logger.debug("Text input submitted", { textLength: payload.text.length });
    popupGetter().hide();
    // Emit event or pass to downstream processing (future task)
  };
}

/**
 * Creates handler for popup dismissed events.
 */
export function createTextInputDismissedHandler(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): (event: IpcMainEvent) => void {
  return () => {
    logger.debug("Text input dismissed");
    popupGetter().hide();
  };
}

/**
 * Creates handler for popup focused events.
 */
export function createTextInputFocusedHandler(logger: Logger): (event: IpcMainEvent) => void {
  return () => {
    logger.debug("Text input popup focused");
  };
}

/**
 * Registers all text input IPC handlers.
 */
export function registerTextInputHandlers(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): void {
  ipcMain.on(IPC_CHANNELS.TEXT_INPUT_SUBMIT, createTextInputSubmitHandler(popupGetter, logger));
  ipcMain.on(
    IPC_CHANNELS.TEXT_INPUT_DISMISSED,
    createTextInputDismissedHandler(popupGetter, logger)
  );
  ipcMain.on(IPC_CHANNELS.TEXT_INPUT_FOCUSED, createTextInputFocusedHandler(logger));
}
```

### 2. Wire Hotkey to Popup

In main.ts, add handler for textInput hotkey:

```typescript
inputState.hotkeyManager.on("hotkey:activated", (event) => {
  if (event.hotkeyType === "textInput") {
    const popup = getTextInputPopup();
    popup.show();
    logger.debug("Text input hotkey activated, showing popup");
  }
  // existing voiceInput handling...
});
```

### 3. Export from IPC Index

Update `src/ipc/index.ts` to export the new handlers.

## Files to Create

- `src/ipc/text-input-handler.ts` - IPC handlers for text input

## Files to Modify

- `src/ipc/index.ts` - Export text input handlers
- `src/main.ts` - Register handlers, wire hotkey

## Acceptance Criteria

- [ ] `createTextInputSubmitHandler` hides popup on submit
- [ ] `createTextInputDismissedHandler` hides popup on dismiss
- [ ] `createTextInputFocusedHandler` logs focus event
- [ ] `registerTextInputHandlers` registers all handlers with ipcMain
- [ ] Text input hotkey (`hotkeyType === "textInput"`) opens popup
- [ ] Handlers follow existing patterns (factory functions, logger injection)
- [ ] Unit tests for all handlers
- [ ] Passes `mise run quality`

## Testing Requirements

- Unit tests for each handler function (mock popup service, verify hide called)
- Unit tests for handler registration

## Out of Scope

- Processing submitted text (future feature for routing)
- Popup window management (T-create-text-input-popup)
- Popup UI (T-create-popup-preload-script)
- Build configuration (separate task)
