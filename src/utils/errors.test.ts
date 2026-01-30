import { describe, it, expect } from "vitest";
import {
  AppError,
  ConfigurationError,
  NetworkError,
  IpcError,
  ServiceError,
  type SerializedAppError,
} from "./errors";
import { ErrorCode } from "../types/errors";

describe("AppError", () => {
  it("should create an error with all properties", () => {
    const cause = new Error("Original");
    const error = new AppError("Tech msg", ErrorCode.INTERNAL, "User msg", false, "high", cause);

    expect(error.message).toBe("Tech msg");
    expect(error.code).toBe(ErrorCode.INTERNAL);
    expect(error.userMessage).toBe("User msg");
    expect(error.recoverable).toBe(false);
    expect(error.severity).toBe("high");
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("AppError");
  });

  it("should use default values for optional parameters", () => {
    const error = new AppError("Msg", ErrorCode.UNKNOWN, "User msg");
    expect(error.recoverable).toBe(true);
    expect(error.severity).toBe("medium");
  });

  describe("toJSON/fromJSON", () => {
    it("should serialize and deserialize correctly", () => {
      const original = new AppError("Tech", ErrorCode.NETWORK_TIMEOUT, "User", false, "high");

      const json = original.toJSON();
      const reconstructed = AppError.fromJSON(json);

      expect(reconstructed.message).toBe(original.message);
      expect(reconstructed.code).toBe(original.code);
      expect(reconstructed.userMessage).toBe(original.userMessage);
      expect(reconstructed.recoverable).toBe(original.recoverable);
      expect(reconstructed.severity).toBe(original.severity);
    });

    it("should handle round-trip with cause chain", () => {
      const rootCause = new AppError("Root", ErrorCode.NETWORK_TIMEOUT, "Timeout");
      const original = new AppError(
        "Top",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service",
        true,
        "high",
        rootCause
      );

      const serialized = JSON.stringify(original.toJSON());
      const reconstructed = AppError.fromJSON(JSON.parse(serialized) as SerializedAppError);

      expect(reconstructed.cause).toBeInstanceOf(AppError);
      expect((reconstructed.cause as AppError).code).toBe(ErrorCode.NETWORK_TIMEOUT);
    });
  });
});

describe("Error subclasses", () => {
  it("ConfigurationError should have correct defaults", () => {
    const error = new ConfigurationError("Invalid config");
    expect(error.name).toBe("ConfigurationError");
    expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
  });

  it("NetworkError should have correct defaults", () => {
    const error = new NetworkError("ECONNREFUSED");
    expect(error.name).toBe("NetworkError");
    expect(error.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
  });

  it("IpcError should have correct defaults", () => {
    const error = new IpcError("Handler not found");
    expect(error.name).toBe("IpcError");
    expect(error.code).toBe(ErrorCode.IPC_HANDLER_FAILED);
    expect(error.recoverable).toBe(false);
  });

  it("ServiceError should have correct defaults", () => {
    const error = new ServiceError("Service failed");
    expect(error.name).toBe("ServiceError");
    expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });
});

describe("Error type discrimination", () => {
  it("should allow instanceof checks", () => {
    const errors: AppError[] = [
      new ConfigurationError("Config"),
      new NetworkError("Network"),
      new IpcError("IPC"),
      new ServiceError("Service"),
    ];

    expect(errors.map((e) => e.name)).toEqual([
      "ConfigurationError",
      "NetworkError",
      "IpcError",
      "ServiceError",
    ]);

    expect(errors[1] instanceof NetworkError).toBe(true);
    expect(errors[1] instanceof ConfigurationError).toBe(false);
  });
});
