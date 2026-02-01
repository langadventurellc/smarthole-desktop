/**
 * Background window management service.
 * Manages a hidden BrowserWindow for audio capture that stays alive while the app runs.
 *
 * The background window provides a renderer context needed for Web Audio API-based
 * audio capture. Since SmartHole runs as a tray app with no persistent visible windows,
 * this hidden window receives audio start/stop IPC events and handles recording.
 *
 * @see T-create-hidden-background task specification
 */

import { BrowserWindow, app } from "electron";
import path from "path";
import { getLogger, Logger } from "../services/logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Background window service interface.
 */
export interface BackgroundWindowService {
  /** Get the BrowserWindow instance (for IPC or debugging) */
  getWindow(): BrowserWindow | null;

  /** Check if the background window is loaded and ready */
  isReady(): boolean;

  /** Wait for the window to be ready (for race condition handling) */
  waitForReady(): Promise<void>;
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Gets the path to the main preload script.
 * Background window uses the main preload since it has all audio IPC APIs.
 */
function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

/**
 * Result of getBackgroundUrl - either a URL string or a file path.
 */
interface BackgroundUrlResult {
  type: "url" | "file";
  value: string;
}

// Vite define plugin injects these as global constants at build time
declare const BACKGROUND_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const BACKGROUND_WINDOW_VITE_NAME: string | undefined;

/**
 * Gets the URL or file path to load for the background window.
 * Uses Electron Forge VitePlugin define constants (not process.env).
 */
function getBackgroundUrl(): BackgroundUrlResult {
  // The VitePlugin injects BACKGROUND_WINDOW_VITE_DEV_SERVER_URL via Vite's define plugin
  // in dev mode. This is a build-time replacement, not a runtime env var.
  if (typeof BACKGROUND_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    // In dev mode, Vite serves index.html from the root
    const baseUrl = BACKGROUND_WINDOW_VITE_DEV_SERVER_URL.endsWith("/")
      ? BACKGROUND_WINDOW_VITE_DEV_SERVER_URL
      : `${BACKGROUND_WINDOW_VITE_DEV_SERVER_URL}/`;
    return {
      type: "url",
      value: `${baseUrl}index.html`,
    };
  }

  // In production (or dev without the define), use file path
  const rendererName =
    typeof BACKGROUND_WINDOW_VITE_NAME !== "undefined"
      ? BACKGROUND_WINDOW_VITE_NAME
      : "background_window";
  return {
    type: "file",
    value: path.join(__dirname, `../renderer/${rendererName}/index.html`),
  };
}

// ============================================================================
// Background Window Implementation
// ============================================================================

class BackgroundWindowImpl implements BackgroundWindowService {
  private readonly logger: Logger;
  private window: BrowserWindow | null = null;
  private ready: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

  constructor() {
    this.logger = getLogger().child({ component: "BackgroundWindow" });
    this.createWindow();
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
   * Creates the hidden background BrowserWindow.
   */
  private createWindow(): void {
    const preloadPath = getPreloadPath();
    const backgroundUrlResult = getBackgroundUrl();

    this.logger.info("Creating background window", {
      preloadPath,
      backgroundUrlType: backgroundUrlResult.type,
      backgroundUrlValue: backgroundUrlResult.value,
    });

    // Create ready promise before window to avoid race
    this.readyPromise = new Promise<void>((resolve) => {
      this.readyResolve = resolve;
    });

    this.window = new BrowserWindow({
      width: 1,
      height: 1,
      show: false, // Hidden - never shown to user
      skipTaskbar: true, // Don't show in Windows taskbar
      frame: false,
      transparent: true,
      focusable: false, // Cannot receive focus
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        // Ensure audio capture works in hidden window
        backgroundThrottling: false,
      },
    });

    // Set up error handlers for content loading
    this.window.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        this.logger.error("Background window failed to load content", {
          errorCode,
          errorDescription,
          validatedURL,
        });
      }
    );

    this.window.webContents.on("did-finish-load", () => {
      this.logger.info("Background window content finished loading");
      this.ready = true;
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
      }
    });

    this.window.webContents.on("render-process-gone", (_event, details) => {
      this.logger.error("Background window render process gone", { reason: details.reason });
      this.ready = false;
    });

    // Handle window closed (shouldn't happen normally)
    this.window.on("closed", () => {
      this.window = null;
      this.ready = false;
      this.logger.warn("Background window closed unexpectedly");
    });

    // Load the background HTML/URL
    if (backgroundUrlResult.type === "url") {
      this.window.loadURL(backgroundUrlResult.value);
    } else {
      this.window.loadFile(backgroundUrlResult.value);
    }

    this.logger.info("Background window created");
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  isReady(): boolean {
    return this.ready && this.window !== null && !this.window.isDestroyed();
  }

  async waitForReady(): Promise<void> {
    if (this.ready) {
      return;
    }
    if (this.readyPromise) {
      await this.readyPromise;
    }
  }

  /**
   * Destroys the window and cleans up (primarily for testing).
   */
  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.ready = false;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let backgroundInstance: BackgroundWindowImpl | null = null;

/**
 * Initializes the background window service.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 */
export function initializeBackgroundWindow(): BackgroundWindowService {
  if (backgroundInstance) {
    return backgroundInstance;
  }

  backgroundInstance = new BackgroundWindowImpl();
  return backgroundInstance;
}

/**
 * Gets the background window service instance.
 * Throws if initializeBackgroundWindow() has not been called.
 */
export function getBackgroundWindow(): BackgroundWindowService {
  if (!backgroundInstance) {
    throw new Error(
      "BackgroundWindow not initialized. Call initializeBackgroundWindow() before using getBackgroundWindow()."
    );
  }
  return backgroundInstance;
}

/**
 * Resets the background window service instance (primarily for testing).
 */
export function resetBackgroundWindow(): void {
  if (backgroundInstance) {
    backgroundInstance.destroy();
  }
  backgroundInstance = null;
}
