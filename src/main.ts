import { app, Tray, Menu, nativeImage, dialog, ipcMain } from "electron";
import { registerProcessErrorHandlers } from "./utils/process-error-handlers";
import { initializeLogger, Logger } from "./services/logger";
import { initializeNotificationService } from "./services/notifications";
import { initializeNotificationQueue, getNotificationQueue } from "./services/notification-queue";
import { IPC_CHANNELS, LogLevel } from "./types";
import { createLogMessageHandler } from "./ipc/log-handler";
import { createNotificationHandler } from "./ipc/notification-handler";

// Module-level variables (initialized in app.whenReady())
let logger: Logger;
let tray: Tray | null = null;

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

function createTray(): void {
  const icon = createTrayIcon();

  tray = new Tray(icon);
  tray.setToolTip("SmartHole");

  const contextMenu = Menu.buildFromTemplate([
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
    },
  ]);

  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
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

app.on("will-quit", () => {
  // Clean up notification queue timers
  try {
    getNotificationQueue()?.destroy();
  } catch {
    // Queue may not be initialized if app quits early
  }
});
