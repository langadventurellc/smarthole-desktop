import { app, Tray, Menu, nativeImage, dialog, ipcMain } from "electron";
import { registerProcessErrorHandlers } from "./utils/process-error-handlers";
import { initializeLogger, Logger } from "./services/logger";
import { initializeNotificationService } from "./services/notifications";
import { initializeNotificationQueue, getNotificationQueue } from "./services/notification-queue";
import { initializeClientRegistry, getClientRegistry } from "./services/client-registry";
import {
  initializeWebSocketServer,
  shutdownWebSocketServer,
  WebSocketServerService,
} from "./services/websocket-server";
import {
  initializeRegistrationHandler,
  RegistrationHandler,
} from "./services/registration-handler";
import { initializeMessageDelivery, MessageDeliveryService } from "./services/message-delivery";
import {
  initializeHotkeyManager,
  getHotkeyManager,
  HotkeyManagerService,
} from "./services/hotkey-manager";
import { initializeInputState, getInputState, InputStateService } from "./services/input-state";
import {
  initializeTextInputPopup,
  getTextInputPopup,
  TextInputPopupService,
} from "./windows/text-input-popup";
import {
  initializeSettingsWindow,
  getSettingsWindow,
  SettingsWindowService,
} from "./windows/settings-window";
import {
  initializeAudioCapture,
  getAudioCapture,
  AudioCaptureService,
} from "./services/audio-capture";
import {
  initializeConfigManager,
  getConfigManager,
  ConfigManagerService,
} from "./services/config-manager";
import {
  initializeCredentialManager,
  getCredentialManager,
  CredentialManagerService,
} from "./services/credential-manager";
import { InputState } from "./types";
import { buildTrayMenuTemplate, TrayMenuActions } from "./tray-menu";
import {
  IPC_CHANNELS,
  LogLevel,
  NotificationPayload,
  ClientNotificationPriority,
  NotificationPriority,
} from "./types";
import { createLogMessageHandler } from "./ipc/log-handler";
import { createNotificationHandler } from "./ipc/notification-handler";
import {
  createWebSocketStatusHandler,
  broadcastWebSocketStatusChange,
  buildWebSocketStatus,
} from "./ipc/websocket-status-handler";
import { registerMessageDeliveryHandlers } from "./ipc/message-delivery-handlers";
import {
  createClientCountHandler,
  createClientListHandler,
  createClientDetailsHandler,
  createRegisteredEventHandler,
  createUnregisteredEventHandler,
} from "./ipc/client-status-handler";
import { wireHotkeyManagerToIpc } from "./ipc/hotkey-handler";
import { createInputStateHandler, wireInputStateToIpc } from "./ipc/input-state-handler";
import { registerTextInputHandlers, wireTextInputToHotkey } from "./ipc/text-input-handler";
import {
  registerAudioHandlers,
  wireAudioCaptureToIpc,
  wireAudioCaptureToHotkey,
} from "./ipc/audio-handler";
import {
  createConfigGetHandler,
  createConfigSetHandler,
  broadcastConfigChange,
} from "./ipc/config-handler";
import {
  createCredentialStoreHandler,
  createCredentialDeleteHandler,
  createCredentialHasHandler,
} from "./ipc/credential-handler";
import { createDialogOpenHandler } from "./ipc/dialog-handler";

// Module-level variables (initialized in app.whenReady())
let logger: Logger;
let tray: Tray | null = null;

// WebSocket server state tracking for IPC status reporting
const WS_DEFAULT_PORT = 9473;

/**
 * Mutable state for WebSocket server tracking.
 * Using an object allows mutation while satisfying const declaration.
 */
const wsState: {
  server: WebSocketServerService | null;
  registrationHandler: RegistrationHandler | null;
  messageDelivery: MessageDeliveryService | null;
  lastError: string | undefined;
} = {
  server: null,
  registrationHandler: null,
  messageDelivery: null,
  lastError: undefined,
};

/**
 * Mutable state for input services.
 */
