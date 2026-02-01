import { describe, it, expect } from "vitest";
import {
  isRoutingSuccess,
  isRoutingFailure,
  isRoutingDecision,
  isRoutingError,
  isRoutingResult,
  type RoutingResult,
  type RoutingDecision,
  type RoutingError,
} from "./routing";
import { ErrorCode } from "./errors";

describe("isRoutingDecision", () => {
  it("should return true for valid routing decision with all fields", () => {
    const decision: RoutingDecision = {
      clientName: "notebook",
      message: "Hello world",
      reason: "Best match for notes",
    };
    expect(isRoutingDecision(decision)).toBe(true);
  });

  it("should return true for valid routing decision without optional reason", () => {
    const decision = {
      clientName: "notebook",
      message: "Hello world",
    };
    expect(isRoutingDecision(decision)).toBe(true);
  });

  it("should return true for empty message", () => {
    const decision = {
      clientName: "notebook",
      message: "",
    };
    expect(isRoutingDecision(decision)).toBe(true);
  });

  it("should return false for non-object values", () => {
    expect(isRoutingDecision(null)).toBe(false);
    expect(isRoutingDecision(undefined)).toBe(false);
    expect(isRoutingDecision("string")).toBe(false);
    expect(isRoutingDecision(123)).toBe(false);
    expect(isRoutingDecision([])).toBe(false);
  });

  it("should return false when clientName is missing", () => {
    expect(isRoutingDecision({ message: "test" })).toBe(false);
  });

  it("should return false when clientName is empty", () => {
    expect(isRoutingDecision({ clientName: "", message: "test" })).toBe(false);
  });

  it("should return false when clientName is not a string", () => {
    expect(isRoutingDecision({ clientName: 123, message: "test" })).toBe(false);
  });

  it("should return false when message is missing", () => {
    expect(isRoutingDecision({ clientName: "notebook" })).toBe(false);
  });

  it("should return false when message is not a string", () => {
    expect(isRoutingDecision({ clientName: "notebook", message: 123 })).toBe(false);
  });

  it("should return false when reason is not a string", () => {
    expect(isRoutingDecision({ clientName: "notebook", message: "test", reason: 123 })).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = { clientName: "notebook", message: "Hello" };
    if (isRoutingDecision(value)) {
      const _decision: RoutingDecision = value;
      expect(_decision.clientName).toBe("notebook");
    }
  });
});

describe("isRoutingError", () => {
  it("should return true for valid routing error", () => {
    const error: RoutingError = {
      code: ErrorCode.ROUTING_REQUEST_FAILED,
      message: "Request failed",
      retryable: false,
    };
    expect(isRoutingError(error)).toBe(true);
  });

  it("should return true for retryable error", () => {
    const error = {
      code: ErrorCode.ROUTING_RATE_LIMITED,
      message: "Rate limited",
      retryable: true,
    };
    expect(isRoutingError(error)).toBe(true);
  });

  it("should return false for non-object values", () => {
    expect(isRoutingError(null)).toBe(false);
    expect(isRoutingError(undefined)).toBe(false);
    expect(isRoutingError("string")).toBe(false);
    expect(isRoutingError(123)).toBe(false);
  });

  it("should return false when code is missing", () => {
    expect(isRoutingError({ message: "test", retryable: false })).toBe(false);
  });

  it("should return false when code is not a string", () => {
    expect(isRoutingError({ code: 123, message: "test", retryable: false })).toBe(false);
  });

  it("should return false when code is not a valid ErrorCode", () => {
    expect(isRoutingError({ code: "INVALID_CODE", message: "test", retryable: false })).toBe(false);
  });

  it("should return false when message is missing", () => {
    expect(isRoutingError({ code: ErrorCode.ROUTING_REQUEST_FAILED, retryable: false })).toBe(
      false
    );
  });

  it("should return false when message is not a string", () => {
    expect(
      isRoutingError({ code: ErrorCode.ROUTING_REQUEST_FAILED, message: 123, retryable: false })
    ).toBe(false);
  });

  it("should return false when retryable is missing", () => {
    expect(isRoutingError({ code: ErrorCode.ROUTING_REQUEST_FAILED, message: "test" })).toBe(false);
  });

  it("should return false when retryable is not a boolean", () => {
    expect(
      isRoutingError({ code: ErrorCode.ROUTING_REQUEST_FAILED, message: "test", retryable: "yes" })
    ).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = {
      code: ErrorCode.ROUTING_REQUEST_FAILED,
      message: "Failed",
      retryable: true,
    };
    if (isRoutingError(value)) {
      const _error: RoutingError = value;
      expect(_error.retryable).toBe(true);
    }
  });
});

