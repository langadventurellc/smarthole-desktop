import { describe, it, expect } from "vitest";
import {
  // Generic validation helpers
  isObject,
  isOneOf,
  isString,
  isNonEmptyStringRaw,
  isNumber,
  isBoolean,
  isArray,
  isArrayOf,
  isOptional,
  // Validation result types and helpers
  type ValidationError,
  type ValidationResult,
  validationOk,
  validationErr,
  makeError,
  // Detailed validation functions
  validateClientRegistration,
  validateMessageMetadata,
  validateRoutedMessage,
  validateClientResponse,
  validateWebSocketMessage,
} from "./guards";
import type {
  ClientRegistration,
  RoutedMessage,
  ClientResponse,
  WebSocketMessage,
  MessageMetadata,
} from "./messages";

// ============================================================================
// Generic Validation Helpers Tests
// ============================================================================

describe("isObject", () => {
  it("should return true for plain objects", () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: "value" })).toBe(true);
    expect(isObject({ nested: { deep: true } })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isObject(null)).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isObject(undefined)).toBe(false);
    expect(isObject("string")).toBe(false);
    expect(isObject(123)).toBe(false);
    expect(isObject(true)).toBe(false);
  });

  it("should narrow the type correctly", () => {
    const value: unknown = { key: "value" };
    if (isObject(value)) {
      // TypeScript should allow accessing properties
      const _key = value.key;
      expect(_key).toBe("value");
    }
  });
});

describe("isOneOf", () => {
  const validValues = ["a", "b", "c"] as const;

  it("should return true for values in the allowed list", () => {
    expect(isOneOf("a", validValues)).toBe(true);
    expect(isOneOf("b", validValues)).toBe(true);
    expect(isOneOf("c", validValues)).toBe(true);
  });

  it("should return false for values not in the allowed list", () => {
    expect(isOneOf("d", validValues)).toBe(false);
    expect(isOneOf("A", validValues)).toBe(false); // Case sensitive
    expect(isOneOf("", validValues)).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isOneOf(123, validValues)).toBe(false);
    expect(isOneOf(null, validValues)).toBe(false);
    expect(isOneOf(undefined, validValues)).toBe(false);
  });

  it("should narrow the type correctly", () => {
    const value: unknown = "a";
    if (isOneOf(value, validValues)) {
      const _narrowed: "a" | "b" | "c" = value;
      expect(_narrowed).toBe("a");
    }
  });
});

describe("isString", () => {
  it("should return true for strings", () => {
    expect(isString("")).toBe(true);
    expect(isString("hello")).toBe(true);
    expect(isString("   ")).toBe(true);
  });

  it("should return false for non-strings", () => {
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString({})).toBe(false);
    expect(isString([])).toBe(false);
  });
});

describe("isNonEmptyStringRaw", () => {
  it("should return true for non-empty strings", () => {
    expect(isNonEmptyStringRaw("hello")).toBe(true);
    expect(isNonEmptyStringRaw("a")).toBe(true);
    expect(isNonEmptyStringRaw("   ")).toBe(true); // Note: doesn't trim
  });

  it("should return false for empty strings", () => {
    expect(isNonEmptyStringRaw("")).toBe(false);
  });

  it("should return false for non-strings", () => {
    expect(isNonEmptyStringRaw(123)).toBe(false);
    expect(isNonEmptyStringRaw(null)).toBe(false);
    expect(isNonEmptyStringRaw(undefined)).toBe(false);
  });
});

describe("isNumber", () => {
  it("should return true for valid numbers", () => {
    expect(isNumber(0)).toBe(true);
    expect(isNumber(42)).toBe(true);
    expect(isNumber(-123)).toBe(true);
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber(Infinity)).toBe(true);
    expect(isNumber(-Infinity)).toBe(true);
  });

  it("should return false for NaN", () => {
    expect(isNumber(NaN)).toBe(false);
  });

  it("should return false for non-numbers", () => {
    expect(isNumber("123")).toBe(false);
    expect(isNumber(null)).toBe(false);
    expect(isNumber(undefined)).toBe(false);
  });
});

describe("isBoolean", () => {
  it("should return true for booleans", () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
  });

  it("should return false for non-booleans", () => {
    expect(isBoolean(0)).toBe(false);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean("true")).toBe(false);
    expect(isBoolean(null)).toBe(false);
    expect(isBoolean(undefined)).toBe(false);
  });
});

