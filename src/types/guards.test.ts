import { describe, it, expect } from "vitest";
import {
  isObject,
  isOneOf,
  isString,
  isArrayOf,
  validationOk,
  validationErr,
  makeError,
  validateClientRegistration,
  validateRoutedMessage,
  validateWebSocketMessage,
} from "./guards";
import type { ClientRegistration, RoutedMessage, WebSocketMessage } from "./messages";

describe("validation helpers", () => {
  it("isObject should distinguish objects from arrays, null, and primitives", () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
  });

  it("isOneOf should validate values against allowed list", () => {
    expect(isOneOf("a", ["a", "b"] as const)).toBe(true);
    expect(isOneOf("c", ["a", "b"] as const)).toBe(false);
  });

  it("isArrayOf should validate all array elements", () => {
    expect(isArrayOf(["a", "b"], isString)).toBe(true);
    expect(isArrayOf(["a", 1], isString)).toBe(false);
  });

  it("validation result helpers should create proper results", () => {
    const success = validationOk({ name: "test" });
    expect(success.success).toBe(true);

    const failure = validationErr([makeError("field", "Invalid", "bad")]);
    expect(failure.success).toBe(false);
    expect(failure.errors?.[0].path).toBe("field");
  });
});

describe("validateClientRegistration", () => {
  it("should validate complete and minimal registrations", () => {
    const full: ClientRegistration = {
      name: "test-client",
      description: "A test client",
      version: "1.0.0",
      capabilities: ["notes"],
    };
    expect(validateClientRegistration(full).success).toBe(true);
    expect(validateClientRegistration({ name: "client", description: "desc" }).success).toBe(true);
  });

  it("should fail for missing required fields", () => {
    const result = validateClientRegistration({});
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "name")).toBe(true);
    expect(result.errors?.some((e) => e.path === "description")).toBe(true);
  });

  it("should fail for invalid field types", () => {
    expect(
      validateClientRegistration({ name: "", description: "desc" }).errors?.some(
        (e) => e.path === "name"
      )
    ).toBe(true);
    expect(
      validateClientRegistration({ name: "x", description: "y", capabilities: "not-array" }).success
    ).toBe(false);
  });
});

describe("validateRoutedMessage", () => {
  const validMessage: RoutedMessage = {
    id: "msg-123" as any,
    text: "Hello",
    timestamp: "2024-01-01T00:00:00Z" as any,
    metadata: { inputMethod: "voice", directRouted: false },
  };

  it("should validate a complete valid message", () => {
    expect(validateRoutedMessage(validMessage).success).toBe(true);
  });

  it("should fail for missing required fields", () => {
    const result = validateRoutedMessage({});
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "id")).toBe(true);
    expect(result.errors?.some((e) => e.path === "metadata")).toBe(true);
  });

  it("should provide nested error paths for invalid metadata", () => {
    const result = validateRoutedMessage({
      ...validMessage,
      metadata: { inputMethod: "invalid", directRouted: "yes" },
    });
    expect(result.errors?.some((e) => e.path === "metadata.inputMethod")).toBe(true);
  });
});

describe("validateWebSocketMessage", () => {
  it("should validate all message types", () => {
    const registration: WebSocketMessage = {
      type: "registration",
      payload: { name: "client", description: "desc" },
    };
    expect(validateWebSocketMessage(registration).success).toBe(true);

    const response: WebSocketMessage = {
      type: "response",
      payload: { messageId: "msg-123" as any, type: "ack", payload: {} },
    };
    expect(validateWebSocketMessage(response).success).toBe(true);
  });

  it("should fail for invalid type or missing payload", () => {
    expect(validateWebSocketMessage({ type: "invalid", payload: {} }).success).toBe(false);
    expect(validateWebSocketMessage({ type: "registration" }).success).toBe(false);
  });

  it("should provide deeply nested error paths", () => {
    const result = validateWebSocketMessage({
      type: "message",
      payload: {
        id: "msg-1",
        text: "hello",
        timestamp: "2024-01-01T00:00:00Z",
        metadata: { inputMethod: "invalid", directRouted: "yes" },
      },
    });
    expect(result.errors?.some((e) => e.path === "payload.metadata.inputMethod")).toBe(true);
  });
});
