/**
 * Tests for the permission IPC handlers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Logger } from "../services/logger";

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

// Store the original platform
const originalPlatform = process.platform;

// Helper to mock platform
function mockPlatform(platform: string): void {
  Object.defineProperty(process, "platform", {
    value: platform,
    writable: true,
  });
}

// Restore platform after tests
afterEach(() => {
  Object.defineProperty(process, "platform", {
    value: originalPlatform,
    writable: true,
  });
});

// Mock Electron modules
const mockGetMediaAccessStatus = vi.fn();
const mockAskForMediaAccess = vi.fn();
const mockIsTrustedAccessibilityClient = vi.fn();
const mockOpenExternal = vi.fn();

vi.mock("electron", () => ({
  systemPreferences: {
    getMediaAccessStatus: (...args: unknown[]) => mockGetMediaAccessStatus(...args),
    askForMediaAccess: (...args: unknown[]) => mockAskForMediaAccess(...args),
    isTrustedAccessibilityClient: (...args: unknown[]) => mockIsTrustedAccessibilityClient(...args),
  },
  shell: {
    openExternal: (...args: unknown[]) => mockOpenExternal(...args),
  },
}));

// Import handlers after mocking
import {
  createMicrophoneCheckHandler,
  createMicrophoneRequestHandler,
  createAccessibilityCheckHandler,
  createAccessibilitySettingsHandler,
} from "./permission-handler";

describe("createMicrophoneCheckHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should return microphone status on macOS", async () => {
    mockPlatform("darwin");
    mockGetMediaAccessStatus.mockReturnValue("granted");

    const handler = createMicrophoneCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ status: "granted" });
    expect(mockGetMediaAccessStatus).toHaveBeenCalledWith("microphone");
    expect(mockLogger.debug).toHaveBeenCalledWith("Microphone permission checked", {
      status: "granted",
      platform: "darwin",
    });
  });

  it("should handle all macOS permission statuses", async () => {
    mockPlatform("darwin");
    const handler = createMicrophoneCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const statuses = ["not-determined", "granted", "denied", "restricted"] as const;

    for (const status of statuses) {
      mockGetMediaAccessStatus.mockReturnValue(status);
      const result = await handler(mockEvent);
      expect(result).toEqual({ status });
    }
  });

  it("should return granted on Windows", async () => {
    mockPlatform("win32");

    const handler = createMicrophoneCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ status: "granted" });
    expect(mockGetMediaAccessStatus).not.toHaveBeenCalled();
  });

  it("should return granted on Linux", async () => {
    mockPlatform("linux");

    const handler = createMicrophoneCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ status: "granted" });
    expect(mockGetMediaAccessStatus).not.toHaveBeenCalled();
  });

  it("should return unknown on error", async () => {
    mockPlatform("darwin");
    mockGetMediaAccessStatus.mockImplementation(() => {
      throw new Error("System error");
    });

    const handler = createMicrophoneCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ status: "unknown" });
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("should return unknown for unrecognized status values", async () => {
    mockPlatform("darwin");
    // Simulate a hypothetical future Electron API returning a new status value
    mockGetMediaAccessStatus.mockReturnValue("some-new-future-status");

    const handler = createMicrophoneCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ status: "unknown" });
  });
});

describe("createMicrophoneRequestHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should request microphone access on macOS and return granted", async () => {
    mockPlatform("darwin");
    mockAskForMediaAccess.mockResolvedValue(true);

    const handler = createMicrophoneRequestHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ granted: true });
    expect(mockAskForMediaAccess).toHaveBeenCalledWith("microphone");
    expect(mockLogger.info).toHaveBeenCalledWith("Microphone permission requested", {
      granted: true,
      platform: "darwin",
    });
  });

  it("should return denied when user denies on macOS", async () => {
    mockPlatform("darwin");
    mockAskForMediaAccess.mockResolvedValue(false);

    const handler = createMicrophoneRequestHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ granted: false });
  });

  it("should return granted on Windows without calling system API", async () => {
    mockPlatform("win32");

    const handler = createMicrophoneRequestHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ granted: true });
    expect(mockAskForMediaAccess).not.toHaveBeenCalled();
  });

  it("should return false on error", async () => {
    mockPlatform("darwin");
    mockAskForMediaAccess.mockRejectedValue(new Error("System error"));

    const handler = createMicrophoneRequestHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ granted: false });
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("createAccessibilityCheckHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should check accessibility on macOS and return trusted", async () => {
    mockPlatform("darwin");
    mockIsTrustedAccessibilityClient.mockReturnValue(true);

    const handler = createAccessibilityCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ trusted: true });
    expect(mockIsTrustedAccessibilityClient).toHaveBeenCalledWith(false);
  });

  it("should return not trusted when not authorized on macOS", async () => {
    mockPlatform("darwin");
    mockIsTrustedAccessibilityClient.mockReturnValue(false);

    const handler = createAccessibilityCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ trusted: false });
  });

  it("should return trusted on Windows", async () => {
    mockPlatform("win32");

    const handler = createAccessibilityCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ trusted: true });
    expect(mockIsTrustedAccessibilityClient).not.toHaveBeenCalled();
  });

  it("should return false on error", async () => {
    mockPlatform("darwin");
    mockIsTrustedAccessibilityClient.mockImplementation(() => {
      throw new Error("System error");
    });

    const handler = createAccessibilityCheckHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ trusted: false });
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("createAccessibilitySettingsHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    vi.clearAllMocks();
  });

  it("should open accessibility settings on macOS and return success", async () => {
    mockPlatform("darwin");
    mockOpenExternal.mockResolvedValue(undefined);

    const handler = createAccessibilitySettingsHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ success: true });
    expect(mockOpenExternal).toHaveBeenCalledWith(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    );
    expect(mockLogger.info).toHaveBeenCalledWith("Opened accessibility settings");
  });

  it("should return success on Windows without opening anything", async () => {
    mockPlatform("win32");

    const handler = createAccessibilitySettingsHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ success: true });
    expect(mockOpenExternal).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Accessibility settings not applicable on this platform",
      { platform: "win32" }
    );
  });

  it("should return failure on error instead of throwing", async () => {
    mockPlatform("darwin");
    mockOpenExternal.mockRejectedValue(new Error("Failed to open"));

    const handler = createAccessibilitySettingsHandler(mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;

    const result = await handler(mockEvent);

    expect(result).toEqual({ success: false });
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
