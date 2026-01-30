/**
 * Hotkey manager service for system-wide keyboard shortcuts.
 * Provides key down and key up event detection for push-to-talk mode.
 *
 * Note: uiohook-napi is lazy-loaded to avoid native module issues at app startup.
 * The native module is only loaded when registerHotkeys() is called.
 *
 * @see F-global-hotkey-system feature specification
 */

import { EventEmitter } from "events";
import { globalShortcut, systemPreferences, app } from "electron";
import { getLogger, Logger } from "./logger";
import {
  HotkeyConfig,
  HotkeyActivatedEvent,
  HotkeyReleasedEvent,
  HotkeyErrorEvent,
  HotkeyType,
} from "../types";

// Re-export types that consumers need
export type { HotkeyActivatedEvent, HotkeyReleasedEvent, HotkeyErrorEvent };

// ============================================================================
// Types
// ============================================================================

/**
 * Events emitted by the HotkeyManagerService.
 */
export interface HotkeyManagerEvents {
  /** Emitted when a registered hotkey is pressed */
  "hotkey:activated": (event: HotkeyActivatedEvent) => void;
  /** Emitted when a registered hotkey is released */
  "hotkey:released": (event: HotkeyReleasedEvent) => void;
  /** Emitted when hotkey registration fails */
  error: (event: HotkeyErrorEvent) => void;
}

/**
 * Internal state for tracking a registered hotkey.
 */
interface RegisteredHotkey {
  accelerator: string;
  hotkeyType: HotkeyType;
  /** uiohook keycodes for detecting key up */
  keycodes: number[];
  isPressed: boolean;
}

/**
 * Hotkey manager service interface.
 */
export interface HotkeyManagerService {
  /**
   * Register hotkeys from configuration.
   * Will check and request accessibility permissions on macOS.
   *
   * @param config - The hotkey configuration
   * @returns true if registration succeeded, false if it failed
   */
  registerHotkeys(config: HotkeyConfig): Promise<boolean>;

  /**
   * Unregister all hotkeys and clean up.
   */
  unregisterAll(): void;

  /**
   * Check if hotkeys are currently registered.
   */
  isRegistered(): boolean;

  /**
   * Check if accessibility permissions are granted (macOS only).
   * Always returns true on non-macOS platforms.
   */
  hasAccessibilityPermissions(): boolean;

  /**
   * Request accessibility permissions (macOS only).
   * No-op on non-macOS platforms.
   *
   * @returns true if permissions are granted
   */
  requestAccessibilityPermissions(): Promise<boolean>;

  /**
   * Subscribe to hotkey events.
   */
  on<K extends keyof HotkeyManagerEvents>(event: K, listener: HotkeyManagerEvents[K]): void;

  /**
   * Unsubscribe from hotkey events.
   */
  off<K extends keyof HotkeyManagerEvents>(event: K, listener: HotkeyManagerEvents[K]): void;
}

// ============================================================================
// Lazy Loading for uiohook-napi
// ============================================================================

/**
 * Type for the uiohook-napi module.
 */
type UiohookModule = typeof import("uiohook-napi");

/**
 * Cached uiohook module after lazy loading.
 */
let uiohookModule: UiohookModule | null = null;

/**
 * Lazy loads the uiohook-napi module.
 * The native module is only loaded when this function is first called.
 *
 * @returns The uiohook-napi module
 * @throws If the native module fails to load
 */
async function loadUiohook(): Promise<UiohookModule> {
  if (uiohookModule) {
    return uiohookModule;
  }

  // Dynamic import to avoid loading native module at module parse time
  uiohookModule = await import("uiohook-napi");
  return uiohookModule;
}

/**
 * Gets the cached uiohook module (must be loaded first via loadUiohook).
 * @returns The uiohook module or null if not loaded
 */
function getUiohook(): UiohookModule | null {
  return uiohookModule;
}

// ============================================================================
// Accelerator Parsing
// ============================================================================

/**
 * Cached accelerator to keycode map (built lazily after uiohook is loaded).
 */
let acceleratorToKeycodeMap: Record<string, number> | null = null;

/**
 * Builds the accelerator to keycode map using UiohookKey constants.
 * Must be called after uiohook is loaded.
 */
