import { describe, it, expect } from "vitest";
import { ERROR_MESSAGES, getUserMessage, getUserMessageSafe, isErrorCode } from "./error-messages";
import { ErrorCode } from "../types/errors";

describe("ERROR_MESSAGES", () => {
  describe("completeness", () => {
    it("should have a message for every ErrorCode", () => {
      const allErrorCodes = Object.values(ErrorCode);
      const mappedCodes = Object.keys(ERROR_MESSAGES);

      expect(mappedCodes).toHaveLength(allErrorCodes.length);

      for (const code of allErrorCodes) {
        expect(ERROR_MESSAGES[code]).toBeDefined();
        expect(typeof ERROR_MESSAGES[code]).toBe("string");
        expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      }
    });

    it("should have non-empty messages for all codes", () => {
      for (const [_code, message] of Object.entries(ERROR_MESSAGES)) {
        expect(message.trim().length).toBeGreaterThan(0);
        expect(message).not.toBe("");
      }
    });
  });

  describe("message quality", () => {
    // Technical terms that should NOT appear in user-facing messages
    const FORBIDDEN_TERMS = [
      "IPC",
      "API",
      "STT",
      "LLM",
      "JSON",
      "HTTP",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "stack trace",
      "stacktrace",
      "exception",
      "null",
      "undefined",
      "TypeError",
      "Error:",
      "fatal",
    ];

    // All messages should contain at least one actionable phrase
    const ACTIONABLE_PHRASES = [
      "try again",
      "please",
      "check",
      "restart",
      "using default",
      "will be restored",
    ];

    it("should not contain technical jargon", () => {
      for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
        const lowerMessage = message.toLowerCase();

        for (const term of FORBIDDEN_TERMS) {
          const lowerTerm = term.toLowerCase();
          expect(
            lowerMessage.includes(lowerTerm),
            `Message for ${code} should not contain "${term}": "${message}"`
          ).toBe(false);
        }
      }
    });

    it("should be actionable (contain guidance for user)", () => {
      for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
        const lowerMessage = message.toLowerCase();
        const hasActionablePhrase = ACTIONABLE_PHRASES.some((phrase) =>
          lowerMessage.includes(phrase.toLowerCase())
        );

        expect(hasActionablePhrase, `Message for ${code} should be actionable: "${message}"`).toBe(
          true
        );
      }
    });

    it("should be concise (max 2 sentences)", () => {
      for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
        // Count sentences by looking for sentence-ending punctuation
        const sentences = message.split(/[.!?]+/).filter((s) => s.trim().length > 0);

        expect(
          sentences.length,
          `Message for ${code} has ${sentences.length} sentences (max 2): "${message}"`
        ).toBeLessThanOrEqual(2);
      }
    });

    it("should not expose file paths", () => {
      for (const [_code, message] of Object.entries(ERROR_MESSAGES)) {
        // Check for common file path patterns
        expect(message).not.toMatch(/\/[a-zA-Z]+\//); // Unix paths like /home/
        expect(message).not.toMatch(/[A-Z]:\\/); // Windows paths like C:\
        expect(message).not.toMatch(/~\//); // Home directory
      }
    });

    it("should not expose stack trace patterns", () => {
      for (const [_code, message] of Object.entries(ERROR_MESSAGES)) {
        expect(message).not.toMatch(/at \w+/); // "at functionName"
        expect(message).not.toMatch(/:\d+:\d+/); // ":line:column"
      }
    });
  });

  describe("specific error messages", () => {
    it("should have appropriate message for UNKNOWN", () => {
      expect(ERROR_MESSAGES[ErrorCode.UNKNOWN]).toContain("unexpected");
      expect(ERROR_MESSAGES[ErrorCode.UNKNOWN]).toContain("try again");
    });

    it("should have appropriate message for INTERNAL", () => {
      expect(ERROR_MESSAGES[ErrorCode.INTERNAL]).toContain("restart");
    });

    it("should have appropriate message for network errors", () => {
      expect(ERROR_MESSAGES[ErrorCode.NETWORK_UNAVAILABLE]).toContain("internet");
      expect(ERROR_MESSAGES[ErrorCode.NETWORK_TIMEOUT]).toContain("timed out");
    });

    it("should have appropriate message for config errors", () => {
      expect(ERROR_MESSAGES[ErrorCode.CONFIG_INVALID]).toContain("settings");
      expect(ERROR_MESSAGES[ErrorCode.CONFIG_SAVE_FAILED]).toContain("save");
    });
  });
});

