/**
 * Preload script for renderer process.
 * This file runs in the renderer process but has access to Node.js APIs.
 * Uses contextBridge to safely expose a typed API to the renderer.
 *
 * All IPC communication goes through explicitly defined channels for security.
 */

import { contextBridge, ipcRenderer } from "electron";
import type {
  LogMessagePayload,
  NotifyShowPayload,
  ConfigSetPayload,
  ConfigGetResponse,
  AppVersionResponse,
  WebSocketServerStatus,
  IpcRoutedMessage,
  IpcDeliveryResult,
  IpcDeliveryStatus,
  MessageSendMultipleResponse,
} from "./types";
import { IPC_CHANNELS } from "./types";
import type { LogLevel, AppConfig } from "./types";

/**
 * Electron API exposed to renderer process via contextBridge.
 * All methods communicate with main process via IPC.
 *
 * Methods use either:
 * - `ipcRenderer.send()` for fire-and-forget operations (logging, quit)
 * - `ipcRenderer.invoke()` for request-response operations (config get/set)
 * - `ipcRenderer.on()` for main->renderer event subscriptions
 */
const electronAPI = {
  // ============================================
  // Logging
  // ============================================

  /**
   * Send a log message to the main process logger.
   *
   * @param level - Log level (error, warn, info, debug, trace)
   * @param message - The log message text
   * @param context - Optional context data for structured logging
   */
  log: (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
    const payload: LogMessagePayload = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };
    ipcRenderer.send(IPC_CHANNELS.LOG_MESSAGE, payload);
  },

  /**
   * Log an error message.
   * Convenience method that calls log with level "error".
   */
  logError: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("error", message, context);
  },

  /**
   * Log a warning message.
   * Convenience method that calls log with level "warn".
   */
  logWarn: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("warn", message, context);
  },

  /**
   * Log an info message.
   * Convenience method that calls log with level "info".
   */
  logInfo: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("info", message, context);
  },

  /**
   * Log a debug message.
   * Convenience method that calls log with level "debug".
   */
  logDebug: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("debug", message, context);
  },

  /**
   * Log a trace message.
   * Convenience method that calls log with level "trace".
   */
  logTrace: (message: string, context?: Record<string, unknown>): void => {
    electronAPI.log("trace", message, context);
  },

  // ============================================
  // Notifications
  // ============================================

  /**
   * Request the main process to show a system notification.
   *
   * @param options - Notification options including title, body, type, and priority
   */
  notify: (options: NotifyShowPayload): void => {
    ipcRenderer.send(IPC_CHANNELS.NOTIFY_SHOW, options);
  },

  /**
   * Show an info notification.
   * Convenience method with type="info" and priority="medium".
   */
  notifyInfo: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "info", priority: "medium" });
  },

  /**
   * Show a warning notification.
   * Convenience method with type="warning" and priority="medium".
   */
  notifyWarning: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "warning", priority: "medium" });
  },

  /**
   * Show an error notification.
   * Convenience method with type="error" and priority="high".
   */
  notifyError: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "error", priority: "high" });
  },

  /**
   * Show a success notification.
   * Convenience method with type="success" and priority="medium".
   */
  notifySuccess: (title: string, body: string): void => {
    electronAPI.notify({ title, body, type: "success", priority: "medium" });
  },

  // ============================================
  // Configuration
  // ============================================

  /**
   * Get the current application configuration.
   *
   * @returns Promise resolving to the current AppConfig
   */
  getConfig: (): Promise<ConfigGetResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET);
  },

  /**
   * Update application configuration.
   * Only the specified keys will be updated; others remain unchanged.
   *
   * @param updates - Partial configuration with values to update
   * @returns Promise resolving when the update is complete
   */
  setConfig: (updates: ConfigSetPayload["updates"]): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, { updates });
  },

  /**
   * Listen for configuration changes from main process.
   * Called whenever the configuration is updated from any source.
   *
   * @param callback - Function called with the updated configuration
   * @returns Unsubscribe function to stop listening
   */
  onConfigChanged: (callback: (config: AppConfig) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, config: AppConfig): void => {
      callback(config);
    };
    ipcRenderer.on(IPC_CHANNELS.CONFIG_CHANGED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.CONFIG_CHANGED, handler);
    };
  },

  // ============================================
  // App Lifecycle
  // ============================================

  /**
   * Get application version information.
   *
   * @returns Promise resolving to version details (app, Electron, Node)
   */
  getVersion: (): Promise<AppVersionResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_VERSION);
  },

  /**
   * Request application quit.
   * This is a fire-and-forget operation; the app will exit.
   */
  quit: (): void => {
    ipcRenderer.send(IPC_CHANNELS.APP_QUIT);
  },

  // ============================================
  // WebSocket Server Status
  // ============================================

  /**
   * Get the current WebSocket server status.
   *
   * @returns Promise resolving to the current WebSocket server status
   */
  getWebSocketStatus: (): Promise<WebSocketServerStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WEBSOCKET_STATUS_GET);
  },

  /**
   * Listen for WebSocket server status changes.
   * Called whenever the server status changes (connections, errors, etc.).
   *
   * @param callback - Function called with the updated status
   * @returns Unsubscribe function to stop listening
   */
  onWebSocketStatusChange: (callback: (status: WebSocketServerStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: WebSocketServerStatus): void => {
      callback(status);
    };
    ipcRenderer.on(IPC_CHANNELS.WEBSOCKET_STATUS_CHANGED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.WEBSOCKET_STATUS_CHANGED, handler);
    };
  },

  // ============================================
  // Message Delivery
  // ============================================

  /**
   * Send a message to a single connected client.
   *
   * @param clientName - The name of the client to send to
   * @param message - The routed message to deliver
   * @returns Promise resolving to the delivery result
   */
  sendMessage: (clientName: string, message: IpcRoutedMessage): Promise<IpcDeliveryResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGE_SEND, clientName, message);
  },

  /**
   * Send a message to multiple connected clients.
   *
   * @param clientNames - Array of client names to send to
   * @param message - The routed message to deliver
   * @returns Promise resolving to results for each client (as array of [name, result] pairs)
   */
  sendMessageMultiple: (
    clientNames: string[],
    message: IpcRoutedMessage
  ): Promise<MessageSendMultipleResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGE_SEND_MULTIPLE, clientNames, message);
  },

  /**
   * Get the delivery status for a specific message.
   *
   * @param messageId - The message ID to look up
   * @returns Promise resolving to the delivery status, or null if not found
   */
  getMessageStatus: (messageId: string): Promise<IpcDeliveryStatus | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGE_GET_STATUS, messageId);
  },

  /**
   * Get recent message delivery history.
   *
   * @param limit - Maximum number of statuses to return (optional)
   * @returns Promise resolving to array of delivery statuses, newest first
   */
  getRecentDeliveries: (limit?: number): Promise<IpcDeliveryStatus[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.MESSAGE_GET_RECENT, limit);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

/**
 * Type definition for the electronAPI exposed to renderer.
 * Export this type for use in type declarations and renderer code.
 */
export type ElectronAPI = typeof electronAPI;
