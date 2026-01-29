---
id: T-implement-error-recovery
title: Implement Error Recovery Strategies
status: open
priority: high
parent: F-error-handling-framework
prerequisites:
  - T-create-error-wrapping-utility
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T04:31:56.064Z
updated: 2026-01-29T04:31:56.064Z
---

# Implement Error Recovery Strategies

## Context

This task is part of the **F-error-handling-framework** feature. It implements common error recovery patterns: retry with backoff, fallback values, and notification strategies.

Reference: [F-error-handling-framework](trellis://F-error-handling-framework)  
Prerequisite: [T-create-error-wrapping-utility](trellis://T-create-error-wrapping-utility)

## Overview

Create error recovery utilities including:

- Retry with exponential backoff for transient failures
- Fallback pattern for providing default values
- Recovery strategy determination based on error type

## Files to Create/Modify

- `src/utils/error-recovery.ts` - Recovery strategy implementations
- Update `src/utils/index.ts` - Add export

## Implementation Requirements

### Recovery Types

```typescript
import { AppError } from "./errors";
import { ErrorCode } from "../types/errors";
import { wrapError } from "./error-utils";
import { Result, ok, err } from "../types/common";

/**
 * Recovery strategies for error handling.
 */
export type RecoveryStrategy = "retry" | "fallback" | "notify" | "shutdown";

/**
 * Configuration for retry with backoff.
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
  /** Error codes that should trigger retry (default: network errors) */
  retryableCodes?: ErrorCode[];
}
```

### Retry with Backoff

````typescript
/**
 * Executes an async operation with retry and exponential backoff.
 *
 * @example
 * ```ts
 * const result = await retryWithBackoff(
 *   () => fetchData(),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
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

/**
 * Promise-based sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
````

### Fallback Pattern

````typescript
/**
 * Executes an operation with a fallback value on failure.
 *
 * @example
 * ```ts
 * const config = await withFallback(
 *   () => loadConfig(),
 *   DEFAULT_CONFIG
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
````

### Recovery Strategy Determination

```typescript
/**
 * Default retryable error codes (transient failures).
 */
const DEFAULT_RETRYABLE_CODES: ErrorCode[] = [
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.NETWORK_REQUEST_FAILED,
  ErrorCode.SERVICE_UNAVAILABLE,
];

/**
 * Determines the appropriate recovery strategy for an error.
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
 */
export function isRetryable(
  error: AppError,
  retryableCodes: ErrorCode[] = DEFAULT_RETRYABLE_CODES
): boolean {
  return error.recoverable && retryableCodes.includes(error.code);
}
```

## Acceptance Criteria

1. [ ] `retryWithBackoff()` retries up to maxAttempts
2. [ ] `retryWithBackoff()` implements exponential backoff with configurable multiplier
3. [ ] `retryWithBackoff()` applies jitter to prevent thundering herd
4. [ ] `retryWithBackoff()` respects maxDelayMs cap
5. [ ] `retryWithBackoff()` returns `Result<T, AppError>`
6. [ ] `withFallback()` returns fallback value on error
7. [ ] `withFallback()` calls onError callback if provided
8. [ ] `withFallbackSync()` works for synchronous operations
9. [ ] `getRecoveryStrategy()` returns appropriate strategy based on error properties
10. [ ] `isRetryable()` checks error against retryable codes
11. [ ] Export added to `src/utils/index.ts`

## Testing Requirements

Create `src/utils/error-recovery.test.ts` with tests for:

- `retryWithBackoff()` succeeds on first attempt
- `retryWithBackoff()` succeeds after transient failure
- `retryWithBackoff()` fails after max attempts
- Backoff delay calculation (verify exponential growth)
- Jitter is applied (delay varies between runs)
- `withFallback()` returns primary value on success
- `withFallback()` returns fallback on error
- `withFallbackSync()` behavior
- `getRecoveryStrategy()` returns correct strategy for each error type
- `isRetryable()` with various error codes

## Notes

- Use `vi.useFakeTimers()` in tests to avoid actual delays
- The retry implementation uses the Result type from `src/types/common.ts`