describe("isRoutingResult", () => {
  it("should return true for successful result with decisions", () => {
    const result: RoutingResult = {
      success: true,
      decisions: [{ clientName: "notebook", message: "Hello" }],
    };
    expect(isRoutingResult(result)).toBe(true);
  });

  it("should return true for successful result with empty decisions", () => {
    const result = {
      success: true,
      decisions: [],
    };
    expect(isRoutingResult(result)).toBe(true);
  });

  it("should return true for successful result with multiple decisions", () => {
    const result = {
      success: true,
      decisions: [
        { clientName: "notebook", message: "Note this" },
        { clientName: "calendar", message: "Schedule this", reason: "Has date" },
      ],
    };
    expect(isRoutingResult(result)).toBe(true);
  });

  it("should return true for failed result with error", () => {
    const result: RoutingResult = {
      success: false,
      error: {
        code: ErrorCode.ROUTING_NO_CLIENTS,
        message: "No clients",
        retryable: false,
      },
    };
    expect(isRoutingResult(result)).toBe(true);
  });

  it("should return false for non-object values", () => {
    expect(isRoutingResult(null)).toBe(false);
    expect(isRoutingResult(undefined)).toBe(false);
    expect(isRoutingResult("string")).toBe(false);
    expect(isRoutingResult(123)).toBe(false);
  });

  it("should return false when success is not a boolean", () => {
    expect(isRoutingResult({ success: "true", decisions: [] })).toBe(false);
    expect(isRoutingResult({ success: 1, decisions: [] })).toBe(false);
  });

  it("should return false for success=true without decisions", () => {
    expect(isRoutingResult({ success: true })).toBe(false);
  });

  it("should return false for success=true with non-array decisions", () => {
    expect(isRoutingResult({ success: true, decisions: "not an array" })).toBe(false);
    expect(isRoutingResult({ success: true, decisions: {} })).toBe(false);
  });

  it("should return false for success=true with invalid decision in array", () => {
    expect(
      isRoutingResult({
        success: true,
        decisions: [{ clientName: "", message: "test" }],
      })
    ).toBe(false);

    expect(
      isRoutingResult({
        success: true,
        decisions: [{ clientName: "valid", message: "ok" }, { invalid: true }],
      })
    ).toBe(false);
  });

  it("should return false for success=false without error", () => {
    expect(isRoutingResult({ success: false })).toBe(false);
  });

  it("should return false for success=false with invalid error", () => {
    expect(isRoutingResult({ success: false, error: "not an object" })).toBe(false);
    expect(isRoutingResult({ success: false, error: { code: "INVALID_CODE" } })).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = {
      success: true,
      decisions: [{ clientName: "test", message: "hello" }],
    };
    if (isRoutingResult(value)) {
      const _result: RoutingResult = value;
      expect(_result.success).toBe(true);
    }
  });
});

describe("isRoutingSuccess", () => {
  it("should return true for successful result", () => {
    const result: RoutingResult = {
      success: true,
      decisions: [{ clientName: "notebook", message: "test" }],
    };
    expect(isRoutingSuccess(result)).toBe(true);
  });

  it("should return false for failed result", () => {
    const result: RoutingResult = {
      success: false,
      error: { code: ErrorCode.ROUTING_REQUEST_FAILED, message: "Failed", retryable: false },
    };
    expect(isRoutingSuccess(result)).toBe(false);
  });

  it("should narrow the type to access decisions", () => {
    const result: RoutingResult = {
      success: true,
      decisions: [{ clientName: "notebook", message: "hello" }],
    };
    if (isRoutingSuccess(result)) {
      expect(result.decisions[0].clientName).toBe("notebook");
    }
  });
});

describe("isRoutingFailure", () => {
  it("should return true for failed result", () => {
    const result: RoutingResult = {
      success: false,
      error: { code: ErrorCode.ROUTING_API_KEY_MISSING, message: "Missing key", retryable: false },
    };
    expect(isRoutingFailure(result)).toBe(true);
  });

  it("should return false for successful result", () => {
    const result: RoutingResult = {
      success: true,
      decisions: [],
    };
    expect(isRoutingFailure(result)).toBe(false);
  });

  it("should narrow the type to access error", () => {
    const result: RoutingResult = {
      success: false,
      error: { code: ErrorCode.ROUTING_RATE_LIMITED, message: "Rate limited", retryable: true },
    };
    if (isRoutingFailure(result)) {
      expect(result.error.retryable).toBe(true);
    }
  });
});
