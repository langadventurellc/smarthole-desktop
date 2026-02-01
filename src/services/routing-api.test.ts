/**
 * Tests for the RoutingApi service.
 * Focuses on API key retrieval, tool use response parsing,
 * error handling, and retry logic for rate limits.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { WebSocket } from "ws";
import { initializeRoutingApi, getRoutingApi, resetRoutingApi } from "./routing-api";
import { initializeLogger, resetLogger } from "./logger";
import { initializeCredentialManager, resetCredentialManager } from "./credential-manager";
import { initializeToolGenerator, resetToolGenerator } from "./tool-generator";
import {
  initializeClientRegistry,
  resetClientRegistry,
  getClientRegistry,
} from "./client-registry";
import { LogLevel, RoutingApiService, RoutingTool, ErrorCode, createClientId } from "../types";

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

// Module-level mock function - must be defined before vi.mock for hoisting
const mockCreate = vi.fn();

// Mock the Anthropic SDK - all classes must be defined inside the factory
vi.mock("@anthropic-ai/sdk", () => {
  // Define error classes inside the mock factory to avoid hoisting issues
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

  // Use a class constructor for the mock
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
import Anthropic from "@anthropic-ai/sdk";

const mockedKeytar = vi.mocked(keytar);

// Create error instances using the mocked Anthropic classes
function createRateLimitError(message: string) {
  return new Anthropic.RateLimitError(
    ...([429, undefined, message, {}] as unknown as ConstructorParameters<
      typeof Anthropic.RateLimitError
    >)
  );
}

function createAuthError(message: string) {
  return new Anthropic.AuthenticationError(
    ...([401, undefined, message, {}] as unknown as ConstructorParameters<
      typeof Anthropic.AuthenticationError
    >)
  );
}

function getMockCreate(): Mock {
  return mockCreate;
}

// Helper to create a mock Anthropic response
// Using unknown cast to avoid strict typing on mock objects
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

// Test tool fixture
function createTestTool(name: string, description: string): RoutingTool {
  return {
    name,
    description,
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to route",
        },
        reason: {
          type: "string",
          description: "Reason for routing",
        },
      },
      required: ["message"],
    },
  };
}

describe("RoutingApi", () => {
  let routingApi: RoutingApiService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockedKeytar.getPassword.mockResolvedValue("sk-ant-test-key");

    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeCredentialManager();
    initializeClientRegistry();
    initializeToolGenerator();
    routingApi = initializeRoutingApi();
  });

  afterEach(() => {
    resetRoutingApi();
    resetToolGenerator();
    resetClientRegistry();
    resetCredentialManager();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeRoutingApi();
      const instance2 = initializeRoutingApi();
      expect(instance1).toBe(instance2);
    });

    it("throws if getRoutingApi called before initialization", () => {
      resetRoutingApi();
      expect(() => getRoutingApi()).toThrow(/not initialized/);
    });

    it("allows re-initialization after reset", () => {
      const instance1 = initializeRoutingApi();
      resetRoutingApi();
      const instance2 = initializeRoutingApi();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("routeMessage", () => {
    const systemPrompt = "You are a routing assistant.";
    const tools = [
      createTestTool("route_to_notebook", "A notebook for notes"),
      createTestTool("route_to_calendar", "A calendar app"),
    ];

    // Register clients so tool generator can resolve tool names to client names
    beforeEach(() => {
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-1"),
        { name: "notebook", description: "A notebook for notes" },
        createMockWebSocket()
      );
      registry.register(
        createClientId("client-2"),
        { name: "calendar", description: "A calendar app" },
        createMockWebSocket()
      );
    });

    it("returns error when no tools provided", async () => {
      const result = await routingApi.routeMessage({
        userMessage: "Hello",
        tools: [],
        systemPrompt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.ROUTING_NO_CLIENTS);
      }
    });

    it("returns error when API key is missing", async () => {
      mockedKeytar.getPassword.mockResolvedValue(null);

      // Reset and reinitialize to pick up new mock
      resetRoutingApi();
      resetCredentialManager();
      initializeCredentialManager();
      routingApi = initializeRoutingApi();

      const result = await routingApi.routeMessage({
        userMessage: "Hello",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.ROUTING_API_KEY_MISSING);
        expect(result.error.retryable).toBe(false);
      }
    });

    it("parses single tool use response correctly", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue(
        createMockResponse([
          {
            type: "tool_use",
            id: "tool_1",
            name: "route_to_notebook",
            input: { message: "Take this note", reason: "User wants to save a note" },
          },
        ])
      );

      const result = await routingApi.routeMessage({
        userMessage: "Save this note",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0]).toEqual({
          clientName: "notebook",
          message: "Take this note",
          reason: "User wants to save a note",
        });
      }
    });

    it("parses multiple tool use responses (multi-routing)", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue(
        createMockResponse([
          {
            type: "tool_use",
            id: "tool_1",
            name: "route_to_notebook",
            input: { message: "Note content" },
          },
          {
            type: "tool_use",
            id: "tool_2",
            name: "route_to_calendar",
            input: { message: "Schedule meeting", reason: "Detected calendar intent" },
          },
        ])
      );

      const result = await routingApi.routeMessage({
        userMessage: "Save note and schedule meeting",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.decisions).toHaveLength(2);
      }
    });

    it("returns empty decisions when no tool use in response", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue(
        createMockResponse([
          {
            type: "text",
            text: "I cannot help with that.",
          },
        ])
      );

      const result = await routingApi.routeMessage({
        userMessage: "Do something impossible",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.decisions).toHaveLength(0);
      }
    });

    it("skips tool use blocks with invalid input", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue(
        createMockResponse([
          {
            type: "tool_use",
            id: "tool_1",
            name: "route_to_notebook",
            input: { notMessage: "wrong field" }, // Missing required 'message'
          },
          {
            type: "tool_use",
            id: "tool_2",
            name: "route_to_calendar",
            input: { message: "Valid message" },
          },
        ])
      );

      const result = await routingApi.routeMessage({
        userMessage: "Test",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0].clientName).toBe("calendar");
      }
    });

    it("includes rejection context in user message when provided", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue(createMockResponse([]));

      await routingApi.routeMessage({
        userMessage: "Original message",
        tools,
        systemPrompt,
        rejectionContext: "Previous client rejected due to capacity",
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: "user",
              content: "Original message\n\n[Context: Previous client rejected due to capacity]",
            },
          ],
        })
      );
    });
  });

  describe("error handling", () => {
    const tools = [createTestTool("route_to_test", "Test client")];
    const systemPrompt = "Test";

    beforeEach(() => {
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-test"),
        { name: "test", description: "Test client" },
        createMockWebSocket()
      );
    });

    it("wraps generic API errors with meaningful context", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockRejectedValue(new Error("Network connection failed"));

      const result = await routingApi.routeMessage({
        userMessage: "Test",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.ROUTING_REQUEST_FAILED);
        expect(result.error.message).toContain("Network connection failed");
        expect(result.error.retryable).toBe(false);
      }
    });

    it("handles authentication errors", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockRejectedValue(createAuthError("Invalid API key"));

      const result = await routingApi.routeMessage({
        userMessage: "Test",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.ROUTING_API_KEY_MISSING);
        expect(result.error.retryable).toBe(false);
      }
    });
  });

  describe("retry logic for rate limits", () => {
    const tools = [createTestTool("route_to_test", "Test client")];
    const systemPrompt = "Test";

    beforeEach(() => {
      // Register the test client for tool name resolution
      const registry = getClientRegistry();
      registry.register(
        createClientId("client-test"),
        { name: "test", description: "Test client" },
        createMockWebSocket()
      );

      // Speed up tests by mocking setTimeout
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries on rate limit error with exponential backoff", async () => {
      const mockCreate = getMockCreate();

      // Fail twice, then succeed
      mockCreate
        .mockRejectedValueOnce(createRateLimitError("Rate limit exceeded"))
        .mockRejectedValueOnce(createRateLimitError("Rate limit exceeded"))
        .mockResolvedValueOnce(
          createMockResponse([
            {
              type: "tool_use",
              id: "tool_1",
              name: "route_to_test",
              input: { message: "Success" },
            },
          ])
        );

      const resultPromise = routingApi.routeMessage({
        userMessage: "Test",
        tools,
        systemPrompt,
      });

      // Advance through retry delays (1s, 2s)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });

    it("fails after max retries on persistent rate limit", async () => {
      const mockCreate = getMockCreate();

      // Always fail with rate limit
      mockCreate.mockRejectedValue(createRateLimitError("Rate limit exceeded"));

      const resultPromise = routingApi.routeMessage({
        userMessage: "Test",
        tools,
        systemPrompt,
      });

      // Advance through all retry delays (1s, 2s, 4s)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCode.ROUTING_RATE_LIMITED);
        expect(result.error.retryable).toBe(true);
      }
      // Initial attempt + 3 retries = 4 calls
      expect(mockCreate).toHaveBeenCalledTimes(4);
    });

    it("does not retry on non-rate-limit errors", async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockRejectedValue(new Error("Server error"));

      const result = await routingApi.routeMessage({
        userMessage: "Test",
        tools,
        systemPrompt,
      });

      expect(result.success).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
