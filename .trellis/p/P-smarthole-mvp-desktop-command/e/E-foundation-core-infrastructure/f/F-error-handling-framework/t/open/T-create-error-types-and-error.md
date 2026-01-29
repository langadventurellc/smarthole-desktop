---
id: T-create-error-types-and-error
title: Create Error Types and Error Codes Enum
status: open
priority: high
parent: F-error-handling-framework
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T04:30:35.956Z
updated: 2026-01-29T04:30:35.956Z
---

# Create Error Types and Error Codes Enum

## Context

This task is part of the **F-error-handling-framework** feature within the **E-foundation-core-infrastructure** epic. It establishes the foundational error type hierarchy and error codes that will be used throughout the SmartHole application.

Reference: [F-error-handling-framework](trellis://F-error-handling-framework)

## Overview

Create the base `AppError` class and specific error subclasses, along with an exhaustive `ErrorCode` enum. These types will be used throughout the application for consistent error handling.

## Files to Create

- `src/types/errors.ts` - Error codes enum and severity levels
- `src/utils/errors.ts` - AppError class and subclasses
- `src/utils/index.ts` - Barrel export for utils

Update:

- `src/types/index.ts` - Add error types export

## Implementation Requirements

### 1. Error Codes Enum (`src/types/errors.ts`)

```typescript
/**
 * Exhaustive error codes for the application.
 * Organized by domain/category.
 */
export enum ErrorCode {
  // General errors
  UNKNOWN = "UNKNOWN",
  INTERNAL = "INTERNAL",

  // Configuration errors
  CONFIG_INVALID = "CONFIG_INVALID",
  CONFIG_LOAD_FAILED = "CONFIG_LOAD_FAILED",
  CONFIG_SAVE_FAILED = "CONFIG_SAVE_FAILED",

  // Network errors
  NETWORK_UNAVAILABLE = "NETWORK_UNAVAILABLE",
  NETWORK_TIMEOUT = "NETWORK_TIMEOUT",
  NETWORK_REQUEST_FAILED = "NETWORK_REQUEST_FAILED",

  // IPC errors
  IPC_CHANNEL_INVALID = "IPC_CHANNEL_INVALID",
  IPC_PAYLOAD_INVALID = "IPC_PAYLOAD_INVALID",
  IPC_HANDLER_FAILED = "IPC_HANDLER_FAILED",

  // Service errors
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  SERVICE_INITIALIZATION_FAILED = "SERVICE_INITIALIZATION_FAILED",

  // STT/LLM errors (for future features)
  STT_INITIALIZATION_FAILED = "STT_INITIALIZATION_FAILED",
  STT_TRANSCRIPTION_FAILED = "STT_TRANSCRIPTION_FAILED",
  LLM_REQUEST_FAILED = "LLM_REQUEST_FAILED",
  LLM_RESPONSE_INVALID = "LLM_RESPONSE_INVALID",
}

/**
 * Severity levels for errors.
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";
```

### 2. AppError Class Hierarchy (`src/utils/errors.ts`)

```typescript
import { ErrorCode, ErrorSeverity } from "../types/errors";

/**
 * Base application error with code, user message, and recoverability.
 */
export class AppError extends Error {
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
    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Creates a JSON-serializable representation for IPC transport.
   */
  toJSON(): Record<string, unknown> { ... }
}

// Specific error subclasses:
export class ConfigurationError extends AppError { ... }
export class NetworkError extends AppError { ... }
export class IpcError extends AppError { ... }
export class ServiceError extends AppError { ... }
```

### 3. Barrel Exports

Create `src/utils/index.ts`:

```typescript
export * from "./errors";
```

Update `src/types/index.ts` to include error types.

## Patterns to Follow

- Follow the existing type patterns in `src/types/common.ts` (branded types, type guards)
- Use const assertions and readonly where appropriate
- Ensure error classes are serializable for IPC transport
- Support Error.cause for error chaining (ES2022)

## Acceptance Criteria

1. [ ] `ErrorCode` enum defined with codes for all expected error scenarios
2. [ ] `ErrorSeverity` type defined (low, medium, high, critical)
3. [ ] `AppError` base class with code, userMessage, recoverable, severity, and cause properties
4. [ ] `ConfigurationError` subclass with sensible defaults
5. [ ] `NetworkError` subclass with sensible defaults
6. [ ] `IpcError` subclass with sensible defaults
7. [ ] `ServiceError` subclass with sensible defaults
8. [ ] `toJSON()` method on AppError for IPC serialization
9. [ ] Barrel exports set up in `src/utils/index.ts`
10. [ ] Types exported from `src/types/index.ts`
11. [ ] Unit tests cover error creation, serialization, and prototype chain

## Testing Requirements

Create `src/utils/errors.test.ts` with tests for:

- AppError construction with all parameters
- Error subclass default values
- Prototype chain (instanceof checks work correctly)
- toJSON() serialization
- Error cause chaining

## Security Considerations

- Error messages should be developer-facing (technical details OK)
- userMessage should be user-facing (no stack traces, no sensitive paths)
- toJSON() must not expose sensitive data