function buildAcceleratorToKeycodeMap(
  UiohookKey: UiohookModule["UiohookKey"]
): Record<string, number> {
  return {
    // Modifiers
    control: UiohookKey.Ctrl,
    ctrl: UiohookKey.Ctrl,
    command: UiohookKey.Meta,
    cmd: UiohookKey.Meta,
    meta: UiohookKey.Meta,
    alt: UiohookKey.Alt,
    option: UiohookKey.Alt,
    shift: UiohookKey.Shift,

    // Special keys
    space: UiohookKey.Space,
    tab: UiohookKey.Tab,
    enter: UiohookKey.Enter,
    return: UiohookKey.Enter,
    backspace: UiohookKey.Backspace,
    delete: UiohookKey.Delete,
    escape: UiohookKey.Escape,
    esc: UiohookKey.Escape,
    up: UiohookKey.ArrowUp,
    down: UiohookKey.ArrowDown,
    left: UiohookKey.ArrowLeft,
    right: UiohookKey.ArrowRight,

    // Function keys
    f1: UiohookKey.F1,
    f2: UiohookKey.F2,
    f3: UiohookKey.F3,
    f4: UiohookKey.F4,
    f5: UiohookKey.F5,
    f6: UiohookKey.F6,
    f7: UiohookKey.F7,
    f8: UiohookKey.F8,
    f9: UiohookKey.F9,
    f10: UiohookKey.F10,
    f11: UiohookKey.F11,
    f12: UiohookKey.F12,

    // Letters (A-Z) - uiohook uses virtual keycodes
    a: UiohookKey.A,
    b: UiohookKey.B,
    c: UiohookKey.C,
    d: UiohookKey.D,
    e: UiohookKey.E,
    f: UiohookKey.F,
    g: UiohookKey.G,
    h: UiohookKey.H,
    i: UiohookKey.I,
    j: UiohookKey.J,
    k: UiohookKey.K,
    l: UiohookKey.L,
    m: UiohookKey.M,
    n: UiohookKey.N,
    o: UiohookKey.O,
    p: UiohookKey.P,
    q: UiohookKey.Q,
    r: UiohookKey.R,
    s: UiohookKey.S,
    t: UiohookKey.T,
    u: UiohookKey.U,
    v: UiohookKey.V,
    w: UiohookKey.W,
    x: UiohookKey.X,
    y: UiohookKey.Y,
    z: UiohookKey.Z,

    // Numbers
    "0": UiohookKey["0"],
    "1": UiohookKey["1"],
    "2": UiohookKey["2"],
    "3": UiohookKey["3"],
    "4": UiohookKey["4"],
    "5": UiohookKey["5"],
    "6": UiohookKey["6"],
    "7": UiohookKey["7"],
    "8": UiohookKey["8"],
    "9": UiohookKey["9"],
  };
}

/**
 * Parses an Electron accelerator string into uiohook keycodes.
 * Example: "CommandOrControl+Shift+Space" -> [Meta/Ctrl, Shift, Space]
 *
 * @param accelerator - The accelerator string to parse
 * @param UiohookKey - The UiohookKey constants from the loaded module
 * @returns Array of keycodes
 */
function parseAccelerator(accelerator: string, UiohookKey: UiohookModule["UiohookKey"]): number[] {
  // Build the map lazily if not already built
  if (!acceleratorToKeycodeMap) {
    acceleratorToKeycodeMap = buildAcceleratorToKeycodeMap(UiohookKey);
  }

  const parts = accelerator.toLowerCase().split("+");
  const keycodes: number[] = [];

  for (const part of parts) {
    const trimmed = part.trim();

    // Handle "CommandOrControl" - platform-specific
    if (trimmed === "commandorcontrol" || trimmed === "cmdorctrl") {
      keycodes.push(process.platform === "darwin" ? UiohookKey.Meta : UiohookKey.Ctrl);
      continue;
    }

    const keycode = acceleratorToKeycodeMap[trimmed];
    if (keycode !== undefined) {
      keycodes.push(keycode);
    }
  }

  return keycodes;
}

// ============================================================================
// Hotkey Manager Implementation
// ============================================================================

