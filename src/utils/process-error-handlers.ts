/**
 * Process error handlers for SmartHole application.
 * Registers global exception handlers in the Electron main process
 * to catch unhandled errors and rejections.
 *
 * This module provides:
 * - `uncaughtException` handler for synchronous errors
 * - `unhandledRejection` handler for promise rejections
 * - Electron-specific `render-process-gone` and `child-process-gone` handlers
 */

import { app } from "electron";
import { wrapError } from "./error-utils";
import { AppError } from "./errors";
import { ErrorCode } from "../types/errors";

// ============================================================================
// Types
// ============================================================================

/**
 * Logger interface for dependency injection.
 * Allows testing without actual logger dependency.
 */
export interface ErrorLogger {
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Options for process error handler registration.
 */
export interface ProcessErrorHandlerOptions {
  /** Logger instance for error reporting */
  logger?: ErrorLogger;
  /** Called before app exits on fatal error */
  onFatalError?: (error: AppError) => void;
  /** Whether to exit on uncaught exception (default: true in production) */
  exitOnUncaught?: boolean;
}

// ============================================================================
// Default Logger
// ============================================================================

/**
 * Default console logger for fallback.
 */
const consoleLogger: ErrorLogger = {
  error: (message, context) => {
    console.error(`[FATAL] ${message}`, context);
  },
};

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Checks if running in development mode.
 */
function isDev(): boolean {
  return process.env.NODE_ENV === "development" || !app.isPackaged;
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Registers global error handlers for the main process.
 * Should be called early in application startup, before any async operations.
 *
 * Handlers registered:
 * - `uncaughtException`: Catches synchronous errors that weren't caught
 * - `unhandledRejection`: Catches unhandled promise rejections
 * - `render-process-gone`: Handles Electron renderer process crashes
 * - `child-process-gone`: Handles Electron child process crashes
 *
 * @param options - Configuration options for error handling
 *
 * @example
 * ```ts
 * // In main.ts
 * registerProcessErrorHandlers({
 *   logger: mainLogger,
 *   onFatalError: (error) => saveEmergencyState(),
 * });
 * ```
 */
export function registerProcessErrorHandlers(options: ProcessErrorHandlerOptions = {}): void {
  const { logger = consoleLogger, onFatalError, exitOnUncaught = !isDev() } = options;

  // Handle uncaught exceptions
  process.on("uncaughtException", (error: Error, origin: string) => {
    const appError = wrapError(error, {
      code: ErrorCode.INTERNAL,
      recoverable: false,
      severity: "critical",
    });

    logger.error(`Uncaught exception from ${origin}: ${appError.message}`, {
      code: appError.code,
      origin,
      stack: error.stack,
    });

    onFatalError?.(appError);

    if (exitOnUncaught) {
      // Give time for logging to complete
      setTimeout(() => {
        app.exit(1);
      }, 100);
    }
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: unknown, _promise: Promise<unknown>) => {
    const appError = wrapError(reason, {
      code: ErrorCode.INTERNAL,
      recoverable: true, // Rejections are often less fatal
      severity: "high",
    });

    logger.error(`Unhandled promise rejection: ${appError.message}`, {
      code: appError.code,
      stack: appError.cause instanceof Error ? appError.cause.stack : undefined,
    });

    // Don't exit on unhandled rejection by default
    // The app can often continue running
  });

  // Handle Electron-specific render process crashes
  app.on("render-process-gone", (_event, _webContents, details) => {
    logger.error(`Render process gone: ${details.reason}`, {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });

  // Handle child process crashes
  app.on("child-process-gone", (_event, details) => {
    logger.error(`Child process gone: ${details.reason}`, {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName,
      name: details.name,
    });
  });
}

/**
 * Unregisters error handlers.
 * Useful for testing to ensure clean state between tests.
 *
 * Warning: This removes ALL listeners for these events, not just
 * the ones registered by `registerProcessErrorHandlers`. Use with caution
 * in production code.
 */
export function unregisterProcessErrorHandlers(): void {
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");
  app.removeAllListeners("render-process-gone");
  app.removeAllListeners("child-process-gone");
}
