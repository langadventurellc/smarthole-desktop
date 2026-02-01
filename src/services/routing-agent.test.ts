/**
 * Tests for the RoutingAgent service.
 * Covers routing flow, direct routing, LLM routing, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import { initializeRoutingAgent, getRoutingAgent, resetRoutingAgent } from "./routing-agent";
import { initializeLogger, resetLogger } from "./logger";
import { initializeCredentialManager, resetCredentialManager } from "./credential-manager";
import { initializeToolGenerator, resetToolGenerator } from "./tool-generator";
import {
  initializeClientRegistry,
  resetClientRegistry,
  getClientRegistry,
} from "./client-registry";
import { initializeRoutingApi, resetRoutingApi } from "./routing-api";
import { initializeMessageDelivery, resetMessageDelivery } from "./message-delivery";
import { LogLevel, RoutingAgentService, createClientId } from "../types";

// Mock WebSocket for client registration
function createMockWebSocket(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    close: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as WebSocket;
}

// Mock keytar
vi.mock("keytar", () => ({
  default: {
    setPassword: vi.fn(),
    getPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

// Module-level mock function for Anthropic API
const mockCreate = vi.fn();

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  class MockAPIError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "APIError";
    }
  }

  class MockRateLimitError extends MockAPIError {
    constructor(message: string) {
      super(429, message);
      this.name = "RateLimitError";
    }
  }

  class MockAuthenticationError extends MockAPIError {
    constructor(message: string) {
      super(401, message);
      this.name = "AuthenticationError";
    }
  }

  class MockAnthropic {
    messages = {
      create: mockCreate,
    };
  }

  return {
    default: Object.assign(MockAnthropic, {
      APIError: MockAPIError,
      RateLimitError: MockRateLimitError,
      AuthenticationError: MockAuthenticationError,
    }),
  };
});

import keytar from "keytar";

const mockedKeytar = vi.mocked(keytar);

// Helper to create a mock Anthropic response
function createMockResponse(content: unknown[]): unknown {
  return {
    id: "msg_123",
    type: "message",
    role: "assistant",
    content,
    model: "claude-3-haiku-20240307",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

// Helper to create a tool use response block
function createToolUseBlock(
  toolName: string,
  message: string,
  reason?: string
): { type: "tool_use"; id: string; name: string; input: { message: string; reason?: string } } {
  return {
    type: "tool_use",
    id: `tool_${Date.now()}`,
    name: toolName,
    input: {
      message,
      ...(reason && { reason }),
    },
  };
}

describe("RoutingAgent", () => {
  let routingAgent: RoutingAgentService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockedKeytar.getPassword.mockResolvedValue("sk-ant-test-key");

    // Initialize all dependencies in order
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeCredentialManager();
    initializeClientRegistry();
    initializeToolGenerator();
    initializeRoutingApi();
    initializeMessageDelivery();
    routingAgent = initializeRoutingAgent();
  });

  afterEach(() => {
    resetRoutingAgent();
    resetMessageDelivery();
    resetRoutingApi();
    resetToolGenerator();
    resetClientRegistry();
    resetCredentialManager();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeRoutingAgent();
      const instance2 = initializeRoutingAgent();
      expect(instance1).toBe(instance2);
    });

    it("throws if getRoutingAgent called before initialization", () => {
      resetRoutingAgent();
      expect(() => getRoutingAgent()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeRoutingAgent();
      resetRoutingAgent();
      const instance2 = initializeRoutingAgent();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("no clients scenario", () => {
    it("returns no_clients when no clients are registered", async () => {
      const result = await routingAgent.routeMessage({
        message: "Hello world",
        source: "text",
      });

      expect(result.type).toBe("no_clients");
      if (result.type === "no_clients") {
        expect(result.message).toContain("No plugins");
      }
    });
  });

  describe("direct routing", () => {
    beforeEach(() => {
      // Register a test client
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook for notes" },
        createMockWebSocket()
      );
    });

    it("routes directly when message matches pattern", async () => {
      const result = await routingAgent.routeMessage({
        message: "notebook: Remember to buy milk",
        source: "text",
      });

      expect(result.type).toBe("routed");
      if (result.type === "routed") {
        expect(result.deliveries).toHaveLength(1);
        expect(result.deliveries[0].clientName).toBe("notebook");
        expect(result.deliveries[0].directRouted).toBe(true);
      }

      // LLM should not be called for direct routing
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("handles case-insensitive client names", async () => {
      const result = await routingAgent.routeMessage({
        message: "NOTEBOOK: This is a test",
        source: "voice",
      });

      expect(result.type).toBe("routed");
      if (result.type === "routed") {
        expect(result.deliveries[0].clientName).toBe("notebook");
        expect(result.deliveries[0].directRouted).toBe(true);
      }
    });

    it("handles comma separator for direct routing", async () => {
      const result = await routingAgent.routeMessage({
        message: "notebook, remember this important thing",
        source: "text",
      });

      expect(result.type).toBe("routed");
      if (result.type === "routed") {
        expect(result.deliveries[0].clientName).toBe("notebook");
        expect(result.deliveries[0].directRouted).toBe(true);
      }
    });

    it("falls through to LLM when direct route client not found", async () => {
      mockCreate.mockResolvedValue(
        createMockResponse([createToolUseBlock("route_to_notebook", "Unknown command")])
      );

      await routingAgent.routeMessage({
        message: "calendar: set a reminder",
        source: "text",
      });

      // Should fall through to LLM since "calendar" is not registered
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe("LLM routing", () => {
    beforeEach(() => {
      // Register test clients
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook for notes" },
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-2"),
        { name: "calendar", description: "A calendar app for scheduling" },
        createMockWebSocket()
      );
    });

    it("routes via LLM when no direct route pattern", async () => {
      mockCreate.mockResolvedValue(
        createMockResponse([
          createToolUseBlock("route_to_notebook", "Take this note", "User wants to save a note"),
        ])
      );

      const result = await routingAgent.routeMessage({
        message: "Remember to buy groceries",
        source: "text",
      });

      expect(result.type).toBe("routed");
      if (result.type === "routed") {
        expect(result.deliveries).toHaveLength(1);
        expect(result.deliveries[0].clientName).toBe("notebook");
        expect(result.deliveries[0].directRouted).toBe(false);
        expect(result.deliveries[0].reason).toBe("User wants to save a note");
      }
    });

    it("supports multi-client routing", async () => {
      mockCreate.mockResolvedValue(
        createMockResponse([
          createToolUseBlock("route_to_notebook", "Note content"),
          createToolUseBlock("route_to_calendar", "Schedule meeting", "Also a calendar event"),
        ])
      );

      const result = await routingAgent.routeMessage({
        message: "Remember meeting tomorrow at 3pm",
        source: "voice",
      });

      expect(result.type).toBe("routed");
      if (result.type === "routed") {
        expect(result.deliveries).toHaveLength(2);
        expect(result.deliveries.map((d) => d.clientName)).toContain("notebook");
        expect(result.deliveries.map((d) => d.clientName)).toContain("calendar");
      }
    });

    it("handles LLM returning no routing decisions", async () => {
      mockCreate.mockResolvedValue(
        createMockResponse([
          {
            type: "text",
            text: "I'm not sure what to do with this.",
          },
        ])
      );

      const result = await routingAgent.routeMessage({
        message: "Something completely random",
        source: "text",
      });

      expect(result.type).toBe("routing_failed");
      if (result.type === "routing_failed") {
        expect(result.error).toContain("No routing decisions");
        expect(result.fallbackAttempted).toBe(false);
      }
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook for notes" },
        createMockWebSocket()
      );
    });

    it("handles API errors gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API connection failed"));

      const result = await routingAgent.routeMessage({
        message: "Test message",
        source: "text",
      });

      expect(result.type).toBe("routing_failed");
      if (result.type === "routing_failed") {
        expect(result.error).toContain("API");
      }
    });

    it("handles partial delivery failures", async () => {
      // Register two clients, one with a closed connection
      const registry = getClientRegistry();
      const closedSocket = createMockWebSocket();
      (closedSocket as unknown as { readyState: number }).readyState = WebSocket.CLOSED;

      registry.register(
        createClientId("client-2"),
        { name: "broken", description: "A broken client" },
        closedSocket
      );

      mockCreate.mockResolvedValue(
        createMockResponse([
          createToolUseBlock("route_to_notebook", "Note content"),
          createToolUseBlock("route_to_broken", "This will fail"),
        ])
      );

      const result = await routingAgent.routeMessage({
        message: "Test message",
        source: "text",
      });

      // Should still succeed with partial deliveries
      expect(result.type).toBe("routed");
      if (result.type === "routed") {
        expect(result.deliveries).toHaveLength(1);
        expect(result.deliveries[0].clientName).toBe("notebook");
      }
    });

    it("returns routing_failed when all deliveries fail", async () => {
      // Make the only client's socket closed
      const registry = getClientRegistry();
      registry.unregister("notebook", "unregister");

      const closedSocket = createMockWebSocket();
      (closedSocket as unknown as { readyState: number }).readyState = WebSocket.CLOSED;

      registry.register(
        createClientId("client-broken"),
        { name: "broken", description: "A broken client" },
        closedSocket
      );

      mockCreate.mockResolvedValue(
        createMockResponse([createToolUseBlock("route_to_broken", "This will fail")])
      );

      const result = await routingAgent.routeMessage({
        message: "Test message",
        source: "text",
      });

      expect(result.type).toBe("routing_failed");
      if (result.type === "routing_failed") {
        expect(result.error).toContain("All message deliveries failed");
      }
    });
  });

  describe("message metadata", () => {
    beforeEach(() => {
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook for notes" },
        createMockWebSocket()
      );
    });

    it("sets correct metadata for direct routed messages", async () => {
      const mockSend = vi.fn();
      const registry = getClientRegistry();
      const client = registry.getClient("notebook");
      if (client) {
        client.connection.send = mockSend;
      }

      await routingAgent.routeMessage({
        message: "notebook: Remember this",
        source: "voice",
      });

      expect(mockSend).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentMessage.payload.metadata.directRouted).toBe(true);
      expect(sentMessage.payload.metadata.inputMethod).toBe("voice");
    });

    it("sets correct metadata for LLM routed messages", async () => {
      mockCreate.mockResolvedValue(
        createMockResponse([
          createToolUseBlock("route_to_notebook", "Test message", "Because user asked"),
        ])
      );

      const mockSend = vi.fn();
      const registry = getClientRegistry();
      const client = registry.getClient("notebook");
      if (client) {
        client.connection.send = mockSend;
      }

      await routingAgent.routeMessage({
        message: "Remember something important",
        source: "text",
      });

      expect(mockSend).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentMessage.payload.metadata.directRouted).toBe(false);
      expect(sentMessage.payload.metadata.inputMethod).toBe("text");
      expect(sentMessage.payload.metadata.routingReason).toBe("Because user asked");
    });

    it("generates unique message IDs", async () => {
      mockCreate.mockResolvedValue(
        createMockResponse([createToolUseBlock("route_to_notebook", "Message 1")])
      );

      const mockSend = vi.fn();
      const registry = getClientRegistry();
      const client = registry.getClient("notebook");
      if (client) {
        client.connection.send = mockSend;
      }

      await routingAgent.routeMessage({
        message: "First message",
        source: "text",
      });

      mockCreate.mockResolvedValue(
        createMockResponse([createToolUseBlock("route_to_notebook", "Message 2")])
      );

      await routingAgent.routeMessage({
        message: "Second message",
        source: "text",
      });

      const firstMessage = JSON.parse(mockSend.mock.calls[0][0]);
      const secondMessage = JSON.parse(mockSend.mock.calls[1][0]);

      expect(firstMessage.payload.id).not.toBe(secondMessage.payload.id);
    });
  });

  describe("source handling", () => {
    beforeEach(() => {
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook for notes" },
        createMockWebSocket()
      );
    });

    it("passes text source correctly", async () => {
      const mockSend = vi.fn();
      const registry = getClientRegistry();
      const client = registry.getClient("notebook");
      if (client) {
        client.connection.send = mockSend;
      }

      await routingAgent.routeMessage({
        message: "notebook: Test",
        source: "text",
      });

      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentMessage.payload.metadata.inputMethod).toBe("text");
    });

    it("passes voice source correctly", async () => {
      const mockSend = vi.fn();
      const registry = getClientRegistry();
      const client = registry.getClient("notebook");
      if (client) {
        client.connection.send = mockSend;
      }

      await routingAgent.routeMessage({
        message: "notebook: Test",
        source: "voice",
      });

      const sentMessage = JSON.parse(mockSend.mock.calls[0][0]);
      expect(sentMessage.payload.metadata.inputMethod).toBe("voice");
    });
  });
});
