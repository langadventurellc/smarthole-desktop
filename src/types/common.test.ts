import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  isMessageId,
  isISOTimestamp,
  createNonEmptyString,
  isNonEmptyString,
} from "./common";

describe("Result type helpers", () => {
  it("should create success and error results", () => {
    const success = ok(42);
    expect(success.success).toBe(true);
    if (success.success) expect(success.value).toBe(42);

    const failure = err("Something went wrong");
    expect(failure.success).toBe(false);
    if (!failure.success) expect(failure.error).toBe("Something went wrong");
  });
});

describe("isMessageId", () => {
  it("should validate message IDs correctly", () => {
    expect(isMessageId("msg-123")).toBe(true);
    expect(isMessageId("")).toBe(false);
    expect(isMessageId(123)).toBe(false);
    expect(isMessageId(null)).toBe(false);
  });
});

describe("isISOTimestamp", () => {
  it("should validate ISO 8601 timestamps", () => {
    expect(isISOTimestamp("2024-01-15T10:30:00.000Z")).toBe(true);
    expect(isISOTimestamp("2024-01-15T10:30:00Z")).toBe(true);
    expect(isISOTimestamp("2024-01-15")).toBe(false);
    expect(isISOTimestamp("not a timestamp")).toBe(false);
    expect(isISOTimestamp(123)).toBe(false);
  });
});

describe("NonEmptyString", () => {
  it("should create non-empty strings and trim whitespace", () => {
    expect(createNonEmptyString("hello")).toBe("hello");
    expect(createNonEmptyString("  hello  ")).toBe("hello");
    expect(createNonEmptyString("")).toBeNull();
    expect(createNonEmptyString("   ")).toBeNull();
  });

  it("should validate non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });
});
