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
  return path.join(__dirname, "preload-popup.js");
}

/**
 * Gets the URL to load for the popup window.
 * Uses Electron Forge VitePlugin environment variables.
 */
function getPopupUrl(): string {
  // The VitePlugin sets POPUP_WINDOW_VITE_DEV_SERVER_URL in dev mode
  // Format: {NAME}_VITE_DEV_SERVER_URL where NAME is uppercase renderer name
  if (process.env.POPUP_WINDOW_VITE_DEV_SERVER_URL) {
    // In dev mode, Vite serves from the root, so we access popup.html directly
    return `${process.env.POPUP_WINDOW_VITE_DEV_SERVER_URL}popup.html`;
  }

  // In production, use file path
  // VitePlugin sets POPUP_WINDOW_VITE_NAME for the renderer output directory
  // The entry point is popup.html (from our rollupOptions.input config)
  return path.join(
    __dirname,
    `../renderer/${process.env.POPUP_WINDOW_VITE_NAME || "popup_window"}/popup.html`
  );
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
        preload: getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Load the popup HTML/URL
    popupWindow.loadURL(getPopupUrl());

    // Set up window events
    this.setupWindowEvents(popupWindow);

    this.logger.debug("Text input popup window created");
    return popupWindow;
  }

  /**
   * Sets up event handlers for the popup window.
   */
  private setupWindowEvents(window: BrowserWindow): void {
    // Handle blur - dismiss the popup
    window.on("blur", () => {
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
    // Create window if it doesn't exist
    if (!this.window || this.window.isDestroyed()) {
      this.window = this.createWindow();
    }

    // Store reference to currently focused window for focus restoration
    this.previouslyFocusedWindow = BrowserWindow.getFocusedWindow();

    // Position and show
    this.centerOnActiveDisplay();
    this.window.show();
    this.window.focus();

    // Send placeholder if provided
    if (options?.placeholder) {
      this.window.webContents.send("textInput:placeholder", options.placeholder);
    }

    this.emitter.emit("focused");
    this.logger.debug("Text input popup shown");
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
