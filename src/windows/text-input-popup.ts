/**
 * Text input popup window management service.
 * Manages a frameless, transparent BrowserWindow for text input,
 * similar to Spotlight or Alfred.
 *
 * @see F-text-input-popup-window feature specification
 */

import { EventEmitter } from "events";
import { BrowserWindow, screen, app } from "electron";
import path from "path";
import { getLogger, Logger } from "../services/logger";
import { TextInputOpenPayload, TextInputSubmitPayload } from "../types";

// ============================================================================
// Types
// ============================================================================

/**
 * Events emitted by the TextInputPopupService.
 */
export interface TextInputPopupEvents {
  /** Emitted when text is submitted from the popup */
  submitted: (payload: TextInputSubmitPayload) => void;
  /** Emitted when the popup is dismissed without submitting */
  dismissed: () => void;
  /** Emitted when the popup window gains focus */
  focused: () => void;
}

/**
 * Text input popup service interface.
 */
export interface TextInputPopupService {
  /** Show the popup window, centering on active display */
  show(options?: TextInputOpenPayload): void;

  /** Hide the popup window */
  hide(): void;

  /** Check if popup is currently visible */
  isVisible(): boolean;

  /** Get the BrowserWindow instance (for IPC) */
  getWindow(): BrowserWindow | null;

  /** Subscribe to popup events */
  on<K extends keyof TextInputPopupEvents>(event: K, listener: TextInputPopupEvents[K]): void;

  /** Unsubscribe from popup events */
  off<K extends keyof TextInputPopupEvents>(event: K, listener: TextInputPopupEvents[K]): void;
}

// ============================================================================
// Constants
// ============================================================================

/** Popup window dimensions */
const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 60;

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Gets the path to the popup preload script.
 * Uses Electron Forge VitePlugin conventions.
 * In both dev and production, the preload script is output alongside main.
 */
function getPreloadPath(): string {
  return path.join(__dirname, "popup.js");
}

/**
 * Result of getPopupUrl - either a URL string or a file path.
 */
interface PopupUrlResult {
  type: "url" | "file";
  value: string;
}

// Vite define plugin injects these as global constants at build time
declare const POPUP_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const POPUP_WINDOW_VITE_NAME: string | undefined;

/**
 * Gets the URL or file path to load for the popup window.
 * Uses Electron Forge VitePlugin define constants (not process.env).
 */
function getPopupUrl(): PopupUrlResult {
  // The VitePlugin injects POPUP_WINDOW_VITE_DEV_SERVER_URL via Vite's define plugin
  // in dev mode. This is a build-time replacement, not a runtime env var.
  if (typeof POPUP_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    // In dev mode, Vite serves index.html from the root
    // Ensure trailing slash before appending path
    const baseUrl = POPUP_WINDOW_VITE_DEV_SERVER_URL.endsWith("/")
      ? POPUP_WINDOW_VITE_DEV_SERVER_URL
      : `${POPUP_WINDOW_VITE_DEV_SERVER_URL}/`;
    return {
      type: "url",
      value: `${baseUrl}index.html`,
    };
  }

  // In production (or dev without the define), use file path
  // VitePlugin sets POPUP_WINDOW_VITE_NAME for the renderer output directory
  const rendererName =
    typeof POPUP_WINDOW_VITE_NAME !== "undefined" ? POPUP_WINDOW_VITE_NAME : "popup_window";
  return {
    type: "file",
    value: path.join(__dirname, `../renderer/${rendererName}/index.html`),
  };
}

// ============================================================================
// Screen Positioning
// ============================================================================

/**
 * Calculates the position to center a window on the active display.
 * Active display is determined by the cursor position.
 *
 * @param width - Window width
 * @param height - Window height
 * @returns Position { x, y } for the window
 */
export function calculateCenteredPosition(width: number, height: number): { x: number; y: number } {
  // Find the display where the cursor currently is
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = activeDisplay;

  // Center the popup in the work area
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);

  return { x, y };
}

// ============================================================================
// Text Input Popup Implementation
// ============================================================================

