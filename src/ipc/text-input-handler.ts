/**
 * IPC handlers for text input popup communication.
 * Bridges the TextInputPopupService to IPC channels.
 *
 * @see F-text-input-popup-window feature specification
 */

import { IpcMainEvent } from "electron";
import { IPC_CHANNELS, isTextInputSubmitPayload } from "../types";
import { TextInputPopupService, getTextInputPopupImpl } from "../windows/text-input-popup";
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
      timestamp: payload.timestamp,
    });

    // Hide the popup
    popup.hide();

    // Emit the submitted event for downstream processing
    const popupImpl = getTextInputPopupImpl();
    if (popupImpl) {
      popupImpl.emitSubmitted(payload);
    }
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
