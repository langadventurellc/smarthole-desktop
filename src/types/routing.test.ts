import { describe, it, expect } from "vitest";
import {
  isRoutingSuccess,
  isRoutingFailure,
  isRoutingDecision,
  isRoutingError,
  isRoutingResult,
  isDeliveryInfo,
  isRoutingOutcome,
  isDirectRouteResult,
  type RoutingResult,
  type RoutingDecision,
  type RoutingError,
  type DeliveryInfo,
  type RoutingOutcome,
  type DirectRouteResult,
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

// ============================================================================
// Routing Agent Type Guard Tests
// ============================================================================

describe("isDeliveryInfo", () => {
  it("should return true for valid delivery info with all fields", () => {
    const info: DeliveryInfo = {
      clientName: "notebook",
      messageId: "msg-123",
      directRouted: false,
      reason: "Best match for notes",
    };
    expect(isDeliveryInfo(info)).toBe(true);
  });

  it("should return true for valid delivery info without optional reason", () => {
    const info = {
      clientName: "notebook",
      messageId: "msg-123",
      directRouted: true,
    };
    expect(isDeliveryInfo(info)).toBe(true);
  });

  it("should return false for non-object values", () => {
    expect(isDeliveryInfo(null)).toBe(false);
    expect(isDeliveryInfo(undefined)).toBe(false);
    expect(isDeliveryInfo("string")).toBe(false);
    expect(isDeliveryInfo(123)).toBe(false);
    expect(isDeliveryInfo([])).toBe(false);
  });

  it("should return false when clientName is missing", () => {
    expect(isDeliveryInfo({ messageId: "msg-123", directRouted: false })).toBe(false);
  });

  it("should return false when clientName is empty", () => {
    expect(isDeliveryInfo({ clientName: "", messageId: "msg-123", directRouted: false })).toBe(
      false
    );
  });

  it("should return false when clientName is not a string", () => {
    expect(isDeliveryInfo({ clientName: 123, messageId: "msg-123", directRouted: false })).toBe(
      false
    );
  });

  it("should return false when messageId is missing", () => {
    expect(isDeliveryInfo({ clientName: "notebook", directRouted: false })).toBe(false);
  });

  it("should return false when messageId is not a string", () => {
    expect(isDeliveryInfo({ clientName: "notebook", messageId: 123, directRouted: false })).toBe(
      false
    );
  });

  it("should return false when directRouted is missing", () => {
    expect(isDeliveryInfo({ clientName: "notebook", messageId: "msg-123" })).toBe(false);
  });

  it("should return false when directRouted is not a boolean", () => {
    expect(
      isDeliveryInfo({ clientName: "notebook", messageId: "msg-123", directRouted: "yes" })
    ).toBe(false);
  });

  it("should return false when reason is not a string", () => {
    expect(
      isDeliveryInfo({
        clientName: "notebook",
        messageId: "msg-123",
        directRouted: false,
        reason: 123,
      })
    ).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = { clientName: "notebook", messageId: "msg-123", directRouted: true };
    if (isDeliveryInfo(value)) {
      const _info: DeliveryInfo = value;
      expect(_info.clientName).toBe("notebook");
    }
  });
});

describe("isRoutingOutcome", () => {
  describe("routed variant", () => {
    it("should return true for valid routed outcome with deliveries", () => {
      const outcome: RoutingOutcome = {
        type: "routed",
        deliveries: [{ clientName: "notebook", messageId: "msg-123", directRouted: false }],
      };
      expect(isRoutingOutcome(outcome)).toBe(true);
    });

    it("should return true for routed outcome with empty deliveries", () => {
      const outcome = {
        type: "routed",
        deliveries: [],
      };
      expect(isRoutingOutcome(outcome)).toBe(true);
    });

    it("should return true for routed outcome with multiple deliveries", () => {
      const outcome = {
        type: "routed",
        deliveries: [
          { clientName: "notebook", messageId: "msg-123", directRouted: false },
          { clientName: "calendar", messageId: "msg-124", directRouted: true, reason: "Has date" },
        ],
      };
      expect(isRoutingOutcome(outcome)).toBe(true);
    });

    it("should return false when deliveries is missing", () => {
      expect(isRoutingOutcome({ type: "routed" })).toBe(false);
    });

    it("should return false when deliveries is not an array", () => {
      expect(isRoutingOutcome({ type: "routed", deliveries: "not an array" })).toBe(false);
    });

    it("should return false when deliveries contains invalid items", () => {
      expect(
        isRoutingOutcome({
          type: "routed",
          deliveries: [{ clientName: "", messageId: "msg-123", directRouted: false }],
        })
      ).toBe(false);
    });
  });

  describe("no_clients variant", () => {
    it("should return true for valid no_clients outcome", () => {
      const outcome: RoutingOutcome = {
        type: "no_clients",
        message: "No plugins are currently connected.",
      };
      expect(isRoutingOutcome(outcome)).toBe(true);
    });

    it("should return false when message is missing", () => {
      expect(isRoutingOutcome({ type: "no_clients" })).toBe(false);
    });

    it("should return false when message is not a string", () => {
      expect(isRoutingOutcome({ type: "no_clients", message: 123 })).toBe(false);
    });
  });

  describe("routing_failed variant", () => {
    it("should return true for valid routing_failed outcome", () => {
      const outcome: RoutingOutcome = {
        type: "routing_failed",
        error: "API request failed",
        fallbackAttempted: true,
      };
      expect(isRoutingOutcome(outcome)).toBe(true);
    });

    it("should return false when error is missing", () => {
      expect(isRoutingOutcome({ type: "routing_failed", fallbackAttempted: false })).toBe(false);
    });

    it("should return false when error is not a string", () => {
      expect(
        isRoutingOutcome({ type: "routing_failed", error: 123, fallbackAttempted: false })
      ).toBe(false);
    });

    it("should return false when fallbackAttempted is missing", () => {
      expect(isRoutingOutcome({ type: "routing_failed", error: "Failed" })).toBe(false);
    });

    it("should return false when fallbackAttempted is not a boolean", () => {
      expect(
        isRoutingOutcome({ type: "routing_failed", error: "Failed", fallbackAttempted: "yes" })
      ).toBe(false);
    });
  });

  it("should return false for non-object values", () => {
    expect(isRoutingOutcome(null)).toBe(false);
    expect(isRoutingOutcome(undefined)).toBe(false);
    expect(isRoutingOutcome("string")).toBe(false);
    expect(isRoutingOutcome(123)).toBe(false);
  });

  it("should return false for unknown type", () => {
    expect(isRoutingOutcome({ type: "unknown", data: {} })).toBe(false);
  });

  it("should return false when type is missing", () => {
    expect(isRoutingOutcome({ deliveries: [] })).toBe(false);
  });

  it("should return false when type is not a string", () => {
    expect(isRoutingOutcome({ type: 123, deliveries: [] })).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = {
      type: "routed",
      deliveries: [{ clientName: "test", messageId: "msg-1", directRouted: false }],
    };
    if (isRoutingOutcome(value)) {
      const _outcome: RoutingOutcome = value;
      expect(_outcome.type).toBe("routed");
    }
  });
});

describe("isDirectRouteResult", () => {
  it("should return true for valid direct route result", () => {
    const result: DirectRouteResult = {
      clientName: "notebook",
      message: "remember this",
      directRouted: true,
    };
    expect(isDirectRouteResult(result)).toBe(true);
  });

  it("should return true for empty message", () => {
    const result = {
      clientName: "notebook",
      message: "",
      directRouted: true,
    };
    expect(isDirectRouteResult(result)).toBe(true);
  });

  it("should return false for non-object values", () => {
    expect(isDirectRouteResult(null)).toBe(false);
    expect(isDirectRouteResult(undefined)).toBe(false);
    expect(isDirectRouteResult("string")).toBe(false);
    expect(isDirectRouteResult(123)).toBe(false);
    expect(isDirectRouteResult([])).toBe(false);
  });

  it("should return false when clientName is missing", () => {
    expect(isDirectRouteResult({ message: "test", directRouted: true })).toBe(false);
  });

  it("should return false when clientName is empty", () => {
    expect(isDirectRouteResult({ clientName: "", message: "test", directRouted: true })).toBe(
      false
    );
  });

  it("should return false when clientName is not a string", () => {
    expect(isDirectRouteResult({ clientName: 123, message: "test", directRouted: true })).toBe(
      false
    );
  });

  it("should return false when message is missing", () => {
    expect(isDirectRouteResult({ clientName: "notebook", directRouted: true })).toBe(false);
  });

  it("should return false when message is not a string", () => {
    expect(isDirectRouteResult({ clientName: "notebook", message: 123, directRouted: true })).toBe(
      false
    );
  });

  it("should return false when directRouted is missing", () => {
    expect(isDirectRouteResult({ clientName: "notebook", message: "test" })).toBe(false);
  });

  it("should return false when directRouted is false", () => {
    expect(
      isDirectRouteResult({ clientName: "notebook", message: "test", directRouted: false })
    ).toBe(false);
  });

  it("should return false when directRouted is not a boolean", () => {
    expect(
      isDirectRouteResult({ clientName: "notebook", message: "test", directRouted: "true" })
    ).toBe(false);
  });

  it("should narrow the type when used as a guard", () => {
    const value: unknown = { clientName: "notebook", message: "hello", directRouted: true };
    if (isDirectRouteResult(value)) {
      const _result: DirectRouteResult = value;
      expect(_result.directRouted).toBe(true);
    }
  });
});
