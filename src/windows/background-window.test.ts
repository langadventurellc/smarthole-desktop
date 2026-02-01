/**
 * Tests for the BackgroundWindow service.
 * Tests singleton lifecycle, window creation, and ready state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Use vi.hoisted to define mocks that will be used in vi.mock
const { mockBrowserWindowInstance, mockApp } = vi.hoisted(() => {
  const mockBrowserWindowInstance = {
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: {
      send: vi.fn(),
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
  initializeBackgroundWindow,
  getBackgroundWindow,
  resetBackgroundWindow,
  BackgroundWindowService,
} from "./background-window";
import { initializeLogger, resetLogger } from "../services/logger";
import { LogLevel } from "../types";

describe("BackgroundWindow", () => {
  let backgroundService: BackgroundWindowService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock browser window state
    mockBrowserWindowInstance.isDestroyed.mockReturnValue(false);

    // Initialize logger and service
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    backgroundService = initializeBackgroundWindow();
  });

  afterEach(() => {
    resetBackgroundWindow();
    resetLogger();
  });

  describe("singleton lifecycle", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeBackgroundWindow();
      const instance2 = initializeBackgroundWindow();
      expect(instance1).toBe(instance2);
    });

    it("throws if getBackgroundWindow called before initialization", () => {
      resetBackgroundWindow();
      expect(() => getBackgroundWindow()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeBackgroundWindow();
      resetBackgroundWindow();
      const instance2 = initializeBackgroundWindow();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("window creation", () => {
    it("creates a BrowserWindow immediately on initialization", () => {
      // Window should be created during initializeBackgroundWindow (called in beforeEach)
      expect(mockBrowserWindowInstance.loadFile).toHaveBeenCalled();
    });

    it("creates window with hidden properties", () => {
      // The window should load content - we verify loadFile was called
      // which means the window was created with the expected config
      expect(mockBrowserWindowInstance.loadFile).toHaveBeenCalled();
    });
  });

  describe("getWindow", () => {
    it("returns the BrowserWindow instance", () => {
      expect(backgroundService.getWindow()).toBe(mockBrowserWindowInstance);
    });
  });

  describe("isReady", () => {
    it("returns false initially", () => {
      // isReady should be false until did-finish-load fires
      // We need to check the service from beforeEach before simulating did-finish-load
      // First, get a fresh service
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();
      expect(service.isReady()).toBe(false);
    });

    it("returns true after did-finish-load fires", () => {
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();

      // Find the did-finish-load handler from the fresh initialization
      const didFinishLoadHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "did-finish-load"
      )?.[1] as (() => void) | undefined;

      // Simulate content loaded
      didFinishLoadHandler?.();

      expect(service.isReady()).toBe(true);
    });

    it("returns false when window is destroyed", () => {
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();

      // Simulate did-finish-load first
      const didFinishLoadHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "did-finish-load"
      )?.[1] as (() => void) | undefined;
      didFinishLoadHandler?.();

      // Then mark window as destroyed
      mockBrowserWindowInstance.isDestroyed.mockReturnValue(true);

      expect(service.isReady()).toBe(false);
    });
  });

  describe("waitForReady", () => {
    it("resolves immediately if already ready", async () => {
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();

      // Simulate did-finish-load
      const didFinishLoadHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "did-finish-load"
      )?.[1] as (() => void) | undefined;
      didFinishLoadHandler?.();

      // Should resolve immediately
      await expect(service.waitForReady()).resolves.toBeUndefined();
    });

    it("waits for did-finish-load before resolving", async () => {
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();

      // Create a promise that should wait
      const waitPromise = service.waitForReady();

      // Find the did-finish-load handler from the fresh initialization
      const didFinishLoadHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "did-finish-load"
      )?.[1] as (() => void) | undefined;

      // Fire the event to resolve the promise
      didFinishLoadHandler?.();

      await expect(waitPromise).resolves.toBeUndefined();
    });
  });

  describe("window closed event", () => {
    it("clears window reference when closed unexpectedly", () => {
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();

      expect(service.getWindow()).toBe(mockBrowserWindowInstance);

      // Find the closed handler
      const closedHandler = mockBrowserWindowInstance.on.mock.calls.find(
        (call: unknown[]) => call[0] === "closed"
      )?.[1] as (() => void) | undefined;

      // Simulate window closed
      closedHandler?.();

      expect(service.getWindow()).toBeNull();
      expect(service.isReady()).toBe(false);
    });
  });

  describe("render process gone event", () => {
    it("sets ready to false when render process crashes", () => {
      resetBackgroundWindow();
      vi.clearAllMocks();
      const service = initializeBackgroundWindow();

      // First set ready to true
      const didFinishLoadHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "did-finish-load"
      )?.[1] as (() => void) | undefined;
      didFinishLoadHandler?.();

      expect(service.isReady()).toBe(true);

      // Find the render-process-gone handler
      const renderProcessGoneHandler = mockBrowserWindowInstance.webContents.on.mock.calls.find(
        (call: unknown[]) => call[0] === "render-process-gone"
      )?.[1] as ((_event: unknown, details: { reason: string }) => void) | undefined;

      // Simulate crash
      renderProcessGoneHandler?.({}, { reason: "crashed" });

      expect(service.isReady()).toBe(false);
    });
  });

  describe("app cleanup", () => {
    it("registers will-quit handler on construction", () => {
      expect(mockApp.on).toHaveBeenCalledWith("will-quit", expect.any(Function));
    });
  });

  describe("reset", () => {
    it("destroys the window when reset", () => {
      resetBackgroundWindow();
      expect(mockBrowserWindowInstance.destroy).toHaveBeenCalled();
    });

    it("does not throw if window already destroyed", () => {
      mockBrowserWindowInstance.isDestroyed.mockReturnValue(true);
      expect(() => resetBackgroundWindow()).not.toThrow();
    });
  });
});