describe("isArray", () => {
  it("should return true for arrays", () => {
    expect(isArray([])).toBe(true);
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray(["a", "b"])).toBe(true);
    expect(isArray([{ key: "value" }])).toBe(true);
  });

  it("should return false for non-arrays", () => {
    expect(isArray({})).toBe(false);
    expect(isArray("array")).toBe(false);
    expect(isArray(null)).toBe(false);
    expect(isArray(undefined)).toBe(false);
  });
});

describe("isArrayOf", () => {
  it("should return true for arrays where all elements pass the guard", () => {
    expect(isArrayOf(["a", "b", "c"], isString)).toBe(true);
    expect(isArrayOf([1, 2, 3], isNumber)).toBe(true);
    expect(isArrayOf([], isString)).toBe(true); // Empty array passes
  });

  it("should return false if any element fails the guard", () => {
    expect(isArrayOf(["a", 1, "c"], isString)).toBe(false);
    expect(isArrayOf([1, "2", 3], isNumber)).toBe(false);
  });

  it("should return false for non-arrays", () => {
    expect(isArrayOf({}, isString)).toBe(false);
    expect(isArrayOf("string", isString)).toBe(false);
    expect(isArrayOf(null, isString)).toBe(false);
  });

  it("should narrow the type correctly", () => {
    const value: unknown = ["a", "b", "c"];
    if (isArrayOf(value, isString)) {
      const _arr: string[] = value;
      expect(_arr.length).toBe(3);
    }
  });
});

describe("isOptional", () => {
  it("should return true for undefined", () => {
    expect(isOptional(undefined, isString)).toBe(true);
    expect(isOptional(undefined, isNumber)).toBe(true);
  });

  it("should return true when value passes the guard", () => {
    expect(isOptional("hello", isString)).toBe(true);
    expect(isOptional(42, isNumber)).toBe(true);
  });

  it("should return false when value is defined but fails guard", () => {
    expect(isOptional(123, isString)).toBe(false);
    expect(isOptional("hello", isNumber)).toBe(false);
  });

  it("should return false for null (null is not undefined)", () => {
    expect(isOptional(null, isString)).toBe(false);
  });
});

// ============================================================================
// Validation Result Helper Tests
// ============================================================================

describe("validationOk", () => {
  it("should create a successful result", () => {
    const result = validationOk({ name: "test" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "test" });
    expect(result.errors).toBeUndefined();
  });
});

describe("validationErr", () => {
  it("should create a failed result", () => {
    const errors = [makeError("field", "Invalid", "bad")];
    const result = validationErr<string>(errors);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.errors).toEqual(errors);
  });
});

describe("makeError", () => {
  it("should create a validation error object", () => {
    const error = makeError("user.name", "Expected a string", 123);
    expect(error.path).toBe("user.name");
    expect(error.message).toBe("Expected a string");
    expect(error.received).toBe(123);
  });
});

// ============================================================================
// validateClientRegistration Tests
// ============================================================================

describe("validateClientRegistration", () => {
  const validRegistration: ClientRegistration = {
    name: "test-client",
    description: "A test client",
    version: "1.0.0",
    capabilities: ["notes", "reminders"],
  };

  it("should validate a complete valid registration", () => {
    const result = validateClientRegistration(validRegistration);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validRegistration);
  });

  it("should validate a minimal valid registration", () => {
    const minimal = { name: "client", description: "desc" };
    const result = validateClientRegistration(minimal);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(minimal);
  });

  it("should fail for non-object values", () => {
    expect(validateClientRegistration(null).success).toBe(false);
    expect(validateClientRegistration("string").success).toBe(false);
    expect(validateClientRegistration([]).success).toBe(false);
  });

  it("should fail for missing required fields", () => {
    const result = validateClientRegistration({});
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBe(2);
    expect(result.errors?.some((e) => e.path === "name")).toBe(true);
    expect(result.errors?.some((e) => e.path === "description")).toBe(true);
  });

  it("should fail for empty name", () => {
    const result = validateClientRegistration({ name: "", description: "desc" });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "name")).toBe(true);
  });

  it("should fail for invalid version type", () => {
    const result = validateClientRegistration({
      name: "client",
      description: "desc",
      version: 123,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "version")).toBe(true);
  });

  it("should fail for invalid capabilities type", () => {
    const result = validateClientRegistration({
      name: "client",
      description: "desc",
      capabilities: "not-an-array",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "capabilities")).toBe(true);
  });

  it("should fail for invalid capability items", () => {
    const result = validateClientRegistration({
      name: "client",
      description: "desc",
      capabilities: ["valid", 123, "also-valid"],
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "capabilities[1]")).toBe(true);
  });

  it("should provide detailed error information", () => {
    const result = validateClientRegistration({ name: 123, description: null });
    expect(result.success).toBe(false);
    const nameError = result.errors?.find((e) => e.path === "name");
    expect(nameError?.message).toBe("Expected a non-empty string");
    expect(nameError?.received).toBe(123);
  });
});

