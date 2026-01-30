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

## Goal

Create IPC handlers for text input popup channels and wire the textInput hotkey to open the popup.

## Key Files to Create/Modify

| File                                                               | Purpose                                    |
| ------------------------------------------------------------------ | ------------------------------------------ |
| `/Users/zach/code/smarthole-desktop/src/ipc/text-input-handler.ts` | Create - IPC handlers for popup            |
| `/Users/zach/code/smarthole-desktop/src/ipc/index.ts`              | Modify - Export new handler                |
| `/Users/zach/code/smarthole-desktop/src/main.ts`                   | Modify - Register handlers and wire hotkey |

## Patterns to Follow

Follow `src/ipc/input-state-handler.ts` pattern:

- Factory functions for handlers
- `wireXToIpc()` function for event bridging
- Logger integration
- Typed event handlers

## Implementation Details

### 1. text-input-handler.ts

```typescript
/**
 * IPC handlers for text input popup communication.
 * Bridges the TextInputPopupService to IPC channels.
 *
 * @see F-text-input-popup-window feature specification
 */

import { IpcMainEvent } from "electron";
import { IPC_CHANNELS, TextInputSubmitPayload, isTextInputSubmitPayload } from "../types";
import { TextInputPopupService } from "../windows/text-input-popup";
import { HotkeyManagerService } from "../services/hotkey-manager";
import { Logger } from "../services/logger";

/**
 * Creates handler for TEXT_INPUT_SUBMIT channel.
 * Handles text submission from the popup, hides it, and emits event.
 *
 * @param popupGetter - Function to get the popup service
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.on()
 */
export function createTextInputSubmitHandler(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): (event: IpcMainEvent, payload: unknown) => void {
  return (_event: IpcMainEvent, payload: unknown): void => {
    // Validate payload
    if (!isTextInputSubmitPayload(payload)) {
      logger.warn("Invalid text input submit payload received", { payload });
      return;
    }

    const popup = popupGetter();

    logger.info("Text input submitted", {
      textLength: payload.text.length,
      submittedAt: payload.submittedAt,
    });

    // Hide the popup
    popup.hide();

    // The popup service will emit the 'submitted' event for downstream processing
  };
}

/**
 * Creates handler for TEXT_INPUT_DISMISSED channel.
 * Handles popup dismissal (user pressed Escape or clicked outside).
 *
 * @param popupGetter - Function to get the popup service
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.on()
 */
export function createTextInputDismissedHandler(
  popupGetter: () => TextInputPopupService,
  logger: Logger
): (event: IpcMainEvent) => void {
  return (_event: IpcMainEvent): void => {
    logger.debug("Text input dismissed");

    const popup = popupGetter();
    popup.hide();
  };
}

/**
 * Creates handler for TEXT_INPUT_FOCUSED channel.
 * Logs when the popup gains focus (for analytics/debugging).
 *
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.on()
 */
export function createTextInputFocusedHandler(logger: Logger): (event: IpcMainEvent) => void {
  return (_event: IpcMainEvent): void => {
    logger.debug("Text input popup focused");
  };
}

/**
 * Wires the text input popup to the hotkey manager.
 * Opens the popup when the textInput hotkey is activated.
 *
 * @param hotkeyManager - The hotkey manager service
 * @param popupGetter - Function to get the popup service
 * @param logger - Logger for debug output
 */
export function wireTextInputToHotkey(
  hotkeyManager: HotkeyManagerService,
  popupGetter: () => TextInputPopupService,
  logger: Logger
): void {
  hotkeyManager.on("hotkey:activated", (event) => {
    if (event.hotkeyType === "textInput") {
      const popup = popupGetter();

      if (!popup.isVisible()) {
        popup.show();
        logger.debug("Text input popup opened via hotkey", {
          accelerator: event.accelerator,
        });
      } else {
        // If already visible, just ensure focus
        popup.getWindow()?.focus();
        logger.debug("Text input popup already visible, focused", {
          accelerator: event.accelerator,
        });
      }
    }
  });

  logger.info("Text input popup wired to hotkey manager");
}

/**
 * Registers all text input IPC handlers with ipcMain.
 * Call this after initializing the popup service.
 *
 * @param ipcMain - The Electron ipcMain module
 * @param popupGetter - Function to get the popup service
 * @param logger - Logger for debug output
 */
export function registerTextInputHandlers(
  ipcMain: Electron.IpcMain,
  popupGetter: () => TextInputPopupService,
  logger: Logger
): void {
  ipcMain.on(IPC_CHANNELS.TEXT_INPUT_SUBMIT, createTextInputSubmitHandler(popupGetter, logger));

  ipcMain.on(
    IPC_CHANNELS.TEXT_INPUT_DISMISSED,
    createTextInputDismissedHandler(popupGetter, logger)
  );

  ipcMain.on(IPC_CHANNELS.TEXT_INPUT_FOCUSED, createTextInputFocusedHandler(logger));

  logger.info("Text input IPC handlers registered");
}
```