const inputState: {
  hotkeyManager: HotkeyManagerService | null;
  inputStateService: InputStateService | null;
} = {
  hotkeyManager: null,
  inputStateService: null,
};

/**
 * Mutable state for popup windows.
 */
const popupState: {
  textInput: TextInputPopupService | null;
} = {
  textInput: null,
};

/**
 * Mutable state for settings window.
 */
const settingsState: {
  settingsWindow: SettingsWindowService | null;
} = {
  settingsWindow: null,
};

/**
 * Mutable state for audio capture.
 */
const audioState: {
  audioCapture: AudioCaptureService | null;
} = {
  audioCapture: null,
};

/**
 * Mutable state for config manager.
 */
const configState: {
  configManager: ConfigManagerService | null;
} = {
  configManager: null,
};

/**
 * Mutable state for credential manager.
 */
const credentialState: {
  credentialManager: CredentialManagerService | null;
} = {
  credentialManager: null,
};

/**
 * Cached tray icons to avoid repeated buffer allocation during state changes.
 */
const iconCache: {
  idle: Electron.NativeImage | null;
  recording: Electron.NativeImage | null;
} = {
  idle: null,
  recording: null,
};

/**
 * Broadcasts the current WebSocket server status to all renderer windows.
 */
function notifyWebSocketStatusChange(): void {
  const status = buildWebSocketStatus(wsState.server, wsState.lastError, WS_DEFAULT_PORT);
  broadcastWebSocketStatusChange(status);
}

/**
 * Maps client notification priority to the notification queue priority.
 * Clients use "normal" while the queue uses "medium".
 *
 * @param priority - The client-provided priority (or undefined)
 * @returns The mapped NotificationPriority for the queue
 */
function mapClientPriorityToQueuePriority(
  priority: ClientNotificationPriority | undefined
): NotificationPriority {
  if (!priority) {
    return "medium";
  }
  if (priority === "normal") {
    return "medium";
  }
  return priority;
}

/**
 * Checks if a notification payload has displayable content.
 * A notification needs at least a title or body to be shown.
 *
 * @param notification - The notification payload from a client
 * @returns true if the notification has content to display
 */
function hasNotificationContent(notification: NotificationPayload): boolean {
  return Boolean(notification.title || notification.body);
}

/**
 * Creates the idle state tray icon (black filled square).
 * On macOS, marked as template image for menu bar theme adaptation.
 *
 * @returns 16x16 black square NativeImage
 */
function createIdleIcon(): Electron.NativeImage {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      buffer[i] = 0; // R
      buffer[i + 1] = 0; // G
      buffer[i + 2] = 0; // B
      buffer[i + 3] = 255; // A (fully opaque)
    }
  }

  const icon = nativeImage.createFromBuffer(buffer, { width: size, height: size });

  // Mark as template image for macOS (icon color adapts to menu bar theme)
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  return icon;
}

/**
 * Creates the recording state tray icon (red filled circle).
 * Not marked as template image to preserve the red color on macOS.
 *
 * @returns 16x16 red circle NativeImage
 */
function createRecordingIcon(): Electron.NativeImage {
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 1; // Leave 1px padding for anti-aliasing

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Calculate distance from center
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        // Inside the circle - red color
        buffer[i] = 255; // R
        buffer[i + 1] = 59; // G (slightly off-red for better visibility)
        buffer[i + 2] = 48; // B
        buffer[i + 3] = 255; // A (fully opaque)
      } else {
        // Outside the circle - transparent
        buffer[i] = 0; // R
        buffer[i + 1] = 0; // G
        buffer[i + 2] = 0; // B
        buffer[i + 3] = 0; // A (transparent)
      }
    }
  }

  const icon = nativeImage.createFromBuffer(buffer, { width: size, height: size });

  // Do NOT mark as template image - we want to preserve the red color
  // Template images on macOS are rendered as monochrome

  return icon;
}

/**
 * Gets the cached idle icon, creating it on first access.
 */
function getIdleIcon(): Electron.NativeImage {
  if (!iconCache.idle) {
    iconCache.idle = createIdleIcon();
  }
  return iconCache.idle;
}

