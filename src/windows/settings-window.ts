/**
 * Settings window management service.
 * Manages a standard framed BrowserWindow for application settings.
 *
 * @see F-settings-window-ui feature specification
 */

import { BrowserWindow, app } from "electron";
import path from "path";
import { getLogger, Logger } from "../services/logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Settings window service interface.
 */
export interface SettingsWindowService {
  /** Show the settings window, focusing existing if already open */
  show(): void;

  /** Hide/close the settings window */
  hide(): void;

  /** Check if settings window is currently visible */
  isVisible(): boolean;

  /** Get the BrowserWindow instance (for IPC) */
  getWindow(): BrowserWindow | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Settings window dimensions */
const SETTINGS_WIDTH = 600;
const SETTINGS_HEIGHT = 500;

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Gets the path to the main preload script.
 * Settings window uses the main preload since it already has all needed APIs.
 */
function getPreloadPath(): string {
  return path.join(__dirname, "main.js");
}

/**
 * Result of getSettingsUrl - either a URL string or a file path.
 */
interface SettingsUrlResult {
  type: "url" | "file";
  value: string;
}

// Vite define plugin injects these as global constants at build time
declare const SETTINGS_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const SETTINGS_WINDOW_VITE_NAME: string | undefined;

/**
 * Gets the URL or file path to load for the settings window.
 * Uses Electron Forge VitePlugin define constants (not process.env).
 */
function getSettingsUrl(): SettingsUrlResult {
  // The VitePlugin injects SETTINGS_WINDOW_VITE_DEV_SERVER_URL via Vite's define plugin
  // in dev mode. This is a build-time replacement, not a runtime env var.
  if (typeof SETTINGS_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    // In dev mode, Vite serves index.html from the root
    // Ensure trailing slash before appending path
    const baseUrl = SETTINGS_WINDOW_VITE_DEV_SERVER_URL.endsWith("/")
      ? SETTINGS_WINDOW_VITE_DEV_SERVER_URL
      : `${SETTINGS_WINDOW_VITE_DEV_SERVER_URL}/`;
    return {
      type: "url",
      value: `${baseUrl}index.html`,
    };
  }

  // In production (or dev without the define), use file path
  // VitePlugin sets SETTINGS_WINDOW_VITE_NAME for the renderer output directory
  const rendererName =
    typeof SETTINGS_WINDOW_VITE_NAME !== "undefined"
      ? SETTINGS_WINDOW_VITE_NAME
      : "settings_window";
  return {
    type: "file",
    value: path.join(__dirname, `../renderer/${rendererName}/index.html`),
  };
}

// ============================================================================
// Settings Window Implementation
// ============================================================================

class SettingsWindowImpl implements SettingsWindowService {
  private readonly logger: Logger;
  private window: BrowserWindow | null = null;

  constructor() {
    this.logger = getLogger().child({ component: "SettingsWindow" });
    this.setupCleanup();
  }

  /**
   * Sets up cleanup on app quit.
   */
  private setupCleanup(): void {
    app.on("will-quit", () => {
      if (this.window && !this.window.isDestroyed()) {
        this.window.destroy();
        this.window = null;
      }
    });
  }

  /**
   * Creates the settings BrowserWindow (hidden by default).
   */
  private createWindow(): BrowserWindow {
    const preloadPath = getPreloadPath();
    const settingsUrlResult = getSettingsUrl();

    this.logger.info("Creating settings window", {
      preloadPath,
      settingsUrlType: settingsUrlResult.type,
      settingsUrlValue: settingsUrlResult.value,
      width: SETTINGS_WIDTH,
      height: SETTINGS_HEIGHT,
    });

    const settingsWindow = new BrowserWindow({
      width: SETTINGS_WIDTH,
      height: SETTINGS_HEIGHT,
      minWidth: 400,
      minHeight: 400,
      frame: true, // Standard frame (not frameless like popup)
      transparent: false, // Not transparent
      resizable: true, // Allow resizing
      show: false, // Created hidden, shown on demand
      title: "SmartHole Settings",
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Set up error handlers for content loading
    settingsWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        this.logger.error("Settings window failed to load content", {
          errorCode,
          errorDescription,
          validatedURL,
        });
      }
    );

    settingsWindow.webContents.on("did-finish-load", () => {
      this.logger.info("Settings window content finished loading");
    });

    settingsWindow.webContents.on("render-process-gone", (_event, details) => {
      this.logger.error("Settings window render process gone", { reason: details.reason });
    });

    // Load the settings HTML/URL
    if (settingsUrlResult.type === "url") {
      settingsWindow.loadURL(settingsUrlResult.value);
    } else {
      settingsWindow.loadFile(settingsUrlResult.value);
    }

    // Set up window events
    this.setupWindowEvents(settingsWindow);

    this.logger.info("Settings window created");
    return settingsWindow;
  }

  /**
   * Sets up event handlers for the settings window.
   */
  private setupWindowEvents(window: BrowserWindow): void {
    // Handle window closed
    window.on("closed", () => {
      this.window = null;
      this.logger.debug("Settings window closed");
    });

    // Handle Escape key to close window
    window.webContents.on("before-input-event", (_event, input) => {
      if (input.key === "Escape" && input.type === "keyDown") {
        this.hide();
      }
    });
  }

  show(): void {
    this.logger.info("show() called");

    // If window exists and is visible, just focus it
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isVisible()) {
        this.window.focus();
        this.logger.debug("Settings window focused (already visible)");
        return;
      }
      // Window exists but is hidden - show it
      this.window.show();
      this.window.focus();
      this.logger.debug("Settings window shown (was hidden)");
      return;
    }

    // Create new window
    this.window = this.createWindow();

    // Wait for content to load before showing
    const webContents = this.window.webContents;
    if (!webContents.isLoading()) {
      this.window.show();
      this.window.focus();
      this.logger.info("Settings window shown immediately");
    } else {
      webContents.once("did-finish-load", () => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.show();
          this.window.focus();
          this.logger.info("Settings window shown after loading");
        }
      });
    }
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) return;

    this.window.close();
    this.logger.debug("Settings window hidden");
  }

  isVisible(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  /**
   * Destroys the window and cleans up (primarily for testing).
   */
  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let settingsInstance: SettingsWindowImpl | null = null;

/**
 * Initializes the settings window service.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 */
export function initializeSettingsWindow(): SettingsWindowService {
  if (settingsInstance) {
    return settingsInstance;
  }

  settingsInstance = new SettingsWindowImpl();
  return settingsInstance;
}

/**
 * Gets the settings window service instance.
 * Throws if initializeSettingsWindow() has not been called.
 */
export function getSettingsWindow(): SettingsWindowService {
  if (!settingsInstance) {
    throw new Error(
      "SettingsWindow not initialized. Call initializeSettingsWindow() before using getSettingsWindow()."
    );
  }
  return settingsInstance;
}

/**
 * Resets the settings window service instance (primarily for testing).
 */
export function resetSettingsWindow(): void {
  if (settingsInstance) {
    settingsInstance.destroy();
  }
  settingsInstance = null;
}
