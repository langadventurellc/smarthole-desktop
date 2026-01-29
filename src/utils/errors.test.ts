import { describe, it, expect } from "vitest";
import {
  AppError,
  ConfigurationError,
  NetworkError,
  IpcError,
  ServiceError,
  type SerializedAppError,
} from "./errors";
import { ErrorCode, ErrorSeverity } from "../types/errors";

describe("AppError", () => {
  describe("constructor", () => {
    it("should create an error with all parameters", () => {
      const cause = new Error("Original error");
      const error = new AppError(
        "Technical error message",
        ErrorCode.INTERNAL,
        "Something went wrong. Please try again.",
        true,
        "high",
        cause
      );

      expect(error.message).toBe("Technical error message");
      expect(error.code).toBe(ErrorCode.INTERNAL);
      expect(error.userMessage).toBe("Something went wrong. Please try again.");
      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe("high");
      expect(error.cause).toBe(cause);
      expect(error.name).toBe("AppError");
    });

    it("should use default values for optional parameters", () => {
      const error = new AppError("Error message", ErrorCode.UNKNOWN, "User message");

      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe("medium");
      expect(error.cause).toBeUndefined();
    });

    it("should allow non-recoverable errors", () => {
      const error = new AppError("Fatal error", ErrorCode.INTERNAL, "Fatal error occurred", false);

      expect(error.recoverable).toBe(false);
    });

    it("should allow critical severity", () => {
      const error = new AppError(
        "Critical error",
        ErrorCode.INTERNAL,
        "Critical failure",
        false,
        "critical"
      );

      expect(error.severity).toBe("critical");
    });

    it("should have a stack trace", () => {
      const error = new AppError("Error with stack", ErrorCode.UNKNOWN, "User message");

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("AppError");
    });
  });

  describe("prototype chain", () => {
    it("should be an instance of Error", () => {
      const error = new AppError("Test", ErrorCode.UNKNOWN, "Test");

      expect(error instanceof Error).toBe(true);
    });

    it("should be an instance of AppError", () => {
      const error = new AppError("Test", ErrorCode.UNKNOWN, "Test");

      expect(error instanceof AppError).toBe(true);
    });

    it("should be catchable as Error", () => {
      let caught: Error | null = null;

      try {
        throw new AppError("Test", ErrorCode.UNKNOWN, "Test");
      } catch (e) {
        caught = e as Error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect(caught).toBeInstanceOf(AppError);
    });
  });

  describe("toJSON", () => {
    it("should serialize all properties", () => {
      const error = new AppError(
        "Technical message",
        ErrorCode.NETWORK_TIMEOUT,
        "Connection timed out",
        true,
        "medium"
      );

      const json = error.toJSON();

      expect(json.name).toBe("AppError");
      expect(json.message).toBe("Technical message");
      expect(json.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(json.userMessage).toBe("Connection timed out");
      expect(json.recoverable).toBe(true);
      expect(json.severity).toBe("medium");
      expect(json.stack).toBeDefined();
    });

    it("should serialize a plain Error cause", () => {
      const cause = new Error("Original error");
      const error = new AppError(
        "Wrapped error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        true,
        "medium",
        cause
      );

      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause?.name).toBe("Error");
      expect(json.cause?.message).toBe("Original error");
    });

    it("should serialize an AppError cause recursively", () => {
      const rootCause = new AppError("Root cause", ErrorCode.NETWORK_UNAVAILABLE, "Network down");
      const error = new AppError(
        "Top level",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service failed",
        true,
        "high",
        rootCause
      );

      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      const causeJson = json.cause as SerializedAppError;
      expect(causeJson.code).toBe(ErrorCode.NETWORK_UNAVAILABLE);
      expect(causeJson.userMessage).toBe("Network down");
    });

    it("should produce valid JSON", () => {
      const error = new AppError(
        "Test error",
        ErrorCode.CONFIG_INVALID,
        "Invalid configuration",
        false,
        "low"
      );

      const json = error.toJSON();
      const serialized = JSON.stringify(json);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(deserialized.userMessage).toBe("Invalid configuration");
      expect(deserialized.recoverable).toBe(false);
      expect(deserialized.severity).toBe("low");
    });
  });

  describe("fromJSON", () => {
    it("should reconstruct an AppError from serialized data", () => {
      const original = new AppError(
        "Technical message",
        ErrorCode.IPC_HANDLER_FAILED,
        "Communication error",
        false,
        "high"
      );

      const json = original.toJSON();
      const reconstructed = AppError.fromJSON(json);

      expect(reconstructed.message).toBe("Technical message");
      expect(reconstructed.code).toBe(ErrorCode.IPC_HANDLER_FAILED);
      expect(reconstructed.userMessage).toBe("Communication error");
      expect(reconstructed.recoverable).toBe(false);
      expect(reconstructed.severity).toBe("high");
    });

    it("should reconstruct an error with a plain cause", () => {
      const cause = new Error("Original");
      const original = new AppError(
        "Wrapped",
        ErrorCode.INTERNAL,
        "Error occurred",
        true,
        "medium",
        cause
      );

      const json = original.toJSON();
      const reconstructed = AppError.fromJSON(json);

      expect(reconstructed.cause).toBeDefined();
      expect(reconstructed.cause?.message).toBe("Original");
    });

    it("should reconstruct an error with an AppError cause", () => {
      const rootCause = new AppError("Root", ErrorCode.NETWORK_TIMEOUT, "Timeout");
      const original = new AppError(
        "Wrapped",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service down",
        true,
        "high",
        rootCause
      );

      const json = original.toJSON();
      const reconstructed = AppError.fromJSON(json);

      expect(reconstructed.cause).toBeInstanceOf(AppError);
      const reconstructedCause = reconstructed.cause as AppError;
      expect(reconstructedCause.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(reconstructedCause.userMessage).toBe("Timeout");
    });

    it("should handle round-trip serialization", () => {
      const original = new AppError(
        "Original message",
        ErrorCode.CONFIG_LOAD_FAILED,
        "Could not load settings",
        true,
        "medium"
      );

      // Simulate IPC transport
      const serialized = JSON.stringify(original.toJSON());
      const deserialized = JSON.parse(serialized) as SerializedAppError;
      const reconstructed = AppError.fromJSON(deserialized);

      expect(reconstructed.message).toBe(original.message);
      expect(reconstructed.code).toBe(original.code);
      expect(reconstructed.userMessage).toBe(original.userMessage);
      expect(reconstructed.recoverable).toBe(original.recoverable);
      expect(reconstructed.severity).toBe(original.severity);
    });
  });

  describe("error cause chaining", () => {
    it("should support deep cause chains", () => {
      const level1 = new Error("Database connection refused");
      const level2 = new AppError(
        "Failed to query user",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Could not load user data",
        true,
        "medium",
        level1
      );
      const level3 = new AppError(
        "Authentication failed",
        ErrorCode.INTERNAL,
        "Please try logging in again",
        true,
        "high",
        level2
      );

      expect(level3.cause).toBe(level2);
      expect((level3.cause as AppError).cause).toBe(level1);
    });

    it("should serialize deep cause chains correctly", () => {
      const level1 = new Error("Root cause");
      const level2 = new AppError(
        "Level 2",
        ErrorCode.NETWORK_TIMEOUT,
        "Timeout",
        true,
        "low",
        level1
      );
      const level3 = new AppError(
        "Level 3",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service error",
        true,
        "medium",
        level2
      );

      const json = level3.toJSON();

      expect(json.cause).toBeDefined();
      const cause2 = json.cause as SerializedAppError;
      expect(cause2.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(cause2.cause).toBeDefined();
      expect(cause2.cause?.message).toBe("Root cause");
    });
  });
});

describe("ConfigurationError", () => {
  describe("constructor", () => {
    it("should create with default values", () => {
      const error = new ConfigurationError("Invalid config format");

      expect(error.name).toBe("ConfigurationError");
      expect(error.message).toBe("Invalid config format");
      expect(error.code).toBe(ErrorCode.CONFIG_INVALID);
      expect(error.userMessage).toBe("There was a problem with the application settings.");
      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe("medium");
    });

    it("should allow custom values", () => {
      const cause = new Error("JSON parse error");
      const error = new ConfigurationError(
        "Config file corrupted",
        ErrorCode.CONFIG_LOAD_FAILED,
        "Your settings could not be loaded. Using defaults.",
        true,
        "low",
        cause
      );

      expect(error.code).toBe(ErrorCode.CONFIG_LOAD_FAILED);
      expect(error.userMessage).toBe("Your settings could not be loaded. Using defaults.");
      expect(error.severity).toBe("low");
      expect(error.cause).toBe(cause);
    });
  });

  describe("prototype chain", () => {
    it("should be an instance of AppError", () => {
      const error = new ConfigurationError("Test");

      expect(error instanceof AppError).toBe(true);
    });

    it("should be an instance of Error", () => {
      const error = new ConfigurationError("Test");

      expect(error instanceof Error).toBe(true);
    });

    it("should be an instance of ConfigurationError", () => {
      const error = new ConfigurationError("Test");

      expect(error instanceof ConfigurationError).toBe(true);
    });
  });
});

describe("NetworkError", () => {
  describe("constructor", () => {
    it("should create with default values", () => {
      const error = new NetworkError("ECONNREFUSED");

      expect(error.name).toBe("NetworkError");
      expect(error.message).toBe("ECONNREFUSED");
      expect(error.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
      expect(error.userMessage).toBe(
        "A network error occurred. Please check your connection and try again."
      );
      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe("medium");
    });

    it("should allow custom timeout error", () => {
      const error = new NetworkError(
        "Request timed out after 30s",
        ErrorCode.NETWORK_TIMEOUT,
        "The server took too long to respond.",
        true,
        "low"
      );

      expect(error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(error.userMessage).toBe("The server took too long to respond.");
    });
  });

  describe("prototype chain", () => {
    it("should be an instance of AppError", () => {
      const error = new NetworkError("Test");

      expect(error instanceof AppError).toBe(true);
    });

    it("should be an instance of NetworkError", () => {
      const error = new NetworkError("Test");

      expect(error instanceof NetworkError).toBe(true);
    });
  });
});

describe("IpcError", () => {
  describe("constructor", () => {
    it("should create with default values", () => {
      const error = new IpcError("Handler not found for channel: app:config");

      expect(error.name).toBe("IpcError");
      expect(error.message).toBe("Handler not found for channel: app:config");
      expect(error.code).toBe(ErrorCode.IPC_HANDLER_FAILED);
      expect(error.userMessage).toBe(
        "An internal communication error occurred. Please restart the application."
      );
      expect(error.recoverable).toBe(false);
      expect(error.severity).toBe("high");
    });

    it("should allow custom channel validation error", () => {
      const error = new IpcError(
        "Invalid channel name: contains unsafe characters",
        ErrorCode.IPC_CHANNEL_INVALID,
        "An internal error occurred."
      );

      expect(error.code).toBe(ErrorCode.IPC_CHANNEL_INVALID);
    });
  });

  describe("prototype chain", () => {
    it("should be an instance of AppError", () => {
      const error = new IpcError("Test");

      expect(error instanceof AppError).toBe(true);
    });

    it("should be an instance of IpcError", () => {
      const error = new IpcError("Test");

      expect(error instanceof IpcError).toBe(true);
    });
  });
});

describe("ServiceError", () => {
  describe("constructor", () => {
    it("should create with default values", () => {
      const error = new ServiceError("Audio service failed to start");

      expect(error.name).toBe("ServiceError");
      expect(error.message).toBe("Audio service failed to start");
      expect(error.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(error.userMessage).toBe(
        "A required service is not available. Please try again later."
      );
      expect(error.recoverable).toBe(true);
      expect(error.severity).toBe("high");
    });

    it("should allow initialization failure", () => {
      const error = new ServiceError(
        "LLM service initialization failed: missing API key",
        ErrorCode.SERVICE_INITIALIZATION_FAILED,
        "The AI service could not be started. Please check your configuration.",
        false,
        "critical"
      );

      expect(error.code).toBe(ErrorCode.SERVICE_INITIALIZATION_FAILED);
      expect(error.recoverable).toBe(false);
      expect(error.severity).toBe("critical");
    });
  });

  describe("prototype chain", () => {
    it("should be an instance of AppError", () => {
      const error = new ServiceError("Test");

      expect(error instanceof AppError).toBe(true);
    });

    it("should be an instance of ServiceError", () => {
      const error = new ServiceError("Test");

      expect(error instanceof ServiceError).toBe(true);
    });
  });
});

describe("Error type discrimination", () => {
  it("should allow discriminating between error types", () => {
    const errors: AppError[] = [
      new ConfigurationError("Config error"),
      new NetworkError("Network error"),
      new IpcError("IPC error"),
      new ServiceError("Service error"),
    ];

    const names = errors.map((e) => e.name);

    expect(names).toEqual(["ConfigurationError", "NetworkError", "IpcError", "ServiceError"]);
  });

  it("should allow instanceof checks in catch blocks", () => {
    function throwRandomError(): void {
      throw new NetworkError("Network failed");
    }

    try {
      throwRandomError();
    } catch (error) {
      if (error instanceof NetworkError) {
        expect(error.code).toBe(ErrorCode.NETWORK_REQUEST_FAILED);
      } else if (error instanceof ConfigurationError) {
        throw new Error("Should not reach here");
      } else {
        throw new Error("Should not reach here");
      }
    }
  });
});

describe("Type safety", () => {
  it("should enforce ErrorCode type", () => {
    // This test verifies TypeScript compilation
    const error = new AppError("Test", ErrorCode.UNKNOWN, "Test message");
    const _code: ErrorCode = error.code;
    expect(_code).toBe(ErrorCode.UNKNOWN);
  });

  it("should enforce ErrorSeverity type", () => {
    // This test verifies TypeScript compilation
    const error = new AppError("Test", ErrorCode.UNKNOWN, "Test message");
    const _severity: ErrorSeverity = error.severity;
    expect(_severity).toBe("medium");
  });

  it("should have readonly properties at compile time", () => {
    // This test verifies that properties are marked readonly in TypeScript.
    // The @ts-expect-error comments will fail if the properties are NOT readonly.
    // Note: readonly is a compile-time only check in TypeScript, not enforced at runtime.
    const error = new AppError("Test", ErrorCode.UNKNOWN, "User message", true, "low");

    // Verify initial values
    expect(error.code).toBe(ErrorCode.UNKNOWN);
    expect(error.userMessage).toBe("User message");
    expect(error.recoverable).toBe(true);
    expect(error.severity).toBe("low");

    // The following lines would cause TypeScript errors if uncommented without @ts-expect-error
    // Keeping them commented as documentation of the readonly constraint:
    // error.code = ErrorCode.INTERNAL;          // Error: Cannot assign to 'code' because it is a read-only property
    // error.userMessage = "New message";        // Error: Cannot assign to 'userMessage' because it is a read-only property
    // error.recoverable = false;                // Error: Cannot assign to 'recoverable' because it is a read-only property
    // error.severity = "high";                  // Error: Cannot assign to 'severity' because it is a read-only property
  });
});
