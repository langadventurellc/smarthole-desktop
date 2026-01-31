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
  ConfigChangedPayload,
  AppVersionResponse,
  WebSocketServerStatus,
  IpcRoutedMessage,
  IpcDeliveryResult,
  IpcDeliveryStatus,
  MessageSendMultipleResponse,
  ClientSummary,
  ClientDetails,
  ClientStatusChangedPayload,
  HotkeyActivatedEvent,
  HotkeyReleasedEvent,
  InputStateInfo,
  InputStateChangedEvent,
  AudioCaptureResult,
  AudioCapturePermission,
  AudioStateChangedEvent,
  AudioPermissionStatus,
  CredentialKey,
  DialogOpenOptions,
  DialogOpenResponse,
  PermissionCheckMicrophoneResponse,
  PermissionRequestMicrophoneResponse,
  PermissionCheckAccessibilityResponse,
  PermissionOpenAccessibilitySettingsResponse,
} from "../types";
import { IPC_CHANNELS } from "../types";
import type { LogLevel, AppConfig } from "../types";

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
   * @param callback - Function called with the updated configuration and changed keys
   * @returns Unsubscribe function to stop listening
   */
  onConfigChanged: (callback: (config: AppConfig, changedKeys: string[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ConfigChangedPayload): void => {
      callback(payload.config, payload.changedKeys);
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

  // ============================================
  // Client Status
  // ============================================

  /**
   * Get the number of registered clients.
   *
   * @returns Promise resolving to the count of registered clients
   */
  getClientCount: (): Promise<number> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIENTS_GET_COUNT);
  },

  /**
   * Get a list of all registered clients.
   *
   * @returns Promise resolving to array of client summaries
   */
  getClientList: (): Promise<ClientSummary[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIENTS_GET_LIST);
  },

  /**
   * Get detailed information about a specific client.
   *
   * @param name - The client name to look up
   * @returns Promise resolving to client details, or null if not found
   */
  getClientDetails: (name: string): Promise<ClientDetails | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CLIENTS_GET_DETAILS, name);
  },

  /**
   * Listen for client status changes (registrations/unregistrations).
   * Called whenever a client registers or unregisters.
   *
   * @param callback - Function called with the status change payload
   * @returns Unsubscribe function to stop listening
   */
  onClientStatusChange: (callback: (payload: ClientStatusChangedPayload) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: ClientStatusChangedPayload
    ): void => {
      callback(payload);
    };
    ipcRenderer.on(IPC_CHANNELS.CLIENTS_STATUS_CHANGED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.CLIENTS_STATUS_CHANGED, handler);
    };
  },

  // ============================================
  // Hotkey Events
  // ============================================

  /**
   * Listen for hotkey activation events.
   * Called whenever a registered hotkey is pressed.
   *
   * @param callback - Function called with the hotkey activated event
   * @returns Unsubscribe function to stop listening
   */
  onHotkeyActivated: (callback: (event: HotkeyActivatedEvent) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      hotkeyEvent: HotkeyActivatedEvent
    ): void => {
      callback(hotkeyEvent);
    };
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_ACTIVATED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.HOTKEY_ACTIVATED, handler);
    };
  },

  /**
   * Listen for hotkey release events.
   * Called whenever a registered hotkey is released (for push-to-talk mode).
   *
   * @param callback - Function called with the hotkey released event
   * @returns Unsubscribe function to stop listening
   */
  onHotkeyReleased: (callback: (event: HotkeyReleasedEvent) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, hotkeyEvent: HotkeyReleasedEvent): void => {
      callback(hotkeyEvent);
    };
    ipcRenderer.on(IPC_CHANNELS.HOTKEY_RELEASED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.HOTKEY_RELEASED, handler);
    };
  },

  // ============================================
  // Input State
  // ============================================

  /**
   * Get the current input state information.
   *
   * @returns Promise resolving to the current input state info
   */
  getInputState: (): Promise<InputStateInfo> => {
    return ipcRenderer.invoke(IPC_CHANNELS.INPUT_GET_STATE);
  },

  /**
   * Listen for input state changes.
   * Called whenever the input state transitions (idle, recording, processing).
   *
   * @param callback - Function called with the state changed event
   * @returns Unsubscribe function to stop listening
   */
  onInputStateChanged: (callback: (event: InputStateChangedEvent) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      stateEvent: InputStateChangedEvent
    ): void => {
      callback(stateEvent);
    };
    ipcRenderer.on(IPC_CHANNELS.INPUT_STATE_CHANGED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.INPUT_STATE_CHANGED, handler);
    };
  },

  // ============================================
  // Audio Capture
  // ============================================

  /**
   * Get the current microphone permission status.
   *
   * @returns Promise resolving to the current permission status
   */
  getAudioPermission: (): Promise<AudioPermissionStatus> => {
    return ipcRenderer.invoke(IPC_CHANNELS.AUDIO_PERMISSION_GET);
  },

  /**
   * Send captured audio data to the main process.
   * Called by the renderer after recording completes.
   *
   * @param result - The captured audio result
   */
  sendAudioData: (result: AudioCaptureResult): void => {
    ipcRenderer.send(IPC_CHANNELS.AUDIO_DATA, { result });
  },

  /**
   * Listen for audio state changes from the main process.
   * Called whenever the audio capture state transitions.
   *
   * @param callback - Function called with the state changed event
   * @returns Unsubscribe function to stop listening
   */
  onAudioStateChanged: (callback: (event: AudioStateChangedEvent) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      stateEvent: AudioStateChangedEvent
    ): void => {
      callback(stateEvent);
    };
    ipcRenderer.on(IPC_CHANNELS.AUDIO_STATE_CHANGED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STATE_CHANGED, handler);
    };
  },

  /**
   * Listen for audio permission changes from the main process.
   * Called whenever the microphone permission status changes.
   *
   * @param callback - Function called with the new permission state
   * @returns Unsubscribe function to stop listening
   */
  onAudioPermissionChanged: (
    callback: (permission: AudioCapturePermission) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      event: { newPermission: AudioCapturePermission }
    ): void => {
      callback(event.newPermission);
    };
    ipcRenderer.on(IPC_CHANNELS.AUDIO_PERMISSION_CHANGED, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_PERMISSION_CHANGED, handler);
    };
  },

  /**
   * Listen for audio start commands from the main process.
   * Called when main process requests the renderer to start recording.
   *
   * @param callback - Function called when recording should start
   * @returns Unsubscribe function to stop listening
   */
  onAudioStart: (callback: () => void): (() => void) => {
    const handler = (): void => {
      callback();
    };
    ipcRenderer.on(IPC_CHANNELS.AUDIO_START, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_START, handler);
    };
  },

  /**
   * Listen for audio stop commands from the main process.
   * Called when main process requests the renderer to stop recording.
   *
   * @param callback - Function called when recording should stop
   * @returns Unsubscribe function to stop listening
   */
  onAudioStop: (callback: () => void): (() => void) => {
    const handler = (): void => {
      callback();
    };
    ipcRenderer.on(IPC_CHANNELS.AUDIO_STOP, handler);

    // Return unsubscribe function
    return (): void => {
      ipcRenderer.removeListener(IPC_CHANNELS.AUDIO_STOP, handler);
    };
  },

  // ============================================
  // Credentials (safe operations only)
  // ============================================

  /** Store a credential in the OS keychain. */
  storeCredential: (key: CredentialKey, value: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIAL_STORE, { key, value });
  },

  /** Delete a credential from the OS keychain. */
  deleteCredential: (key: CredentialKey): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIAL_DELETE, { key });
  },

  /** Check if a credential exists. Use to show "configured" vs "not configured" in settings UI. */
  hasCredential: (key: CredentialKey): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.CREDENTIAL_HAS, { key });
  },

  // ============================================
  // Dialogs
  // ============================================

  /**
   * Show a native open file/directory dialog.
   * Used by settings UI to pick file paths (e.g., local Whisper path).
   *
   * @param options - Dialog options (title, filters, properties)
   * @returns Promise resolving to the dialog result with selected paths
   */
  showOpenDialog: (options?: DialogOpenOptions): Promise<DialogOpenResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN, options);
  },

  // ============================================
  // Permissions
  // ============================================

  /**
   * Check the current microphone permission status.
   * On macOS, returns the actual permission status from system preferences.
   * On Windows/Linux, typically returns "granted" as permissions are handled at device access.
   *
   * @returns Promise resolving to the microphone permission status
   */
  checkMicrophonePermission: (): Promise<PermissionCheckMicrophoneResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_CHECK_MICROPHONE);
  },

  /**
   * Request microphone access from the user.
   * On macOS, triggers the system permission dialog if access hasn't been determined.
   * On Windows/Linux, this is effectively a no-op as permission is handled at device access.
   *
   * @returns Promise resolving to whether access was granted
   */
  requestMicrophonePermission: (): Promise<PermissionRequestMicrophoneResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_REQUEST_MICROPHONE);
  },

  /**
   * Check if the application is a trusted accessibility client.
   * Only meaningful on macOS; other platforms always return trusted=true.
   * Accessibility permission is required for global hotkeys on macOS.
   *
   * @returns Promise resolving to whether the app is trusted for accessibility
   */
  checkAccessibilityPermission: (): Promise<PermissionCheckAccessibilityResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_CHECK_ACCESSIBILITY);
  },

  /**
   * Open the system accessibility settings (macOS only).
   * Guides the user to manually grant accessibility permission.
   * On non-macOS platforms, this is a no-op that returns success.
   *
   * @returns Promise resolving to whether the settings were successfully opened
   */
  openAccessibilitySettings: (): Promise<PermissionOpenAccessibilitySettingsResponse> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PERMISSION_OPEN_ACCESSIBILITY_SETTINGS);
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

/**
 * Type definition for the electronAPI exposed to renderer.
 * Export this type for use in type declarations and renderer code.
 */
export type ElectronAPI = typeof electronAPI;
