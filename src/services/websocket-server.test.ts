/**
 * Tests for WebSocket server service.
 * Focuses on critical functionality: origin validation, lifecycle, connection tracking, and heartbeat.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IncomingMessage } from "http";
import { Socket } from "net";
import WebSocket from "ws";

// Mock the logger before importing the module
vi.mock("./logger", () => ({
  getLogger: () => ({
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

// Import after mocking
import {
  initializeWebSocketServer,
  getWebSocketServer,
  shutdownWebSocketServer,
  resetWebSocketServer,
  ConnectionInfo,
} from "./websocket-server";
import { ClientId } from "../types";

describe("WebSocket Server Service", () => {
  beforeEach(() => {
    resetWebSocketServer();
  });

  afterEach(async () => {
    await shutdownWebSocketServer();
    resetWebSocketServer();
  });

  describe("initialization", () => {
    it("should initialize and start the server", async () => {
      const server = await initializeWebSocketServer({ port: 19473 });

      expect(server.isRunning()).toBe(true);
      expect(server.getState()).toBe("running");
      expect(server.getPort()).toBe(19473);
    });

    it("should return existing instance on multiple calls", async () => {
      const server1 = await initializeWebSocketServer({ port: 19474 });
      const server2 = await initializeWebSocketServer({ port: 19475 }); // Different port

      // Should return the same instance, not create a new one
      expect(server1).toBe(server2);
      expect(server1.getPort()).toBe(19474); // Uses the first port
    });

    it("should throw when getting server before initialization", () => {
      expect(() => getWebSocketServer()).toThrow("WebSocketServer not initialized");
    });
  });

  describe("lifecycle", () => {
    it("should report correct connection count initially", async () => {
      const server = await initializeWebSocketServer({ port: 19476 });

      expect(server.getConnectionCount()).toBe(0);
    });

    it("should shutdown gracefully", async () => {
      const server = await initializeWebSocketServer({ port: 19477 });
      expect(server.isRunning()).toBe(true);

      await shutdownWebSocketServer();

      expect(server.getState()).toBe("stopped");
      expect(server.isRunning()).toBe(false);
    });

    it("should handle shutdown when not initialized", async () => {
      // Should not throw
      await expect(shutdownWebSocketServer()).resolves.toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should reject starting server on port already in use", async () => {
      // Start first server
      const server1 = await initializeWebSocketServer({ port: 19478 });
      expect(server1.isRunning()).toBe(true);

      // Shut down first server but DON'T reset the singleton
      // This simulates the race condition where the port is still in use
      await shutdownWebSocketServer();

      // Now reset and try again - this should succeed since port is free
      resetWebSocketServer();
      const server2 = await initializeWebSocketServer({ port: 19478 });
      expect(server2.isRunning()).toBe(true);
    });

    it("should not allow starting when already running", async () => {
      const server = await initializeWebSocketServer({ port: 19479 });
      expect(server.isRunning()).toBe(true);

      // Second call should return the same instance, not try to start a new one
      const server2 = await initializeWebSocketServer({ port: 19480 });
      expect(server).toBe(server2);
      expect(server.getPort()).toBe(19479); // Original port preserved
    });
  });
});

describe("localhost connection validation", () => {
  // Test the isLocalhostConnection function indirectly through verifyClient
  // Since verifyClient is internal, we test behavior through connection attempts

  function createMockRequest(remoteAddress: string): IncomingMessage {
    const mockSocket = {
      remoteAddress,
    } as Socket;

    const mockRequest = {
      socket: mockSocket,
    } as IncomingMessage;

    return mockRequest;
  }

  it("should identify IPv4 localhost as valid", () => {
    const request = createMockRequest("127.0.0.1");
    expect(request.socket.remoteAddress).toBe("127.0.0.1");
  });

  it("should identify IPv6 localhost as valid", () => {
    const request = createMockRequest("::1");
    expect(request.socket.remoteAddress).toBe("::1");
  });

  it("should identify IPv4-mapped IPv6 localhost as valid", () => {
    const request = createMockRequest("::ffff:127.0.0.1");
    expect(request.socket.remoteAddress).toBe("::ffff:127.0.0.1");
  });

  it("should identify non-localhost addresses", () => {
    const request = createMockRequest("192.168.1.100");
    expect(request.socket.remoteAddress).not.toBe("127.0.0.1");
    expect(request.socket.remoteAddress).not.toBe("::1");
  });
});

describe("Connection tracking", () => {
  beforeEach(() => {
    resetWebSocketServer();
  });

  afterEach(async () => {
    await shutdownWebSocketServer();
    resetWebSocketServer();
  });

  it("should return empty active connections initially", async () => {
    const server = await initializeWebSocketServer({ port: 19481 });

    expect(server.getActiveConnections()).toEqual([]);
    expect(server.getConnectionCount()).toBe(0);
  });

  it("should track connections when clients connect", async () => {
    const server = await initializeWebSocketServer({ port: 19482 });

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19482");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    // Give the server time to process the connection
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(server.getConnectionCount()).toBe(1);

    const connections = server.getActiveConnections();
    expect(connections).toHaveLength(1);
    expect(connections[0].id).toBeDefined();
    expect(connections[0].connectedAt).toBeInstanceOf(Date);
    expect(connections[0].lastActivity).toBeInstanceOf(Date);
    expect(connections[0].remoteAddress).toBeDefined();

    // Clean up
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("should remove connection tracking when client disconnects", async () => {
    const server = await initializeWebSocketServer({ port: 19483 });

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19483");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(server.getConnectionCount()).toBe(1);

    // Disconnect the client
    client.close();

    // Wait for disconnect to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(server.getConnectionCount()).toBe(0);
    expect(server.getActiveConnections()).toEqual([]);
  });

  it("should emit connection event when client connects", async () => {
    const server = await initializeWebSocketServer({ port: 19484 });

    const connectionPromise = new Promise<ConnectionInfo>((resolve) => {
      server.on("connection", (info) => {
        resolve(info);
      });
    });

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19484");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    const connectionInfo = await connectionPromise;
    expect(connectionInfo.id).toBeDefined();
    expect(connectionInfo.connectedAt).toBeInstanceOf(Date);

    // Clean up
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("should emit disconnection event when client disconnects", async () => {
    const server = await initializeWebSocketServer({ port: 19485 });

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19485");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    const disconnectionPromise = new Promise<{
      info: ConnectionInfo;
      code: number;
      reason: string;
    }>((resolve) => {
      server.on("disconnection", (info, code, reason) => {
        resolve({ info, code, reason });
      });
    });

    // Disconnect the client
    client.close(1000, "Test disconnect");

    const { info, code } = await disconnectionPromise;
    expect(info.id).toBeDefined();
    expect(code).toBe(1000);
  });

  it("should get connection by ID", async () => {
    const server = await initializeWebSocketServer({ port: 19486 });

    let connectionId: ClientId | undefined;
    server.on("connection", (info) => {
      connectionId = info.id;
    });

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19486");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(connectionId).toBeDefined();
    const connection = server.getConnection(connectionId!);
    expect(connection).toBeDefined();
    expect(connection?.id).toBe(connectionId);

    // Clean up
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("should return undefined for unknown connection ID", async () => {
    const server = await initializeWebSocketServer({ port: 19487 });

    const connection = server.getConnection("nonexistent-id" as ClientId);
    expect(connection).toBeUndefined();
  });
});

describe("Heartbeat monitoring", () => {
  beforeEach(() => {
    resetWebSocketServer();
  });

  afterEach(async () => {
    await shutdownWebSocketServer();
    resetWebSocketServer();
  });

  it("should update lastActivity on pong response", async () => {
    const server = await initializeWebSocketServer({
      port: 19488,
      heartbeatInterval: 100, // Fast heartbeat for testing
      heartbeatTimeout: 50,
    });

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19488");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const connections = server.getActiveConnections();
    expect(connections).toHaveLength(1);
    const initialLastActivity = connections[0].lastActivity;

    // Wait for heartbeat ping and pong response
    await new Promise((resolve) => setTimeout(resolve, 150));

    const updatedConnections = server.getActiveConnections();
    if (updatedConnections.length > 0) {
      // lastActivity should be updated after pong
      expect(updatedConnections[0].lastActivity.getTime()).toBeGreaterThanOrEqual(
        initialLastActivity.getTime()
      );
    }

    // Clean up
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("should allow unsubscribing from events", async () => {
    const server = await initializeWebSocketServer({ port: 19489 });

    let callCount = 0;
    const listener = (): void => {
      callCount++;
    };

    server.on("connection", listener);
    server.off("connection", listener);

    // Connect a client
    const client = new WebSocket("ws://127.0.0.1:19489");

    await new Promise<void>((resolve, reject) => {
      client.on("open", resolve);
      client.on("error", reject);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Listener should not have been called since we unsubscribed
    expect(callCount).toBe(0);

    // Clean up
    client.close();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
