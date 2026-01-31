/**
 * Onboarding window management service.
 * Manages a standard framed BrowserWindow for the first-run experience.
 *
 * @see F-first-run-experience feature specification
 */

import { BrowserWindow, app } from "electron";
import path from "path";
import { getLogger, Logger } from "../services/logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Onboarding window service interface.
 */
export interface OnboardingWindowService {
  /** Show the onboarding window, focusing existing if already open */
  show(): void;

  /** Hide/close the onboarding window */
  hide(): void;

  /** Check if onboarding window is currently visible */
  isVisible(): boolean;

  /** Get the BrowserWindow instance (for IPC) */
  getWindow(): BrowserWindow | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Onboarding window dimensions */
const ONBOARDING_WIDTH = 600;
const ONBOARDING_HEIGHT = 500;

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Gets the path to the main preload script.
 * Onboarding window uses the main preload since it already has all needed APIs.
 * Note: The preload entry (src/preload/main.ts) builds to preload.js, not main.js.
 */
function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

/**
 * Result of getOnboardingUrl - either a URL string or a file path.
 */
interface OnboardingUrlResult {
  type: "url" | "file";
  value: string;
}

// Vite define plugin injects these as global constants at build time
declare const ONBOARDING_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const ONBOARDING_WINDOW_VITE_NAME: string | undefined;

/**
 * Gets the URL or file path to load for the onboarding window.
 * Uses Electron Forge VitePlugin define constants (not process.env).
 */
function getOnboardingUrl(): OnboardingUrlResult {
  // The VitePlugin injects ONBOARDING_WINDOW_VITE_DEV_SERVER_URL via Vite's define plugin
  // in dev mode. This is a build-time replacement, not a runtime env var.
  if (typeof ONBOARDING_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    // In dev mode, Vite serves index.html from the root
    // Ensure trailing slash before appending path
    const baseUrl = ONBOARDING_WINDOW_VITE_DEV_SERVER_URL.endsWith("/")
      ? ONBOARDING_WINDOW_VITE_DEV_SERVER_URL
      : `${ONBOARDING_WINDOW_VITE_DEV_SERVER_URL}/`;
    return {
      type: "url",
      value: `${baseUrl}index.html`,
    };
  }

  // In production (or dev without the define), use file path
  // VitePlugin sets ONBOARDING_WINDOW_VITE_NAME for the renderer output directory
  const rendererName =
    typeof ONBOARDING_WINDOW_VITE_NAME !== "undefined"
      ? ONBOARDING_WINDOW_VITE_NAME
      : "onboarding_window";
  return {
    type: "file",
    value: path.join(__dirname, `../renderer/${rendererName}/index.html`),
  };
}

// ============================================================================
// Onboarding Window Implementation
// ============================================================================

class OnboardingWindowImpl implements OnboardingWindowService {
  private readonly logger: Logger;
  private window: BrowserWindow | null = null;

  constructor() {
    this.logger = getLogger().child({ component: "OnboardingWindow" });
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
   * Creates the onboarding BrowserWindow (hidden by default).
   */
  private createWindow(): BrowserWindow {
    const preloadPath = getPreloadPath();
    const onboardingUrlResult = getOnboardingUrl();

    this.logger.info("Creating onboarding window", {
      preloadPath,
      onboardingUrlType: onboardingUrlResult.type,
      onboardingUrlValue: onboardingUrlResult.value,
      width: ONBOARDING_WIDTH,
      height: ONBOARDING_HEIGHT,
    });

    const onboardingWindow = new BrowserWindow({
      width: ONBOARDING_WIDTH,
      height: ONBOARDING_HEIGHT,
      frame: true, // Standard frame (not frameless)
      transparent: false, // Not transparent
      resizable: false, // Fixed wizard size
      show: false, // Created hidden, shown on demand
      center: true, // Center on screen
      title: "Welcome to SmartHole",
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Set up error handlers for content loading
    onboardingWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        this.logger.error("Onboarding window failed to load content", {
          errorCode,
          errorDescription,
          validatedURL,
        });
      }
    );

    onboardingWindow.webContents.on("did-finish-load", () => {
      this.logger.info("Onboarding window content finished loading");
    });

    onboardingWindow.webContents.on("render-process-gone", (_event, details) => {
      this.logger.error("Onboarding window render process gone", { reason: details.reason });
    });

    // Load the onboarding HTML/URL
    if (onboardingUrlResult.type === "url") {
      onboardingWindow.loadURL(onboardingUrlResult.value);
    } else {
      onboardingWindow.loadFile(onboardingUrlResult.value);
    }

    // Set up window events
    this.setupWindowEvents(onboardingWindow);

    this.logger.info("Onboarding window created");
    return onboardingWindow;
  }

  /**
   * Sets up event handlers for the onboarding window.
   */
  private setupWindowEvents(window: BrowserWindow): void {
    // Handle window closed
    window.on("closed", () => {
      this.window = null;
      this.logger.debug("Onboarding window closed");
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
        this.logger.debug("Onboarding window focused (already visible)");
        return;
      }
      // Window exists but is hidden - show it
      this.window.show();
      this.window.focus();
      this.logger.debug("Onboarding window shown (was hidden)");
      return;
    }

    // Create new window
    this.window = this.createWindow();

    // Wait for content to load before showing
    const webContents = this.window.webContents;
    if (!webContents.isLoading()) {
      this.window.show();
      this.window.focus();
      this.logger.info("Onboarding window shown immediately");
    } else {
      webContents.once("did-finish-load", () => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.show();
          this.window.focus();
          this.logger.info("Onboarding window shown after loading");
        }
      });
    }
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) return;

    this.window.close();
    this.logger.debug("Onboarding window hidden");
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

let onboardingInstance: OnboardingWindowImpl | null = null;

/**
 * Initializes the onboarding window service.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 */
export function initializeOnboardingWindow(): OnboardingWindowService {
  if (onboardingInstance) {
    return onboardingInstance;
  }

  onboardingInstance = new OnboardingWindowImpl();
  return onboardingInstance;
}

/**
 * Gets the onboarding window service instance.
 * Throws if initializeOnboardingWindow() has not been called.
 */
export function getOnboardingWindow(): OnboardingWindowService {
  if (!onboardingInstance) {
    throw new Error(
      "OnboardingWindow not initialized. Call initializeOnboardingWindow() before using getOnboardingWindow()."
    );
  }
  return onboardingInstance;
}

/**
 * Resets the onboarding window service instance (primarily for testing).
 */
export function resetOnboardingWindow(): void {
  if (onboardingInstance) {
    onboardingInstance.destroy();
  }
  onboardingInstance = null;
}
