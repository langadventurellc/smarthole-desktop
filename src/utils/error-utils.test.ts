import { describe, it, expect } from "vitest";
import { wrapError, isAppError, isErrorOfType, getRootCause } from "./error-utils";
import { AppError, NetworkError, ServiceError } from "./errors";
import { ErrorCode } from "../types/errors";
import { getUserMessage } from "./error-messages";

describe("wrapError", () => {
  it("should return the same AppError when no options provided", () => {
    const original = new AppError("Original", ErrorCode.INTERNAL, "User msg");
    expect(wrapError(original)).toBe(original);
  });

  it("should create new AppError with overridden options", () => {
    const original = new AppError("Original", ErrorCode.INTERNAL, "User msg");
    const result = wrapError(original, {
      code: ErrorCode.NETWORK_TIMEOUT,
      userMessage: "Custom",
      severity: "high",
    });

    expect(result).not.toBe(original);
    expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT);
    expect(result.userMessage).toBe("Custom");
    expect(result.severity).toBe("high");
  });

  it("should wrap standard Error with default UNKNOWN code", () => {
    const error = new Error("Standard error");
    const result = wrapError(error);

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe(ErrorCode.UNKNOWN);
    expect(result.userMessage).toBe(getUserMessage(ErrorCode.UNKNOWN));
    expect(result.cause).toBe(error);
  });

  it("should wrap non-Error values as AppError", () => {
    expect(wrapError("Something failed").message).toBe("Something failed");
    expect(wrapError(null).message).toBe("null");
    expect(wrapError("test").code).toBe(ErrorCode.UNKNOWN);
  });
});

describe("isAppError", () => {
  it("should identify AppError and subclasses", () => {
    expect(isAppError(new AppError("Test", ErrorCode.UNKNOWN, "User msg"))).toBe(true);
    expect(isAppError(new NetworkError("Network error"))).toBe(true);
    expect(isAppError(new Error("Standard"))).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("isErrorOfType", () => {
  it("should match error types correctly", () => {
    const networkError = new NetworkError("Network failed");
    expect(isErrorOfType(networkError, NetworkError)).toBe(true);
    expect(isErrorOfType(networkError, AppError)).toBe(true);
    expect(isErrorOfType(networkError, ServiceError)).toBe(false);
  });
});

describe("getRootCause", () => {
  it("should traverse error chains to find root cause", () => {
    const root = new Error("Root");
    const mid = new Error("Middle");
    mid.cause = root;
    const top = new Error("Top");
    top.cause = mid;

    expect(getRootCause(top)).toBe(root);
    expect(getRootCause(new Error("No cause"))).toEqual(
      expect.objectContaining({ message: "No cause" })
    );
  });

  it("should work with AppError chains", () => {
    const rootCause = new Error("Database connection refused");
    const appError = new AppError(
      "Auth failed",
      ErrorCode.INTERNAL,
      "Try again",
      true,
      "high",
      rootCause
    );

    expect(getRootCause(appError)).toBe(rootCause);
  });
});
