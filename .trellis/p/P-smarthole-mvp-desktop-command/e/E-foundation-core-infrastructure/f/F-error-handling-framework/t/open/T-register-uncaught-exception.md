---
id: T-register-uncaught-exception
title: Register Uncaught Exception Handlers in Main Process
status: open
priority: high
parent: F-error-handling-framework
prerequisites:
  - T-create-error-wrapping-utility
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T04:32:57.632Z
updated: 2026-01-29T04:32:57.632Z
---

# Register Uncaught Exception Handlers in Main Process

## Context

This task is part of the **F-error-handling-framework** feature. It sets up global exception handlers in the Electron main process to catch unhandled errors and rejections.

Reference: [F-error-handling-framework](trellis://F-error-handling-framework)  
Prerequisite: [T-create-error-wrapping-utility](trellis://T-create-error-wrapping-utility)

## Overview

Register handlers for `uncaughtException` and `unhandledRejection` in the Electron main process to:

- Log errors before potential crash
- Attempt graceful shutdown where possible
- Prevent silent failures

## Files to Create/Modify

- `src/utils/process-error-handlers.ts` - Exception handler registration
- Modify `src/main.ts` - Initialize handlers early in startup
- Update `src/utils/index.ts` - Add export

## Implementation Requirements

### Process Error Handlers

````typescript
import { app } from "electron";
import { wrapError, AppError } from "./errors";
import { ErrorCode } from "../types/errors";

/**
 * Logger interface for dependency injection.
 * Allows testing without actual logger dependency.
 */
interface ErrorLogger {
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Options for process error handler registration.
 */
interface ProcessErrorHandlerOptions {
  /** Logger instance for error reporting */
  logger?: ErrorLogger;
  /** Called before app exits on fatal error */
  onFatalError?: (error: AppError) => void;
  /** Whether to exit on uncaught exception (default: true in production) */
  exitOnUncaught?: boolean;
}

/**
 * Default console logger for fallback.
 */
const consoleLogger: ErrorLogger = {
  error: (message, context) => {
    console.error(`[FATAL] ${message}`, context);
  },
};

/**
 * Registers global error handlers for the main process.
 * Should be called early in application startup.
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
  process.on("unhandledRejection", (reason: unknown, promise: Promise<unknown>) => {
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
  app.on("render-process-gone", (event, webContents, details) => {
    logger.error(`Render process gone: ${details.reason}`, {
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });

  // Handle child process crashes
  app.on("child-process-gone", (event, details) => {
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
 * Checks if running in development mode.
 */
function isDev(): boolean {
  return process.env.NODE_ENV === "development" || !app.isPackaged;
}

/**
 * Unregisters error handlers (useful for testing).
 */
export function unregisterProcessErrorHandlers(): void {
  process.removeAllListeners("uncaughtException");
  process.removeAllListeners("unhandledRejection");
  app.removeAllListeners("render-process-gone");
  app.removeAllListeners("child-process-gone");
}
````

### Integration in main.ts

Add near the top of `src/main.ts`:

```typescript
import { registerProcessErrorHandlers } from "./utils/process-error-handlers";

// Register early, before any async operations
registerProcessErrorHandlers({
  // logger: mainLogger,  // Add when logging system is implemented
  onFatalError: (error) => {
    // Could save state, show dialog, etc.
    console.error("Fatal error:", error.message);
  },
});
```

## Acceptance Criteria

1. [ ] `registerProcessErrorHandlers()` registers `uncaughtException` handler
2. [ ] `registerProcessErrorHandlers()` registers `unhandledRejection` handler
3. [ ] `registerProcessErrorHandlers()` registers `render-process-gone` handler
4. [ ] `registerProcessErrorHandlers()` registers `child-process-gone` handler
5. [ ] Uncaught exceptions are wrapped as AppError and logged
6. [ ] Unhandled rejections are wrapped as AppError and logged
7. [ ] `onFatalError` callback is called before exit
8. [ ] App exits with code 1 on uncaught exception (in production)
9. [ ] App does NOT exit on unhandled rejection by default
10. [ ] `unregisterProcessErrorHandlers()` removes all handlers (for testing)
11. [ ] Handlers are registered in `src/main.ts`
12. [ ] Export added to `src/utils/index.ts`

## Testing Requirements

Create `src/utils/process-error-handlers.test.ts` with tests for:

- Handler registration adds listeners to process
- `unregisterProcessErrorHandlers()` removes listeners
- Uncaught exception triggers logger.error
- Unhandled rejection triggers logger.error
- `onFatalError` callback is invoked
- Error is wrapped as AppError with correct code

**Note**: Testing process handlers requires mocking:

- Mock `process.on` and `process.removeAllListeners`
- Mock `app.on` and `app.removeAllListeners` from Electron
- Use `vi.mock("electron")` to mock the app module

## Security Considerations

- Stack traces should be logged for debugging but not exposed to users
- Don't log sensitive data that might be in error messages
- The `onFatalError` callback should not throw (could cause infinite loop)