/**
 * Gets the cached recording icon, creating it on first access.
 */
function getRecordingIcon(): Electron.NativeImage {
  if (!iconCache.recording) {
    iconCache.recording = createRecordingIcon();
  }
  return iconCache.recording;
}

/**
 * Updates the tray icon based on the current input state.
 * Shows a red circle when recording, black square otherwise.
 * Uses cached icons to avoid repeated buffer allocation.
 *
 * @param state - The current input state
 */
function updateTrayIcon(state: InputState): void {
  if (!tray) {
    return;
  }

  const icon = state === InputState.RECORDING ? getRecordingIcon() : getIdleIcon();
  tray.setImage(icon);
}

/**
 * Builds the tray context menu with current client connection status.
 * Called whenever the menu needs to be rebuilt (initial creation or status change).
 *
 * @returns The built Electron Menu
 */
function buildTrayMenu(): Electron.Menu {
  // Get current client status from registry (with fallback for early initialization)
  let clientCount = 0;
  let connectedClients: { name: string; description?: string }[] = [];

  try {
    const registry = getClientRegistry();
    clientCount = registry.getClientCount();
    connectedClients = registry.getAllClients().map((client) => ({
      name: client.name,
      description: client.description,
    }));
  } catch {
    // Registry not initialized yet - use defaults
  }

  // Get current input state (with fallback for early initialization)
  let currentInputState: InputState = InputState.IDLE;
  let isRecording = false;

  try {
    currentInputState = getInputState().getCurrentState();
    isRecording = getAudioCapture().isRecording();
  } catch {
    // Services not initialized yet - use defaults
  }

  // Build menu actions
  const actions: TrayMenuActions = {
    onOpenTextInput: (): void => {
      try {
        getTextInputPopup().show();
      } catch {
        // Service not initialized yet
      }
    },
    onStartRecording: (): void => {
      try {
        void getAudioCapture().startRecording();
      } catch {
        // Service not initialized yet
      }
    },
    onStopRecording: (): void => {
      try {
        void getAudioCapture().stopRecording();
      } catch {
        // Service not initialized yet
      }
    },
    onSettings: (): void => {
      try {
        getSettingsWindow().show();
      } catch {
        // Service not initialized yet
      }
    },
    onAbout: (): void => {
      dialog.showMessageBox({
        type: "info",
        title: "About SmartHole",
        message: "SmartHole",
        detail: `Version ${app.getVersion()}`,
        buttons: ["OK"],
      });
    },
    onQuit: (): void => {
      app.quit();
    },
  };

  // Build template and create menu
  const template = buildTrayMenuTemplate(
    { clientCount, connectedClients, currentInputState, isRecording },
    actions
  );

  return Menu.buildFromTemplate(template);
}

/**
 * Updates the tray context menu with current client connection status.
 * Should be called when clients connect or disconnect.
 */
function updateTrayMenu(): void {
  if (!tray) {
    return;
  }
  const contextMenu = buildTrayMenu();
  tray.setContextMenu(contextMenu);
}

