import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  retryWithBackoff,
  withFallback,
  withFallbackSync,
  getRecoveryStrategy,
  isRetryable,
  RetryOptions,
} from "./error-recovery";
import { AppError, NetworkError, ConfigurationError, ServiceError } from "./errors";
import { ErrorCode } from "../types/errors";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful operations", () => {
    it("should succeed on first attempt", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const resultPromise = retryWithBackoff(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe("success");
      }
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should succeed after transient failure", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Transient failure"))
        .mockResolvedValue("success");

      const resultPromise = retryWithBackoff(operation);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe("success");
      }
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("should succeed on last attempt", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValue("success");

      const resultPromise = retryWithBackoff(operation, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe("success");
      }
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe("failed operations", () => {
    it("should fail after max attempts", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Always fails"));

      const resultPromise = retryWithBackoff(operation, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.message).toBe("Always fails");
      }
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should return the last error when all attempts fail", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockRejectedValueOnce(new Error("Error 3"));

      const resultPromise = retryWithBackoff(operation, { maxAttempts: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Error 3");
      }
    });

    it("should wrap non-AppError errors", async () => {
      const operation = vi.fn().mockRejectedValue("string error");

      const resultPromise = retryWithBackoff(operation, { maxAttempts: 1 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error.message).toBe("string error");
      }
    });
  });

  describe("backoff delay calculation", () => {
    it("should apply exponential backoff", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const options: RetryOptions = {
        maxAttempts: 4,
        initialDelayMs: 1000,
        multiplier: 2,
        jitter: 0, // No jitter for predictable delays
      };

      const resultPromise = retryWithBackoff(operation, options);

      // Advance through each delay
      // Attempt 1 fails -> delay 1000ms (1000 * 2^0)
      await vi.advanceTimersByTimeAsync(1000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Attempt 2 fails -> delay 2000ms (1000 * 2^1)
      await vi.advanceTimersByTimeAsync(2000);
      expect(operation).toHaveBeenCalledTimes(3);

      // Attempt 3 fails -> delay 4000ms (1000 * 2^2)
      await vi.advanceTimersByTimeAsync(4000);
      expect(operation).toHaveBeenCalledTimes(4);

      await resultPromise;
    });

    it("should respect maxDelayMs cap", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const options: RetryOptions = {
        maxAttempts: 5,
        initialDelayMs: 10000,
        maxDelayMs: 15000,
        multiplier: 2,
        jitter: 0,
      };

      const resultPromise = retryWithBackoff(operation, options);

      // First delay would be 10000ms, capped at 15000
      await vi.advanceTimersByTimeAsync(10000);
      expect(operation).toHaveBeenCalledTimes(2);

      // Second delay would be 20000ms, capped at 15000
      await vi.advanceTimersByTimeAsync(15000);
      expect(operation).toHaveBeenCalledTimes(3);

      // Third delay would be 40000ms, capped at 15000
      await vi.advanceTimersByTimeAsync(15000);
      expect(operation).toHaveBeenCalledTimes(4);

      await vi.runAllTimersAsync();
      await resultPromise;
    });

    it("should apply jitter to delays", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));
      const mathRandomSpy = vi.spyOn(Math, "random");

      // Test with jitter = 0.5 and random returning 0.5
      // Delay = baseDelay + (baseDelay * 0.5 * 0.5) = baseDelay * 1.25
      mathRandomSpy.mockReturnValue(0.5);

      const options: RetryOptions = {
        maxAttempts: 2,
        initialDelayMs: 1000,
        multiplier: 1,
        jitter: 0.5,
      };

      const resultPromise = retryWithBackoff(operation, options);

      // Base delay is 1000, jitter adds 1000 * 0.5 * 0.5 = 250
      // Total delay = 1250ms
      await vi.advanceTimersByTimeAsync(1250);
      expect(operation).toHaveBeenCalledTimes(2);

      await vi.runAllTimersAsync();
      await resultPromise;

      mathRandomSpy.mockRestore();
    });

    it("should vary delays with different random values", async () => {
      const delays: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;

      vi.spyOn(globalThis, "setTimeout").mockImplementation(((
        callback: () => void,
        delay?: number
      ) => {
        if (delay !== undefined && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback, delay);
      }) as typeof setTimeout);

      const mathRandomSpy = vi.spyOn(Math, "random");
      mathRandomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);

      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const options: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        multiplier: 1,
        jitter: 0.5,
      };

      const resultPromise = retryWithBackoff(operation, options);
      await vi.runAllTimersAsync();
      await resultPromise;

      // With jitter 0.5 and base 1000:
      // First delay: 1000 + (1000 * 0.5 * 0.1) = 1050
      // Second delay: 1000 + (1000 * 0.5 * 0.9) = 1450
      expect(delays[0]).toBeCloseTo(1050, 0);
      expect(delays[1]).toBeCloseTo(1450, 0);
      expect(delays[0]).not.toBe(delays[1]);

      mathRandomSpy.mockRestore();
      vi.mocked(globalThis.setTimeout).mockRestore();
    });
  });

  describe("default options", () => {
    it("should use default maxAttempts of 3", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const resultPromise = retryWithBackoff(operation);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should use default initialDelayMs of 1000", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValue("success");

      const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

      const resultPromise = retryWithBackoff(operation);

      // Should wait 1000ms before second attempt
      await vi.advanceTimersByTimeAsync(999);
      expect(operation).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(operation).toHaveBeenCalledTimes(2);

      await resultPromise;
      mathRandomSpy.mockRestore();
    });
  });

  describe("custom options", () => {
    it("should respect custom maxAttempts", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const resultPromise = retryWithBackoff(operation, { maxAttempts: 5 });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(operation).toHaveBeenCalledTimes(5);
    });

    it("should respect custom multiplier", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));
      const mathRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

      const options: RetryOptions = {
        maxAttempts: 3,
        initialDelayMs: 100,
        multiplier: 3, // 100, 300, 900
        jitter: 0,
      };

      const resultPromise = retryWithBackoff(operation, options);

      await vi.advanceTimersByTimeAsync(100);
      expect(operation).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(300);
      expect(operation).toHaveBeenCalledTimes(3);

      await vi.runAllTimersAsync();
      await resultPromise;
      mathRandomSpy.mockRestore();
    });
  });
});

