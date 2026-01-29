import { describe, it, expect } from "vitest";
import {
  wrapError,
  isAppError,
  isErrorOfType,
  getRootCause,
  WrapErrorOptions,
} from "./error-utils";
import { AppError, ConfigurationError, NetworkError, IpcError, ServiceError } from "./errors";
import { ErrorCode } from "../types/errors";
import { getUserMessage } from "./error-messages";

describe("wrapError", () => {
  describe("with AppError input", () => {
    it("should return the same AppError when no options provided", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "high"
      );

      const result = wrapError(original);

      expect(result).toBe(original);
    });

    it("should return a new AppError with overridden code", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium"
      );

      const result = wrapError(original, { code: ErrorCode.NETWORK_TIMEOUT });

      expect(result).not.toBe(original);
      expect(result.message).toBe("Original error");
      expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(result.userMessage).toBe("Something went wrong");
    });

    it("should return a new AppError with overridden userMessage", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium"
      );

      const result = wrapError(original, { userMessage: "Custom message" });

      expect(result.userMessage).toBe("Custom message");
      expect(result.code).toBe(ErrorCode.INTERNAL);
    });

    it("should return a new AppError with overridden recoverable flag", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium"
      );

      const result = wrapError(original, { recoverable: false });

      expect(result.recoverable).toBe(false);
    });

    it("should return a new AppError with overridden severity", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium"
      );

      const result = wrapError(original, { severity: "critical" });

      expect(result.severity).toBe("critical");
    });

    it("should preserve the original error as cause when overriding", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium"
      );

      const result = wrapError(original, { code: ErrorCode.UNKNOWN });

      expect(result.cause).toBe(original);
    });

    it("should preserve original cause if it exists when overriding", () => {
      const rootCause = new Error("Root cause");
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium",
        rootCause
      );

      const result = wrapError(original, { code: ErrorCode.UNKNOWN });

      expect(result.cause).toBe(rootCause);
    });

    it("should apply multiple options at once", () => {
      const original = new AppError(
        "Original error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium"
      );

      const options: WrapErrorOptions = {
        code: ErrorCode.NETWORK_REQUEST_FAILED,
        userMessage: "Network failed",
        recoverable: false,
        severity: "high",
      };

      const result = wrapError(original, options);

      expect(result.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
      expect(result.userMessage).toBe("Network failed");
      expect(result.recoverable).toBe(false);
      expect(result.severity).toBe("high");
    });
  });

  describe("with standard Error input", () => {
    it("should wrap Error with default UNKNOWN code", () => {
      const error = new Error("Standard error");

      const result = wrapError(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("Standard error");
      expect(result.code).toBe(ErrorCode.UNKNOWN);
      expect(result.userMessage).toBe(getUserMessage(ErrorCode.UNKNOWN));
      expect(result.recoverable).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.cause).toBe(error);
    });

    it("should wrap Error with custom code", () => {
      const error = new Error("Network timeout");

      const result = wrapError(error, { code: ErrorCode.NETWORK_TIMEOUT });

      expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(result.userMessage).toBe(getUserMessage(ErrorCode.NETWORK_TIMEOUT));
      expect(result.cause).toBe(error);
    });

    it("should wrap Error with custom userMessage", () => {
      const error = new Error("Detailed error");

      const result = wrapError(error, { userMessage: "Something went wrong" });

      expect(result.userMessage).toBe("Something went wrong");
    });

    it("should wrap Error with non-recoverable flag", () => {
      const error = new Error("Fatal error");

      const result = wrapError(error, { recoverable: false });

      expect(result.recoverable).toBe(false);
    });

    it("should wrap Error with custom severity", () => {
      const error = new Error("Critical failure");

      const result = wrapError(error, { severity: "critical" });

      expect(result.severity).toBe("critical");
    });

    it("should wrap TypeError", () => {
      const error = new TypeError("Cannot read property 'x' of undefined");

      const result = wrapError(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("Cannot read property 'x' of undefined");
      expect(result.cause).toBe(error);
    });

    it("should wrap RangeError", () => {
      const error = new RangeError("Value out of range");

      const result = wrapError(error);

      expect(result).toBeInstanceOf(AppError);
      expect(result.cause).toBe(error);
    });
  });

  describe("with string input", () => {
    it("should wrap string with default values", () => {
      const result = wrapError("Something failed");

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("Something failed");
      expect(result.code).toBe(ErrorCode.UNKNOWN);
      expect(result.userMessage).toBe(getUserMessage(ErrorCode.UNKNOWN));
      expect(result.recoverable).toBe(true);
      expect(result.severity).toBe("medium");
      expect(result.cause).toBeUndefined();
    });

    it("should wrap string with custom code", () => {
      const result = wrapError("Config error", { code: ErrorCode.CONFIG_INVALID });

      expect(result.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(result.userMessage).toBe(getUserMessage(ErrorCode.CONFIG_INVALID));
    });

    it("should wrap empty string", () => {
      const result = wrapError("");

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("");
    });
  });

  describe("with null input", () => {
    it("should wrap null as string representation", () => {
      const result = wrapError(null);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("null");
      expect(result.code).toBe(ErrorCode.UNKNOWN);
    });

    it("should wrap null with custom options", () => {
      const result = wrapError(null, {
        code: ErrorCode.INTERNAL,
        userMessage: "An error occurred",
      });

      expect(result.code).toBe(ErrorCode.INTERNAL);
      expect(result.userMessage).toBe("An error occurred");
    });
  });

  describe("with undefined input", () => {
    it("should wrap undefined as string representation", () => {
      const result = wrapError(undefined);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("undefined");
      expect(result.code).toBe(ErrorCode.UNKNOWN);
    });
  });

  describe("with object input", () => {
    it("should wrap plain object as string representation", () => {
      const result = wrapError({ foo: "bar" });

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("[object Object]");
    });

    it("should wrap object with custom toString", () => {
      const obj = {
        toString() {
          return "Custom error object";
        },
      };

      const result = wrapError(obj);

      expect(result.message).toBe("Custom error object");
    });
  });

  describe("with number input", () => {
    it("should wrap number as string representation", () => {
      const result = wrapError(42);

      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe("42");
    });

    it("should wrap NaN", () => {
      const result = wrapError(NaN);

      expect(result.message).toBe("NaN");
    });
  });

  describe("with boolean input", () => {
    it("should wrap false as string representation", () => {
      const result = wrapError(false);

      expect(result.message).toBe("false");
    });

    it("should wrap true as string representation", () => {
      const result = wrapError(true);

      expect(result.message).toBe("true");
    });
  });

  describe("default user message", () => {
    it("should use getUserMessage for the specified code", () => {
      const result = wrapError("Error", { code: ErrorCode.NETWORK_UNAVAILABLE });

      expect(result.userMessage).toBe(getUserMessage(ErrorCode.NETWORK_UNAVAILABLE));
    });

    it("should use UNKNOWN message when no code specified", () => {
      const result = wrapError("Error");

      expect(result.userMessage).toBe(getUserMessage(ErrorCode.UNKNOWN));
    });
  });
});

