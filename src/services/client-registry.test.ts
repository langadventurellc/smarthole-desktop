/**
 * Tests for the ClientRegistry service.
 * Focuses on meaningful behaviors: registration validation, duplicate handling,
 * lookup correctness, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import {
  initializeClientRegistry,
  getClientRegistry,
  resetClientRegistry,
  ClientRegistryService,
} from "./client-registry";
import { initializeLogger, resetLogger } from "./logger";
import { createClientId, ClientRegistration, LogLevel } from "../types";

// Mock WebSocket
function createMockWebSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    close: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as WebSocket;
}

// Test data
function createTestRegistration(overrides?: Partial<ClientRegistration>): ClientRegistration {
  return {
    name: "test-client",
    description: "A test client for unit tests",
    version: "1.0.0",
    capabilities: ["test"],
    ...overrides,
  };
}

describe("ClientRegistry", () => {
  let registry: ClientRegistryService;

  beforeEach(() => {
    // Initialize logger (required by registry)
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    registry = initializeClientRegistry();
  });

  afterEach(() => {
    resetClientRegistry();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeClientRegistry();
      const instance2 = initializeClientRegistry();
      expect(instance1).toBe(instance2);
    });

    it("throws if getClientRegistry called before initialization", () => {
      resetClientRegistry();
      expect(() => getClientRegistry()).toThrow(/not initialized/);
    });
  });

  describe("register", () => {
    it("successfully registers a new client", () => {
      const clientId = createClientId("client-1");
      const registration = createTestRegistration();
      const connection = createMockWebSocket();

      const result = registry.register(clientId, registration, connection);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.client.name).toBe("test-client");
        expect(result.client.id).toBe(clientId);
      }
      expect(registry.getClientCount()).toBe(1);
    });

    it("rejects duplicate client names", () => {
      const registration = createTestRegistration();
      registry.register(createClientId("client-1"), registration, createMockWebSocket());

      // Attempt to register with same name
      const result = registry.register(
        createClientId("client-2"),
        createTestRegistration(), // same name
        createMockWebSocket()
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already registered");
      }
      expect(registry.getClientCount()).toBe(1);
    });

    it("rejects if same connection ID tries to register again", () => {
      const clientId = createClientId("client-1");
      registry.register(clientId, createTestRegistration(), createMockWebSocket());

      // Attempt to register with same clientId but different name
      const result = registry.register(
        clientId,
        createTestRegistration({ name: "different-client" }),
        createMockWebSocket()
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("already registered");
      }
    });

    it("emits registered event on successful registration", () => {
      const handler = vi.fn();
      registry.on("registered", handler);

      const clientId = createClientId("client-1");
      registry.register(clientId, createTestRegistration(), createMockWebSocket());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          client: expect.objectContaining({
            name: "test-client",
            id: clientId,
          }),
        })
      );
    });
  });

  describe("unregister", () => {
    it("removes client by name and emits event", () => {
      const handler = vi.fn();
      registry.on("unregistered", handler);

      registry.register(
        createClientId("client-1"),
        createTestRegistration(),
        createMockWebSocket()
      );

      const result = registry.unregister("test-client", "disconnect");

      expect(result).toBe(true);
      expect(registry.hasClient("test-client")).toBe(false);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          client: expect.objectContaining({ name: "test-client" }),
          reason: "disconnect",
        })
      );
    });

    it("removes client by ID", () => {
      const clientId = createClientId("client-1");
      registry.register(clientId, createTestRegistration(), createMockWebSocket());

      const result = registry.unregisterById(clientId, "unregister");

      expect(result).toBe(true);
      expect(registry.getClientById(clientId)).toBeUndefined();
    });

    it("returns false when client not found", () => {
      expect(registry.unregister("nonexistent", "disconnect")).toBe(false);
      expect(registry.unregisterById(createClientId("nonexistent"), "disconnect")).toBe(false);
    });
  });

  describe("lookup operations", () => {
    beforeEach(() => {
      // Register multiple clients
      registry.register(
        createClientId("client-1"),
        createTestRegistration({ name: "alpha", description: "First client" }),
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-2"),
        createTestRegistration({ name: "beta", description: "Second client" }),
        createMockWebSocket()
      );
    });

    it("getClient returns correct client by name", () => {
      const client = registry.getClient("alpha");
      expect(client).toBeDefined();
      expect(client?.description).toBe("First client");
    });

    it("getClientById returns correct client by ID", () => {
      const client = registry.getClientById(createClientId("client-2"));
      expect(client).toBeDefined();
      expect(client?.name).toBe("beta");
    });

    it("getAllClients returns all registered clients without connections", () => {
      const clients = registry.getAllClients();
      expect(clients).toHaveLength(2);
      expect(clients.map((c) => c.name).sort()).toEqual(["alpha", "beta"]);
      // Verify no connection property exposed
      clients.forEach((c) => {
        expect(c).not.toHaveProperty("connection");
      });
    });

    it("hasClient returns correct boolean", () => {
      expect(registry.hasClient("alpha")).toBe(true);
      expect(registry.hasClient("gamma")).toBe(false);
    });
  });

  describe("clear", () => {
    it("removes all clients and listeners", () => {
      registry.register(
        createClientId("client-1"),
        createTestRegistration(),
        createMockWebSocket()
      );
      const handler = vi.fn();
      registry.on("registered", handler);

      registry.clear();

      expect(registry.getClientCount()).toBe(0);
      // Re-register to test listeners were removed
      registry.register(
        createClientId("client-2"),
        createTestRegistration({ name: "new-client" }),
        createMockWebSocket()
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
