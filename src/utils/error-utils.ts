/**
 * Error wrapping utilities for SmartHole application.
 * Converts unknown caught values into typed AppError instances.
 *
 * This module provides utilities to safely convert any caught value
 * (Error, string, or unknown) into a typed AppError, ensuring consistent
 * error handling throughout the codebase.
 */

import { AppError } from "./errors";
import { ErrorCode, ErrorSeverity } from "../types/errors";
import { getUserMessage } from "./error-messages";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for wrapping errors.
 */
export interface WrapErrorOptions {
  /** Error code to assign if not already an AppError */
  code?: ErrorCode;
  /** Override the user message */
  userMessage?: string;
  /** Whether the error is recoverable */
  recoverable?: boolean;
  /** Error severity */
  severity?: ErrorSeverity;
}

// ============================================================================
// Error Wrapping Functions
// ============================================================================

/**
 * Converts any caught value to an AppError.
 *
 * Handles:
 * - AppError (returned as-is or with option overrides)
 * - Error instances (wrapped with cause chain)
 * - Strings (converted to Error message)
 * - Unknown values (converted to string representation)
 *
 * @param error - The caught value to wrap
 * @param options - Options to customize the wrapped error
 * @returns A typed AppError instance
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const appError = wrapError(error, { code: ErrorCode.SERVICE_UNAVAILABLE });
 *   // appError is now a typed AppError
 * }
 * ```
 */
export function wrapError(error: unknown, options: WrapErrorOptions = {}): AppError {
  // If already an AppError, optionally update with options
  if (error instanceof AppError) {
    if (Object.keys(options).length === 0) {
      return error;
    }
    return new AppError(
      error.message,
      options.code ?? error.code,
      options.userMessage ?? error.userMessage,
      options.recoverable ?? error.recoverable,
      options.severity ?? error.severity,
      error.cause ?? error
    );
  }

  const code = options.code ?? ErrorCode.UNKNOWN;
  const userMessage = options.userMessage ?? getUserMessage(code);
  const recoverable = options.recoverable ?? true;
  const severity = options.severity ?? "medium";

  // Handle standard Error
  if (error instanceof Error) {
    return new AppError(error.message, code, userMessage, recoverable, severity, error);
  }

  // Handle string
  if (typeof error === "string") {
    return new AppError(error, code, userMessage, recoverable, severity);
  }

  // Handle unknown (including null, undefined, objects, etc.)
  return new AppError(String(error), code, userMessage, recoverable, severity);
}

// ============================================================================
// Type Guard Functions
// ============================================================================

/**
 * Checks if an error is an AppError.
 *
 * @param error - The value to check
 * @returns true if the error is an AppError instance
 *
 * @example
 * ```ts
 * try {
 *   await operation();
 * } catch (error) {
 *   if (isAppError(error)) {
 *     // error is typed as AppError
 *     console.log(error.code);
 *   }
 * }
 * ```
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Checks if an error is a specific type of AppError.
 *
 * @param error - The value to check
 * @param ErrorClass - The error class to check against
 * @returns true if the error is an instance of the specified class
 *
 * @example
 * ```ts
 * import { NetworkError } from './errors';
 *
 * try {
 *   await apiCall();
 * } catch (error) {
 *   if (isErrorOfType(error, NetworkError)) {
 *     // error is typed as NetworkError
 *     console.log('Network issue:', error.message);
 *   }
 * }
 * ```
 */
export function isErrorOfType<T extends AppError>(
  error: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ErrorClass: abstract new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass;
}

// ============================================================================
// Error Chain Utilities
// ============================================================================

/**
 * Extracts the root cause from an error chain.
 *
 * Traverses the error's cause chain to find the original error
 * that started the chain. Useful for debugging and logging.
 *
 * @param error - The error to get the root cause from
 * @returns The root cause error (deepest in the chain)
 *
 * @example
 * ```ts
 * const rootCause = getRootCause(appError);
 * console.log('Original error:', rootCause.message);
 * ```
 */
export function getRootCause(error: Error): Error {
  let current = error;
  while (current.cause instanceof Error) {
    current = current.cause;
  }
  return current;
}
