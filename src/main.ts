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
import { InputState } from "./types";
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

function createTrayIcon(): Electron.NativeImage {
  // Create a 16x16 black filled square as placeholder icon
  // Replace with actual app icon later
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

  // Build menu template with client status
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: `${clientCount} client${clientCount !== 1 ? "s" : ""} connected`,
      enabled: false, // Display-only label
    },
  ];

  // Add connected clients submenu when clients are connected
  if (clientCount > 0) {
    template.push({
      label: "Connected Clients",
      submenu: connectedClients.map((client) => ({
        label: client.name,
        sublabel: client.description,
        enabled: false,
      })),
    });
  }

  // Add separator and standard menu items
  template.push(
    { type: "separator" },
    {
      label: "About SmartHole",
      click: (): void => {
        dialog.showMessageBox({
          type: "info",
          title: "About SmartHole",
          message: "SmartHole",
          detail: `Version ${app.getVersion()}`,
          buttons: ["OK"],
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: (): void => {
        app.quit();
      },
    }
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
  const icon = createTrayIcon();

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
