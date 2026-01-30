/**
 * Tests for the MessageDelivery service.
 * Focuses on meaningful behaviors: successful delivery, error handling,
 * multi-client delivery, and history tracking with eviction.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocket } from "ws";
import {
  initializeMessageDelivery,
  getMessageDelivery,
  resetMessageDelivery,
  MessageDeliveryService,
} from "./message-delivery";
import { initializeClientRegistry, resetClientRegistry } from "./client-registry";
import { initializeLogger, resetLogger } from "./logger";
import {
  createClientId,
  createMessageId,
  createTimestamp,
  ClientRegistration,
  RoutedMessage,
  LogLevel,
  WebSocketResponseMessage,
  ClientResponse,
} from "../types";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock WebSocket with configurable state.
 */
function createMockWebSocket(options: { readyState?: number } = {}): WebSocket {
  return {
    readyState: options.readyState ?? WebSocket.OPEN,
    close: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as WebSocket;
}

/**
 * Create test registration data.
 */
function createTestRegistration(overrides?: Partial<ClientRegistration>): ClientRegistration {
  return {
    name: "test-client",
    description: "A test client for unit tests",
    version: "1.0.0",
    capabilities: ["test"],
    ...overrides,
  };
}

/**
 * Create a test routed message.
 */
function createTestMessage(overrides?: Partial<RoutedMessage>): RoutedMessage {
  return {
    id: createMessageId("msg-123"),
    text: "Test message content",
    timestamp: createTimestamp(),
    metadata: {
      inputMethod: "text",
      directRouted: false,
    },
    ...overrides,
  };
}

/**
 * Register a test client in the registry.
 */
function registerTestClient(
  name: string,
  wsOptions: { readyState?: number } = {}
): { ws: WebSocket } {
  const registry = initializeClientRegistry();
  const ws = createMockWebSocket(wsOptions);
  registry.register(createClientId(`client-${name}`), createTestRegistration({ name }), ws);
  return { ws };
}

// ============================================================================
// Tests
// ============================================================================

describe("MessageDelivery", () => {
  let delivery: MessageDeliveryService;

  beforeEach(() => {
    // Initialize required services
    initializeLogger({ level: LogLevel.ERROR, logMessageContent: false });
    initializeClientRegistry();
    delivery = initializeMessageDelivery();
  });

  afterEach(() => {
    resetMessageDelivery();
    resetClientRegistry();
    resetLogger();
  });

  describe("initialization", () => {
    it("returns same instance on multiple initialize calls", () => {
      const instance1 = initializeMessageDelivery();
      const instance2 = initializeMessageDelivery();
      expect(instance1).toBe(instance2);
    });

    it("throws if getMessageDelivery called before initialization", () => {
      resetMessageDelivery();
      expect(() => getMessageDelivery()).toThrow(/not initialized/);
    });
  });

  describe("sendToClient", () => {
    it("successfully delivers message to connected client", () => {
      const { ws } = registerTestClient("notebook");
      const message = createTestMessage();

      const result = delivery.sendToClient("notebook", message);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.deliveredAt).toBeDefined();
      }
      expect(ws.send).toHaveBeenCalledTimes(1);

      // Verify wire format
      const sentData = (ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const parsed = JSON.parse(sentData);
      expect(parsed.type).toBe("message");
      expect(parsed.payload.id).toBe(message.id);
      expect(parsed.payload.text).toBe(message.text);
    });

    it("returns CLIENT_NOT_FOUND for unknown client", () => {
      const message = createTestMessage();

      const result = delivery.sendToClient("nonexistent", message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CLIENT_NOT_FOUND");
      }
    });

    it("returns CLIENT_NOT_CONNECTED when WebSocket is not open", () => {
      registerTestClient("notebook", { readyState: WebSocket.CLOSED });
      const message = createTestMessage();

      const result = delivery.sendToClient("notebook", message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("CLIENT_NOT_CONNECTED");
      }
    });

    it("returns SEND_FAILED when WebSocket.send throws", () => {
      const { ws } = registerTestClient("notebook");
      (ws.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Connection reset");
      });
      const message = createTestMessage();

      const result = delivery.sendToClient("notebook", message);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("SEND_FAILED");
      }
    });
  });

  describe("sendToClients", () => {
    it("delivers to all specified clients", () => {
      const { ws: ws1 } = registerTestClient("notebook");
      const { ws: ws2 } = registerTestClient("terminal");
      const message = createTestMessage();

      const results = delivery.sendToClients(["notebook", "terminal"], message);

      expect(results.size).toBe(2);
      expect(results.get("notebook")?.success).toBe(true);
      expect(results.get("terminal")?.success).toBe(true);
      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);
    });

    it("returns individual errors for each failed client", () => {
      registerTestClient("notebook");
      // terminal not registered
      const message = createTestMessage();

      const results = delivery.sendToClients(["notebook", "terminal"], message);

      expect(results.size).toBe(2);
      expect(results.get("notebook")?.success).toBe(true);
      expect(results.get("terminal")?.success).toBe(false);
      const terminalResult = results.get("terminal") as { success: false; error: string };
      expect(terminalResult.error).toBe("CLIENT_NOT_FOUND");
    });

    it("handles empty client list", () => {
      const message = createTestMessage();

      const results = delivery.sendToClients([], message);

      expect(results.size).toBe(0);
    });
  });

  describe("delivery history", () => {
    it("tracks delivery status for messages", () => {
      registerTestClient("notebook");
      const message = createTestMessage();

      delivery.sendToClient("notebook", message);

      const status = delivery.getDeliveryStatus(message.id);
      expect(status).toBeDefined();
      expect(status?.messageId).toBe(message.id);
      expect(status?.clientName).toBe("notebook");
      expect(status?.result.success).toBe(true);
    });

    it("returns undefined for unknown message ID", () => {
      const status = delivery.getDeliveryStatus(createMessageId("unknown"));
      expect(status).toBeUndefined();
    });

    it("getRecentDeliveries returns newest first", () => {
      registerTestClient("notebook");
      const msg1 = createTestMessage({ id: createMessageId("msg-1") });
      const msg2 = createTestMessage({ id: createMessageId("msg-2") });
      const msg3 = createTestMessage({ id: createMessageId("msg-3") });

      delivery.sendToClient("notebook", msg1);
      delivery.sendToClient("notebook", msg2);
      delivery.sendToClient("notebook", msg3);

      const recent = delivery.getRecentDeliveries();
      expect(recent).toHaveLength(3);
      expect(recent[0].messageId).toBe("msg-3");
      expect(recent[1].messageId).toBe("msg-2");
      expect(recent[2].messageId).toBe("msg-1");
    });

    it("getRecentDeliveries respects limit parameter", () => {
      registerTestClient("notebook");

      for (let i = 0; i < 10; i++) {
        delivery.sendToClient("notebook", createTestMessage({ id: createMessageId(`msg-${i}`) }));
      }

      const recent = delivery.getRecentDeliveries(3);
      expect(recent).toHaveLength(3);
      expect(recent[0].messageId).toBe("msg-9");
    });

    it("clearDeliveryHistory removes all history", () => {
      registerTestClient("notebook");
      delivery.sendToClient("notebook", createTestMessage());

      delivery.clearDeliveryHistory();

      expect(delivery.getRecentDeliveries()).toHaveLength(0);
    });
  });

  describe("history eviction", () => {
    it("evicts oldest entries when history exceeds max size", () => {
      // Create service with small history size
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ maxHistorySize: 5 });

      registerTestClient("notebook");

      // Send more messages than history size
      for (let i = 0; i < 8; i++) {
        delivery.sendToClient("notebook", createTestMessage({ id: createMessageId(`msg-${i}`) }));
      }

      const history = delivery.getRecentDeliveries();
      expect(history).toHaveLength(5);

      // Should have msg-3 through msg-7 (oldest 3 evicted)
      const ids = history.map((s) => s.messageId);
      expect(ids).toContain("msg-7");
      expect(ids).toContain("msg-6");
      expect(ids).toContain("msg-5");
      expect(ids).toContain("msg-4");
      expect(ids).toContain("msg-3");
      expect(ids).not.toContain("msg-0");
      expect(ids).not.toContain("msg-1");
      expect(ids).not.toContain("msg-2");
    });
  });

  describe("multi-client delivery tracking", () => {
    it("tracks separate status for each client in multi-delivery", () => {
      registerTestClient("notebook");
      registerTestClient("terminal");
      const message = createTestMessage();

      delivery.sendToClients(["notebook", "terminal"], message);

      // Both deliveries are tracked
      const history = delivery.getRecentDeliveries();
      expect(history).toHaveLength(2);

      const clientNames = history.map((s) => s.clientName);
      expect(clientNames).toContain("notebook");
      expect(clientNames).toContain("terminal");
    });
  });

  describe("handleResponse", () => {
    /**
     * Helper to create a WebSocket response message as raw data.
     */
    function createResponseData(response: ClientResponse): Buffer {
      const message: WebSocketResponseMessage = {
        type: "response",
        payload: response,
      };
      return Buffer.from(JSON.stringify(message));
    }

    /**
     * Register a client and send a message to it, returning the context needed for responses.
     */
    function setupDeliveredMessage(clientName: string): {
      connectionId: string;
      messageId: string;
    } {
      const connectionId = `client-${clientName}`;
      registerTestClient(clientName);
      const message = createTestMessage({ id: createMessageId(`msg-${clientName}`) });
      delivery.sendToClient(clientName, message);
      return { connectionId, messageId: message.id };
    }

    it("processes ack response and updates delivery status", () => {
      const { connectionId, messageId } = setupDeliveredMessage("notebook");

      const responseData = createResponseData({
        messageId: createMessageId(messageId),
        type: "ack",
        payload: {},
      });

      const result = delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.responseType).toBe("ack");
      }

      // Verify delivery status was updated
      const status = delivery.getDeliveryStatus(createMessageId(messageId));
      expect(status?.response).toBeDefined();
      expect(status?.response?.type).toBe("ack");
      expect(status?.response?.receivedAt).toBeDefined();
    });

    it("processes reject response with reason", () => {
      const { connectionId, messageId } = setupDeliveredMessage("notebook");
      const rejectReason = "I don't handle calendar events";

      const responseData = createResponseData({
        messageId: createMessageId(messageId),
        type: "reject",
        payload: { reason: rejectReason },
      });

      const result = delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.responseType).toBe("reject");
      }

      const status = delivery.getDeliveryStatus(createMessageId(messageId));
      expect(status?.response?.type).toBe("reject");
      expect(status?.response?.payload).toEqual({ reason: rejectReason });
    });

    it("processes notification response", () => {
      const { connectionId, messageId } = setupDeliveredMessage("notebook");
      const notification = {
        title: "Note saved",
        body: "Your note was saved successfully",
        priority: "normal" as const,
      };

      const responseData = createResponseData({
        messageId: createMessageId(messageId),
        type: "notification",
        payload: notification,
      });

      const result = delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(result.handled).toBe(true);
      if (result.handled) {
        expect(result.responseType).toBe("notification");
      }

      const status = delivery.getDeliveryStatus(createMessageId(messageId));
      expect(status?.response?.type).toBe("notification");
      expect(status?.response?.payload).toEqual(notification);
    });

    it("returns unknown_message for response to unknown messageId", () => {
      registerTestClient("notebook");
      const connectionId = "client-notebook";

      const responseData = createResponseData({
        messageId: createMessageId("unknown-msg-id"),
        type: "ack",
        payload: {},
      });

      const result = delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("unknown_message");
      }
    });

    it("returns not_response for non-response messages", () => {
      registerTestClient("notebook");
      const connectionId = "client-notebook";

      // Send a registration message instead of a response
      const registrationData = Buffer.from(
        JSON.stringify({
          type: "registration",
          payload: { name: "test", description: "test" },
        })
      );

      const result = delivery.handleResponse(registrationData, {
        connectionId: createClientId(connectionId),
      });

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("not_response");
      }
    });

    it("returns parse_error for invalid JSON", () => {
      const result = delivery.handleResponse(Buffer.from("not valid json"), {
        connectionId: createClientId("client-test"),
      });

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("parse_error");
      }
    });

    it("returns invalid_message for non-WebSocket message format", () => {
      const result = delivery.handleResponse(Buffer.from(JSON.stringify({ foo: "bar" })), {
        connectionId: createClientId("client-test"),
      });

      expect(result.handled).toBe(false);
      if (!result.handled) {
        expect(result.reason).toBe("invalid_message");
      }
    });

    it("emits response:ack event when ack received", () => {
      const { connectionId, messageId } = setupDeliveredMessage("notebook");
      const ackHandler = vi.fn();
      delivery.on("response:ack", ackHandler);

      const responseData = createResponseData({
        messageId: createMessageId(messageId),
        type: "ack",
        payload: {},
      });

      delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(ackHandler).toHaveBeenCalledWith(messageId, "notebook");

      delivery.off("response:ack", ackHandler);
    });

    it("emits response:reject event when reject received", () => {
      const { connectionId, messageId } = setupDeliveredMessage("notebook");
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      const responseData = createResponseData({
        messageId: createMessageId(messageId),
        type: "reject",
        payload: { reason: "Not my problem" },
      });

      delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(rejectHandler).toHaveBeenCalledWith(messageId, "notebook", "Not my problem");

      delivery.off("response:reject", rejectHandler);
    });

    it("emits response:notification event when notification received", () => {
      const { connectionId, messageId } = setupDeliveredMessage("notebook");
      const notifyHandler = vi.fn();
      delivery.on("response:notification", notifyHandler);

      const notification = { title: "Done", body: "Task complete" };
      const responseData = createResponseData({
        messageId: createMessageId(messageId),
        type: "notification",
        payload: notification,
      });

      delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      expect(notifyHandler).toHaveBeenCalledWith(messageId, "notebook", notification);

      delivery.off("response:notification", notifyHandler);
    });
  });

  describe("response timeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses default timeout of 30 seconds", () => {
      registerTestClient("notebook");
      const message = createTestMessage();
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      delivery.sendToClient("notebook", message);

      // Advance time just under 30 seconds - no timeout yet
      vi.advanceTimersByTime(29999);
      expect(rejectHandler).not.toHaveBeenCalled();

      // Advance to exactly 30 seconds - timeout should fire
      vi.advanceTimersByTime(1);
      expect(rejectHandler).toHaveBeenCalledWith(message.id, "notebook", "Response timeout");

      delivery.off("response:reject", rejectHandler);
    });

    it("uses custom timeout from config", () => {
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ responseTimeoutMs: 5000 });

      registerTestClient("notebook");
      const message = createTestMessage();
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      delivery.sendToClient("notebook", message);

      // Advance time just under 5 seconds - no timeout yet
      vi.advanceTimersByTime(4999);
      expect(rejectHandler).not.toHaveBeenCalled();

      // Advance to exactly 5 seconds - timeout should fire
      vi.advanceTimersByTime(1);
      expect(rejectHandler).toHaveBeenCalledWith(message.id, "notebook", "Response timeout");

      delivery.off("response:reject", rejectHandler);
    });

    it("updates delivery status on timeout", () => {
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ responseTimeoutMs: 1000 });

      registerTestClient("notebook");
      const message = createTestMessage();

      delivery.sendToClient("notebook", message);

      // Trigger timeout
      vi.advanceTimersByTime(1000);

      const status = delivery.getDeliveryStatus(message.id);
      expect(status?.response).toBeDefined();
      expect(status?.response?.type).toBe("reject");
      expect(status?.response?.payload).toEqual({ reason: "Response timeout" });
    });

    it("cancels timeout when response is received", () => {
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ responseTimeoutMs: 1000 });

      const connectionId = "client-notebook";
      registerTestClient("notebook");
      const message = createTestMessage();
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      delivery.sendToClient("notebook", message);

      // Receive response before timeout
      const responseData = Buffer.from(
        JSON.stringify({
          type: "response",
          payload: {
            messageId: message.id,
            type: "ack",
            payload: {},
          },
        })
      );

      delivery.handleResponse(responseData, {
        connectionId: createClientId(connectionId),
      });

      // Advance past the timeout - should not trigger since response was received
      vi.advanceTimersByTime(2000);
      expect(rejectHandler).not.toHaveBeenCalled();

      delivery.off("response:reject", rejectHandler);
    });

    it("does not start timer for failed deliveries", () => {
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ responseTimeoutMs: 1000 });

      // Don't register client - delivery will fail
      const message = createTestMessage();
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      delivery.sendToClient("nonexistent", message);

      // Advance past the timeout - should not trigger since delivery failed
      vi.advanceTimersByTime(2000);
      expect(rejectHandler).not.toHaveBeenCalled();

      delivery.off("response:reject", rejectHandler);
    });

    it("handles multiple concurrent timeouts independently", () => {
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ responseTimeoutMs: 1000 });

      registerTestClient("notebook");
      registerTestClient("terminal");
      const message = createTestMessage();
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      // Send to both clients
      delivery.sendToClients(["notebook", "terminal"], message);

      // Trigger timeout
      vi.advanceTimersByTime(1000);

      // Both should have timed out
      expect(rejectHandler).toHaveBeenCalledTimes(2);
      expect(rejectHandler).toHaveBeenCalledWith(message.id, "notebook", "Response timeout");
      expect(rejectHandler).toHaveBeenCalledWith(message.id, "terminal", "Response timeout");

      delivery.off("response:reject", rejectHandler);
    });

    it("clears timers on service reset", () => {
      resetMessageDelivery();
      delivery = initializeMessageDelivery({ responseTimeoutMs: 1000 });

      registerTestClient("notebook");
      const message = createTestMessage();
      const rejectHandler = vi.fn();
      delivery.on("response:reject", rejectHandler);

      delivery.sendToClient("notebook", message);

      // Reset the service (clears timers)
      resetMessageDelivery();

      // Re-initialize to set up the listener again
      delivery = initializeMessageDelivery({ responseTimeoutMs: 1000 });
      delivery.on("response:reject", rejectHandler);

      // Advance past the timeout - should not trigger since service was reset
      vi.advanceTimersByTime(2000);
      expect(rejectHandler).not.toHaveBeenCalled();

      delivery.off("response:reject", rejectHandler);
    });
  });
});
