/**
 * Tests for the OnboardingWindow service.
 * Tests singleton lifecycle, window management, and behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Use vi.hoisted to define mocks that will be used in vi.mock
const { mockBrowserWindowInstance, mockApp } = vi.hoisted(() => {
  const mockBrowserWindowInstance = {
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    focus: vi.fn(),
    destroy: vi.fn(),
    isVisible: vi.fn().mockReturnValue(false),
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
      send: vi.fn(),
      isLoading: vi.fn().mockReturnValue(false),
      once: vi.fn(),
      on: vi.fn(),
    },
  };

  const mockApp = {
    on: vi.fn(),
    isPackaged: false,
  };

  return {
    mockBrowserWindowInstance,
    mockApp,
  };
});

// Mock Electron modules before importing the service
vi.mock("electron", () => {
  // Create a mock constructor function
  function MockBrowserWindow() {
    return mockBrowserWindowInstance;
  }

  return {
    BrowserWindow: MockBrowserWindow,
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
  initializeOnboardingWindow,
  getOnboardingWindow,
  resetOnboardingWindow,
  OnboardingWindowService,
} from "./onboarding-window";
import { initializeLogger, resetLogger } from "../services/logger";
import { LogLevel } from "../types";

describe("OnboardingWindow", () => {
  let onboardingService: OnboardingWindowService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock browser window state
    mockBrowserWindowInstance.isVisible.mockReturnValue(false);
    mockBrowserWindowInstance.isDestroyed.mockReturnValue(false);

    // Initialize logger and service
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    onboardingService = initializeOnboardingWindow();
  });

  afterEach(() => {
    resetOnboardingWindow();
    resetLogger();
  });

  describe("singleton lifecycle", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeOnboardingWindow();
      const instance2 = initializeOnboardingWindow();
      expect(instance1).toBe(instance2);
    });

    it("throws if getOnboardingWindow called before initialization", () => {
      resetOnboardingWindow();
      expect(() => getOnboardingWindow()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeOnboardingWindow();
      resetOnboardingWindow();
      const instance2 = initializeOnboardingWindow();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("show", () => {
    it("creates and shows the window", () => {
      onboardingService.show();

      expect(mockBrowserWindowInstance.show).toHaveBeenCalled();
      expect(mockBrowserWindowInstance.focus).toHaveBeenCalled();
    });

    it("focuses existing window if already visible", () => {
      // First show creates the window
      onboardingService.show();
      mockBrowserWindowInstance.isVisible.mockReturnValue(true);

      // Clear mocks to verify second call behavior
      vi.clearAllMocks();

      // Second show should just focus
      onboardingService.show();

      expect(mockBrowserWindowInstance.focus).toHaveBeenCalled();
      // Should not create a new window (no loadURL/loadFile calls)
      expect(mockBrowserWindowInstance.loadURL).not.toHaveBeenCalled();
      expect(mockBrowserWindowInstance.loadFile).not.toHaveBeenCalled();
    });

    it("shows hidden window if it exists but is not visible", () => {
      // First show creates the window
      onboardingService.show();
      mockBrowserWindowInstance.isVisible.mockReturnValue(false);

      // Clear mocks to verify second call behavior
      vi.clearAllMocks();

      // Second show should show the existing hidden window
      onboardingService.show();

      expect(mockBrowserWindowInstance.show).toHaveBeenCalled();
      expect(mockBrowserWindowInstance.focus).toHaveBeenCalled();
    });

    it("waits for content to load before showing if still loading", () => {
      mockBrowserWindowInstance.webContents.isLoading.mockReturnValue(true);

      onboardingService.show();

      // Should register a once listener for did-finish-load
      expect(mockBrowserWindowInstance.webContents.once).toHaveBeenCalledWith(
        "did-finish-load",
        expect.any(Function)
      );
    });

    it("shows immediately if content already loaded", () => {
      mockBrowserWindowInstance.webContents.isLoading.mockReturnValue(false);

      onboardingService.show();

      expect(mockBrowserWindowInstance.show).toHaveBeenCalled();
      expect(mockBrowserWindowInstance.focus).toHaveBeenCalled();
    });
  });

  describe("hide", () => {
    it("closes the window", () => {
      onboardingService.show();
      onboardingService.hide();

      expect(mockBrowserWindowInstance.close).toHaveBeenCalled();
    });

    it("does nothing if window does not exist", () => {
      // Don't show window first
      onboardingService.hide();

      expect(mockBrowserWindowInstance.close).not.toHaveBeenCalled();
    });

    it("does nothing if window is already destroyed", () => {
      onboardingService.show();
      mockBrowserWindowInstance.isDestroyed.mockReturnValue(true);

      onboardingService.hide();

      expect(mockBrowserWindowInstance.close).not.toHaveBeenCalled();
    });
  });

  describe("isVisible", () => {
    it("returns false when window not created", () => {
      expect(onboardingService.isVisible()).toBe(false);
    });

    it("returns true when window is visible", () => {
      onboardingService.show();
      mockBrowserWindowInstance.isVisible.mockReturnValue(true);

      expect(onboardingService.isVisible()).toBe(true);
    });

    it("returns false when window is hidden", () => {
      onboardingService.show();
      mockBrowserWindowInstance.isVisible.mockReturnValue(false);

      expect(onboardingService.isVisible()).toBe(false);
    });

    it("returns false when window is destroyed", () => {
      onboardingService.show();
      mockBrowserWindowInstance.isDestroyed.mockReturnValue(true);

      expect(onboardingService.isVisible()).toBe(false);
    });
  });

  describe("getWindow", () => {
    it("returns null before window is created", () => {
      expect(onboardingService.getWindow()).toBeNull();
    });

    it("returns window after show", () => {
      onboardingService.show();
      expect(onboardingService.getWindow()).toBe(mockBrowserWindowInstance);
    });
  });

  describe("escape key handling", () => {
    it("registers before-input-event handler for escape key", () => {
      onboardingService.show();

      expect(mockBrowserWindowInstance.webContents.on).toHaveBeenCalledWith(
        "before-input-event",
        expect.any(Function)
      );
    });

    it("closes window when escape key is pressed", () => {
      onboardingService.show();

      // Find the before-input-event handler
      const beforeInputHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "before-input-event"
      )?.[1] as ((_event: unknown, input: { key: string; type: string }) => void) | undefined;

      // Simulate escape key press
      beforeInputHandler?.({}, { key: "Escape", type: "keyDown" });

      expect(mockBrowserWindowInstance.close).toHaveBeenCalled();
    });

    it("does not close window for other keys", () => {
      onboardingService.show();

      // Find the before-input-event handler
      const beforeInputHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "before-input-event"
      )?.[1] as ((_event: unknown, input: { key: string; type: string }) => void) | undefined;

      // Simulate other key press
      beforeInputHandler?.({}, { key: "Enter", type: "keyDown" });

      expect(mockBrowserWindowInstance.close).not.toHaveBeenCalled();
    });

    it("does not close window for escape keyUp event", () => {
      onboardingService.show();

      // Find the before-input-event handler
      const beforeInputHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "before-input-event"
      )?.[1] as ((_event: unknown, input: { key: string; type: string }) => void) | undefined;

      // Simulate escape key release (not keyDown)
      beforeInputHandler?.({}, { key: "Escape", type: "keyUp" });

      expect(mockBrowserWindowInstance.close).not.toHaveBeenCalled();
    });
  });

  describe("window closed event", () => {
    it("clears window reference when closed", () => {
      onboardingService.show();
      expect(onboardingService.getWindow()).toBe(mockBrowserWindowInstance);

      // Find the closed handler
      const closedHandler = mockBrowserWindowInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === "closed"
      )?.[1] as (() => void) | undefined;

      // Simulate window closed
      closedHandler?.();

      expect(onboardingService.getWindow()).toBeNull();
    });
  });

  describe("app cleanup", () => {
    it("registers will-quit handler on construction", () => {
      expect(mockApp.on).toHaveBeenCalledWith("will-quit", expect.any(Function));
    });
  });
});
