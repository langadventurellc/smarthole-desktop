import { describe, it, expect } from "vitest";
import {
  // Response type guards
  isRejectResponse,
  isNotificationResponse,
  isAckResponse,
  // WebSocket message type guards
  isWebSocketMessage,
  isRegistrationMessage,
  isRoutedMessage,
  isResponseMessage,
  // Types for testing
  type ClientRegistration,
  type RegisteredClient,
  type MessageMetadata,
  type RoutedMessage,
  type ClientResponse,
  type RejectPayload,
  type NotificationPayload,
  type WebSocketMessage,
  type WebSocketMessageType,
  type InputMethod,
  type ClientResponseType,
  type ClientNotificationPriority,
} from "./messages";
import { createMessageId, createClientId, createTimestamp } from "./common";

describe("ClientRegistration interface", () => {
  it("should accept valid registration with required fields", () => {
    const registration: ClientRegistration = {
      name: "notebook",
      description: "I handle note-taking and memory storage.",
    };
    expect(registration.name).toBe("notebook");
    expect(registration.description).toBe("I handle note-taking and memory storage.");
  });

  it("should accept registration with optional fields", () => {
    const registration: ClientRegistration = {
      name: "home-assistant",
      description: "I control smart home devices.",
      version: "2.1.0",
      capabilities: ["lights", "thermostat", "locks"],
    };
    expect(registration.version).toBe("2.1.0");
    expect(registration.capabilities).toEqual(["lights", "thermostat", "locks"]);
  });
});

describe("RegisteredClient interface", () => {
  it("should extend ClientRegistration with server metadata", () => {
    const client: RegisteredClient = {
      name: "notebook",
      description: "I handle note-taking.",
      id: createClientId("client-123"),
      connectedAt: createTimestamp(),
      status: "connected",
    };
    expect(client.name).toBe("notebook");
    expect(client.status).toBe("connected");
  });

  it("should accept both connected and disconnected status", () => {
    const connected: RegisteredClient = {
      name: "test",
      description: "test client",
      id: createClientId("c1"),
      connectedAt: createTimestamp(),
      status: "connected",
    };
    const disconnected: RegisteredClient = {
      ...connected,
      status: "disconnected",
    };
    expect(connected.status).toBe("connected");
    expect(disconnected.status).toBe("disconnected");
  });
});

describe("InputMethod type", () => {
  it("should only allow voice or text values", () => {
    const voice: InputMethod = "voice";
    const text: InputMethod = "text";
    expect(voice).toBe("voice");
    expect(text).toBe("text");

    // @ts-expect-error - 'keyboard' is not a valid InputMethod
    const _invalid: InputMethod = "keyboard";
    expect(_invalid).toBeDefined();
  });
});

describe("MessageMetadata interface", () => {
  it("should accept minimal metadata", () => {
    const metadata: MessageMetadata = {
      inputMethod: "voice",
      directRouted: false,
    };
    expect(metadata.inputMethod).toBe("voice");
    expect(metadata.directRouted).toBe(false);
  });

  it("should accept full metadata with optional fields", () => {
    const metadata: MessageMetadata = {
      confidence: 0.95,
      routingReason: "User mentioned notes",
      inputMethod: "voice",
      directRouted: false,
    };
    expect(metadata.confidence).toBe(0.95);
    expect(metadata.routingReason).toBe("User mentioned notes");
  });
});

describe("RoutedMessage interface", () => {
  it("should accept valid routed message", () => {
    const message: RoutedMessage = {
      id: createMessageId("msg-456"),
      text: "Remember to buy groceries",
      timestamp: createTimestamp(),
      metadata: {
        inputMethod: "voice",
        directRouted: false,
      },
    };
    expect(message.text).toBe("Remember to buy groceries");
  });

  it("should require all fields", () => {
    // This test verifies type safety - incomplete message shouldn't compile
    // @ts-expect-error - missing required fields
    const _incomplete: RoutedMessage = {
      id: createMessageId("msg-1"),
      text: "test",
    };
    expect(_incomplete).toBeDefined();
  });
});

describe("ClientResponseType type", () => {
  it("should only allow ack, reject, or notification", () => {
    const ack: ClientResponseType = "ack";
    const reject: ClientResponseType = "reject";
    const notification: ClientResponseType = "notification";

    expect(ack).toBe("ack");
    expect(reject).toBe("reject");
    expect(notification).toBe("notification");

    // @ts-expect-error - 'error' is not a valid ClientResponseType
    const _invalid: ClientResponseType = "error";
    expect(_invalid).toBeDefined();
  });
});

