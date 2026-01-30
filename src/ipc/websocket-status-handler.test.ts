/**
 * Tests for the WebSocket status IPC handler.
 *
 * @see F-websocket-server-foundation feature specification
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildWebSocketStatus, createWebSocketStatusHandler } from "./websocket-status-handler";
import type { WebSocketServerService } from "../services/websocket-server";
import type { Logger } from "../services/logger";

// Mock WebSocketServerService
function createMockWebSocketServer(
  overrides: Partial<WebSocketServerService> = {}
): WebSocketServerService {
  return {
    isRunning: () => true,
    getState: () => "running",
    getPort: () => 9473,
    getConnectionCount: () => 0,
    getActiveConnections: () => [],
    getConnection: () => undefined,
    on: vi.fn(),
    off: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
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

describe("buildWebSocketStatus", () => {
  it("should return running status when server is running", () => {
    const server = createMockWebSocketServer({
      getState: () => "running",
      getPort: () => 9473,
      getConnectionCount: () => 5,
    });

    const status = buildWebSocketStatus(server, undefined, 9473);

    expect(status).toEqual({
      state: "running",
      port: 9473,
      activeConnections: 5,
      error: undefined,
    });
  });

  it("should return stopped status when server is stopped", () => {
    const server = createMockWebSocketServer({
      getState: () => "stopped",
      getPort: () => 9473,
      getConnectionCount: () => 0,
    });

    const status = buildWebSocketStatus(server, undefined, 9473);

    expect(status).toEqual({
      state: "stopped",
      port: 9473,
      activeConnections: 0,
      error: undefined,
    });
  });

  it("should return error status when there is an error", () => {
    const server = createMockWebSocketServer({
      getState: () => "running",
      getPort: () => 9473,
      getConnectionCount: () => 0,
    });

    const status = buildWebSocketStatus(server, "Port already in use", 9473);

    expect(status).toEqual({
      state: "error",
      port: 9473,
      activeConnections: 0,
      error: "Port already in use",
    });
  });

  it("should handle null server with no error", () => {
    const status = buildWebSocketStatus(null, undefined, 9473);

    expect(status).toEqual({
      state: "stopped",
      port: 9473,
      activeConnections: 0,
      error: undefined,
    });
  });

  it("should handle null server with error", () => {
    const status = buildWebSocketStatus(null, "Failed to start", 9473);

    expect(status).toEqual({
      state: "error",
      port: 9473,
      activeConnections: 0,
      error: "Failed to start",
    });
  });

  it("should map starting state to stopped", () => {
    const server = createMockWebSocketServer({
      getState: () => "starting",
    });

    const status = buildWebSocketStatus(server, undefined, 9473);
    expect(status.state).toBe("stopped");
  });

  it("should map stopping state to stopped", () => {
    const server = createMockWebSocketServer({
      getState: () => "stopping",
    });

    const status = buildWebSocketStatus(server, undefined, 9473);
    expect(status.state).toBe("stopped");
  });
});

describe("createWebSocketStatusHandler", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = createMockLogger();
  });

  it("should return current status from server", () => {
    const server = createMockWebSocketServer({
      getState: () => "running",
      getPort: () => 9999,
      getConnectionCount: () => 3,
    });

    const handler = createWebSocketStatusHandler(
      () => server,
      () => undefined,
      9473,
      mockLogger
    );

    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result).toEqual({
      state: "running",
      port: 9999,
      activeConnections: 3,
      error: undefined,
    });
  });

  it("should return error status when getWebSocketServer throws", () => {
    const handler = createWebSocketStatusHandler(
      () => {
        throw new Error("Server crashed");
      },
      () => undefined,
      9473,
      mockLogger
    );

    const mockEvent = {} as Electron.IpcMainInvokeEvent;
    const result = handler(mockEvent);

    expect(result.state).toBe("error");
    expect(result.error).toBe("Server crashed");
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