// ============================================================================
// validateMessageMetadata Tests
// ============================================================================

describe("validateMessageMetadata", () => {
  const validMetadata: MessageMetadata = {
    inputMethod: "voice",
    directRouted: false,
    confidence: 0.95,
    routingReason: "User asked about notes",
  };

  it("should validate complete valid metadata", () => {
    const result = validateMessageMetadata(validMetadata);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validMetadata);
  });

  it("should validate minimal valid metadata", () => {
    const minimal = { inputMethod: "text", directRouted: true };
    const result = validateMessageMetadata(minimal);
    expect(result.success).toBe(true);
  });

  it("should fail for non-object values", () => {
    expect(validateMessageMetadata(null).success).toBe(false);
    expect(validateMessageMetadata("string").success).toBe(false);
  });

  it("should fail for invalid inputMethod", () => {
    const result = validateMessageMetadata({
      inputMethod: "invalid",
      directRouted: true,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "inputMethod")).toBe(true);
  });

  it("should fail for invalid directRouted", () => {
    const result = validateMessageMetadata({
      inputMethod: "voice",
      directRouted: "yes",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "directRouted")).toBe(true);
  });

  it("should fail for invalid optional confidence", () => {
    const result = validateMessageMetadata({
      inputMethod: "voice",
      directRouted: true,
      confidence: "high",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "confidence")).toBe(true);
  });

  it("should use path prefix for nested validation", () => {
    const result = validateMessageMetadata({ inputMethod: "invalid" }, "metadata");
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "metadata.inputMethod")).toBe(true);
    expect(result.errors?.some((e) => e.path === "metadata.directRouted")).toBe(true);
  });
});

// ============================================================================
// validateRoutedMessage Tests
// ============================================================================

describe("validateRoutedMessage", () => {
  const validMessage: RoutedMessage = {
    id: "msg-123" as any,
    text: "Remember to buy groceries",
    timestamp: "2024-01-15T10:30:00.000Z" as any,
    metadata: {
      inputMethod: "voice",
      directRouted: false,
      confidence: 0.95,
      routingReason: "User wants to remember something",
    },
  };

  it("should validate a complete valid message", () => {
    const result = validateRoutedMessage(validMessage);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validMessage);
  });

  it("should fail for non-object values", () => {
    expect(validateRoutedMessage(null).success).toBe(false);
    expect(validateRoutedMessage([]).success).toBe(false);
  });

  it("should fail for missing required fields", () => {
    const result = validateRoutedMessage({});
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "id")).toBe(true);
    expect(result.errors?.some((e) => e.path === "text")).toBe(true);
    expect(result.errors?.some((e) => e.path === "timestamp")).toBe(true);
    expect(result.errors?.some((e) => e.path === "metadata")).toBe(true);
  });

  it("should fail for invalid metadata structure", () => {
    const result = validateRoutedMessage({
      id: "msg-1",
      text: "hello",
      timestamp: "2024-01-01T00:00:00Z",
      metadata: { inputMethod: "invalid", directRouted: "yes" },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "metadata.inputMethod")).toBe(true);
    expect(result.errors?.some((e) => e.path === "metadata.directRouted")).toBe(true);
  });

  it("should provide nested error paths", () => {
    const result = validateRoutedMessage({
      id: "msg-1",
      text: "hello",
      timestamp: "2024-01-01T00:00:00Z",
      metadata: { inputMethod: "voice", directRouted: true, confidence: "high" },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "metadata.confidence")).toBe(true);
  });
});

// ============================================================================
// validateClientResponse Tests
// ============================================================================

