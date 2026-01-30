/**
 * IPC input state handler for state queries and broadcasts to renderer processes.
 * Bridges the InputStateService to IPC channels.
 *
 * @see F-global-hotkey-system feature specification
 */

import { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { IPC_CHANNELS, InputStateInfo, InputStateChangedEvent } from "../types";
import { InputStateService } from "../services/input-state";
import { Logger } from "../services/logger";

/**
 * Broadcasts an input state changed event to all renderer windows.
 *
 * @param event - The input state changed event
 */
export function broadcastInputStateChanged(event: InputStateChangedEvent): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.INPUT_STATE_CHANGED, event);
    }
  }
}

/**
 * Creates an IPC handler function for INPUT_GET_STATE channel.
 * Returns the current input state information.
 *
 * @param getInputState - Function to get the input state service
 * @param logger - Logger for debug output
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createInputStateHandler(
  getInputState: () => InputStateService,
  logger: Logger
): (_event: IpcMainInvokeEvent) => InputStateInfo {
  return (_event: IpcMainInvokeEvent): InputStateInfo => {
    try {
      const inputState = getInputState();
      const stateInfo = inputState.getStateInfo();

      logger.debug("Input state requested", { state: stateInfo.state, mode: stateInfo.mode });

      return stateInfo;
    } catch (error) {
      logger.error("Failed to get input state", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return a default idle state rather than throwing
      return {
        state: "idle",
        mode: "push-to-talk",
        stateEnteredAt: Date.now(),
      };
    }
  };
}

/**
 * Wires up input state service events to IPC broadcasts.
 * Call this after initializing the input state service to enable IPC broadcasting.
 *
 * @param inputState - The initialized input state service
 * @param logger - Logger for debug output
 */
export function wireInputStateToIpc(inputState: InputStateService, logger: Logger): void {
  inputState.on("stateChanged", (event) => {
    logger.debug("Broadcasting input:stateChanged to renderer", {
      previousState: event.previousState,
      newState: event.newState,
    });
    broadcastInputStateChanged(event);
  });

  logger.info("Input state service wired to IPC");
}
