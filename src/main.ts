import { app, Tray, Menu, nativeImage, dialog, ipcMain } from "electron";
import { registerProcessErrorHandlers } from "./utils/process-error-handlers";
import { initializeLogger } from "./services/logger";
import { IPC_CHANNELS, LogLevel } from "./types";
import { createLogMessageHandler } from "./ipc/log-handler";

// ============================================================================
// Logger Initialization (early, before other operations)
// ============================================================================

/**
 * Initialize the logger early in the application lifecycle.
 * This ensures all subsequent operations can use structured logging.
 */
const logger = initializeLogger({
  level: "info" as LogLevel,
  logMessageContent: false, // Privacy-aware: don't log message content by default
  prettyPrint: !app.isPackaged, // Pretty print in development
});

/**
 * Child logger for IPC-related logging.
 */
const ipcLogger = logger.child({ component: "IPC" });

// Register error handlers early, before any async operations
registerProcessErrorHandlers({
  logger, // Now using the initialized logger
  onFatalError: (error) => {
    // Could save state, show dialog, etc.
    logger.error("Fatal error occurred", { message: error.message, stack: error.stack });
  },
});

// ============================================================================
// IPC Handlers
// ============================================================================

/**
 * Handle log messages from the renderer process.
 * Validates payload and forwards to the main process logger with enriched context.
 */
ipcMain.on(IPC_CHANNELS.LOG_MESSAGE, createLogMessageHandler(logger, ipcLogger));

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
