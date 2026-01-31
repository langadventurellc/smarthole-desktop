/**
 * Unit tests for preload.ts electronAPI.
 *
 * These tests mock the Electron ipcRenderer to verify:
 * - Correct IPC channels are used
 * - Payload structures match expected types
 * - Convenience methods call base methods correctly
 * - Event subscription/unsubscription works
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { IPC_CHANNELS } from "../types";

// Use vi.hoisted to define mock functions that can be used in vi.mock
// This is necessary because vi.mock is hoisted to the top of the file
const { mockSend, mockInvoke, mockOn, mockRemoveListener, mockExposeInMainWorld } = vi.hoisted(
  () => ({
    mockSend: vi.fn(),
    mockInvoke: vi.fn(),
    mockOn: vi.fn(),
    mockRemoveListener: vi.fn(),
    mockExposeInMainWorld: vi.fn(),
  })
);

// Mock Electron's ipcRenderer and contextBridge before importing preload
vi.mock("electron", () => ({
  ipcRenderer: {
    send: mockSend,
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
}));

// Import the module after mocking - this triggers the contextBridge.exposeInMainWorld call
import "./preload";
import type { ElectronAPI } from "./preload";
import type { AppConfig, NotifyShowPayload } from "../types";

// Get the electronAPI that was passed to exposeInMainWorld during module initialization
// This must be called before any tests clear the mocks
const capturedElectronAPI = ((): ElectronAPI => {
  if (mockExposeInMainWorld.mock.calls.length === 0) {
    throw new Error("exposeInMainWorld was not called during module initialization");
  }
  return mockExposeInMainWorld.mock.calls[0][1] as ElectronAPI;
})();

describe("preload electronAPI", () => {
  const electronAPI = capturedElectronAPI;

  beforeEach(() => {
    // Clear mock call history but keep the captured API reference
    mockSend.mockClear();
    mockInvoke.mockClear();
    mockOn.mockClear();
    mockRemoveListener.mockClear();
  });

  describe("contextBridge setup", () => {
    it("should expose electronAPI to main world", () => {
      // Check the initial call that happened during module load
      expect(mockExposeInMainWorld).toHaveBeenCalledWith("electronAPI", expect.any(Object));
    });

    it("should expose all expected methods", () => {
      expect(electronAPI).toHaveProperty("log");
      expect(electronAPI).toHaveProperty("logError");
      expect(electronAPI).toHaveProperty("logWarn");
      expect(electronAPI).toHaveProperty("logInfo");
      expect(electronAPI).toHaveProperty("logDebug");
      expect(electronAPI).toHaveProperty("logTrace");
      expect(electronAPI).toHaveProperty("notify");
      expect(electronAPI).toHaveProperty("notifyInfo");
      expect(electronAPI).toHaveProperty("notifyWarning");
      expect(electronAPI).toHaveProperty("notifyError");
      expect(electronAPI).toHaveProperty("notifySuccess");
      expect(electronAPI).toHaveProperty("getConfig");
      expect(electronAPI).toHaveProperty("setConfig");
      expect(electronAPI).toHaveProperty("onConfigChanged");
      expect(electronAPI).toHaveProperty("getVersion");
      expect(electronAPI).toHaveProperty("quit");
    });

    it("should expose methods as functions", () => {
      expect(typeof electronAPI.log).toBe("function");
      expect(typeof electronAPI.logError).toBe("function");
      expect(typeof electronAPI.notify).toBe("function");
      expect(typeof electronAPI.getConfig).toBe("function");
      expect(typeof electronAPI.setConfig).toBe("function");
      expect(typeof electronAPI.onConfigChanged).toBe("function");
      expect(typeof electronAPI.getVersion).toBe("function");
      expect(typeof electronAPI.quit).toBe("function");
    });
  });

  describe("log method", () => {
    it("should send log message to correct channel", () => {
      electronAPI.log("info", "Test message");

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "info",
          message: "Test message",
        })
      );
    });

    it("should include timestamp in payload", () => {
      const beforeTime = new Date().toISOString();
      electronAPI.log("debug", "Timestamp test");
      const afterTime = new Date().toISOString();

      const payload = mockSend.mock.calls[0][1];
      expect(payload.timestamp).toBeDefined();
      expect(typeof payload.timestamp).toBe("string");
      // Verify timestamp is between before and after
      expect(payload.timestamp >= beforeTime).toBe(true);
      expect(payload.timestamp <= afterTime).toBe(true);
    });

    it("should include context when provided", () => {
      const context = { userId: 123, action: "test" };
      electronAPI.log("warn", "Context test", context);

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "warn",
          message: "Context test",
          context,
        })
      );
    });

    it("should work with all log levels", () => {
      const levels = ["error", "warn", "info", "debug", "trace"] as const;

      for (const level of levels) {
        mockSend.mockClear();
        electronAPI.log(level, `${level} message`);

        expect(mockSend).toHaveBeenCalledWith(
          IPC_CHANNELS.LOG_MESSAGE,
          expect.objectContaining({ level })
        );
      }
    });
  });

  describe("log convenience methods", () => {
    it("logError should call log with error level", () => {
      electronAPI.logError("Error message", { error: "details" });

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "error",
          message: "Error message",
          context: { error: "details" },
        })
      );
    });

    it("logWarn should call log with warn level", () => {
      electronAPI.logWarn("Warning message");

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "warn",
          message: "Warning message",
        })
      );
    });

    it("logInfo should call log with info level", () => {
      electronAPI.logInfo("Info message");

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "info",
          message: "Info message",
        })
      );
    });

    it("logDebug should call log with debug level", () => {
      electronAPI.logDebug("Debug message");

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "debug",
          message: "Debug message",
        })
      );
    });

    it("logTrace should call log with trace level", () => {
      electronAPI.logTrace("Trace message");

      expect(mockSend).toHaveBeenCalledWith(
        IPC_CHANNELS.LOG_MESSAGE,
        expect.objectContaining({
          level: "trace",
          message: "Trace message",
        })
      );
    });
  });

  describe("notify method", () => {
    it("should send notification to correct channel", () => {
      const options: NotifyShowPayload = {
        title: "Test",
        body: "Test body",
        type: "info",
        priority: "medium",
      };

      electronAPI.notify(options);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.NOTIFY_SHOW, options);
    });

    it("should pass through all notification options", () => {
      const options: NotifyShowPayload = {
        title: "Full Test",
        body: "Test body with all options",
        type: "warning",
        priority: "high",
        actions: [{ label: "OK", actionId: "ok" }],
        timeout: 5000,
      };

      electronAPI.notify(options);

      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.NOTIFY_SHOW, options);
    });
  });

  describe("notify convenience methods", () => {
    it("notifyInfo should call notify with info type", () => {
      electronAPI.notifyInfo("Title", "Body");

      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.NOTIFY_SHOW, {
        title: "Title",
        body: "Body",
        type: "info",
        priority: "medium",
      });
    });

    it("notifyWarning should call notify with warning type", () => {
      electronAPI.notifyWarning("Warning Title", "Warning Body");

      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.NOTIFY_SHOW, {
        title: "Warning Title",
        body: "Warning Body",
        type: "warning",
        priority: "medium",
      });
    });

    it("notifyError should call notify with error type and high priority", () => {
      electronAPI.notifyError("Error Title", "Error Body");

      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.NOTIFY_SHOW, {
        title: "Error Title",
        body: "Error Body",
        type: "error",
        priority: "high",
      });
    });

    it("notifySuccess should call notify with success type", () => {
      electronAPI.notifySuccess("Success Title", "Success Body");

      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.NOTIFY_SHOW, {
        title: "Success Title",
        body: "Success Body",
        type: "success",
        priority: "medium",
      });
    });
  });

  describe("getConfig method", () => {
    it("should invoke config:get channel", async () => {
      const mockConfig = { logLevel: "info" };
      mockInvoke.mockResolvedValueOnce({ config: mockConfig });

      const result = await electronAPI.getConfig();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_GET);
      expect(result).toEqual({ config: mockConfig });
    });
  });

  describe("setConfig method", () => {
    it("should invoke config:set channel with updates", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const updates = { logLevel: "debug" as const };

      await electronAPI.setConfig(updates);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_SET, { updates });
    });

    it("should handle nested config updates", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const updates = { stt: { backend: "local" as const } };

      await electronAPI.setConfig(updates);

      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_SET, { updates });
    });
  });

  describe("onConfigChanged method", () => {
    it("should register listener on config:changed channel", () => {
      const callback = vi.fn();

      electronAPI.onConfigChanged(callback);

      expect(mockOn).toHaveBeenCalledTimes(1);
      expect(mockOn).toHaveBeenCalledWith(IPC_CHANNELS.CONFIG_CHANGED, expect.any(Function));
    });

    it("should return unsubscribe function", () => {
      const callback = vi.fn();

      const unsubscribe = electronAPI.onConfigChanged(callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should call callback when config changes", () => {
      const callback = vi.fn();
      electronAPI.onConfigChanged(callback);

      // Get the registered handler
      const handler = mockOn.mock.calls[0][1] as (
        event: Electron.IpcRendererEvent,
        payload: { config: AppConfig; changedKeys: string[] }
      ) => void;

      // Simulate config change event
      const mockEvent = {} as Electron.IpcRendererEvent;
      const mockConfig = { logLevel: "debug" } as AppConfig;
      const changedKeys = ["logLevel"];
      handler(mockEvent, { config: mockConfig, changedKeys });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(mockConfig, changedKeys);
    });

    it("should remove listener when unsubscribe is called", () => {
      const callback = vi.fn();

      const unsubscribe = electronAPI.onConfigChanged(callback);

      // Get the handler that was registered
      const registeredHandler = mockOn.mock.calls[0][1];

      // Unsubscribe
      unsubscribe();

      expect(mockRemoveListener).toHaveBeenCalledTimes(1);
      expect(mockRemoveListener).toHaveBeenCalledWith(
        IPC_CHANNELS.CONFIG_CHANGED,
        registeredHandler
      );
    });

    it("should support multiple subscriptions", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsub1 = electronAPI.onConfigChanged(callback1);
      const unsub2 = electronAPI.onConfigChanged(callback2);

      expect(mockOn).toHaveBeenCalledTimes(2);

      // Each unsubscribe should only remove its own listener
      unsub1();
      expect(mockRemoveListener).toHaveBeenCalledTimes(1);

      unsub2();
      expect(mockRemoveListener).toHaveBeenCalledTimes(2);
    });
  });

  describe("getVersion method", () => {
    it("should invoke app:version channel", async () => {
      const mockVersion = {
        version: "1.0.0",
        electronVersion: "25.0.0",
        nodeVersion: "18.0.0",
      };
      mockInvoke.mockResolvedValueOnce(mockVersion);

      const result = await electronAPI.getVersion();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_VERSION);
      expect(result).toEqual(mockVersion);
    });
  });

  describe("quit method", () => {
    it("should send quit message to correct channel", () => {
      electronAPI.quit();

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.APP_QUIT);
    });
  });
});

describe("ElectronAPI type", () => {
  it("should be exported and usable as a type", () => {
    // Type-level test - this compiles if ElectronAPI is properly exported
    const api: ElectronAPI = capturedElectronAPI;
    expect(api).toBeDefined();
  });
});
