import { describe, it, expect } from "vitest";
import { ERROR_MESSAGES, getUserMessageSafe, isErrorCode } from "./error-messages";
import { ErrorCode } from "../types/errors";

describe("ERROR_MESSAGES", () => {
  it("should have a message for every ErrorCode", () => {
    const allErrorCodes = Object.values(ErrorCode);
    for (const code of allErrorCodes) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("should not contain technical jargon", () => {
    const FORBIDDEN_TERMS = ["IPC", "API", "JSON", "HTTP", "ECONNREFUSED", "stack trace", "null"];

    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      const lowerMessage = message.toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(
          lowerMessage.includes(term.toLowerCase()),
          `Message for ${code} should not contain "${term}"`
        ).toBe(false);
      }
    }
  });

  it("should be actionable (contain guidance for user)", () => {
    const ACTIONABLE_PHRASES = [
      "try again",
      "please",
      "check",
      "restart",
      "using default",
      "will be restored",
    ];

    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      const lowerMessage = message.toLowerCase();
      const hasActionablePhrase = ACTIONABLE_PHRASES.some((phrase) =>
        lowerMessage.includes(phrase.toLowerCase())
      );
      expect(hasActionablePhrase, `Message for ${code} should be actionable`).toBe(true);
    }
  });
});

describe("getUserMessageSafe", () => {
  it("should return correct message for valid error codes", () => {
    expect(getUserMessageSafe(ErrorCode.NETWORK_TIMEOUT)).toBe(
      ERROR_MESSAGES[ErrorCode.NETWORK_TIMEOUT]
    );
  });

  it("should return UNKNOWN message for invalid inputs", () => {
    const unknownMsg = ERROR_MESSAGES[ErrorCode.UNKNOWN];
    expect(getUserMessageSafe("INVALID_CODE")).toBe(unknownMsg);
    expect(getUserMessageSafe(null)).toBe(unknownMsg);
  });
});

describe("isErrorCode", () => {
  it("should validate error codes correctly", () => {
    expect(isErrorCode(ErrorCode.UNKNOWN)).toBe(true);
    expect(isErrorCode("INVALID")).toBe(false);
    expect(isErrorCode(null)).toBe(false);
  });
});
