/**
 * Tests for the RegistrationHandler service.
 * Focuses on meaningful behaviors: message parsing, validation flow,
 * registration success/failure, and response sending.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { WebSocket } from "ws";
import {
  initializeRegistrationHandler,
  getRegistrationHandler,
  resetRegistrationHandler,
  RegistrationHandler,
  RegistrationContext,
} from "./registration-handler";
import { initializeClientRegistry, resetClientRegistry } from "./client-registry";
import { initializeLogger, resetLogger } from "./logger";
import { createClientId, LogLevel, WebSocketRegistrationResponse } from "../types";

// Mock WebSocket
function createMockWebSocket(): WebSocket & { send: Mock } {
  return {
    readyState: WebSocket.OPEN,
    close: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as WebSocket & { send: Mock };
}

// Create registration message
function createRegistrationMessage(payload: {
  name?: string;
  description?: string;
  version?: string;
  capabilities?: string[];
}): string {
  return JSON.stringify({
    type: "registration",
    payload,
  });
}

// Create raw data from string
function toRawData(str: string): Buffer {
  return Buffer.from(str);
}

// Parse sent response
function parseSentResponse(mockWs: WebSocket & { send: Mock }): WebSocketRegistrationResponse {
  expect(mockWs.send).toHaveBeenCalled();
  const sentData = mockWs.send.mock.calls[0][0];
  return JSON.parse(sentData as string);
}

describe("RegistrationHandler", () => {
  let handler: RegistrationHandler;

  beforeEach(() => {
    // Initialize dependencies
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeClientRegistry();
    handler = initializeRegistrationHandler();
  });

  afterEach(() => {
    resetRegistrationHandler();
    resetClientRegistry();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeRegistrationHandler();
      const instance2 = initializeRegistrationHandler();
      expect(instance1).toBe(instance2);
    });

    it("throws if getRegistrationHandler called before initialization", () => {
      resetRegistrationHandler();
      expect(() => getRegistrationHandler()).toThrow(/not initialized/);
    });
  });

  describe("processMessage - parsing", () => {
    it("returns parse_error for invalid JSON", () => {
      const ws = createMockWebSocket();
      const context: RegistrationContext = {
        ws,
        connectionId: createClientId("conn-1"),
      };

      const result = handler.processMessage(toRawData("not valid json"), context);

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("parse_error");
      }
    });

    it("returns invalid_message for non-WebSocket message format", () => {
      const ws = createMockWebSocket();
      const context: RegistrationContext = {
        ws,
        connectionId: createClientId("conn-1"),
      };

      const result = handler.processMessage(toRawData('{"foo": "bar"}'), context);

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("invalid_message");
      }
    });

    it("returns not_registration for non-registration messages", () => {
      const ws = createMockWebSocket();
      const context: RegistrationContext = {
        ws,
        connectionId: createClientId("conn-1"),
      };

      const data = JSON.stringify({ type: "message", payload: {} });
      const result = handler.processMessage(toRawData(data), context);

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("not_registration");
      }
    });
  });

  describe("processMessage - validation", () => {
    it("rejects registration with missing name", () => {
      const ws = createMockWebSocket();
      const context: RegistrationContext = {
        ws,
        connectionId: createClientId("conn-1"),
      };

      const data = createRegistrationMessage({
        description: "A valid description",
      });
      const result = handler.processMessage(toRawData(data), context);

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.registered).toBe(false);
      }

      const response = parseSentResponse(ws);
      expect(response.payload.success).toBe(false);
      if (!response.payload.success) {
        expect(response.payload.code).toBe("INVALID_NAME");
      }
    });

    it("rejects registration with missing description", () => {
      const ws = createMockWebSocket();
      const context: RegistrationContext = {
        ws,
        connectionId: createClientId("conn-1"),
      };

      const data = createRegistrationMessage({
        name: "test-client",
      });
      const result = handler.processMessage(toRawData(data), context);

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.registered).toBe(false);
      }

      const response = parseSentResponse(ws);
      expect(response.payload.success).toBe(false);
      if (!response.payload.success) {
        expect(response.payload.code).toBe("INVALID_DESCRIPTION");
      }
    });

    it("rejects registration with invalid name format", () => {
      const ws = createMockWebSocket();
      const context: RegistrationContext = {
        ws,
        connectionId: createClientId("conn-1"),
      };

      const data = createRegistrationMessage({
        name: "123-invalid-start",
        description: "A valid description",
      });
      const result = handler.processMessage(toRawData(data), context);

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.registered).toBe(false);
      }

      const response = parseSentResponse(ws);
      expect(response.payload.success).toBe(false);
      if (!response.payload.success) {
        expect(response.payload.code).toBe("INVALID_NAME");
      }
    });
  });

  describe("processMessage - registration flow", () => {
    it("successfully registers a valid client", () => {
      const ws = createMockWebSocket();
      const connectionId = createClientId("conn-1");
      const context: RegistrationContext = { ws, connectionId };

      const data = createRegistrationMessage({
        name: "test-client",
        description: "A test client",
        version: "1.0.0",
      });
      const result = handler.processMessage(toRawData(data), context);

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.registered).toBe(true);
      }

      const response = parseSentResponse(ws);
      expect(response.type).toBe("registration_response");
      expect(response.payload.success).toBe(true);
      if (response.payload.success) {
        expect(response.payload.clientId).toBe(connectionId);
        expect(response.payload.message).toContain("successful");
      }
    });

    it("rejects duplicate client names", () => {
      // Register first client
      const ws1 = createMockWebSocket();
      const context1: RegistrationContext = {
        ws: ws1,
        connectionId: createClientId("conn-1"),
      };
      handler.processMessage(
        toRawData(
          createRegistrationMessage({
            name: "unique-client",
            description: "First client",
          })
        ),
        context1
      );

      // Try to register second client with same name
      const ws2 = createMockWebSocket();
      const context2: RegistrationContext = {
        ws: ws2,
        connectionId: createClientId("conn-2"),
      };
      const result = handler.processMessage(
        toRawData(
          createRegistrationMessage({
            name: "unique-client",
            description: "Second client",
          })
        ),
        context2
      );

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.registered).toBe(false);
      }

      const response = parseSentResponse(ws2);
      expect(response.payload.success).toBe(false);
      if (!response.payload.success) {
        expect(response.payload.code).toBe("DUPLICATE_NAME");
      }
    });

    it("rejects if same connection tries to register twice", () => {
      const ws = createMockWebSocket();
      const connectionId = createClientId("conn-1");
      const context: RegistrationContext = { ws, connectionId };

      // First registration
      handler.processMessage(
        toRawData(
          createRegistrationMessage({
            name: "first-client",
            description: "First registration",
          })
        ),
        context
      );

      // Clear mock to check second response
      ws.send.mockClear();

      // Second registration attempt
      const result = handler.processMessage(
        toRawData(
          createRegistrationMessage({
            name: "second-client",
            description: "Second registration",
          })
        ),
        context
      );

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.registered).toBe(false);
      }

      const response = parseSentResponse(ws);
      expect(response.payload.success).toBe(false);
      if (!response.payload.success) {
        expect(response.payload.code).toBe("ALREADY_REGISTERED");
      }
    });
  });

  describe("isConnectionRegistered", () => {
    it("returns false for unregistered connection", () => {
      expect(handler.isConnectionRegistered(createClientId("unknown"))).toBe(false);
    });

    it("returns true for registered connection", () => {
      const ws = createMockWebSocket();
      const connectionId = createClientId("conn-1");
      const context: RegistrationContext = { ws, connectionId };

      handler.processMessage(
        toRawData(
          createRegistrationMessage({
            name: "test-client",
            description: "A test client",
          })
        ),
        context
      );

      expect(handler.isConnectionRegistered(connectionId)).toBe(true);
    });
  });
});
