---
id: F-error-handling-framework
title: Error Handling Framework
status: done
priority: high
parent: E-foundation-core-infrastructure
prerequisites:
  - F-core-types-ipc-architecture
affectedFiles:
  src/types/errors.ts: Created ErrorCode enum with all error codes, ErrorSeverity
    type, ERROR_SEVERITIES constant, and type guards (isErrorSeverity,
    isErrorCode)
  src/utils/errors.ts: "Created AppError base class with toJSON/fromJSON methods,
    SerializedAppError interface, and subclasses: ConfigurationError,
    NetworkError, IpcError, ServiceError"
  src/utils/index.ts: Created barrel export for utils module; Added export for
    error-messages module; Added export for error-utils module; Added export for
    error-recovery module; Added export for process-error-handlers module
  src/types/index.ts: Added export for errors.ts to barrel export
  src/utils/errors.test.ts: Created comprehensive test suite with 40 tests
    covering all error classes, serialization, prototype chain, and error cause
    chaining
  src/utils/error-messages.ts: Created ERROR_MESSAGES constant mapping all
    ErrorCode values to user-friendly messages, getUserMessage() and
    getUserMessageSafe() helper functions, and re-exported isErrorCode type
    guard
  src/utils/error-messages.test.ts: Created comprehensive test suite with 26 tests
    covering message completeness, quality (no jargon, actionable, concise),
    getUserMessage, getUserMessageSafe, and isErrorCode
  src/utils/error-utils.ts: Created error wrapping utility with wrapError(),
    isAppError(), isErrorOfType(), and getRootCause() functions
  src/utils/error-utils.test.ts: Created comprehensive test suite with 56 tests
    covering all error wrapping scenarios
  src/components/ErrorBoundary.tsx: Created Error Boundary component with
    getDerivedStateFromError, componentDidCatch, reset functionality, IPC
    reporting, and support for custom fallback UI
  src/components/ErrorBoundary.test.tsx: Created comprehensive test suite with 25
    tests covering all acceptance criteria
  src/components/index.ts: Created barrel export for components module
  src/test-setup.ts: Created vitest setup file for jest-dom matchers
  vitest.config.ts: Updated to use jsdom environment, added React plugin, and setup file
  package.json: Added @testing-library/react, @testing-library/jest-dom, and jsdom
    dev dependencies
  src/utils/error-recovery.ts: Created error recovery utilities with
    retryWithBackoff(), withFallback(), withFallbackSync(),
    getRecoveryStrategy(), and isRetryable() functions
  src/utils/error-recovery.test.ts: Created comprehensive test suite with 59 tests
    covering all acceptance criteria
  src/utils/process-error-handlers.ts: Created new module with
    registerProcessErrorHandlers() and unregisterProcessErrorHandlers()
    functions, ErrorLogger and ProcessErrorHandlerOptions interfaces, and
    isDev() helper
  src/utils/process-error-handlers.test.ts: Created comprehensive test suite with
    36 tests covering handler registration, unregistration, uncaughtException
    handling, unhandledRejection handling, render-process-gone,
    child-process-gone, options handling, and error wrapping
  src/main.ts: Added import and early registration of process error handlers with
    onFatalError callback
log:
  - "Starting feature implementation. Verified all 6 tasks exist with correct
    dependencies. Prerequisite F-core-types-ipc-architecture is complete.
    Execution order: T-create-error-types-and-error → T-create-user-facing-error
    → T-create-error-wrapping-utility → T-create-react-error-boundary →
    T-implement-error-recovery → T-register-uncaught-exception"
  - Completed T-create-error-types-and-error. Created src/types/errors.ts with
    ErrorCode enum (18 codes), ErrorSeverity type, and type guards. Created
    src/utils/errors.ts with AppError base class, toJSON/fromJSON methods, and
    subclasses (ConfigurationError, NetworkError, IpcError, ServiceError). 40
    tests passing. Proceeding to T-create-user-facing-error.
  - Completed T-create-user-facing-error. Created src/utils/error-messages.ts
    with ERROR_MESSAGES mapping for all 18 error codes, getUserMessage() and
    getUserMessageSafe() helpers. 26 tests passing. Proceeding to
    T-create-error-wrapping-utility.
  - Completed T-create-error-wrapping-utility. Created src/utils/error-utils.ts
    with wrapError(), isAppError(), isErrorOfType(), and getRootCause()
    functions. 56 tests passing. Proceeding to T-create-react-error-boundary.
  - Completed T-create-react-error-boundary. Created
    src/components/ErrorBoundary.tsx with error catching, IPC reporting, reset
    functionality, and fallback support. Added test infrastructure (jsdom,
    @testing-library/react). 25 tests passing. Proceeding to
    T-implement-error-recovery.
  - Completed T-implement-error-recovery. Created src/utils/error-recovery.ts
    with retryWithBackoff(), withFallback(), withFallbackSync(),
    getRecoveryStrategy(), and isRetryable(). 59 tests passing. Proceeding to
    final task T-register-uncaught-exception.
  - "Auto-completed: All child tasks are complete"
  - Completed T-register-uncaught-exception. Created
    src/utils/process-error-handlers.ts with registerProcessErrorHandlers() and
    unregisterProcessErrorHandlers(). Integrated into src/main.ts. 36 tests
    passing. All 6 tasks complete. Feature implementation finished.