describe("withFallback", () => {
  describe("successful operations", () => {
    it("should return primary value on success", async () => {
      const operation = vi.fn().mockResolvedValue("primary");

      const result = await withFallback(operation, "fallback");

      expect(result).toBe("primary");
    });

    it("should return primary value for sync operation", async () => {
      const operation = vi.fn().mockReturnValue("primary");

      const result = await withFallback(operation, "fallback");

      expect(result).toBe("primary");
    });

    it("should not call onError on success", async () => {
      const operation = vi.fn().mockResolvedValue("primary");
      const onError = vi.fn();

      await withFallback(operation, "fallback", onError);

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("failed operations", () => {
    it("should return fallback value on error", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Failure"));

      const result = await withFallback(operation, "fallback");

      expect(result).toBe("fallback");
    });

    it("should return fallback value for thrown sync error", async () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error("Sync failure");
      });

      const result = await withFallback(operation, "fallback");

      expect(result).toBe("fallback");
    });

    it("should call onError callback with wrapped AppError", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Test error"));
      const onError = vi.fn();

      await withFallback(operation, "fallback", onError);

      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Test error");
    });

    it("should pass through AppError to onError callback", async () => {
      const appError = new NetworkError("Network failed");
      const operation = vi.fn().mockRejectedValue(appError);
      const onError = vi.fn();

      await withFallback(operation, "fallback", onError);

      expect(onError).toHaveBeenCalledWith(appError);
    });
  });

  describe("with different fallback types", () => {
    it("should work with object fallback", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));
      const fallback = { key: "value" };

      const result = await withFallback(operation, fallback);

      expect(result).toBe(fallback);
    });

    it("should work with array fallback", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));
      const fallback = [1, 2, 3];

      const result = await withFallback(operation, fallback);

      expect(result).toBe(fallback);
    });

    it("should work with null fallback", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const result = await withFallback(operation, null);

      expect(result).toBeNull();
    });

    it("should work with undefined fallback", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Fail"));

      const result = await withFallback(operation, undefined);

      expect(result).toBeUndefined();
    });
  });
});

