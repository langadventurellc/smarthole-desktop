/**
 * IPC hotkey handler for broadcasting hotkey events to renderer processes.
 * Bridges the HotkeyManagerService events to IPC channels.
 *
 * @see F-global-hotkey-system feature specification
 */

import { BrowserWindow } from "electron";
import { IPC_CHANNELS, HotkeyActivatedEvent, HotkeyReleasedEvent } from "../types";
import { HotkeyManagerService } from "../services/hotkey-manager";
import { Logger } from "../services/logger";

/**
 * Broadcasts a hotkey activated event to all renderer windows.
 *
 * @param event - The hotkey activated event
 */
export function broadcastHotkeyActivated(event: HotkeyActivatedEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.HOTKEY_ACTIVATED, event);
    }
  }
}

/**
 * Broadcasts a hotkey released event to all renderer windows.
 *
 * @param event - The hotkey released event
 */
export function broadcastHotkeyReleased(event: HotkeyReleasedEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.HOTKEY_RELEASED, event);
    }
  }
}

/**
 * Wires up hotkey manager events to IPC broadcasts.
 * Call this after initializing the hotkey manager to enable IPC broadcasting.
 *
 * @param hotkeyManager - The initialized hotkey manager service
 * @param logger - Logger for debug output
 */
export function wireHotkeyManagerToIpc(hotkeyManager: HotkeyManagerService, logger: Logger): void {
  hotkeyManager.on("hotkey:activated", (event) => {
    logger.debug("Broadcasting hotkey:activated to renderer", {
      accelerator: event.accelerator,
      hotkeyType: event.hotkeyType,
    });
    broadcastHotkeyActivated(event);
  });

  hotkeyManager.on("hotkey:released", (event) => {
    logger.debug("Broadcasting hotkey:released to renderer", {
      accelerator: event.accelerator,
      hotkeyType: event.hotkeyType,
    });
    broadcastHotkeyReleased(event);
  });

  logger.info("Hotkey manager wired to IPC");
}