class TextInputPopupImpl implements TextInputPopupService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private window: BrowserWindow | null = null;
  private previouslyFocusedWindow: BrowserWindow | null = null;
  /** Flag to prevent blur handler from hiding the window during initial show */
  private isShowing = false;

  constructor() {
    this.logger = getLogger().child({ component: "TextInputPopup" });
    this.emitter = new EventEmitter();
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
   * Creates the popup BrowserWindow (hidden by default).
   */
  private createWindow(): BrowserWindow {
    const preloadPath = getPreloadPath();
    const popupUrlResult = getPopupUrl();

    this.logger.info("Creating popup window", {
      preloadPath,
      popupUrlType: popupUrlResult.type,
      popupUrlValue: popupUrlResult.value,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
    });

    const popupWindow = new BrowserWindow({
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false, // Created hidden, shown on demand
      focusable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Set up error handlers for content loading
    popupWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedURL) => {
        this.logger.error("Popup failed to load content", {
          errorCode,
          errorDescription,
          validatedURL,
        });
      }
    );

    popupWindow.webContents.on("did-finish-load", () => {
      this.logger.info("Popup content finished loading");
    });

    popupWindow.webContents.on("render-process-gone", (_event, details) => {
      this.logger.error("Popup render process gone", { reason: details.reason });
    });

    // Load the popup HTML/URL
    if (popupUrlResult.type === "url") {
      popupWindow.loadURL(popupUrlResult.value);
    } else {
      popupWindow.loadFile(popupUrlResult.value);
    }

    // Set up window events
    this.setupWindowEvents(popupWindow);

    this.logger.info("Text input popup window created");
    return popupWindow;
  }

  /**
   * Sets up event handlers for the popup window.
   */
  private setupWindowEvents(window: BrowserWindow): void {
    // Handle blur - dismiss the popup
    // Only hide if not in the middle of showing (prevents race condition)
    window.on("blur", () => {
      if (this.isShowing) {
        this.logger.debug("Text input popup blur ignored during show");
        return;
      }
      this.logger.debug("Text input popup lost focus");
      this.emitter.emit("dismissed");
      this.hide();
    });

    // Handle window closed
    window.on("closed", () => {
      this.window = null;
      this.logger.debug("Text input popup window closed");
    });
  }

  /**
   * Centers the window on the active display.
   */
  private centerOnActiveDisplay(): void {
    if (!this.window) return;

    const { x, y } = calculateCenteredPosition(POPUP_WIDTH, POPUP_HEIGHT);
    this.window.setPosition(x, y);
  }

  show(options?: TextInputOpenPayload): void {
    this.logger.info("show() called", { hasOptions: !!options });

    // Set showing flag to prevent blur handler from hiding window during activation
    this.isShowing = true;

    // Create window if it doesn't exist
    const needsCreate = !this.window || this.window.isDestroyed();
    this.logger.info("Window state check", {
      needsCreate,
      windowExists: !!this.window,
      isDestroyed: this.window?.isDestroyed() ?? "N/A",
    });

    if (needsCreate) {
      this.window = this.createWindow();
    }

    // At this point window is guaranteed to exist (createWindow always returns a window)

    const window = this.window!;

    // Store reference to currently focused window for focus restoration
    this.previouslyFocusedWindow = BrowserWindow.getFocusedWindow();

    // Position the window before showing
    this.centerOnActiveDisplay();
    const bounds = window.getBounds();
    this.logger.info("Window positioned", {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });

    // Check if webContents have already loaded
    const webContents = window.webContents;
    const isLoading = webContents.isLoading();
    this.logger.info("Content loading state", { isLoading });

    if (!isLoading) {
      // Content is already loaded, show immediately
      this.activateAndShow(options);
    } else {
      // Wait for content to finish loading before showing
      this.logger.info("Waiting for content to finish loading...");
      webContents.once("did-finish-load", () => {
        this.logger.info("Content loaded, now activating window");
        this.activateAndShow(options);
      });
    }
  }

  /**
   * Activates the window and shows it after content is ready.
   */
  private activateAndShow(options?: TextInputOpenPayload): void {
    this.logger.info("activateAndShow() called");

    if (!this.window || this.window.isDestroyed()) {
      this.logger.warn("activateAndShow() aborted - window is null or destroyed");
      this.isShowing = false;
      return;
    }

    // Show and focus the window
    this.logger.info("Calling window.show() and window.focus()");
    this.window.show();
    this.window.focus();

    // Log visibility state after show
    this.logger.info("Window state after show()", {
      isVisible: this.window.isVisible(),
      isFocused: this.window.isFocused(),
      bounds: this.window.getBounds(),
    });

    // Send placeholder if provided
    if (options?.placeholder) {
      this.window.webContents.send("textInput:placeholder", options.placeholder);
    }

    this.emitter.emit("focused");
    this.logger.info("Text input popup shown and focused");

    // Clear the showing flag after a brief delay to allow focus to settle
    // This prevents the blur handler from firing during the window activation
    setTimeout(() => {
      this.isShowing = false;
      this.logger.info("isShowing flag cleared");
    }, 100);
  }

  hide(): void {
    if (!this.window || this.window.isDestroyed()) return;

    this.window.hide();

    // Clear the input field for next use
    this.window.webContents.send("textInput:clear");

    // Restore focus to previous window
    if (this.previouslyFocusedWindow && !this.previouslyFocusedWindow.isDestroyed()) {
      this.previouslyFocusedWindow.focus();
    }
    this.previouslyFocusedWindow = null;

    this.logger.debug("Text input popup hidden");
  }

  isVisible(): boolean {
    return this.window !== null && !this.window.isDestroyed() && this.window.isVisible();
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  on<K extends keyof TextInputPopupEvents>(event: K, listener: TextInputPopupEvents[K]): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof TextInputPopupEvents>(event: K, listener: TextInputPopupEvents[K]): void {
    this.emitter.off(event, listener);
  }

  /**
   * Emits a submitted event. Called by IPC handler when text is submitted.
   */
  emitSubmitted(payload: TextInputSubmitPayload): void {
    this.emitter.emit("submitted", payload);
  }

  /**
   * Destroys the window and cleans up (primarily for testing).
   */
  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
    this.previouslyFocusedWindow = null;
    this.isShowing = false;
    this.emitter.removeAllListeners();
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let popupInstance: TextInputPopupImpl | null = null;

/**
 * Initializes the text input popup service.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 */
export function initializeTextInputPopup(): TextInputPopupService {
  if (popupInstance) {
    return popupInstance;
  }

  popupInstance = new TextInputPopupImpl();
  return popupInstance;
}

/**
 * Gets the text input popup service instance.
 * Throws if initializeTextInputPopup() has not been called.
 */
export function getTextInputPopup(): TextInputPopupService {
  if (!popupInstance) {
    throw new Error(
      "TextInputPopup not initialized. Call initializeTextInputPopup() before using getTextInputPopup()."
    );
  }
  return popupInstance;
}

/**
 * Resets the text input popup service instance (primarily for testing).
 */
export function resetTextInputPopup(): void {
  if (popupInstance) {
    popupInstance.destroy();
  }
  popupInstance = null;
}

/**
 * Gets the popup implementation instance for internal use (e.g., IPC handlers).
 * Returns null if not initialized.
 */
export function getTextInputPopupImpl(): TextInputPopupImpl | null {
  return popupInstance;
}
