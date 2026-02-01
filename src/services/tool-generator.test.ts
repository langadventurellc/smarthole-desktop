/**
 * Tests for the ToolGenerator service.
 * Focuses on tool name sanitization, tool generation from registry,
 * cache invalidation on registry events, and client name resolution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  initializeToolGenerator,
  getToolGenerator,
  resetToolGenerator,
  sanitizeToolName,
} from "./tool-generator";
import { initializeLogger, resetLogger } from "./logger";
import {
  initializeClientRegistry,
  resetClientRegistry,
  ClientRegistryService,
} from "./client-registry";
import { createClientId, LogLevel, ToolGeneratorService } from "../types";
import { WebSocket } from "ws";

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

describe("sanitizeToolName", () => {
  it("replaces hyphens with underscores", () => {
    expect(sanitizeToolName("my-client")).toBe("route_to_my_client");
  });

  it("replaces multiple special characters", () => {
    expect(sanitizeToolName("client-with-many_chars")).toBe("route_to_client_with_many_chars");
  });

  it("handles names with spaces and special chars", () => {
    expect(sanitizeToolName("my client!")).toBe("route_to_my_client_");
  });

  it("prepends client_ if name starts with number after sanitization", () => {
    expect(sanitizeToolName("123client")).toBe("route_to_client_123client");
  });

  it("removes leading underscores", () => {
    expect(sanitizeToolName("_underscore_start")).toBe("route_to_underscore_start");
  });

  it("handles simple alphanumeric names", () => {
    expect(sanitizeToolName("simpleClient")).toBe("route_to_simpleClient");
  });
});

describe("ToolGenerator", () => {
  let registry: ClientRegistryService;
  let toolGenerator: ToolGeneratorService;

  beforeEach(() => {
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    registry = initializeClientRegistry();
    toolGenerator = initializeToolGenerator();
  });

  afterEach(() => {
    resetToolGenerator();
    resetClientRegistry();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeToolGenerator();
      const instance2 = initializeToolGenerator();
      expect(instance1).toBe(instance2);
    });

    it("throws if getToolGenerator called before initialization", () => {
      resetToolGenerator();
      resetClientRegistry();
      expect(() => getToolGenerator()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeToolGenerator();
      resetToolGenerator();
      const instance2 = initializeToolGenerator();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("generateTools", () => {
    it("returns empty array when no clients registered", () => {
      const tools = toolGenerator.generateTools();
      expect(tools).toEqual([]);
    });

    it("generates tool for each registered client", () => {
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook client", version: "1.0.0" },
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-2"),
        { name: "home-assistant", description: "Home automation", version: "2.0.0" },
        createMockWebSocket()
      );

      const tools = toolGenerator.generateTools();

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name).sort()).toEqual([
        "route_to_home_assistant",
        "route_to_notebook",
      ]);
    });

    it("uses client description as tool description", () => {
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A powerful notebook for notes" },
        createMockWebSocket()
      );

      const tools = toolGenerator.generateTools();

      expect(tools[0].description).toBe("A powerful notebook for notes");
    });

    it("generates proper input schema with message and reason parameters", () => {
      registry.register(
        createClientId("client-1"),
        { name: "test", description: "Test client" },
        createMockWebSocket()
      );

      const tools = toolGenerator.generateTools();

      expect(tools[0].input_schema).toEqual({
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The message to route to this client",
          },
          reason: {
            type: "string",
            description: "Explanation for why this client was chosen",
          },
        },
        required: ["message"],
      });
    });

    it("caches tools and returns same array on subsequent calls", () => {
      registry.register(
        createClientId("client-1"),
        { name: "test", description: "Test" },
        createMockWebSocket()
      );

      const tools1 = toolGenerator.generateTools();
      const tools2 = toolGenerator.generateTools();

      expect(tools1).toBe(tools2);
    });
  });

  describe("generateToolsExcluding", () => {
    beforeEach(() => {
      registry.register(
        createClientId("client-1"),
        { name: "alpha", description: "Alpha client" },
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-2"),
        { name: "beta", description: "Beta client" },
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-3"),
        { name: "gamma", description: "Gamma client" },
        createMockWebSocket()
      );
    });

    it("excludes specified clients from generated tools", () => {
      const tools = toolGenerator.generateToolsExcluding(["beta"]);

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name).sort()).toEqual(["route_to_alpha", "route_to_gamma"]);
    });

    it("excludes multiple clients", () => {
      const tools = toolGenerator.generateToolsExcluding(["alpha", "gamma"]);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("route_to_beta");
    });

    it("returns all tools if exclude list is empty", () => {
      const tools = toolGenerator.generateToolsExcluding([]);

      expect(tools).toHaveLength(3);
    });

    it("handles non-existent client names gracefully", () => {
      const tools = toolGenerator.generateToolsExcluding(["nonexistent"]);

      expect(tools).toHaveLength(3);
    });
  });

  describe("resolveClientName", () => {
    beforeEach(() => {
      registry.register(
        createClientId("client-1"),
        { name: "my-client", description: "My client" },
        createMockWebSocket()
      );
    });

    it("resolves tool name to client name", () => {
      // Trigger cache build
      toolGenerator.generateTools();

      const clientName = toolGenerator.resolveClientName("route_to_my_client");
      expect(clientName).toBe("my-client");
    });

    it("returns undefined for unknown tool name", () => {
      toolGenerator.generateTools();

      const clientName = toolGenerator.resolveClientName("route_to_unknown");
      expect(clientName).toBeUndefined();
    });

    it("builds cache if not already built", () => {
      // Don't call generateTools first
      const clientName = toolGenerator.resolveClientName("route_to_my_client");
      expect(clientName).toBe("my-client");
    });
  });

  describe("cache invalidation on registry events", () => {
    it("invalidates cache when client registers", () => {
      registry.register(
        createClientId("client-1"),
        { name: "first", description: "First" },
        createMockWebSocket()
      );

      const tools1 = toolGenerator.generateTools();
      expect(tools1).toHaveLength(1);

      // Register another client
      registry.register(
        createClientId("client-2"),
        { name: "second", description: "Second" },
        createMockWebSocket()
      );

      const tools2 = toolGenerator.generateTools();
      expect(tools2).toHaveLength(2);
      expect(tools2).not.toBe(tools1); // New array, cache was invalidated
    });

    it("invalidates cache when client unregisters", () => {
      registry.register(
        createClientId("client-1"),
        { name: "first", description: "First" },
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-2"),
        { name: "second", description: "Second" },
        createMockWebSocket()
      );

      const tools1 = toolGenerator.generateTools();
      expect(tools1).toHaveLength(2);

      // Unregister a client
      registry.unregister("first", "disconnect");

      const tools2 = toolGenerator.generateTools();
      expect(tools2).toHaveLength(1);
      expect(tools2).not.toBe(tools1);
    });
  });
});
