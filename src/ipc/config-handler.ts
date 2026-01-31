/**
 * IPC config handler for the main process.
 * Provides configuration management to the renderer process.
 */

import { IpcMainInvokeEvent, BrowserWindow } from "electron";
import { ConfigGetResponse, ConfigSetPayload, ConfigChangedPayload, IPC_CHANNELS } from "../types";
import { ConfigManagerService } from "../services/config-manager";
import { Logger } from "../services/logger";

/**
 * Creates an IPC handler function for CONFIG_GET channel.
 * Returns the current application configuration.
 *
 * @param getConfigManager - Function to get the config manager service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createConfigGetHandler(
  getConfigManager: () => ConfigManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => ConfigGetResponse {
  return (_event: IpcMainInvokeEvent): ConfigGetResponse => {
    try {
      const configManager = getConfigManager();
      const config = configManager.getConfig();

      ipcLogger.debug("Config requested");

      return { config };
    } catch (error) {
      ipcLogger.error("Failed to get config", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let the renderer handle the error
      throw error;
    }
  };
}

/**
 * Creates an IPC handler function for CONFIG_SET channel.
 * Updates config with partial values.
 *
 * @param getConfigManager - Function to get the config manager service
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 */
export function createConfigSetHandler(
  getConfigManager: () => ConfigManagerService,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent, payload: ConfigSetPayload) => void {
  return (_event: IpcMainInvokeEvent, payload: ConfigSetPayload): void => {
    try {
      const configManager = getConfigManager();
      const changedKeys = configManager.setConfig(payload.updates);

      ipcLogger.debug("Config updated", { changedKeys });
    } catch (error) {
      ipcLogger.error("Failed to set config", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let the renderer handle the error
      throw error;
    }
  };
}

/**
 * Broadcasts config change to all renderer windows.
 *
 * @param payload - The config changed payload containing config and changedKeys
 * @param ipcLogger - Child logger for IPC-related logging
 */
export function broadcastConfigChange(payload: ConfigChangedPayload, ipcLogger: Logger): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.CONFIG_CHANGED, payload);
    }
  }

  ipcLogger.debug("Config change broadcasted to renderer windows", {
    changedKeys: payload.changedKeys,
    windowsNotified: windows.filter((w) => !w.isDestroyed()).length,
  });
}
