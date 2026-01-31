/**
 * Tests for the TextInputPopup service.
 * Tests singleton lifecycle, window management, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Use vi.hoisted to define mocks that will be used in vi.mock
const { mockBrowserWindowInstance, mockGetFocusedWindow, mockScreen, mockApp } = vi.hoisted(() => {
  const mockBrowserWindowInstance = {
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
    isVisible: vi.fn().mockReturnValue(false),
    isDestroyed: vi.fn().mockReturnValue(false),
    isFocused: vi.fn().mockReturnValue(true),
    setPosition: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 660, y: 510, width: 600, height: 60 }),
    webContents: {
      send: vi.fn(),
      isLoading: vi.fn().mockReturnValue(false),
      once: vi.fn(),
      on: vi.fn(),
    },
  };

  const mockGetFocusedWindow = vi.fn((): unknown => null);

  const mockScreen = {
    getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 500 })),
    getDisplayNearestPoint: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    })),
  };

  const mockApp = {
    on: vi.fn(),
    isPackaged: false,
  };

  return {
    mockBrowserWindowInstance,
    mockGetFocusedWindow,
    mockScreen,
    mockApp,
  };
});

// Mock Electron modules before importing the service
vi.mock("electron", () => {
  // Create a mock constructor function
  function MockBrowserWindow() {
    return mockBrowserWindowInstance;
  }
  // Add static method
  MockBrowserWindow.getFocusedWindow = mockGetFocusedWindow;

  return {
    BrowserWindow: MockBrowserWindow,
    screen: mockScreen,
    app: mockApp,
  };
});

// Mock path module
vi.mock("path", () => ({
  default: {
    join: vi.fn((...args: string[]) => args.join("/")),
  },
}));

import {
  initializeTextInputPopup,
  getTextInputPopup,
  resetTextInputPopup,
  calculateCenteredPosition,
  TextInputPopupService,
} from "./text-input-popup";
import { initializeLogger, resetLogger } from "../services/logger";
import { LogLevel } from "../types";

describe("TextInputPopup", () => {
  let popupService: TextInputPopupService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock browser window state
    mockBrowserWindowInstance.isVisible.mockReturnValue(false);
    mockBrowserWindowInstance.isDestroyed.mockReturnValue(false);
    mockGetFocusedWindow.mockReturnValue(null);

    // Initialize logger and service
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    popupService = initializeTextInputPopup();
  });

  afterEach(() => {
    resetTextInputPopup();
    resetLogger();
  });

  describe("singleton lifecycle", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeTextInputPopup();
      const instance2 = initializeTextInputPopup();
      expect(instance1).toBe(instance2);
    });

    it("throws if getTextInputPopup called before initialization", () => {
      resetTextInputPopup();
      expect(() => getTextInputPopup()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeTextInputPopup();
      resetTextInputPopup();
      const instance2 = initializeTextInputPopup();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("show", () => {
    it("positions window centered on active display", () => {
      mockScreen.getDisplayNearestPoint.mockReturnValue({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      popupService.show();

      // Expected center position: (1920 - 600) / 2 = 660, (1080 - 60) / 2 = 510
      expect(mockBrowserWindowInstance.setPosition).toHaveBeenCalledWith(660, 510);
    });

    it("shows and focuses the window", () => {
      popupService.show();

      expect(mockBrowserWindowInstance.show).toHaveBeenCalled();
      expect(mockBrowserWindowInstance.focus).toHaveBeenCalled();
    });

    it("sends placeholder when provided", () => {
      popupService.show({ placeholder: "Type something..." });

      expect(mockBrowserWindowInstance.webContents.send).toHaveBeenCalledWith(
        "textInput:placeholder",
        "Type something..."
      );
    });

    it("emits focused event", () => {
      const focusHandler = vi.fn();
      popupService.on("focused", focusHandler);

      popupService.show();

      expect(focusHandler).toHaveBeenCalled();
    });
  });

  describe("hide", () => {
    it("hides the window", () => {
      popupService.show();
      popupService.hide();

      expect(mockBrowserWindowInstance.hide).toHaveBeenCalled();
    });

    it("clears input field via IPC", () => {
      popupService.show();
      popupService.hide();

      expect(mockBrowserWindowInstance.webContents.send).toHaveBeenCalledWith("textInput:clear");
    });

    it("restores focus to previous window", () => {
      const mockPreviousWindow = {
        focus: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
      };
      mockGetFocusedWindow.mockReturnValue(mockPreviousWindow);

      popupService.show();
      popupService.hide();

      expect(mockPreviousWindow.focus).toHaveBeenCalled();
    });
  });

  describe("isVisible", () => {
    it("returns false when window not created", () => {
      expect(popupService.isVisible()).toBe(false);
    });

    it("returns true when window is visible", () => {
      popupService.show();
      mockBrowserWindowInstance.isVisible.mockReturnValue(true);

      expect(popupService.isVisible()).toBe(true);
    });

    it("returns false when window is hidden", () => {
      popupService.show();
      mockBrowserWindowInstance.isVisible.mockReturnValue(false);

      expect(popupService.isVisible()).toBe(false);
    });
  });

  describe("event subscription", () => {
    it("allows subscribing to dismissed event", () => {
      vi.useFakeTimers();
      const handler = vi.fn();
      popupService.on("dismissed", handler);

      popupService.show();

      // Wait for the isShowing flag to be cleared (100ms timeout)
      vi.advanceTimersByTime(100);

      // Simulate blur event
      const blurHandler = mockBrowserWindowInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === "blur"
      )?.[1] as (() => void) | undefined;
      blurHandler?.();

      expect(handler).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("ignores blur event during show (prevents race condition)", () => {
      const handler = vi.fn();
      popupService.on("dismissed", handler);

      popupService.show();

      // Simulate blur event immediately (before timeout clears isShowing)
      const blurHandler = mockBrowserWindowInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === "blur"
      )?.[1] as (() => void) | undefined;
      blurHandler?.();

      // Should NOT be called because isShowing is still true
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows unsubscribing from events", () => {
      const handler = vi.fn();
      popupService.on("focused", handler);
      popupService.off("focused", handler);

      popupService.show();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("getWindow", () => {
    it("returns null before window is created", () => {
      expect(popupService.getWindow()).toBeNull();
    });

    it("returns window after show", () => {
      popupService.show();
      expect(popupService.getWindow()).toBe(mockBrowserWindowInstance);
    });
  });
});

describe("calculateCenteredPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("centers window on primary display", () => {
    mockScreen.getCursorScreenPoint.mockReturnValue({ x: 500, y: 500 });
    mockScreen.getDisplayNearestPoint.mockReturnValue({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    });

    const { x, y } = calculateCenteredPosition(600, 60);

    expect(x).toBe(660); // (1920 - 600) / 2
    expect(y).toBe(510); // (1080 - 60) / 2
  });

  it("handles displays with non-zero origin", () => {
    mockScreen.getCursorScreenPoint.mockReturnValue({ x: 2000, y: 500 });
    mockScreen.getDisplayNearestPoint.mockReturnValue({
      workArea: { x: 1920, y: 0, width: 1920, height: 1080 },
    });

    const { x, y } = calculateCenteredPosition(600, 60);

    expect(x).toBe(1920 + 660); // workArea.x + center offset
    expect(y).toBe(510);
  });

  it("handles work area with menu bar offset", () => {
    mockScreen.getCursorScreenPoint.mockReturnValue({ x: 500, y: 500 });
    mockScreen.getDisplayNearestPoint.mockReturnValue({
      workArea: { x: 0, y: 25, width: 1920, height: 1055 }, // macOS menu bar
    });

    const { x, y } = calculateCenteredPosition(600, 60);

    expect(x).toBe(660);
    expect(y).toBe(25 + 498); // workArea.y + (1055 - 60) / 2 = 25 + 497.5 rounded
  });
});
