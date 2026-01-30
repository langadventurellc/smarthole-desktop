/**
 * IPC WebSocket status handler for the main process.
 * Provides status information about the WebSocket server to the renderer process.
 *
 * @see F-websocket-server-foundation feature specification
 */

import { IpcMainInvokeEvent, BrowserWindow } from "electron";
import { WebSocketServerStatus, IPC_CHANNELS } from "../types";
import { WebSocketServerService } from "../services/websocket-server";
import { Logger } from "../services/logger";

/**
 * Maps the internal server state to the UI-facing state.
 * The WebSocket server uses more granular states internally (starting, stopping).
 */
function mapServerState(
  internalState: "stopped" | "starting" | "running" | "stopping",
  hasError: boolean
): WebSocketServerStatus["state"] {
  if (hasError) {
    return "error";
  }

  switch (internalState) {
    case "running":
      return "running";
    case "stopped":
    case "starting":
    case "stopping":
      return "stopped";
    default:
      return "stopped";
  }
}

/**
 * Builds a WebSocketServerStatus object from the WebSocket server service.
 *
 * @param wsServer - The WebSocket server service (or null if not initialized)
 * @param lastError - The last error message (if any)
 * @param port - The configured port number
 * @returns The current WebSocket server status
 */
export function buildWebSocketStatus(
  wsServer: WebSocketServerService | null,
  lastError: string | undefined,
  port: number
): WebSocketServerStatus {
  if (!wsServer) {
    return {
      state: lastError ? "error" : "stopped",
      port,
      activeConnections: 0,
      error: lastError,
    };
  }

  const internalState = wsServer.getState();
  const state = mapServerState(internalState, !!lastError);

  return {
    state,
    port: wsServer.getPort(),
    activeConnections: wsServer.getConnectionCount(),
    error: lastError,
  };
}

/**
 * Creates an IPC handler function for WEBSOCKET_STATUS_GET channel.
 * Returns the current WebSocket server status.
 *
 * @param getWebSocketServer - Function to get the current WebSocket server (may return null)
 * @param getLastError - Function to get the last error message (may return undefined)
 * @param defaultPort - Default port used if server is not initialized
 * @param ipcLogger - Child logger for IPC-related logging
 * @returns Handler function compatible with ipcMain.handle()
 *
 * @example
 * ```typescript
 * import { ipcMain } from 'electron';
 * import { IPC_CHANNELS } from './types';
 * import { createWebSocketStatusHandler } from './ipc/websocket-status-handler';
 *
 * const handler = createWebSocketStatusHandler(
 *   () => wsServerOrNull,
 *   () => lastErrorOrUndefined,
 *   9473,
 *   ipcLogger
 * );
 * ipcMain.handle(IPC_CHANNELS.WEBSOCKET_STATUS_GET, handler);
 * ```
 */
export function createWebSocketStatusHandler(
  getWebSocketServer: () => WebSocketServerService | null,
  getLastError: () => string | undefined,
  defaultPort: number,
  ipcLogger: Logger
): (_event: IpcMainInvokeEvent) => WebSocketServerStatus {
  return (_event: IpcMainInvokeEvent): WebSocketServerStatus => {
    try {
      const wsServer = getWebSocketServer();
      const lastError = getLastError();
      const status = buildWebSocketStatus(wsServer, lastError, defaultPort);

      ipcLogger.debug("WebSocket status requested", {
        state: status.state,
        activeConnections: status.activeConnections,
      });

      return status;
    } catch (error) {
      ipcLogger.error("Failed to get WebSocket status", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return error state rather than throwing
      return {
        state: "error",
        port: defaultPort,
        activeConnections: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };
}

/**
 * Broadcasts WebSocket status change to all renderer windows.
 *
 * @param status - The current WebSocket server status
 */
export function broadcastWebSocketStatusChange(status: WebSocketServerStatus): void {
  const windows = BrowserWindow.getAllWindows();
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.WEBSOCKET_STATUS_CHANGED, status);
    }
  }
}
