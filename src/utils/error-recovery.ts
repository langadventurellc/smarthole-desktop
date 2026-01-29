/**
 * Error recovery utilities for SmartHole application.
 * Provides retry with backoff, fallback patterns, and recovery strategy determination.
 *
 * This module implements common error recovery patterns to handle transient failures
 * gracefully and provide appropriate recovery strategies based on error types.
 */

import { AppError } from "./errors";
import { ErrorCode } from "../types/errors";
import { wrapError } from "./error-utils";
import { Result, ok, err } from "../types/common";

// ============================================================================
// Types
// ============================================================================

/**
 * Recovery strategies for error handling.
 *
 * - `retry`: Attempt the operation again (for transient failures)
 * - `fallback`: Use a default/cached value
 * - `notify`: Alert the user but continue
 * - `shutdown`: Graceful shutdown required (unrecoverable)
 */
export type RecoveryStrategy = "retry" | "fallback" | "notify" | "shutdown";

/**
 * Configuration for retry with backoff.
 *
 * Note: To filter which errors should be retried, use `isRetryable()` before
 * calling `retryWithBackoff()`. The retry function itself will attempt all
 * errors up to maxAttempts.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  multiplier?: number;
  /** Optional jitter factor 0-1 (default: 0.1) */
  jitter?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default retryable error codes (transient failures).
 * These are network-related errors that are typically temporary.
 */
const DEFAULT_RETRYABLE_CODES: ErrorCode[] = [
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.NETWORK_REQUEST_FAILED,
  ErrorCode.SERVICE_UNAVAILABLE,
];

// ============================================================================
// Sleep Utility
// ============================================================================

/**
 * Promise-based sleep utility.
 *
 * @param ms - Number of milliseconds to sleep
 * @returns A promise that resolves after the specified delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Retry with Backoff
// ============================================================================

/**
 * Executes an async operation with retry and exponential backoff.
 *
 * Uses exponential backoff with optional jitter to prevent thundering herd
 * problems when multiple clients retry simultaneously.
 *
 * @param operation - The async operation to execute
 * @param options - Configuration for retry behavior
 * @returns A Result containing the operation result or the last error
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => fetchData(),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.value);
 * } else {
 *   console.log('Failed after retries:', result.error.message);
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<Result<T, AppError>> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    multiplier = 2,
    jitter = 0.1,
  } = options;

  let lastError: AppError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      return ok(result);
    } catch (error) {
      lastError = wrapError(error);

      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = initialDelayMs * Math.pow(multiplier, attempt - 1);
      const jitterAmount = baseDelay * jitter * Math.random();
      const delay = Math.min(baseDelay + jitterAmount, maxDelayMs);

      await sleep(delay);
    }
  }

  return err(lastError!);
}

// ============================================================================
// Fallback Patterns
// ============================================================================

/**
 * Executes an operation with a fallback value on failure.
 *
 * Useful for operations where a default value can be used if the primary
 * operation fails (e.g., loading config with fallback to defaults).
 *
 * @param operation - The operation to execute (sync or async)
 * @param fallbackValue - The value to return if the operation fails
 * @param onError - Optional callback invoked when an error occurs
 * @returns The operation result or the fallback value
 *
 * @example
 * ```ts
 * const config = await withFallback(
 *   () => loadConfig(),
 *   DEFAULT_CONFIG,
 *   (error) => console.log('Using default config:', error.message)
 * );
 * ```
 */
export async function withFallback<T>(
  operation: () => Promise<T> | T,
  fallbackValue: T,
  onError?: (error: AppError) => void
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const appError = wrapError(error);
    onError?.(appError);
    return fallbackValue;
  }
}

/**
 * Synchronous version of withFallback.
 *
 * @param operation - The synchronous operation to execute
 * @param fallbackValue - The value to return if the operation fails
 * @param onError - Optional callback invoked when an error occurs
 * @returns The operation result or the fallback value
 *
 * @example
 * ```ts
 * const value = withFallbackSync(
 *   () => JSON.parse(data),
 *   {},
 *   (error) => console.log('Parse failed:', error.message)
 * );
 * ```
 */
export function withFallbackSync<T>(
  operation: () => T,
  fallbackValue: T,
  onError?: (error: AppError) => void
): T {
  try {
    return operation();
  } catch (error) {
    const appError = wrapError(error);
    onError?.(appError);
    return fallbackValue;
  }
}

// ============================================================================
// Recovery Strategy Determination
// ============================================================================

/**
 * Determines the appropriate recovery strategy for an error.
 *
 * The strategy is determined based on:
 * 1. Recoverability flag - non-recoverable errors trigger shutdown
 * 2. Severity level - critical severity triggers shutdown
 * 3. Error code - network/service errors suggest retry, config errors suggest fallback
 * 4. Default - notify the user
 *
 * @param error - The AppError to analyze
 * @returns The recommended recovery strategy
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const appError = wrapError(error);
 *   const strategy = getRecoveryStrategy(appError);
 *
 *   switch (strategy) {
 *     case 'retry':
 *       return await retryWithBackoff(() => riskyOperation());
 *     case 'fallback':
 *       return DEFAULT_VALUE;
 *     case 'notify':
 *       showNotification(appError.userMessage);
 *       break;
 *     case 'shutdown':
 *       await gracefulShutdown();
 *       break;
 *   }
 * }
 * ```
 */
export function getRecoveryStrategy(error: AppError): RecoveryStrategy {
  // Non-recoverable errors should trigger shutdown
  if (!error.recoverable) {
    return "shutdown";
  }

  // Critical severity requires shutdown
  if (error.severity === "critical") {
    return "shutdown";
  }

  // Retryable network/service errors
  if (DEFAULT_RETRYABLE_CODES.includes(error.code)) {
    return "retry";
  }

  // Configuration errors can use fallback
  if (error.code.startsWith("CONFIG_")) {
    return "fallback";
  }

  // Default to notify user
  return "notify";
}

/**
 * Checks if an error is retryable based on its code.
 *
 * An error is considered retryable if:
 * 1. It is marked as recoverable
 * 2. Its error code is in the list of retryable codes
 *
 * @param error - The AppError to check
 * @param retryableCodes - Optional custom list of retryable error codes
 * @returns true if the error is retryable
 *
 * @example
 * ```ts
 * if (isRetryable(appError)) {
 *   return await retryWithBackoff(() => operation());
 * }
 * ```
 */
export function isRetryable(
  error: AppError,
  retryableCodes: ErrorCode[] = DEFAULT_RETRYABLE_CODES
): boolean {
  return error.recoverable && retryableCodes.includes(error.code);
}
