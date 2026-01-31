/**
 * Tests for the config IPC handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createConfigGetHandler,
  createConfigSetHandler,
  broadcastConfigChange,
} from "./config-handler";
import type { ConfigManagerService } from "../services/config-manager";
import type { Logger } from "../services/logger";
import { DEFAULT_CONFIG } from "../types";

// Mock BrowserWindow for broadcast tests
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

import { BrowserWindow } from "electron";

// Mock ConfigManagerService
function createMockConfigManager(
  overrides: Partial<ConfigManagerService> = {}
): ConfigManagerService {
  return {
    getConfig: vi.fn().mockReturnValue(DEFAULT_CONFIG),
    setConfig: vi.fn().mockReturnValue([]),
    on: vi.fn(),
    off: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

// Mock Logger
function createMockLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
    level: "info",
    silent: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger;
}

describe("createConfigGetHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return current config from manager", () => {
    const mockConfig = { ...DEFAULT_CONFIG, logLevel: "debug" as const };
    const configManager = createMockConfigManager({
      getConfig: vi.fn().mockReturnValue(mockConfig),
    });

    const handler = createConfigGetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toEqual({ config: mockConfig });
    expect(configManager.getConfig).toHaveBeenCalled();
  });

  it("should log debug message when config requested", () => {
    const configManager = createMockConfigManager();

    const handler = createConfigGetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    handler(mockEvent);

    expect(mockLogger.debug).toHaveBeenCalledWith("Config requested");
  });

  it("should throw and log error when manager throws", () => {
    const configManager = createMockConfigManager({
      getConfig: vi.fn().mockImplementation(() => {
        throw new Error("Config unavailable");
      }),
    });

    const handler = createConfigGetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    expect(() => handler(mockEvent)).toThrow("Config unavailable");
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("createConfigSetHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should call setConfig with updates", () => {
    const configManager = createMockConfigManager({
      setConfig: vi.fn().mockReturnValue(["logLevel"]),
    });

    const handler = createConfigSetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    handler(mockEvent, { updates: { logLevel: "debug" } });

    expect(configManager.setConfig).toHaveBeenCalledWith({ logLevel: "debug" });
  });

  it("should log debug message with changed keys", () => {
    const configManager = createMockConfigManager({
      setConfig: vi.fn().mockReturnValue(["logLevel", "stt.backend"]),
    });

    const handler = createConfigSetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    handler(mockEvent, { updates: { logLevel: "debug" } });

    expect(mockLogger.debug).toHaveBeenCalledWith("Config updated", {
      changedKeys: ["logLevel", "stt.backend"],
    });
  });

  it("should throw and log error when manager throws", () => {
    const configManager = createMockConfigManager({
      setConfig: vi.fn().mockImplementation(() => {
        throw new Error("Invalid config value");
      }),
    });

    const handler = createConfigSetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    expect(() => handler(mockEvent, { updates: { logLevel: "invalid" as any } })).toThrow(
      "Invalid config value"
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should handle empty updates gracefully", () => {
    const configManager = createMockConfigManager({
      setConfig: vi.fn().mockReturnValue([]),
    });

    const handler = createConfigSetHandler(() => configManager, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    expect(() => handler(mockEvent, { updates: {} })).not.toThrow();
    expect(configManager.setConfig).toHaveBeenCalledWith({});
  });
});

describe("broadcastConfigChange", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
  });

  it("should send to all windows", () => {
    const mockSend = vi.fn();
    const mockWindows = [
      { isDestroyed: () => false, webContents: { send: mockSend } },
      { isDestroyed: () => false, webContents: { send: mockSend } },
    ];
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(
      mockWindows as unknown as Electron.BrowserWindow[]
    );

    const payload = {
      config: DEFAULT_CONFIG,
      changedKeys: ["logLevel"],
    };

    broadcastConfigChange(payload, mockLogger);

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith("config:changed", payload);
  });

  it("should skip destroyed windows", () => {
    const mockSend = vi.fn();
    const mockWindows = [
      { isDestroyed: () => true, webContents: { send: mockSend } },
      { isDestroyed: () => false, webContents: { send: mockSend } },
    ];
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(
      mockWindows as unknown as Electron.BrowserWindow[]
    );

    const payload = {
      config: DEFAULT_CONFIG,
      changedKeys: ["stt.backend"],
    };

    broadcastConfigChange(payload, mockLogger);

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should handle empty window list", () => {
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const payload = {
      config: DEFAULT_CONFIG,
      changedKeys: [],
    };

    // Should not throw
    expect(() => broadcastConfigChange(payload, mockLogger)).not.toThrow();
  });

  it("should broadcast with correct channel name", () => {
    const mockSend = vi.fn();
    const mockWindows = [{ isDestroyed: () => false, webContents: { send: mockSend } }];
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(
      mockWindows as unknown as Electron.BrowserWindow[]
    );

    const payload = {
      config: { ...DEFAULT_CONFIG, logLevel: "debug" as const },
      changedKeys: ["logLevel"],
    };

    broadcastConfigChange(payload, mockLogger);

    expect(mockSend).toHaveBeenCalledWith("config:changed", payload);
  });
});
