/**
 * Application error classes for SmartHole.
 * Provides a type-safe error hierarchy with support for error codes,
 * user-friendly messages, recoverability, and error chaining.
 */

import { ErrorCode, ErrorSeverity } from "../types/errors";

// ============================================================================
// Serialized Error Type (for IPC transport)
// ============================================================================

/**
 * JSON-serializable representation of an AppError.
 * Used for transporting errors across IPC boundaries.
 */
export interface SerializedAppError {
  name: string;
  message: string;
  code: ErrorCode;
  userMessage: string;
  recoverable: boolean;
  severity: ErrorSeverity;
  stack?: string;
  cause?: SerializedAppError | { name: string; message: string; stack?: string };
}

// ============================================================================
// Base AppError Class
// ============================================================================

/**
 * Base application error with code, user message, and recoverability.
 *
 * All application-specific errors should extend this class.
 * Supports:
 * - Error codes for programmatic handling
 * - User-friendly messages (safe to display)
 * - Recoverability flag for determining error handling strategy
 * - Severity levels for prioritization
 * - Error cause chaining (ES2022)
 * - JSON serialization for IPC transport
 *
 * @example
 * ```ts
 * throw new AppError(
 *   "Database connection failed: ECONNREFUSED",
 *   ErrorCode.SERVICE_UNAVAILABLE,
 *   "Unable to connect to the database. Please try again later.",
 *   true, // recoverable
 *   "high",
 *   originalError
 * );
 * ```
 */
export class AppError extends Error {
  /**
   * Creates a new AppError instance.
   *
   * @param message - Technical/developer-facing error message
   * @param code - Error code for programmatic handling
   * @param userMessage - User-facing message (safe to display, no sensitive data)
   * @param recoverable - Whether the error is recoverable (retry, fallback possible)
   * @param severity - Error severity level
   * @param cause - Original error that caused this error (for chaining)
   */
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly recoverable: boolean = true,
    public readonly severity: ErrorSeverity = "medium",
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "AppError";

    // Maintain proper prototype chain for instanceof checks
    // This is required when extending built-in classes like Error in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace, excluding constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  /**
   * Creates a JSON-serializable representation for IPC transport.
   * Safe to send across process boundaries.
   *
   * Note: Stack traces are included for debugging but should be
   * filtered before displaying to end users.
   *
   * @returns A plain object representation of the error
   */
  toJSON(): SerializedAppError {
    const serialized: SerializedAppError = {
      name: this.name,
      message: this.message,
      code: this.code,
      userMessage: this.userMessage,
      recoverable: this.recoverable,
      severity: this.severity,
    };

    // Include stack for debugging (filter before displaying to users)
    if (this.stack) {
      serialized.stack = this.stack;
    }

    // Serialize cause if present
    if (this.cause) {
      if (this.cause instanceof AppError) {
        serialized.cause = this.cause.toJSON();
      } else {
        serialized.cause = {
          name: this.cause.name,
          message: this.cause.message,
          stack: this.cause.stack,
        };
      }
    }

    return serialized;
  }

  /**
   * Reconstructs an AppError from a serialized representation.
   * Useful for deserializing errors received over IPC.
   *
   * @param data - Serialized error data
   * @returns A new AppError instance
   */
  static fromJSON(data: SerializedAppError): AppError {
    let cause: Error | undefined;

    if (data.cause) {
      if ("code" in data.cause) {
        // It's a serialized AppError
        cause = AppError.fromJSON(data.cause as SerializedAppError);
      } else {
        // It's a plain error
        const plainError = new Error(data.cause.message);
        plainError.name = data.cause.name;
        if (data.cause.stack) {
          plainError.stack = data.cause.stack;
        }
        cause = plainError;
      }
    }

    const error = new AppError(
      data.message,
      data.code,
      data.userMessage,
      data.recoverable,
      data.severity,
      cause
    );

    // Restore the original stack if provided
    if (data.stack) {
      error.stack = data.stack;
    }

    return error;
  }
}

// ============================================================================
// Specific Error Subclasses
// ============================================================================

/**
 * Error related to application configuration.
 *
 * Default severity: medium (can usually fall back to defaults)
 * Default recoverable: true (can often retry or use defaults)
 */
export class ConfigurationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CONFIG_INVALID,
    userMessage: string = "There was a problem with the application settings.",
    recoverable: boolean = true,
    severity: ErrorSeverity = "medium",
    cause?: Error
  ) {
    super(message, code, userMessage, recoverable, severity, cause);
    this.name = "ConfigurationError";
  }
}

/**
 * Error related to network operations (HTTP requests, connectivity).
 *
 * Default severity: medium (often transient)
 * Default recoverable: true (network issues are usually transient)
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_REQUEST_FAILED,
    userMessage: string = "A network error occurred. Please check your connection and try again.",
    recoverable: boolean = true,
    severity: ErrorSeverity = "medium",
    cause?: Error
  ) {
    super(message, code, userMessage, recoverable, severity, cause);
    this.name = "NetworkError";
  }
}

/**
 * Error related to IPC (Inter-Process Communication) between main and renderer.
 *
 * Default severity: high (IPC failures can break core functionality)
 * Default recoverable: false (IPC errors often indicate structural problems)
 */
export class IpcError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.IPC_HANDLER_FAILED,
    userMessage: string = "An internal communication error occurred. Please restart the application.",
    recoverable: boolean = false,
    severity: ErrorSeverity = "high",
    cause?: Error
  ) {
    super(message, code, userMessage, recoverable, severity, cause);
    this.name = "IpcError";
  }
}

/**
 * Error related to service availability or initialization.
 *
 * Default severity: high (service failures affect functionality)
 * Default recoverable: true (services can often be restarted)
 */
export class ServiceError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SERVICE_UNAVAILABLE,
    userMessage: string = "A required service is not available. Please try again later.",
    recoverable: boolean = true,
    severity: ErrorSeverity = "high",
    cause?: Error
  ) {
    super(message, code, userMessage, recoverable, severity, cause);
    this.name = "ServiceError";
  }
}