describe("ClientNotificationPriority type", () => {
  it("should only allow low, normal, or high", () => {
    const low: ClientNotificationPriority = "low";
    const normal: ClientNotificationPriority = "normal";
    const high: ClientNotificationPriority = "high";

    expect(low).toBe("low");
    expect(normal).toBe("normal");
    expect(high).toBe("high");

    // @ts-expect-error - 'urgent' is not a valid priority
    const _invalid: ClientNotificationPriority = "urgent";
    expect(_invalid).toBeDefined();
  });
});

describe("RejectPayload interface", () => {
  it("should accept empty payload", () => {
    const payload: RejectPayload = {};
    expect(payload).toEqual({});
  });

  it("should accept payload with reason", () => {
    const payload: RejectPayload = {
      reason: "I don't handle calendar events",
    };
    expect(payload.reason).toBe("I don't handle calendar events");
  });
});

describe("NotificationPayload interface", () => {
  it("should accept empty payload", () => {
    const payload: NotificationPayload = {};
    expect(payload).toEqual({});
  });

  it("should accept full payload", () => {
    const payload: NotificationPayload = {
      title: "Note saved",
      body: "Your note was saved successfully",
      priority: "high",
    };
    expect(payload.title).toBe("Note saved");
    expect(payload.body).toBe("Your note was saved successfully");
    expect(payload.priority).toBe("high");
  });
});

describe("ClientResponse interface", () => {
  it("should accept ack response with empty payload", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-123"),
      type: "ack",
      payload: {},
    };
    expect(response.type).toBe("ack");
  });

  it("should accept reject response with reason", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-123"),
      type: "reject",
      payload: { reason: "Cannot handle this" },
    };
    expect(response.type).toBe("reject");
  });

  it("should accept notification response with full payload", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-123"),
      type: "notification",
      payload: {
        title: "Done",
        body: "Task completed",
        priority: "normal",
      },
    };
    expect(response.type).toBe("notification");
  });
});

describe("isRejectResponse type guard", () => {
  it("should return true for reject responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "reject",
      payload: { reason: "Cannot process" },
    };
    expect(isRejectResponse(response)).toBe(true);
  });

  it("should return true for reject response with empty payload", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "reject",
      payload: {},
    };
    expect(isRejectResponse(response)).toBe(true);
  });

  it("should return false for ack responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "ack",
      payload: {},
    };
    expect(isRejectResponse(response)).toBe(false);
  });

  it("should return false for notification responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "notification",
      payload: { title: "Test" },
    };
    expect(isRejectResponse(response)).toBe(false);
  });

  it("should narrow the type when used as guard", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "reject",
      payload: { reason: "test reason" },
    };

    if (isRejectResponse(response)) {
      // TypeScript should know payload is RejectPayload here
      const reason: string | undefined = response.payload.reason;
      expect(reason).toBe("test reason");
    }
  });
});

describe("isNotificationResponse type guard", () => {
  it("should return true for notification responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "notification",
      payload: { title: "Alert", body: "Something happened" },
    };
    expect(isNotificationResponse(response)).toBe(true);
  });

  it("should return true for notification with empty payload", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "notification",
      payload: {},
    };
    expect(isNotificationResponse(response)).toBe(true);
  });

  it("should return true for notification with priority only", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "notification",
      payload: { priority: "high" },
    };
    expect(isNotificationResponse(response)).toBe(true);
  });

  it("should return false for ack responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "ack",
      payload: {},
    };
    expect(isNotificationResponse(response)).toBe(false);
  });

  it("should return false for reject responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "reject",
      payload: {},
    };
    expect(isNotificationResponse(response)).toBe(false);
  });

  it("should narrow the type when used as guard", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "notification",
      payload: { title: "Test", body: "Body text", priority: "high" },
    };

    if (isNotificationResponse(response)) {
      // TypeScript should know payload is NotificationPayload here
      const title: string | undefined = response.payload.title;
      const body: string | undefined = response.payload.body;
      const priority: "low" | "normal" | "high" | undefined = response.payload.priority;
      expect(title).toBe("Test");
      expect(body).toBe("Body text");
      expect(priority).toBe("high");
    }
  });
});