schema: v1.0
childrenIds:
  - T-create-error-types-and-error
  - T-create-error-wrapping-utility
  - T-create-react-error-boundary
  - T-create-user-facing-error
  - T-implement-error-recovery
  - T-register-uncaught-exception
created: 2026-01-29T02:21:09.469Z
updated: 2026-01-29T02:21:09.469Z
---

# Error Handling Framework

## Purpose

Establish centralized error types, handling patterns, and recovery strategies used throughout the application. This framework ensures consistent error handling, provides user-friendly error messages, and enables graceful degradation when services fail.

## Key Components

### 1. Error Type Hierarchy (`src/utils/errors.ts`)

Define application-specific error classes:

```typescript
// Base application error
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly recoverable: boolean = true,
    public readonly cause?: Error
  ) { ... }
}

// Specific error types
class ConfigurationError extends AppError { ... }
class NetworkError extends AppError { ... }
class IpcError extends AppError { ... }
class ServiceError extends AppError { ... }
```

### 2. Error Codes (`src/types/errors.ts`)

- Define exhaustive error code enum
- Map error codes to user-facing messages
- Include error severity levels

### 3. User-Facing Error Messages

- Create mapping from error codes to localized, user-friendly messages
- Messages should be actionable (tell user what to do)
- Avoid technical jargon in user messages

### 4. Error Recovery Strategies (`src/utils/error-recovery.ts`)

Implement common recovery patterns:

- **Retry with backoff**: For transient network errors
- **Fallback**: Use cached/default values when service unavailable
- **Notify and continue**: Log error, notify user, continue operation
- **Graceful shutdown**: For unrecoverable errors

```typescript
type RecoveryStrategy = "retry" | "fallback" | "notify" | "shutdown";

interface ErrorHandler {
  handle(error: AppError): Promise<RecoveryResult>;
  canRecover(error: AppError): boolean;
  getRecoveryStrategy(error: AppError): RecoveryStrategy;
}
```

### 5. Global Error Boundary (Renderer)

- React error boundary component for renderer process
- Catches React rendering errors
- Displays user-friendly fallback UI
- Reports errors to main process via IPC

### 6. Uncaught Exception Handlers (Main Process)

- Handle `uncaughtException` and `unhandledRejection`
- Log errors before crash
- Attempt graceful shutdown where possible

## Technical Requirements

- Integrate with logging system (use logger for all error logging)
- Error classes must be serializable for IPC transport
- Support error cause chaining (Error.cause)
- Type-safe error code handling

## Implementation Guidance

**Directory Creation:**

- Create `src/utils/` directory
- Files: `errors.ts`, `error-recovery.ts`, `index.ts`
- Add to types: `src/types/errors.ts`

**Error Creation Pattern:**

```typescript
// Good - clear user message, includes code and recoverability
throw new NetworkError(
  "API request failed: connection timeout",
  ErrorCode.NETWORK_TIMEOUT,
  "Unable to connect to the server. Please check your internet connection.",
  true, // recoverable
  originalError
);
```

**Error Handling Pattern:**

```typescript
try {
  await riskyOperation();
} catch (error) {
  const appError = wrapError(error); // Convert unknown errors to AppError
  const recovery = errorHandler.getRecoveryStrategy(appError);

  if (recovery === "retry") {
    return await retryWithBackoff(() => riskyOperation());
  } else if (recovery === "notify") {
    await notifyUser(appError.userMessage);
  }
  // ... etc
}
```

## Acceptance Criteria

1. [ ] Base `AppError` class implemented with code, userMessage, and recoverable properties
2. [ ] Specific error subclasses created (ConfigurationError, NetworkError, IpcError, ServiceError)
3. [ ] Error codes enum defined with comprehensive codes for expected error scenarios
4. [ ] User-facing error message mapping implemented
5. [ ] Error recovery strategies implemented (retry, fallback, notify)
6. [ ] Retry with exponential backoff utility created
7. [ ] `wrapError` utility converts unknown errors to AppError
8. [ ] React ErrorBoundary component created for renderer
9. [ ] Uncaught exception handlers registered in main process
10. [ ] Errors are logged appropriately (no sensitive data exposed)
11. [ ] Unit tests for error classification and recovery strategies

## Testing Requirements

- Unit tests for each error type
- Unit tests for retry logic and backoff calculation
- Unit tests for error wrapping utility
- Test ErrorBoundary catches and reports errors
- Test that user messages don't expose technical details

## Security Considerations

- User-facing messages must never expose stack traces
- Error messages must never include sensitive data (API keys, tokens, file paths with usernames)
- Log detailed errors internally but sanitize for user display

## Dependencies

- F-core-types-ipc-architecture (for error code types, IPC channel for error reporting)
