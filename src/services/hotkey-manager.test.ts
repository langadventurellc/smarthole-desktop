/**
 * Tests for the HotkeyManager service.
 * Tests registration/unregistration, event emission, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Store uiohook handlers captured during module initialization
let _keydownHandler: ((e: { keycode: number }) => void) | null = null;
let keyupHandler: ((e: { keycode: number }) => void) | null = null;

// Mock Electron modules before importing the service
vi.mock("electron", () => ({
  globalShortcut: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
  systemPreferences: {
    isTrustedAccessibilityClient: vi.fn(),
  },
  app: {
    on: vi.fn(),
  },
}));

// Mock uiohook-napi - handlers are captured via the on() mock
vi.mock("uiohook-napi", () => ({
  uIOhook: {
    on: vi.fn((event: string, handler: (e: { keycode: number }) => void) => {
      // This runs when the module loads
      if (event === "keydown") _keydownHandler = handler;
      if (event === "keyup") keyupHandler = handler;
    }),
    start: vi.fn(),
    stop: vi.fn(),
  },
  UiohookKey: {
    Ctrl: 29,
    Meta: 3675,
    Alt: 56,
    Shift: 42,
    Space: 57,
    Tab: 15,
    Enter: 28,
    Backspace: 14,
    Delete: 111,
    Escape: 1,
    ArrowUp: 103,
    ArrowDown: 108,
    ArrowLeft: 105,
    ArrowRight: 106,
    F1: 59,
    F2: 60,
    F3: 61,
    F4: 62,
    F5: 63,
    F6: 64,
    F7: 65,
    F8: 66,
    F9: 67,
    F10: 68,
    F11: 87,
    F12: 88,
    A: 30,
    B: 48,
    C: 46,
    D: 32,
    E: 18,
    F: 33,
    G: 34,
    H: 35,
    I: 23,
    J: 36,
    K: 37,
    L: 38,
    M: 50,
    N: 49,
    O: 24,
    P: 25,
    Q: 16,
    R: 19,
    S: 31,
    T: 20,
    U: 22,
    V: 47,
    W: 17,
    X: 45,
    Y: 21,
    Z: 44,
    "0": 11,
    "1": 2,
    "2": 3,
    "3": 4,
    "4": 5,
    "5": 6,
    "6": 7,
    "7": 8,
    "8": 9,
    "9": 10,
  },
}));

import { globalShortcut, systemPreferences } from "electron";
import { uIOhook } from "uiohook-napi";
import {
  initializeHotkeyManager,
  getHotkeyManager,
  resetHotkeyManager,
  HotkeyManagerService,
} from "./hotkey-manager";
import { initializeLogger, resetLogger } from "./logger";
import { LogLevel, HotkeyConfig } from "../types";

describe("HotkeyManager", () => {
  let hotkeyManager: HotkeyManagerService;
  const mockGlobalShortcut = globalShortcut as unknown as {
    register: ReturnType<typeof vi.fn>;
    unregister: ReturnType<typeof vi.fn>;
  };
  const mockSystemPrefs = systemPreferences as unknown as {
    isTrustedAccessibilityClient: ReturnType<typeof vi.fn>;
  };
  const mockUIOhook = uIOhook as unknown as {
    on: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    _keydownHandler = null;
    keyupHandler = null;

    // Re-setup on() mock to capture new handlers
    mockUIOhook.on.mockImplementation(
      (event: string, handler: (e: { keycode: number }) => void) => {
        if (event === "keydown") _keydownHandler = handler;
        if (event === "keyup") keyupHandler = handler;
      }
    );

    // Default mock behavior
    mockGlobalShortcut.register.mockReturnValue(true);
    mockSystemPrefs.isTrustedAccessibilityClient.mockReturnValue(true);

    // Initialize logger and service
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    hotkeyManager = initializeHotkeyManager();
  });

  afterEach(() => {
    resetHotkeyManager();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeHotkeyManager();
      const instance2 = initializeHotkeyManager();
      expect(instance1).toBe(instance2);
    });

    it("throws if getHotkeyManager called before initialization", () => {
      resetHotkeyManager();
      expect(() => getHotkeyManager()).toThrow(/not initialized/);
    });
  });

  describe("registerHotkeys", () => {
    const config: HotkeyConfig = {
      voiceInput: "CommandOrControl+Shift+Space",
    };

    it("registers hotkey successfully", async () => {
      const result = await hotkeyManager.registerHotkeys(config);

      expect(result).toBe(true);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith(
        "CommandOrControl+Shift+Space",
        expect.any(Function)
      );
      expect(hotkeyManager.isRegistered()).toBe(true);
    });

    it("registers both voice and text hotkeys when textInput provided", async () => {
      const configWithText: HotkeyConfig = {
        voiceInput: "CommandOrControl+Shift+Space",
        textInput: "CommandOrControl+Shift+T",
      };

      const result = await hotkeyManager.registerHotkeys(configWithText);

      expect(result).toBe(true);
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(2);
    });

    it("starts uiohook for key up detection", async () => {
      await hotkeyManager.registerHotkeys(config);

      expect(mockUIOhook.start).toHaveBeenCalled();
    });

    it("returns false when registration fails", async () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      // Need an error handler or EventEmitter will throw
      hotkeyManager.on("error", () => {});

      const result = await hotkeyManager.registerHotkeys(config);

      expect(result).toBe(false);
      expect(hotkeyManager.isRegistered()).toBe(false);
    });

    it("emits error event when registration fails", async () => {
      mockGlobalShortcut.register.mockReturnValue(false);
      const errorHandler = vi.fn();
      hotkeyManager.on("error", errorHandler);

      await hotkeyManager.registerHotkeys(config);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "REGISTRATION_FAILED",
          accelerator: "CommandOrControl+Shift+Space",
        })
      );
    });
  });

  describe("hotkey events", () => {
    const config: HotkeyConfig = {
      voiceInput: "CommandOrControl+Shift+Space",
    };

    it("emits hotkey:activated when hotkey is pressed", async () => {
      const activatedHandler = vi.fn();
      hotkeyManager.on("hotkey:activated", activatedHandler);

      await hotkeyManager.registerHotkeys(config);

      // Get the callback passed to globalShortcut.register and call it
      const registerCall = mockGlobalShortcut.register.mock.calls[0];
      const callback = registerCall[1] as () => void;
      callback();

      expect(activatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        })
      );
    });

    it("emits hotkey:released when key is released", async () => {
      const releasedHandler = vi.fn();
      hotkeyManager.on("hotkey:released", releasedHandler);

      await hotkeyManager.registerHotkeys(config);

      // Simulate key down (hotkey activated)
      const registerCall = mockGlobalShortcut.register.mock.calls[0];
      const callback = registerCall[1] as () => void;
      callback();

      // Simulate key up via uiohook - Space keycode = 57
      if (keyupHandler) {
        keyupHandler({ keycode: 57 });
      }

      expect(releasedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          accelerator: "CommandOrControl+Shift+Space",
          hotkeyType: "voiceInput",
        })
      );
    });
  });

  describe("unregisterAll", () => {
    it("unregisters all hotkeys and stops uiohook", async () => {
      await hotkeyManager.registerHotkeys({
        voiceInput: "CommandOrControl+Shift+Space",
        textInput: "CommandOrControl+Shift+T",
      });

      hotkeyManager.unregisterAll();

      expect(mockGlobalShortcut.unregister).toHaveBeenCalledTimes(2);
      expect(mockUIOhook.stop).toHaveBeenCalled();
      expect(hotkeyManager.isRegistered()).toBe(false);
    });
  });

  describe("accessibility permissions (macOS)", () => {
    beforeEach(() => {
      // Simulate macOS
      vi.stubGlobal("process", { ...process, platform: "darwin" });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("checks accessibility permissions before registering", async () => {
      mockSystemPrefs.isTrustedAccessibilityClient.mockReturnValue(true);

      await hotkeyManager.registerHotkeys({ voiceInput: "CommandOrControl+Shift+Space" });

      expect(mockSystemPrefs.isTrustedAccessibilityClient).toHaveBeenCalled();
    });

    it("emits error when accessibility denied", async () => {
      mockSystemPrefs.isTrustedAccessibilityClient.mockReturnValue(false);
      const errorHandler = vi.fn();
      hotkeyManager.on("error", errorHandler);

      const result = await hotkeyManager.registerHotkeys({
        voiceInput: "CommandOrControl+Shift+Space",
      });

      expect(result).toBe(false);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "ACCESSIBILITY_DENIED",
        })
      );
    });
  });

  describe("event subscription", () => {
    it("allows unsubscribing from events", async () => {
      const handler = vi.fn();
      hotkeyManager.on("hotkey:activated", handler);
      hotkeyManager.off("hotkey:activated", handler);

      await hotkeyManager.registerHotkeys({ voiceInput: "CommandOrControl+Shift+Space" });

      // Trigger the hotkey
      const registerCall = mockGlobalShortcut.register.mock.calls[0];
      const callback = registerCall[1] as () => void;
      callback();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