describe("getUserMessage", () => {
  it("should return the correct message for a valid error code", () => {
    expect(getUserMessage(ErrorCode.NETWORK_TIMEOUT)).toBe(
      ERROR_MESSAGES[ErrorCode.NETWORK_TIMEOUT]
    );
  });

  it("should return messages for all error codes", () => {
    for (const code of Object.values(ErrorCode)) {
      const message = getUserMessage(code);
      expect(message).toBe(ERROR_MESSAGES[code]);
    }
  });

  it("should return the same message as direct lookup", () => {
    const code = ErrorCode.CONFIG_LOAD_FAILED;
    expect(getUserMessage(code)).toBe(ERROR_MESSAGES[code]);
  });
});

describe("getUserMessageSafe", () => {
  it("should return the correct message for a valid error code string", () => {
    expect(getUserMessageSafe(ErrorCode.NETWORK_UNAVAILABLE)).toBe(
      ERROR_MESSAGES[ErrorCode.NETWORK_UNAVAILABLE]
    );
  });

  it("should return UNKNOWN message for invalid string", () => {
    expect(getUserMessageSafe("INVALID_CODE")).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it("should return UNKNOWN message for null", () => {
    expect(getUserMessageSafe(null)).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it("should return UNKNOWN message for undefined", () => {
    expect(getUserMessageSafe(undefined)).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it("should return UNKNOWN message for number", () => {
    expect(getUserMessageSafe(123)).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it("should return UNKNOWN message for object", () => {
    expect(getUserMessageSafe({ code: "NETWORK_TIMEOUT" })).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it("should return UNKNOWN message for empty string", () => {
    expect(getUserMessageSafe("")).toBe(ERROR_MESSAGES[ErrorCode.UNKNOWN]);
  });

  it("should handle all valid ErrorCode values", () => {
    for (const code of Object.values(ErrorCode)) {
      const message = getUserMessageSafe(code);
      expect(message).toBe(ERROR_MESSAGES[code]);
    }
  });
});

describe("isErrorCode (re-exported)", () => {
  it("should be re-exported from error-messages", () => {
    expect(typeof isErrorCode).toBe("function");
  });

  it("should return true for valid error codes", () => {
    expect(isErrorCode(ErrorCode.UNKNOWN)).toBe(true);
    expect(isErrorCode(ErrorCode.NETWORK_TIMEOUT)).toBe(true);
    expect(isErrorCode("INTERNAL")).toBe(true);
  });

  it("should return false for invalid values", () => {
    expect(isErrorCode("INVALID")).toBe(false);
    expect(isErrorCode(null)).toBe(false);
    expect(isErrorCode(undefined)).toBe(false);
    expect(isErrorCode(123)).toBe(false);
    expect(isErrorCode({})).toBe(false);
  });
});

describe("Integration with AppError", () => {
  it("should work with error codes from AppError instances", async () => {
    // Dynamically import to avoid circular dependency issues in tests
    const { AppError } = await import("./errors");

    const error = new AppError(
      "Technical network error",
      ErrorCode.NETWORK_TIMEOUT,
      "User message from error"
    );

    const message = getUserMessage(error.code);
    expect(message).toBe(ERROR_MESSAGES[ErrorCode.NETWORK_TIMEOUT]);
  });
});