describe("isAppError", () => {
  it("should return true for AppError", () => {
    const error = new AppError("Test", ErrorCode.UNKNOWN, "User message");

    expect(isAppError(error)).toBe(true);
  });

  it("should return true for AppError subclasses", () => {
    const configError = new ConfigurationError("Config error");
    const networkError = new NetworkError("Network error");
    const ipcError = new IpcError("IPC error");
    const serviceError = new ServiceError("Service error");

    expect(isAppError(configError)).toBe(true);
    expect(isAppError(networkError)).toBe(true);
    expect(isAppError(ipcError)).toBe(true);
    expect(isAppError(serviceError)).toBe(true);
  });

  it("should return false for standard Error", () => {
    const error = new Error("Standard error");

    expect(isAppError(error)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isAppError(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it("should return false for string", () => {
    expect(isAppError("error")).toBe(false);
  });

  it("should return false for object that looks like AppError", () => {
    const fakeError = {
      message: "Fake",
      code: ErrorCode.UNKNOWN,
      userMessage: "Fake user message",
      recoverable: true,
      severity: "medium",
    };

    expect(isAppError(fakeError)).toBe(false);
  });

  it("should narrow type correctly", () => {
    const error: unknown = new AppError("Test", ErrorCode.INTERNAL, "User message");

    if (isAppError(error)) {
      // TypeScript should recognize these properties
      expect(error.code).toBe(ErrorCode.INTERNAL);
      expect(error.userMessage).toBe("User message");
    } else {
      throw new Error("Should have identified as AppError");
    }
  });
});

describe("isErrorOfType", () => {
  it("should return true for exact type match", () => {
    const error = new NetworkError("Network failed");

    expect(isErrorOfType(error, NetworkError)).toBe(true);
  });

  it("should return true for parent class", () => {
    const error = new NetworkError("Network failed");

    expect(isErrorOfType(error, AppError)).toBe(true);
  });

  it("should return false for different subclass", () => {
    const error = new NetworkError("Network failed");

    expect(isErrorOfType(error, ConfigurationError)).toBe(false);
    expect(isErrorOfType(error, IpcError)).toBe(false);
    expect(isErrorOfType(error, ServiceError)).toBe(false);
  });

  it("should return false for standard Error", () => {
    const error = new Error("Standard error");

    expect(isErrorOfType(error, AppError)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isErrorOfType(null, AppError)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isErrorOfType(undefined, AppError)).toBe(false);
  });

  it("should narrow type correctly for NetworkError", () => {
    const error: unknown = new NetworkError("Network failed");

    if (isErrorOfType(error, NetworkError)) {
      // TypeScript should recognize this as NetworkError
      expect(error.name).toBe("NetworkError");
      expect(error.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
    } else {
      throw new Error("Should have identified as NetworkError");
    }
  });

  it("should narrow type correctly for ConfigurationError", () => {
    const error: unknown = new ConfigurationError("Config invalid");

    if (isErrorOfType(error, ConfigurationError)) {
      expect(error.name).toBe("ConfigurationError");
      expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
    } else {
      throw new Error("Should have identified as ConfigurationError");
    }
  });

  it("should work in catch block pattern", () => {
    try {
      throw new ServiceError("Service unavailable");
    } catch (error) {
      if (isErrorOfType(error, ServiceError)) {
        expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
        return;
      }
      throw new Error("Should have caught ServiceError");
    }
  });
});

describe("getRootCause", () => {
  it("should return the same error if no cause", () => {
    const error = new Error("No cause");

    const root = getRootCause(error);

    expect(root).toBe(error);
  });

  it("should return the cause when one level deep", () => {
    const rootCause = new Error("Root cause");
    const error = new Error("Top level");
    error.cause = rootCause;

    const root = getRootCause(error);

    expect(root).toBe(rootCause);
  });

  it("should traverse multiple levels", () => {
    const level1 = new Error("Level 1");
    const level2 = new Error("Level 2");
    level2.cause = level1;
    const level3 = new Error("Level 3");
    level3.cause = level2;

    const root = getRootCause(level3);

    expect(root).toBe(level1);
  });

  it("should work with AppError chain", () => {
    const rootCause = new Error("Database connection refused");
    const level2 = new AppError(
      "Failed to query user",
      ErrorCode.SERVICE_UNAVAILABLE,
      "Could not load user data",
      true,
      "medium",
      rootCause
    );
    const level3 = new AppError(
      "Authentication failed",
      ErrorCode.INTERNAL,
      "Please try logging in again",
      true,
      "high",
      level2
    );

    const root = getRootCause(level3);

    expect(root).toBe(rootCause);
    expect(root.message).toBe("Database connection refused");
  });

  it("should handle mixed AppError and Error chain", () => {
    const level1 = new TypeError("Cannot read property 'x'");
    const level2 = new AppError(
      "Data processing failed",
      ErrorCode.INTERNAL,
      "Something went wrong",
      true,
      "medium",
      level1
    );
    const level3 = new NetworkError("API call failed");
    // Manually set cause since NetworkError constructor chains differently
    Object.defineProperty(level3, "cause", { value: level2, writable: false });

    const root = getRootCause(level3);

    expect(root).toBe(level1);
  });

  it("should stop at non-Error cause", () => {
    const error = new Error("Top level");
    // Set a non-Error cause (unusual but possible)
    error.cause = "string cause" as unknown as Error;

    const root = getRootCause(error);

    // Should return the error itself since cause is not an Error
    expect(root).toBe(error);
  });

  it("should handle deep chains efficiently", () => {
    let current = new Error("Root");
    for (let i = 0; i < 100; i++) {
      const next = new Error(`Level ${i}`);
      next.cause = current;
      current = next;
    }

    const root = getRootCause(current);

    expect(root.message).toBe("Root");
  });
});

describe("Integration scenarios", () => {
  it("should wrap and check error type in catch block", () => {
    function throwError(): never {
      throw new TypeError("Type mismatch");
    }

    try {
      throwError();
    } catch (error) {
      const appError = wrapError(error, { code: ErrorCode.INTERNAL });

      expect(isAppError(appError)).toBe(true);
      expect(appError.code).toBe(ErrorCode.INTERNAL);
      expect(getRootCause(appError)).toBeInstanceOf(TypeError);
    }
  });

  it("should handle async error wrapping", async () => {
    async function riskyOperation(): Promise<void> {
      throw new Error("Async failure");
    }

    try {
      await riskyOperation();
    } catch (error) {
      const appError = wrapError(error, {
        code: ErrorCode.NETWORK_REQUEST_FAILED,
        userMessage: "Operation failed",
      });

      expect(appError.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
      expect(appError.userMessage).toBe("Operation failed");
    }
  });

  it("should chain wrapped errors correctly", () => {
    const original = new Error("Original");
    const wrapped1 = wrapError(original, { code: ErrorCode.NETWORK_UNAVAILABLE });
    const wrapped2 = wrapError(wrapped1, { code: ErrorCode.SERVICE_UNAVAILABLE });

    expect(wrapped2.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(getRootCause(wrapped2)).toBe(original);
  });
});
