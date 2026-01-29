---
id: T-create-error-wrapping-utility
title: Create Error Wrapping Utility
status: open
priority: high
parent: F-error-handling-framework
prerequisites:
  - T-create-error-types-and-error
  - T-create-user-facing-error
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T04:31:25.660Z
updated: 2026-01-29T04:31:25.660Z
---

# Create Error Wrapping Utility

## Context

This task is part of the **F-error-handling-framework** feature. It creates utilities to convert unknown caught errors into typed `AppError` instances.

Reference: [F-error-handling-framework](trellis://F-error-handling-framework)  
Prerequisites: [T-create-error-types-and-error](trellis://T-create-error-types-and-error), [T-create-user-facing-error](trellis://T-create-user-facing-error)

## Overview

Create a `wrapError()` utility that safely converts any caught value (which could be Error, string, or unknown) into a typed `AppError`. This ensures consistent error handling throughout the codebase.

## Files to Create/Modify

- `src/utils/error-utils.ts` - Error wrapping utilities
- Update `src/utils/index.ts` - Add export

## Implementation Requirements

### Error Wrapping Utility

````typescript
import { AppError, NetworkError, ConfigurationError, IpcError, ServiceError } from "./errors";
import { ErrorCode, ErrorSeverity } from "../types/errors";
import { getUserMessage } from "./error-messages";

/**
 * Options for wrapping errors.
 */
interface WrapErrorOptions {
  /** Error code to assign if not already an AppError */
  code?: ErrorCode;
  /** Override the user message */
  userMessage?: string;
  /** Whether the error is recoverable */
  recoverable?: boolean;
  /** Error severity */
  severity?: ErrorSeverity;
}

/**
 * Converts any caught value to an AppError.
 *
 * Handles:
 * - AppError (returned as-is or with option overrides)
 * - Error instances (wrapped with cause chain)
 * - Strings (converted to Error message)
 * - Unknown values (converted to string representation)
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

  // Handle unknown
  return new AppError(String(error), code, userMessage, recoverable, severity);
}

/**
 * Checks if an error is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Checks if an error is a specific type of AppError.
 */
export function isErrorOfType<T extends AppError>(
  error: unknown,
  ErrorClass: new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass;
}

/**
 * Extracts the root cause from an error chain.
 */
export function getRootCause(error: Error): Error {
  let current = error;
  while (current.cause instanceof Error) {
    current = current.cause;
  }
  return current;
}
````

## Usage Pattern

```typescript
// In application code
try {
  await apiCall();
} catch (error) {
  const appError = wrapError(error, {
    code: ErrorCode.NETWORK_REQUEST_FAILED,
  });

  logger.error(appError.message, { code: appError.code });
  showNotification(appError.userMessage);
}
```

## Acceptance Criteria

1. [ ] `wrapError()` handles AppError inputs (returns as-is or with overrides)
2. [ ] `wrapError()` handles Error inputs (wraps with cause chain)
3. [ ] `wrapError()` handles string inputs
4. [ ] `wrapError()` handles unknown/null/undefined inputs
5. [ ] Default code is `ErrorCode.UNKNOWN`
6. [ ] User message defaults to `getUserMessage(code)`
7. [ ] `isAppError()` type guard works correctly
8. [ ] `isErrorOfType()` checks for specific error subclasses
9. [ ] `getRootCause()` traverses cause chain to find root
10. [ ] Export added to `src/utils/index.ts`

## Testing Requirements

Create `src/utils/error-utils.test.ts` with tests for:

- `wrapError()` with AppError input
- `wrapError()` with standard Error input
- `wrapError()` with string input
- `wrapError()` with null/undefined
- `wrapError()` with option overrides
- `isAppError()` type guard
- `isErrorOfType()` with subclasses
- `getRootCause()` with nested cause chain

## Security Considerations

- Ensure wrapped error messages don't expose sensitive data from original error
- The cause chain is preserved for debugging but not exposed in userMessage
