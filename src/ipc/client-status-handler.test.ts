/**
 * Tests for the client status IPC handler.
 *
 * @see F-connection-health-ui feature specification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createClientCountHandler,
  createClientListHandler,
  createClientDetailsHandler,
  createRegisteredEventHandler,
  createUnregisteredEventHandler,
  broadcastClientStatusChange,
} from "./client-status-handler";
import type { ClientRegistryService } from "../services/client-registry";
import type { Logger } from "../services/logger";
import type { RegistryClientInfo } from "../types";
import { createClientId, createTimestamp } from "../types";

// Mock BrowserWindow for broadcast tests
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

import { BrowserWindow } from "electron";

// Mock client for testing
function createMockClient(overrides: Partial<RegistryClientInfo> = {}): RegistryClientInfo {
  return {
    id: createClientId("conn-123"),
    name: "test-client",
    description: "A test client for testing",
    version: "1.0.0",
    capabilities: ["voice", "text"],
    registeredAt: createTimestamp(new Date("2024-01-15T10:00:00.000Z")),
    ...overrides,
  };
}

// Mock ClientRegistryService
function createMockRegistry(overrides: Partial<ClientRegistryService> = {}): ClientRegistryService {
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    unregisterById: vi.fn(),
    getClient: vi.fn(),
    getClientById: vi.fn(),
    getAllClients: vi.fn().mockReturnValue([]),
    hasClient: vi.fn(),
    getClientCount: vi.fn().mockReturnValue(0),
    on: vi.fn(),
    off: vi.fn(),
    clear: vi.fn(),
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

describe("createClientCountHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return client count from registry", () => {
    const registry = createMockRegistry({
      getClientCount: vi.fn().mockReturnValue(5),
    });

    const handler = createClientCountHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toBe(5);
    expect(registry.getClientCount).toHaveBeenCalled();
  });

  it("should return 0 when registry is empty", () => {
    const registry = createMockRegistry({
      getClientCount: vi.fn().mockReturnValue(0),
    });

    const handler = createClientCountHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toBe(0);
  });

  it("should return 0 and log error when registry throws", () => {
    const registry = createMockRegistry({
      getClientCount: vi.fn().mockImplementation(() => {
        throw new Error("Registry unavailable");
      }),
    });

    const handler = createClientCountHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toBe(0);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("createClientListHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return list of client summaries", () => {
    const clients = [
      createMockClient({ name: "client-1", description: "First client" }),
      createMockClient({ name: "client-2", description: "Second client" }),
    ];
    const registry = createMockRegistry({
      getAllClients: vi.fn().mockReturnValue(clients),
    });

    const handler = createClientListHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toEqual([
      { name: "client-1", description: "First client" },
      { name: "client-2", description: "Second client" },
    ]);
  });

  it("should return empty array when no clients", () => {
    const registry = createMockRegistry({
      getAllClients: vi.fn().mockReturnValue([]),
    });

    const handler = createClientListHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toEqual([]);
  });

  it("should return empty array and log error when registry throws", () => {
    const registry = createMockRegistry({
      getAllClients: vi.fn().mockImplementation(() => {
        throw new Error("Registry unavailable");
      }),
    });

    const handler = createClientListHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("createClientDetailsHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return client details for existing client", () => {
    const client = createMockClient({
      id: createClientId("conn-456"),
      name: "my-client",
      description: "My test client",
      version: "2.0.0",
      capabilities: ["audio"],
      registeredAt: createTimestamp(new Date("2024-01-20T12:00:00.000Z")),
    });
    const registry = createMockRegistry({
      getClient: vi.fn().mockReturnValue(client),
    });

    const handler = createClientDetailsHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent, "my-client");

    expect(result).toEqual({
      id: "conn-456",
      name: "my-client",
      description: "My test client",
      version: "2.0.0",
      capabilities: ["audio"],
      registeredAt: "2024-01-20T12:00:00.000Z",
    });
    expect(registry.getClient).toHaveBeenCalledWith("my-client");
  });

  it("should return null for non-existent client", () => {
    const registry = createMockRegistry({
      getClient: vi.fn().mockReturnValue(undefined),
    });

    const handler = createClientDetailsHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent, "unknown-client");

    expect(result).toBeNull();
    expect(registry.getClient).toHaveBeenCalledWith("unknown-client");
  });

  it("should return null and log error when registry throws", () => {
    const registry = createMockRegistry({
      getClient: vi.fn().mockImplementation(() => {
        throw new Error("Registry unavailable");
      }),
    });

    const handler = createClientDetailsHandler(() => registry, mockLogger);
    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent, "test-client");

    expect(result).toBeNull();
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe("broadcastClientStatusChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      event: "registered" as const,
      client: { name: "new-client", description: "A new client" },
      count: 3,
    };

    broadcastClientStatusChange(payload);

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith("clients:statusChanged", payload);
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
      event: "unregistered" as const,
      client: { name: "old-client", description: "An old client" },
      count: 1,
    };

    broadcastClientStatusChange(payload);

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should handle empty window list", () => {
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

    const payload = {
      event: "registered" as const,
      client: { name: "client", description: "A client" },
      count: 1,
    };

    // Should not throw
    expect(() => broadcastClientStatusChange(payload)).not.toThrow();
  });
});

describe("createRegisteredEventHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should broadcast registered event with current count", () => {
    const mockSend = vi.fn();
    const mockWindows = [{ isDestroyed: () => false, webContents: { send: mockSend } }];
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(
      mockWindows as unknown as Electron.BrowserWindow[]
    );

    const registry = createMockRegistry({
      getClientCount: vi.fn().mockReturnValue(2),
    });

    const handler = createRegisteredEventHandler(() => registry);
    handler({
      client: { name: "new-client", description: "Newly registered" },
    });

    expect(mockSend).toHaveBeenCalledWith("clients:statusChanged", {
      event: "registered",
      client: { name: "new-client", description: "Newly registered" },
      count: 2,
    });
  });
});

describe("createUnregisteredEventHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should broadcast unregistered event with current count", () => {
    const mockSend = vi.fn();
    const mockWindows = [{ isDestroyed: () => false, webContents: { send: mockSend } }];
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(
      mockWindows as unknown as Electron.BrowserWindow[]
    );

    const registry = createMockRegistry({
      getClientCount: vi.fn().mockReturnValue(0),
    });

    const handler = createUnregisteredEventHandler(() => registry);
    handler({
      client: { name: "old-client", description: "Just left" },
    });

    expect(mockSend).toHaveBeenCalledWith("clients:statusChanged", {
      event: "unregistered",
      client: { name: "old-client", description: "Just left" },
      count: 0,
    });
  });
});
