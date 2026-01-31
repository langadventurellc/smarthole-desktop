/**
 * IPC dialog handler for the main process.
 * Provides native file dialog access to the renderer process.
 */

import { IpcMainInvokeEvent, dialog } from "electron";
import { DialogOpenOptions, DialogOpenResponse } from "../types";
import { Logger } from "../services/logger";

/**
 * Creates an IPC handler function for DIALOG_OPEN channel.
 * Shows a native open file/directory dialog.
 *
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createDialogOpenHandler(
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, options?: DialogOpenOptions) => Promise<DialogOpenResponse> {
  return async (
    _event: IpcMainInvokeEvent,
    options?: DialogOpenOptions
  ): Promise<DialogOpenResponse> => {
    try {
      ipcLogger.debug("Opening file dialog", {
        title: options?.title,
        defaultPath: options?.defaultPath,
        properties: options?.properties,
      });

      const result = await dialog.showOpenDialog({
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        properties: options?.properties ?? ["openFile"],
      });

      ipcLogger.debug("File dialog closed", {
        canceled: result.canceled,
        fileCount: result.filePaths.length,
      });

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
      };
    } catch (error) {
      ipcLogger.error("Failed to open file dialog", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let the renderer handle the error
      throw error;
    }
  };
}
