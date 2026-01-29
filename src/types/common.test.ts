import { describe, it, expect } from "vitest";
import {
  // Result types and helpers
  ok,
  err,
  type Result,
  // Branded ID types and functions
  createMessageId,
  createClientId,
  isMessageId,
  isClientId,
  type MessageId,
  type ClientId,
  // Timestamp types and functions
  createTimestamp,
  isISOTimestamp,
  parseTimestamp,
  type ISOTimestamp,
  // NonEmptyString types and functions
  createNonEmptyString,
  isNonEmptyString,
  type NonEmptyString,
} from "./common";

describe("Result type", () => {
  describe("ok helper", () => {
    it("should create a success result with the provided value", () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it("should work with complex objects", () => {
      const data = { name: "test", count: 5 };
      const result = ok(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(data);
      }
    });
  });

  describe("err helper", () => {
    it("should create an error result with the provided error", () => {
      const result = err("Something went wrong");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Something went wrong");
      }
    });

    it("should work with Error objects", () => {
      const error = new Error("Test error");
      const result = err(error);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe("type narrowing", () => {
    it("should allow type narrowing based on success property", () => {
      const successResult: Result<number, string> = ok(42);
      const errorResult: Result<number, string> = err("error");

      if (successResult.success) {
        // TypeScript should know value exists here
        const _value: number = successResult.value;
        expect(_value).toBe(42);
      }

      if (!errorResult.success) {
        // TypeScript should know error exists here
        const _error: string = errorResult.error;
        expect(_error).toBe("error");
      }
    });
  });
});

describe("MessageId", () => {
  describe("createMessageId", () => {
    it("should create a MessageId from a string", () => {
      const id = createMessageId("msg-123");
      expect(id).toBe("msg-123");
    });

    it("should create a MessageId from a UUID-like string", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const id = createMessageId(uuid);
      expect(id).toBe(uuid);
    });
  });

  describe("isMessageId", () => {
    it("should return true for non-empty strings", () => {
      expect(isMessageId("msg-123")).toBe(true);
      expect(isMessageId("a")).toBe(true);
    });

    it("should return false for empty strings", () => {
      expect(isMessageId("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isMessageId(123)).toBe(false);
      expect(isMessageId(null)).toBe(false);
      expect(isMessageId(undefined)).toBe(false);
      expect(isMessageId({})).toBe(false);
      expect(isMessageId([])).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "msg-123";
      if (isMessageId(value)) {
        // TypeScript should know this is MessageId
        const _id: MessageId = value;
        expect(_id).toBe("msg-123");
      }
    });
  });
});

describe("ClientId", () => {
  describe("createClientId", () => {
    it("should create a ClientId from a string", () => {
      const id = createClientId("client-456");
      expect(id).toBe("client-456");
    });
  });

  describe("isClientId", () => {
    it("should return true for non-empty strings", () => {
      expect(isClientId("client-456")).toBe(true);
    });

    it("should return false for empty strings", () => {
      expect(isClientId("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isClientId(123)).toBe(false);
      expect(isClientId(null)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "client-456";
      if (isClientId(value)) {
        const _id: ClientId = value;
        expect(_id).toBe("client-456");
      }
    });
  });
});

describe("ISOTimestamp", () => {
  describe("createTimestamp", () => {
    it("should create a timestamp from the current time when no date provided", () => {
      const before = new Date();
      const timestamp = createTimestamp();
      const after = new Date();

      const parsedTime = new Date(timestamp).getTime();
      expect(parsedTime).toBeGreaterThanOrEqual(before.getTime());
      expect(parsedTime).toBeLessThanOrEqual(after.getTime());
    });

    it("should create a timestamp from a provided date", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const timestamp = createTimestamp(date);
      expect(timestamp).toBe("2024-01-15T10:30:00.000Z");
    });

    it("should produce valid ISO 8601 format", () => {
      const timestamp = createTimestamp();
      expect(isISOTimestamp(timestamp)).toBe(true);
    });
  });

  describe("isISOTimestamp", () => {
    it("should return true for valid ISO 8601 timestamps", () => {
      expect(isISOTimestamp("2024-01-15T10:30:00.000Z")).toBe(true);
      expect(isISOTimestamp("2024-12-31T23:59:59.999Z")).toBe(true);
    });

    it("should return true for timestamps without milliseconds", () => {
      expect(isISOTimestamp("2024-01-15T10:30:00Z")).toBe(true);
    });

    it("should return false for invalid formats", () => {
      expect(isISOTimestamp("2024-01-15")).toBe(false);
      expect(isISOTimestamp("2024/01/15T10:30:00Z")).toBe(false);
      expect(isISOTimestamp("not a timestamp")).toBe(false);
      expect(isISOTimestamp("")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isISOTimestamp(123)).toBe(false);
      expect(isISOTimestamp(null)).toBe(false);
      expect(isISOTimestamp(new Date())).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "2024-01-15T10:30:00.000Z";
      if (isISOTimestamp(value)) {
        const _timestamp: ISOTimestamp = value;
        expect(_timestamp).toBe("2024-01-15T10:30:00.000Z");
      }
    });
  });

  describe("parseTimestamp", () => {
    it("should parse an ISOTimestamp into a Date", () => {
      const timestamp = createTimestamp(new Date("2024-01-15T10:30:00.000Z"));
      const parsed = parseTimestamp(timestamp);
      expect(parsed.toISOString()).toBe("2024-01-15T10:30:00.000Z");
    });
  });
});

describe("NonEmptyString", () => {
  describe("createNonEmptyString", () => {
    it("should create a NonEmptyString from a valid string", () => {
      const result = createNonEmptyString("hello");
      expect(result).toBe("hello");
    });

    it("should trim whitespace from the string", () => {
      const result = createNonEmptyString("  hello  ");
      expect(result).toBe("hello");
    });

    it("should return null for empty strings", () => {
      const result = createNonEmptyString("");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only strings", () => {
      expect(createNonEmptyString("   ")).toBeNull();
      expect(createNonEmptyString("\t")).toBeNull();
      expect(createNonEmptyString("\n")).toBeNull();
      expect(createNonEmptyString("  \t\n  ")).toBeNull();
    });
  });

  describe("isNonEmptyString", () => {
    it("should return true for non-empty strings", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("a")).toBe(true);
    });

    it("should return true for strings with leading/trailing whitespace", () => {
      // The type guard checks if the trimmed string is non-empty
      expect(isNonEmptyString("  hello  ")).toBe(true);
    });

    it("should return false for empty strings", () => {
      expect(isNonEmptyString("")).toBe(false);
    });

    it("should return false for whitespace-only strings", () => {
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString("\t")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
    });

    it("should narrow the type when used as a guard", () => {
      const value: unknown = "hello";
      if (isNonEmptyString(value)) {
        const _str: NonEmptyString = value;
        expect(_str).toBe("hello");
      }
    });
  });
});

describe("Type-level constraints", () => {
  it("should not allow assigning MessageId to ClientId", () => {
    const messageId = createMessageId("msg-1");
    const clientId = createClientId("client-1");

    // These lines verify that the types are different at compile time
    // @ts-expect-error - MessageId should not be assignable to ClientId
    const _wrongAssignment1: ClientId = messageId;

    // @ts-expect-error - ClientId should not be assignable to MessageId
    const _wrongAssignment2: MessageId = clientId;

    // Suppress unused variable warnings
    expect(_wrongAssignment1).toBeDefined();
    expect(_wrongAssignment2).toBeDefined();
  });

  it("should not allow plain strings to be assigned to branded types", () => {
    const plainString = "some-id";

    // @ts-expect-error - plain string should not be assignable to MessageId
    const _wrongMessageId: MessageId = plainString;

    // @ts-expect-error - plain string should not be assignable to ClientId
    const _wrongClientId: ClientId = plainString;

    // @ts-expect-error - plain string should not be assignable to ISOTimestamp
    const _wrongTimestamp: ISOTimestamp = plainString;

    // @ts-expect-error - plain string should not be assignable to NonEmptyString
    const _wrongNonEmpty: NonEmptyString = plainString;

    // Suppress unused variable warnings
    expect(_wrongMessageId).toBeDefined();
    expect(_wrongClientId).toBeDefined();
    expect(_wrongTimestamp).toBeDefined();
    expect(_wrongNonEmpty).toBeDefined();
  });
});