describe("isAckResponse type guard", () => {
  it("should return true for ack responses with empty payload", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "ack",
      payload: {},
    };
    expect(isAckResponse(response)).toBe(true);
  });

  it("should return false for reject responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "reject",
      payload: {},
    };
    expect(isAckResponse(response)).toBe(false);
  });

  it("should return false for notification responses", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "notification",
      payload: {},
    };
    expect(isAckResponse(response)).toBe(false);
  });

  it("should return false for ack with non-empty payload", () => {
    // This tests runtime validation - payload should be empty for ack
    // We cast through unknown to simulate malformed data at runtime
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "ack",
      payload: { reason: "unexpected" } as unknown as Record<string, never>,
    };
    expect(isAckResponse(response)).toBe(false);
  });

  it("should narrow the type when used as guard", () => {
    const response: ClientResponse = {
      messageId: createMessageId("msg-1"),
      type: "ack",
      payload: {},
    };

    if (isAckResponse(response)) {
      // TypeScript should know this is an ack response
      expect(response.type).toBe("ack");
      expect(Object.keys(response.payload)).toHaveLength(0);
    }
  });
});

describe("WebSocketMessage type", () => {
  it("should accept registration message", () => {
    const msg: WebSocketMessage = {
      type: "registration",
      payload: {
        name: "test",
        description: "Test client",
      },
    };
    expect(msg.type).toBe("registration");
  });

  it("should accept routed message", () => {
    const msg: WebSocketMessage = {
      type: "message",
      payload: {
        id: createMessageId("msg-1"),
        text: "Hello",
        timestamp: createTimestamp(),
        metadata: {
          inputMethod: "text",
          directRouted: false,
        },
      },
    };
    expect(msg.type).toBe("message");
  });

  it("should accept response message", () => {
    const msg: WebSocketMessage = {
      type: "response",
      payload: {
        messageId: createMessageId("msg-1"),
        type: "ack",
        payload: {},
      },
    };
    expect(msg.type).toBe("response");
  });
});

describe("isWebSocketMessage type guard", () => {
  it("should return true for valid registration message", () => {
    const msg = {
      type: "registration",
      payload: { name: "test", description: "Test" },
    };
    expect(isWebSocketMessage(msg)).toBe(true);
  });

  it("should return true for valid message type", () => {
    const msg = {
      type: "message",
      payload: {
        id: "msg-1",
        text: "Hello",
        timestamp: "2024-01-01T00:00:00.000Z",
        metadata: { inputMethod: "text", directRouted: false },
      },
    };
    expect(isWebSocketMessage(msg)).toBe(true);
  });

  it("should return true for valid response type", () => {
    const msg = {
      type: "response",
      payload: { messageId: "msg-1", type: "ack", payload: {} },
    };
    expect(isWebSocketMessage(msg)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isWebSocketMessage(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isWebSocketMessage(undefined)).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isWebSocketMessage("string")).toBe(false);
    expect(isWebSocketMessage(123)).toBe(false);
    expect(isWebSocketMessage(true)).toBe(false);
  });

  it("should return false for objects without type", () => {
    expect(isWebSocketMessage({ payload: {} })).toBe(false);
  });

  it("should return false for objects without payload", () => {
    expect(isWebSocketMessage({ type: "registration" })).toBe(false);
  });

  it("should return false for invalid type values", () => {
    expect(isWebSocketMessage({ type: "invalid", payload: {} })).toBe(false);
    expect(isWebSocketMessage({ type: "error", payload: {} })).toBe(false);
  });

  it("should return false for non-string type", () => {
    expect(isWebSocketMessage({ type: 123, payload: {} })).toBe(false);
  });
});

describe("isRegistrationMessage type guard", () => {
  it("should return true for registration messages", () => {
    const msg: WebSocketMessage = {
      type: "registration",
      payload: { name: "test", description: "Test" },
    };
    expect(isRegistrationMessage(msg)).toBe(true);
  });

  it("should return false for other message types", () => {
    const routedMsg: WebSocketMessage = {
      type: "message",
      payload: {
        id: createMessageId("msg-1"),
        text: "Hello",
        timestamp: createTimestamp(),
        metadata: { inputMethod: "text", directRouted: false },
      },
    };
    const responseMsg: WebSocketMessage = {
      type: "response",
      payload: { messageId: createMessageId("msg-1"), type: "ack", payload: {} },
    };

    expect(isRegistrationMessage(routedMsg)).toBe(false);
    expect(isRegistrationMessage(responseMsg)).toBe(false);
  });

  it("should narrow type to WebSocketRegistrationMessage", () => {
    const msg: WebSocketMessage = {
      type: "registration",
      payload: { name: "notebook", description: "Takes notes" },
    };

    if (isRegistrationMessage(msg)) {
      // TypeScript should know payload is ClientRegistration
      expect(msg.payload.name).toBe("notebook");
      expect(msg.payload.description).toBe("Takes notes");
    }
  });
});