### 2. Update ipc/index.ts

Add export for the new handler module:

```typescript
export * from "./text-input-handler";
```

### 3. Update main.ts

Add imports and initialization:

```typescript
// Add to imports
import {
  initializeTextInputPopup,
  getTextInputPopup,
  TextInputPopupService,
} from "./windows/text-input-popup";
import { registerTextInputHandlers, wireTextInputToHotkey } from "./ipc/text-input-handler";

// Add to wsState (or create new popupState object)
const popupState: {
  textInput: TextInputPopupService | null;
} = {
  textInput: null,
};

// Inside app.whenReady(), after hotkey manager initialization:

// Initialize text input popup
popupState.textInput = initializeTextInputPopup();
logger.info("Text input popup initialized");

// Register text input IPC handlers
const textInputLogger = logger.child({ component: "TextInputIPC" });
registerTextInputHandlers(ipcMain, () => getTextInputPopup(), textInputLogger);

// Wire text input popup to hotkey manager
wireTextInputToHotkey(inputState.hotkeyManager, () => getTextInputPopup(), textInputLogger);

// Wire popup submitted event to downstream processing
popupState.textInput.on("submitted", (payload) => {
  logger.info("Text input ready for processing", {
    textLength: payload.text.length,
  });
  // TODO: Route to message processing in future task
});
```

### 4. Create Tests

Create `/Users/zach/code/smarthole-desktop/src/ipc/text-input-handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTextInputSubmitHandler,
  createTextInputDismissedHandler,
  createTextInputFocusedHandler,
} from "./text-input-handler";

describe("text-input-handler", () => {
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };

  const mockPopup = {
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(),
    getWindow: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  const mockEvent = {} as Electron.IpcMainEvent;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTextInputSubmitHandler", () => {
    it("hides popup on valid submit", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, {
        text: "hello world",
        submittedAt: "2024-01-01T00:00:00Z",
      });

      expect(mockPopup.hide).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Text input submitted",
        expect.objectContaining({ textLength: 11 })
      );
    });

    it("warns on invalid payload", () => {
      const handler = createTextInputSubmitHandler(() => mockPopup, mockLogger);

      handler(mockEvent, { invalid: true });

      expect(mockPopup.hide).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("createTextInputDismissedHandler", () => {
    it("hides popup on dismiss", () => {
      const handler = createTextInputDismissedHandler(() => mockPopup, mockLogger);

      handler(mockEvent);

      expect(mockPopup.hide).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith("Text input dismissed");
    });
  });

  describe("createTextInputFocusedHandler", () => {
    it("logs focus event", () => {
      const handler = createTextInputFocusedHandler(mockLogger);

      handler(mockEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith("Text input popup focused");
    });
  });
});
```

## Acceptance Criteria

- [ ] `createTextInputSubmitHandler` validates payload and hides popup
- [ ] `createTextInputDismissedHandler` hides popup on dismiss
- [ ] `createTextInputFocusedHandler` logs focus events
- [ ] `wireTextInputToHotkey` opens popup on textInput hotkey
- [ ] `registerTextInputHandlers` convenience function
- [ ] Handlers exported from `src/ipc/index.ts`
- [ ] Handlers registered in `src/main.ts`
- [ ] Popup wired to hotkey manager in `src/main.ts`
- [ ] Unit tests for all handlers
- [ ] Tests pass: `mise run test`
- [ ] Quality checks pass: `mise run quality`

## Dependencies

- T-add-text-input-popup-ipc (for IPC_CHANNELS, types)
- T-create-text-input-popup (for TextInputPopupService)

## Estimated Complexity

Medium - IPC handler creation, hotkey wiring, main.ts integration.