describe("withFallbackSync", () => {
  describe("successful operations", () => {
    it("should return primary value on success", () => {
      const operation = vi.fn().mockReturnValue("primary");

      const result = withFallbackSync(operation, "fallback");

      expect(result).toBe("primary");
    });

    it("should not call onError on success", () => {
      const operation = vi.fn().mockReturnValue("primary");
      const onError = vi.fn();

      withFallbackSync(operation, "fallback", onError);

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe("failed operations", () => {
    it("should return fallback value on error", () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error("Sync failure");
      });

      const result = withFallbackSync(operation, "fallback");

      expect(result).toBe("fallback");
    });

    it("should call onError callback with wrapped AppError", () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      const onError = vi.fn();

      withFallbackSync(operation, "fallback", onError);

      expect(onError).toHaveBeenCalledTimes(1);
      const error = onError.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe("Test error");
    });

    it("should pass through AppError to onError callback", () => {
      const appError = new ConfigurationError("Config invalid");
      const operation = vi.fn().mockImplementation(() => {
        throw appError;
      });
      const onError = vi.fn();

      withFallbackSync(operation, "fallback", onError);

      expect(onError).toHaveBeenCalledWith(appError);
    });
  });

  describe("with different fallback types", () => {
    it("should work with object fallback", () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error("Fail");
      });
      const fallback = { config: true };

      const result = withFallbackSync(operation, fallback);

      expect(result).toBe(fallback);
    });

    it("should work with number fallback", () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error("Fail");
      });

      const result = withFallbackSync(operation, 42);

      expect(result).toBe(42);
    });
  });
});