describe("validateClientResponse", () => {
  const validResponse: ClientResponse = {
    messageId: "msg-123" as any,
    type: "ack",
    payload: {},
  };

  it("should validate a valid ack response", () => {
    const result = validateClientResponse(validResponse);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validResponse);
  });

  it("should validate a valid reject response", () => {
    const reject = {
      messageId: "msg-123",
      type: "reject",
      payload: { reason: "Cannot handle this" },
    };
    const result = validateClientResponse(reject);
    expect(result.success).toBe(true);
  });

  it("should validate a valid notification response", () => {
    const notification = {
      messageId: "msg-123",
      type: "notification",
      payload: { title: "Success", body: "Your note was saved" },
    };
    const result = validateClientResponse(notification);
    expect(result.success).toBe(true);
  });

  it("should fail for non-object values", () => {
    expect(validateClientResponse(null).success).toBe(false);
    expect(validateClientResponse("string").success).toBe(false);
  });

  it("should fail for invalid type", () => {
    const result = validateClientResponse({
      messageId: "msg-123",
      type: "invalid",
      payload: {},
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "type")).toBe(true);
  });

  it("should fail for non-object payload", () => {
    const result = validateClientResponse({
      messageId: "msg-123",
      type: "ack",
      payload: "invalid",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "payload")).toBe(true);
  });

  it("should collect multiple errors", () => {
    const result = validateClientResponse({});
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBe(3);
    expect(result.errors?.some((e) => e.path === "messageId")).toBe(true);
    expect(result.errors?.some((e) => e.path === "type")).toBe(true);
    expect(result.errors?.some((e) => e.path === "payload")).toBe(true);
  });
});

// ============================================================================
// validateWebSocketMessage Tests
// ============================================================================

describe("validateWebSocketMessage", () => {
  const validRegistrationMessage: WebSocketMessage = {
    type: "registration",
    payload: {
      name: "test-client",
      description: "A test client",
    },
  };

  const validRoutedMessage: WebSocketMessage = {
    type: "message",
    payload: {
      id: "msg-123" as any,
      text: "Hello",
      timestamp: "2024-01-01T00:00:00Z" as any,
      metadata: {
        inputMethod: "text",
        directRouted: false,
      },
    },
  };

  const validResponseMessage: WebSocketMessage = {
    type: "response",
    payload: {
      messageId: "msg-123" as any,
      type: "ack",
      payload: {},
    },
  };

  it("should validate a registration message", () => {
    const result = validateWebSocketMessage(validRegistrationMessage);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validRegistrationMessage);
  });

  it("should validate a routed message", () => {
    const result = validateWebSocketMessage(validRoutedMessage);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validRoutedMessage);
  });

  it("should validate a response message", () => {
    const result = validateWebSocketMessage(validResponseMessage);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validResponseMessage);
  });

  it("should fail for non-object values", () => {
    expect(validateWebSocketMessage(null).success).toBe(false);
    expect(validateWebSocketMessage([]).success).toBe(false);
    expect(validateWebSocketMessage("string").success).toBe(false);
  });

  it("should fail for invalid type", () => {
    const result = validateWebSocketMessage({ type: "invalid", payload: {} });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "type")).toBe(true);
  });

  it("should fail for missing payload", () => {
    const result = validateWebSocketMessage({ type: "registration" });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "payload")).toBe(true);
  });

  it("should fail for invalid registration payload", () => {
    const result = validateWebSocketMessage({
      type: "registration",
      payload: { name: "", description: 123 },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "payload.name")).toBe(true);
    expect(result.errors?.some((e) => e.path === "payload.description")).toBe(true);
  });

  it("should fail for invalid routed message payload", () => {
    const result = validateWebSocketMessage({
      type: "message",
      payload: { id: 123, text: null },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "payload.id")).toBe(true);
    expect(result.errors?.some((e) => e.path === "payload.text")).toBe(true);
  });

  it("should fail for invalid response payload", () => {
    const result = validateWebSocketMessage({
      type: "response",
      payload: { messageId: null, type: "invalid" },
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "payload.messageId")).toBe(true);
    expect(result.errors?.some((e) => e.path === "payload.type")).toBe(true);
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
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.path === "payload.metadata.inputMethod")).toBe(true);
    expect(result.errors?.some((e) => e.path === "payload.metadata.directRouted")).toBe(true);
  });
});

// ============================================================================
// Type-level Constraint Tests
// ============================================================================

describe("Type-level constraints", () => {
  it("ValidationResult should have correct structure based on success", () => {
    const successResult: ValidationResult<string> = { success: true, data: "test" };
    const failResult: ValidationResult<string> = {
      success: false,
      errors: [{ path: "", message: "Error", received: null }],
    };

    if (successResult.success) {
      const _data: string | undefined = successResult.data;
      expect(_data).toBe("test");
    }

    if (!failResult.success) {
      const _errors: ValidationError[] | undefined = failResult.errors;
      expect(_errors?.length).toBe(1);
    }
  });

  it("ValidationError should have required fields", () => {
    const error: ValidationError = {
      path: "field.nested",
      message: "Invalid value",
      received: { bad: "data" },
    };

    expect(error.path).toBe("field.nested");
    expect(error.message).toBe("Invalid value");
    expect(error.received).toEqual({ bad: "data" });
  });
});