function createTray(): void {
  const icon = getIdleIcon();

  tray = new Tray(icon);
  tray.setToolTip("SmartHole");

  const contextMenu = buildTrayMenu();
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(async () => {
  // ============================================================================
  // Initialize all services AFTER Electron is ready
  // This prevents pino worker thread issues that cause 100% CPU usage
  // ============================================================================

  // Initialize logger first
  logger = initializeLogger({
    level: "info" as LogLevel,
    logMessageContent: false, // Privacy-aware: don't log message content by default
    prettyPrint: !app.isPackaged, // Pretty print in development
  });

  const ipcLogger = logger.child({ component: "IPC" });
  const notifyLogger = logger.child({ component: "NotificationIPC" });

  // Initialize config manager early (other services may depend on it)
  configState.configManager = initializeConfigManager();
  logger.info("Config manager initialized");

  // Register config IPC handlers
  const configLogger = logger.child({ component: "ConfigIPC" });
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET,
    createConfigGetHandler(() => getConfigManager(), configLogger)
  );
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SET,
    createConfigSetHandler(() => getConfigManager(), configLogger)
  );

  // Wire config changes to broadcast to all renderer windows
  configState.configManager.on("configChanged", (config, changedKeys) => {
    broadcastConfigChange({ config, changedKeys }, configLogger);
  });

  // Initialize credential manager (after config manager, before services that need credentials)
  credentialState.credentialManager = initializeCredentialManager();
  logger.info("Credential manager initialized");

  // Register credential IPC handlers
  const credentialLogger = logger.child({ component: "CredentialIPC" });
  ipcMain.handle(
    IPC_CHANNELS.CREDENTIAL_STORE,
    createCredentialStoreHandler(() => getCredentialManager(), credentialLogger)
  );
  ipcMain.handle(
    IPC_CHANNELS.CREDENTIAL_DELETE,
    createCredentialDeleteHandler(() => getCredentialManager(), credentialLogger)
  );
  ipcMain.handle(
    IPC_CHANNELS.CREDENTIAL_HAS,
    createCredentialHasHandler(() => getCredentialManager(), credentialLogger)
  );

  // Register dialog IPC handler
  const dialogLogger = logger.child({ component: "DialogIPC" });
  ipcMain.handle(IPC_CHANNELS.DIALOG_OPEN, createDialogOpenHandler(dialogLogger));

  // Initialize notification services
  const notificationService = initializeNotificationService();
  logger.info("Notification service initialized", {
    supported: notificationService.isSupported(),
  });

  const notificationQueue = initializeNotificationQueue(notificationService, {
    maxPerMinute: 10,
    maxQueueDepth: 20,
    minInterval: 1000,
  });

  // Initialize client registry for tracking connected plugin clients
  initializeClientRegistry();
  logger.info("Client registry initialized");

  // Initialize WebSocket server for plugin client connections
  const wsLogger = logger.child({ component: "WebSocketIPC" });
  try {
    wsState.server = await initializeWebSocketServer({
      port: WS_DEFAULT_PORT,
      host: "127.0.0.1",
      maxConnections: 100,
    });
    logger.info("WebSocket server initialized", {
      port: wsState.server.getPort(),
      running: wsState.server.isRunning(),
    });

    // Initialize registration handler for processing client registration messages
    wsState.registrationHandler = initializeRegistrationHandler();
    logger.info("Registration handler initialized");

    // Initialize message delivery service for sending messages to clients and handling responses
    wsState.messageDelivery = initializeMessageDelivery();
    logger.info("Message delivery service initialized");

    // Wire up notification response handling to route client notifications to the queue
    wsState.messageDelivery.on("response:notification", (messageId, clientName, notification) => {
      // Validate notification has content to display
      if (!hasNotificationContent(notification)) {
        logger.warn("Empty notification received from client", {
          messageId,
          clientName,
        });
        return;
      }

      // Map client notification to queue format and enqueue
      notificationQueue.enqueue({
        title: notification.title ?? clientName,
        body: notification.body ?? "",
        type: "info", // Client notifications are informational by default
        priority: mapClientPriorityToQueuePriority(notification.priority),
      });

      logger.info("Client notification routed to queue", {
        messageId,
        clientName,
        title: notification.title,
        priority: notification.priority,
      });
    });

    // Subscribe to connection events to broadcast status changes
    wsState.server.on("connection", () => {
      notifyWebSocketStatusChange();
    });
    wsState.server.on("disconnection", (info, code, reason) => {
      // Calculate connection duration
      const durationMs = Date.now() - info.connectedAt.getTime();
      const durationSec = Math.round(durationMs / 1000);

      // Clean up client from registry if they were registered
      const registry = getClientRegistry();
      const wasRegistered = registry.unregisterById(info.id, "disconnect");

      if (wasRegistered) {
        logger.info("Registered client disconnected", {
          connectionId: info.id,
          durationSeconds: durationSec,
          code,
          reason: reason || "unknown",
        });
      } else {
        // Client disconnected without having registered (or registration failed)
        logger.debug("Unregistered connection closed", {
          connectionId: info.id,
          durationSeconds: durationSec,
          code,
          reason: reason || "unknown",
        });
      }

      notifyWebSocketStatusChange();
    });
    wsState.server.on("error", () => {
      notifyWebSocketStatusChange();
    });

    // Wire up message handling for registration and responses
    wsState.server.on("message", (info, ws, data) => {
      // Try registration handler first
      if (wsState.registrationHandler) {
        const result = wsState.registrationHandler.processMessage(data, {
          ws,
          connectionId: info.id,
        });
        if (result.handled) {
          logger.debug("Registration message processed", {
            connectionId: info.id,
            registered: result.registered,
          });
          return; // Message handled by registration
        }
      }

      // Try response handler for client responses
      if (wsState.messageDelivery) {
        const result = wsState.messageDelivery.handleResponse(data, {
          connectionId: info.id,
        });
        if (result.handled) {
          logger.debug("Response message processed", {
            connectionId: info.id,
            responseType: result.responseType,
          });
        }
      }
    });
  } catch (error) {
    wsState.lastError = error instanceof Error ? error.message : String(error);
    logger.error("Failed to initialize WebSocket server", {
      error: wsState.lastError,
    });
    // Don't crash the app if WebSocket server fails to start
    // The app can still function without it, but plugin connections will be unavailable
  }

  // Register WebSocket status IPC handler
  ipcMain.handle(
    IPC_CHANNELS.WEBSOCKET_STATUS_GET,
    createWebSocketStatusHandler(
      () => wsState.server,
      () => wsState.lastError,
      WS_DEFAULT_PORT,
      wsLogger
    )
  );

  // Register client status IPC handlers
  const clientStatusLogger = logger.child({ component: "ClientStatusIPC" });
  const registryGetter = (): ReturnType<typeof getClientRegistry> => getClientRegistry();

  ipcMain.handle(
    IPC_CHANNELS.CLIENTS_GET_COUNT,
    createClientCountHandler(registryGetter, clientStatusLogger)
  );
  ipcMain.handle(
    IPC_CHANNELS.CLIENTS_GET_LIST,
    createClientListHandler(registryGetter, clientStatusLogger)
  );
  ipcMain.handle(
    IPC_CHANNELS.CLIENTS_GET_DETAILS,
    createClientDetailsHandler(registryGetter, clientStatusLogger)
  );

  // Subscribe to registry events to broadcast status changes to renderer
  const registry = getClientRegistry();
  registry.on("registered", createRegisteredEventHandler(registryGetter));
  registry.on("unregistered", createUnregisteredEventHandler(registryGetter));

  // Subscribe to registry events to update tray menu when clients connect/disconnect
  registry.on("registered", () => {
    updateTrayMenu();
  });
  registry.on("unregistered", () => {
    updateTrayMenu();
  });

  // Register message delivery IPC handlers
  const messageLogger = logger.child({ component: "MessageDeliveryIPC" });
  registerMessageDeliveryHandlers(ipcMain, () => wsState.messageDelivery, messageLogger);

  // Initialize hotkey manager and input state services
  const hotkeyLogger = logger.child({ component: "HotkeyIPC" });
  const inputStateLogger = logger.child({ component: "InputStateIPC" });

  // Initialize input state service first (hotkey events will transition it)
  inputState.inputStateService = initializeInputState();
  logger.info("Input state service initialized");

  // Wire input state to IPC for state change broadcasts
  wireInputStateToIpc(inputState.inputStateService, inputStateLogger);

  // Subscribe to input state changes to update tray menu and icon
  inputState.inputStateService.on("stateChanged", (event) => {
    updateTrayMenu();
    updateTrayIcon(event.newState);
  });

  // Register input state IPC handler
  const inputStateGetter = (): InputStateService => getInputState();
  ipcMain.handle(
    IPC_CHANNELS.INPUT_GET_STATE,
    createInputStateHandler(inputStateGetter, inputStateLogger)
  );

  // Initialize hotkey manager
  inputState.hotkeyManager = initializeHotkeyManager();
  logger.info("Hotkey manager initialized");

  // Wire hotkey manager to IPC for event broadcasts
  wireHotkeyManagerToIpc(inputState.hotkeyManager, hotkeyLogger);

  // Wire hotkey events to input state transitions
  inputState.hotkeyManager.on("hotkey:activated", (event) => {
    if (event.hotkeyType === "voiceInput") {
      const stateService = inputState.inputStateService;
      if (stateService && stateService.canTransitionTo(InputState.RECORDING)) {
        stateService.transitionTo(InputState.RECORDING);
        logger.debug("Voice input hotkey activated, transitioned to RECORDING");
      }
    }
  });

  inputState.hotkeyManager.on("hotkey:released", (event) => {
    if (event.hotkeyType === "voiceInput") {
      const stateService = inputState.inputStateService;
      // In push-to-talk mode, releasing the hotkey should transition from RECORDING to PROCESSING
      if (
        stateService &&
        stateService.getCurrentMode() === "push-to-talk" &&
        stateService.getCurrentState() === InputState.RECORDING
      ) {
        stateService.transitionTo(InputState.PROCESSING);
        logger.debug("Voice input hotkey released, transitioned to PROCESSING");
      }
    }
  });

  inputState.hotkeyManager.on("error", (event) => {
    logger.error("Hotkey error", {
      message: event.message,
      code: event.code,
      accelerator: event.accelerator,
    });
  });

  // Initialize text input popup
  popupState.textInput = initializeTextInputPopup();
  logger.info("Text input popup initialized");

  // Initialize settings window
  settingsState.settingsWindow = initializeSettingsWindow();
  logger.info("Settings window initialized");

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

  // Initialize audio capture service
  const audioLogger = logger.child({ component: "AudioIPC" });
  audioState.audioCapture = initializeAudioCapture();
  logger.info("Audio capture service initialized");

  // Wire audio capture to IPC for state/permission broadcasts
  wireAudioCaptureToIpc(audioState.audioCapture, audioLogger);

  // Wire audio capture to hotkey manager for voice input
  wireAudioCaptureToHotkey(inputState.hotkeyManager, () => getAudioCapture(), audioLogger);

  // Register audio IPC handlers
  registerAudioHandlers(ipcMain, () => getAudioCapture(), audioLogger);

  // Wire audio ready event for downstream STT processing
  audioState.audioCapture.on("audioReady", (event) => {
    logger.info("Audio ready for STT processing", {
      durationMs: event.result.audio.durationMs,
      format: event.result.audio.format,
    });
    // TODO: Route to STT processing in future task
  });

  // Register error handlers
  registerProcessErrorHandlers({
    logger,
    onFatalError: (error) => {
      logger.error("Fatal error occurred", { message: error.message, stack: error.stack });
    },
  });

  // Register IPC handlers
  ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, createLogMessageHandler(logger, ipcLogger));
  ipcMain.on(IPC_CHANNELS.NOTIFY_SHOW, createNotificationHandler(notificationQueue, notifyLogger));

  logger.info("Application starting", { version: app.getVersion() });

  createTray();

  // Hide dock icon on macOS since this is a tray-only app
  if (process.platform === "darwin" && app.dock) {
    app.dock.hide();
  }

  logger.info("Application ready", { platform: process.platform });
});

app.on("window-all-closed", () => {
  // Don't quit when all windows are closed - this is a tray app
});

app.on("will-quit", async () => {
  // Clean up hotkey manager (unregisters global shortcuts)
  try {
    getHotkeyManager()?.unregisterAll();
  } catch {
    // Manager may not be initialized if app quits early
  }

  // Clean up audio capture service
  try {
    getAudioCapture()?.reset();
  } catch {
    // Service may not be initialized if app quits early
  }

  // Clean up WebSocket server
  try {
    await shutdownWebSocketServer();
  } catch {
    // Server may not be initialized if app quits early
  }

  // Clean up notification queue timers
  try {
    getNotificationQueue()?.destroy();
  } catch {
    // Queue may not be initialized if app quits early
  }
});