describe("getRecoveryStrategy", () => {
  describe("shutdown strategy", () => {
    it("should return shutdown for non-recoverable errors", () => {
      const error = new AppError(
        "Fatal error",
        ErrorCode.INTERNAL,
        "Something went wrong",
        false, // not recoverable
        "high"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("shutdown");
    });

    it("should return shutdown for critical severity", () => {
      const error = new AppError(
        "Critical failure",
        ErrorCode.INTERNAL,
        "Critical error occurred",
        true,
        "critical"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("shutdown");
    });

    it("should prioritize non-recoverable over other factors", () => {
      const error = new AppError(
        "Network timeout",
        ErrorCode.NETWORK_TIMEOUT, // Would suggest retry
        "Timeout",
        false, // But not recoverable
        "low"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("shutdown");
    });
  });

  describe("retry strategy", () => {
    it("should return retry for NETWORK_TIMEOUT", () => {
      const error = new NetworkError(
        "Request timed out",
        ErrorCode.NETWORK_TIMEOUT,
        "The request timed out"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("retry");
    });

    it("should return retry for NETWORK_REQUEST_FAILED", () => {
      const error = new NetworkError(
        "Request failed",
        ErrorCode.NETWORK_REQUEST_FAILED,
        "The request failed"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("retry");
    });

    it("should return retry for SERVICE_UNAVAILABLE", () => {
      const error = new ServiceError(
        "Service unavailable",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service is unavailable"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("retry");
    });
  });

  describe("fallback strategy", () => {
    it("should return fallback for CONFIG_INVALID", () => {
      const error = new ConfigurationError(
        "Invalid config",
        ErrorCode.CONFIG_INVALID,
        "Configuration is invalid"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("fallback");
    });

    it("should return fallback for CONFIG_LOAD_FAILED", () => {
      const error = new ConfigurationError(
        "Failed to load config",
        ErrorCode.CONFIG_LOAD_FAILED,
        "Could not load configuration"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("fallback");
    });

    it("should return fallback for CONFIG_SAVE_FAILED", () => {
      const error = new ConfigurationError(
        "Failed to save config",
        ErrorCode.CONFIG_SAVE_FAILED,
        "Could not save configuration"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("fallback");
    });
  });

  describe("notify strategy", () => {
    it("should return notify for UNKNOWN error", () => {
      const error = new AppError(
        "Unknown error",
        ErrorCode.UNKNOWN,
        "Something went wrong",
        true,
        "medium"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("notify");
    });

    it("should return notify for INTERNAL error", () => {
      const error = new AppError(
        "Internal error",
        ErrorCode.INTERNAL,
        "An internal error occurred",
        true,
        "medium"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("notify");
    });

    it("should return notify for IPC errors", () => {
      const error = new AppError(
        "IPC error",
        ErrorCode.IPC_HANDLER_FAILED,
        "Communication error",
        true,
        "high"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("notify");
    });

    it("should return notify for STT errors", () => {
      const error = new AppError(
        "STT failed",
        ErrorCode.STT_TRANSCRIPTION_FAILED,
        "Transcription failed",
        true,
        "medium"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("notify");
    });

    it("should return notify for LLM errors", () => {
      const error = new AppError(
        "LLM failed",
        ErrorCode.LLM_REQUEST_FAILED,
        "Request to LLM failed",
        true,
        "medium"
      );

      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe("notify");
    });
  });
});

describe("isRetryable", () => {
  describe("with default retryable codes", () => {
    it("should return true for NETWORK_TIMEOUT", () => {
      const error = new NetworkError("Timeout", ErrorCode.NETWORK_TIMEOUT, "Request timed out");

      expect(isRetryable(error)).toBe(true);
    });

    it("should return true for NETWORK_REQUEST_FAILED", () => {
      const error = new NetworkError(
        "Request failed",
        ErrorCode.NETWORK_REQUEST_FAILED,
        "Request failed"
      );

      expect(isRetryable(error)).toBe(true);
    });

    it("should return true for SERVICE_UNAVAILABLE", () => {
      const error = new ServiceError(
        "Unavailable",
        ErrorCode.SERVICE_UNAVAILABLE,
        "Service unavailable"
      );

      expect(isRetryable(error)).toBe(true);
    });

    it("should return false for non-retryable codes", () => {
      const error = new AppError(
        "Internal error",
        ErrorCode.INTERNAL,
        "Internal error",
        true,
        "medium"
      );

      expect(isRetryable(error)).toBe(false);
    });

    it("should return false for non-recoverable errors even with retryable code", () => {
      const error = new AppError(
        "Timeout",
        ErrorCode.NETWORK_TIMEOUT,
        "Request timed out",
        false, // Not recoverable
        "high"
      );

      expect(isRetryable(error)).toBe(false);
    });
  });

  describe("with custom retryable codes", () => {
    it("should use custom codes list", () => {
      const error = new AppError(
        "Internal error",
        ErrorCode.INTERNAL,
        "Internal error",
        true,
        "medium"
      );

      const customCodes = [ErrorCode.INTERNAL, ErrorCode.UNKNOWN];

      expect(isRetryable(error, customCodes)).toBe(true);
    });

    it("should not match default codes when using custom list", () => {
      const error = new NetworkError("Timeout", ErrorCode.NETWORK_TIMEOUT, "Request timed out");

      const customCodes = [ErrorCode.INTERNAL];

      expect(isRetryable(error, customCodes)).toBe(false);
    });

    it("should return false for empty custom codes list", () => {
      const error = new NetworkError("Timeout", ErrorCode.NETWORK_TIMEOUT, "Request timed out");

      expect(isRetryable(error, [])).toBe(false);
    });
  });

  describe("recoverable flag check", () => {
    it("should return false when recoverable is false", () => {
      const error = new AppError(
        "Fatal network error",
        ErrorCode.NETWORK_TIMEOUT,
        "Network error",
        false,
        "critical"
      );

      expect(isRetryable(error)).toBe(false);
    });

    it("should return true when recoverable is true and code matches", () => {
      const error = new AppError(
        "Transient network error",
        ErrorCode.NETWORK_TIMEOUT,
        "Network error",
        true,
        "medium"
      );

      expect(isRetryable(error)).toBe(true);
    });
  });
});

describe("Integration scenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should combine isRetryable check with retryWithBackoff", async () => {
    const networkError = new NetworkError(
      "Timeout",
      ErrorCode.NETWORK_TIMEOUT,
      "Request timed out"
    );

    let attempts = 0;
    const operation = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw networkError;
      }
      return "success";
    });

    // Only retry if the error is retryable
    const wrappedOperation = async () => {
      try {
        return await operation();
      } catch (error) {
        if (error instanceof AppError && isRetryable(error)) {
          throw error; // Let retryWithBackoff handle it
        }
        throw error;
      }
    };

    const resultPromise = retryWithBackoff(wrappedOperation);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe("success");
    }
  });

  it("should use fallback when retry fails", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Always fails"));

    const resultPromise = retryWithBackoff(operation, { maxAttempts: 2 });
    await vi.runAllTimersAsync();
    const retryResult = await resultPromise;

    const finalResult = retryResult.success
      ? retryResult.value
      : await withFallback(
          () => {
            throw retryResult.error;
          },
          "default",
          () => {
            /* logged */
          }
        );

    expect(finalResult).toBe("default");
  });

  it("should determine strategy and handle error appropriately", async () => {
    const errors = [
      new NetworkError("Timeout", ErrorCode.NETWORK_TIMEOUT, "Timed out"),
      new ConfigurationError("Invalid", ErrorCode.CONFIG_INVALID, "Invalid config"),
      new AppError("Unknown", ErrorCode.UNKNOWN, "Unknown error", true, "medium"),
      new AppError("Fatal", ErrorCode.INTERNAL, "Fatal", false, "critical"),
    ];

    const strategies = errors.map(getRecoveryStrategy);

    expect(strategies).toEqual(["retry", "fallback", "notify", "shutdown"]);
  });
});