describe("isRoutedMessage type guard", () => {
  it("should return true for routed messages", () => {
    const msg: WebSocketMessage = {
      type: "message",
      payload: {
        id: createMessageId("msg-1"),
        text: "Test message",
        timestamp: createTimestamp(),
        metadata: { inputMethod: "voice", directRouted: false },
      },
    };
    expect(isRoutedMessage(msg)).toBe(true);
  });

  it("should return false for other message types", () => {
    const regMsg: WebSocketMessage = {
      type: "registration",
      payload: { name: "test", description: "Test" },
    };
    const responseMsg: WebSocketMessage = {
      type: "response",
      payload: { messageId: createMessageId("msg-1"), type: "ack", payload: {} },
    };

    expect(isRoutedMessage(regMsg)).toBe(false);
    expect(isRoutedMessage(responseMsg)).toBe(false);
  });

  it("should narrow type to WebSocketRoutedMessage", () => {
    const msg: WebSocketMessage = {
      type: "message",
      payload: {
        id: createMessageId("msg-123"),
        text: "Remember this",
        timestamp: createTimestamp(),
        metadata: { inputMethod: "voice", directRouted: true },
      },
    };

    if (isRoutedMessage(msg)) {
      // TypeScript should know payload is RoutedMessage
      expect(msg.payload.text).toBe("Remember this");
      expect(msg.payload.metadata.directRouted).toBe(true);
    }
  });
});

describe("isResponseMessage type guard", () => {
  it("should return true for response messages", () => {
    const msg: WebSocketMessage = {
      type: "response",
      payload: {
        messageId: createMessageId("msg-1"),
        type: "ack",
        payload: {},
      },
    };
    expect(isResponseMessage(msg)).toBe(true);
  });

  it("should return false for other message types", () => {
    const regMsg: WebSocketMessage = {
      type: "registration",
      payload: { name: "test", description: "Test" },
    };
    const routedMsg: WebSocketMessage = {
      type: "message",
      payload: {
        id: createMessageId("msg-1"),
        text: "Hello",
        timestamp: createTimestamp(),
        metadata: { inputMethod: "text", directRouted: false },
      },
    };

    expect(isResponseMessage(regMsg)).toBe(false);
    expect(isResponseMessage(routedMsg)).toBe(false);
  });

  it("should narrow type to WebSocketResponseMessage", () => {
    const msg: WebSocketMessage = {
      type: "response",
      payload: {
        messageId: createMessageId("msg-456"),
        type: "notification",
        payload: { title: "Done", priority: "high" },
      },
    };

    if (isResponseMessage(msg)) {
      // TypeScript should know payload is ClientResponse
      expect(msg.payload.type).toBe("notification");
    }
  });
});

describe("Type-level constraints", () => {
  it("should not allow invalid message types in WebSocketMessage", () => {
    // Verify that 'error' is not a valid WebSocketMessage type
    // This would cause a compile error if we tried to use it directly
    const invalidType = "error";
    // @ts-expect-error - 'error' is not assignable to WebSocketMessageType
    const _typeCheck: WebSocketMessageType = invalidType;
    expect(_typeCheck).toBeDefined();
  });

  it("should not allow mismatched type and payload", () => {
    // Verify discriminated union enforces correct payload for each type
    // Registration type requires name and description, not RoutedMessage fields
    const routedPayload = {
      id: createMessageId("msg-1"),
      text: "Hello",
      timestamp: createTimestamp(),
      metadata: { inputMethod: "text" as const, directRouted: false },
    };
    // @ts-expect-error - RoutedMessage payload not assignable to ClientRegistration
    const _invalid: WebSocketMessage = { type: "registration", payload: routedPayload };
    expect(_invalid).toBeDefined();
  });

  it("should require messageId to be MessageId type in ClientResponse", () => {
    const plainString = "plain-string-id";
    // @ts-expect-error - plain string not assignable to MessageId
    const _invalidId: ClientResponse["messageId"] = plainString;
    expect(_invalidId).toBeDefined();
  });

  it("should require id to be MessageId type in RoutedMessage", () => {
    const plainString = "plain-string-id";
    // @ts-expect-error - plain string not assignable to MessageId
    const _invalidId: RoutedMessage["id"] = plainString;
    expect(_invalidId).toBeDefined();
  });

  it("should require timestamp to be ISOTimestamp type in RoutedMessage", () => {
    const plainString = "2024-01-01";
    // @ts-expect-error - plain string not assignable to ISOTimestamp
    const _invalidTimestamp: RoutedMessage["timestamp"] = plainString;
    expect(_invalidTimestamp).toBeDefined();
  });
});