class HotkeyManagerImpl implements HotkeyManagerService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private readonly registeredHotkeys: Map<string, RegisteredHotkey> = new Map();
  private uiohookStarted = false;
  private uiohookListenersSetup = false;
  private currentlyPressedKeys: Set<number> = new Set();

  constructor() {
    this.logger = getLogger().child({ component: "HotkeyManager" });
    this.emitter = new EventEmitter();
    this.setupCleanup();
  }

  /**
   * Sets up uiohook event listeners.
   * Called lazily after uiohook is loaded.
   */
  private setupUiohookListeners(): void {
    if (this.uiohookListenersSetup) {
      return;
    }

    const uiohook = getUiohook();
    if (!uiohook) {
      return;
    }

    uiohook.uIOhook.on("keydown", (e) => {
      this.currentlyPressedKeys.add(e.keycode);
    });

    uiohook.uIOhook.on("keyup", (e) => {
      this.currentlyPressedKeys.delete(e.keycode);
      this.handleKeyUp(e.keycode);
    });

    this.uiohookListenersSetup = true;
  }

  private setupCleanup(): void {
    // Clean up hotkeys when app quits
    app.on("will-quit", () => {
      this.unregisterAll();
    });
  }

  private handleKeyUp(keycode: number): void {
    // Check if any registered hotkey includes this keycode and is currently pressed
    for (const [accelerator, hotkey] of this.registeredHotkeys.entries()) {
      if (hotkey.isPressed && hotkey.keycodes.includes(keycode)) {
        // One of the keys in the combo was released
        hotkey.isPressed = false;
        this.logger.debug("Hotkey released", {
          accelerator,
          keycode,
          hotkeyType: hotkey.hotkeyType,
        });

        const event: HotkeyReleasedEvent = {
          accelerator,
          hotkeyType: hotkey.hotkeyType,
        };
        this.emitter.emit("hotkey:released", event);
      }
    }
  }

  async registerHotkeys(config: HotkeyConfig): Promise<boolean> {
    // Check accessibility permissions on macOS
    if (process.platform === "darwin" && !this.hasAccessibilityPermissions()) {
      this.logger.warn("Accessibility permissions not granted, requesting...");
      const granted = await this.requestAccessibilityPermissions();
      if (!granted) {
        this.logger.error("Accessibility permissions denied");
        const errorEvent: HotkeyErrorEvent = {
          message: "Accessibility permissions are required for hotkey registration on macOS",
          code: "ACCESSIBILITY_DENIED",
        };
        this.emitter.emit("error", errorEvent);
        return false;
      }
    }

    // Lazy-load uiohook-napi
    let uiohook: UiohookModule;
    try {
      uiohook = await loadUiohook();
      this.logger.debug("uiohook-napi loaded successfully");
    } catch (error) {
      this.logger.error("Failed to load uiohook-napi", {
        error: error instanceof Error ? error.message : String(error),
      });
      const errorEvent: HotkeyErrorEvent = {
        message: `Failed to load native keyboard hook module: ${error instanceof Error ? error.message : String(error)}`,
        code: "UIOHOOK_ERROR",
      };
      this.emitter.emit("error", errorEvent);
      return false;
    }

    // Setup listeners now that uiohook is loaded
    this.setupUiohookListeners();

    // Register voice input hotkey
    const voiceSuccess = this.registerSingleHotkey(
      config.voiceInput,
      "voiceInput",
      uiohook.UiohookKey
    );
    if (!voiceSuccess) {
      return false;
    }

    // Register text input hotkey if provided
    if (config.textInput) {
      const textSuccess = this.registerSingleHotkey(
        config.textInput,
        "textInput",
        uiohook.UiohookKey
      );
      if (!textSuccess) {
        // Unregister voice hotkey if text registration fails
        globalShortcut.unregister(config.voiceInput);
        this.registeredHotkeys.delete(config.voiceInput);
        return false;
      }
    }

    // Start uiohook for key up detection if not already started
    if (!this.uiohookStarted) {
      try {
        uiohook.uIOhook.start();
        this.uiohookStarted = true;
        this.logger.debug("uiohook started for key up detection");
      } catch (error) {
        this.logger.error("Failed to start uiohook", {
          error: error instanceof Error ? error.message : String(error),
        });
        const errorEvent: HotkeyErrorEvent = {
          message: `Failed to start key up detection: ${error instanceof Error ? error.message : String(error)}`,
          code: "UIOHOOK_ERROR",
        };
        this.emitter.emit("error", errorEvent);
        // Registration still succeeded for key down, so don't fail entirely
      }
    }

    this.logger.info("Hotkeys registered successfully", {
      voiceInput: config.voiceInput,
      textInput: config.textInput,
    });

    return true;
  }

  private registerSingleHotkey(
    accelerator: string,
    hotkeyType: HotkeyType,
    UiohookKey: UiohookModule["UiohookKey"]
  ): boolean {
    // Try to register with Electron's globalShortcut
    const success = globalShortcut.register(accelerator, () => {
      this.handleHotkeyActivated(accelerator, hotkeyType);
    });

    if (!success) {
      this.logger.error("Failed to register hotkey (may be in use by another application)", {
        accelerator,
        hotkeyType,
      });

      const errorEvent: HotkeyErrorEvent = {
        message: `Failed to register hotkey "${accelerator}". It may be in use by another application.`,
        accelerator,
        code: "REGISTRATION_FAILED",
      };
      this.emitter.emit("error", errorEvent);
      return false;
    }

    // Parse accelerator for key up detection
    const keycodes = parseAccelerator(accelerator, UiohookKey);

    const registeredHotkey: RegisteredHotkey = {
      accelerator,
      hotkeyType,
      keycodes,
      isPressed: false,
    };
    this.registeredHotkeys.set(accelerator, registeredHotkey);

    this.logger.debug("Hotkey registered", { accelerator, hotkeyType, keycodes });
    return true;
  }

  private handleHotkeyActivated(accelerator: string, hotkeyType: HotkeyType): void {
    const hotkey = this.registeredHotkeys.get(accelerator);
    if (hotkey) {
      hotkey.isPressed = true;
    }

    this.logger.debug("Hotkey activated", { accelerator, hotkeyType });

    const event: HotkeyActivatedEvent = {
      accelerator,
      hotkeyType,
    };
    this.emitter.emit("hotkey:activated", event);
  }

  unregisterAll(): void {
    // Unregister all Electron global shortcuts
    for (const accelerator of this.registeredHotkeys.keys()) {
      try {
        globalShortcut.unregister(accelerator);
      } catch (error) {
        this.logger.warn("Failed to unregister hotkey", {
          accelerator,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.registeredHotkeys.clear();

    // Stop uiohook if it was started
    if (this.uiohookStarted) {
      const uiohook = getUiohook();
      if (uiohook) {
        try {
          uiohook.uIOhook.stop();
          this.uiohookStarted = false;
          this.logger.debug("uiohook stopped");
        } catch (error) {
          this.logger.warn("Failed to stop uiohook", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.currentlyPressedKeys.clear();
    this.logger.info("All hotkeys unregistered");
  }

  isRegistered(): boolean {
    return this.registeredHotkeys.size > 0;
  }

  hasAccessibilityPermissions(): boolean {
    if (process.platform !== "darwin") {
      return true;
    }
    return systemPreferences.isTrustedAccessibilityClient(false);
  }

  async requestAccessibilityPermissions(): Promise<boolean> {
    if (process.platform !== "darwin") {
      return true;
    }

    // This will prompt the user with the system accessibility dialog
    // Note: The user must manually enable the app in System Preferences
    systemPreferences.isTrustedAccessibilityClient(true);

    // Give the user a moment to respond, then check again
    // In practice, the app may need to be restarted after granting permissions
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.hasAccessibilityPermissions());
      }, 1000);
    });
  }

  on<K extends keyof HotkeyManagerEvents>(event: K, listener: HotkeyManagerEvents[K]): void {
    this.emitter.on(event, listener);
  }

  off<K extends keyof HotkeyManagerEvents>(event: K, listener: HotkeyManagerEvents[K]): void {
    this.emitter.off(event, listener);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let hotkeyManagerInstance: HotkeyManagerImpl | null = null;

/**
 * Initializes the global hotkey manager instance.
 * Must be called inside `app.whenReady()` after the logger has been initialized.
 *
 * Note: This does NOT load the uiohook-napi native module. The module is
 * lazy-loaded when registerHotkeys() is called.
 */
export function initializeHotkeyManager(): HotkeyManagerService {
  if (hotkeyManagerInstance) {
    return hotkeyManagerInstance;
  }

  hotkeyManagerInstance = new HotkeyManagerImpl();
  return hotkeyManagerInstance;
}

/**
 * Gets the current hotkey manager service instance.
 * Throws if initializeHotkeyManager() has not been called.
 */
export function getHotkeyManager(): HotkeyManagerService {
  if (!hotkeyManagerInstance) {
    throw new Error(
      "HotkeyManager not initialized. Call initializeHotkeyManager() before using getHotkeyManager()."
    );
  }
  return hotkeyManagerInstance;
}

/**
 * Resets the hotkey manager instance (primarily for testing).
 */
export function resetHotkeyManager(): void {
  if (hotkeyManagerInstance) {
    hotkeyManagerInstance.unregisterAll();
  }
  hotkeyManagerInstance = null;
  // Also reset the cached uiohook module and keycode map for clean testing
  uiohookModule = null;
  acceleratorToKeycodeMap = null;
}
