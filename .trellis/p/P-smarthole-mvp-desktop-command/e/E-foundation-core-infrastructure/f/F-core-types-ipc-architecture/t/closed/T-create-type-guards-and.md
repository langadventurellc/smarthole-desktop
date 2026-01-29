---
id: T-create-type-guards-and
title: Create type guards and validation utilities
status: done
priority: high
parent: F-core-types-ipc-architecture
prerequisites:
  - T-create-ipc-channel-definitions
  - T-create-websocket-message-types
affectedFiles:
  src/types/guards.ts: Created type guards and validation utilities module with
    generic helpers (isObject, isOneOf, isString, isNonEmptyStringRaw, isNumber,
    isBoolean, isArray, isArrayOf, isOptional), validation result types
    (ValidationError, ValidationResult), helper functions (validationOk,
    validationErr, makeError), and detailed validation functions
    (validateClientRegistration, validateMessageMetadata, validateRoutedMessage,
    validateClientResponse, validateWebSocketMessage)
  src/types/guards.test.ts: Created comprehensive unit tests (72 tests) covering
    all generic helpers, validation result helpers, and detailed validation
    functions including edge cases, nested validation, and error path
    verification
  src/types/index.ts: Updated barrel export to include guards module
log:
  - >-
    Research phase complete. Reviewed all existing type files:

    - common.ts: Has isObject-like patterns via isNonEmptyString, isMessageId,
    etc.

    - config.ts: Has isLogLevel, isVoiceInputMode, isSttBackend, isLlmProvider

    - messages.ts: Has isWebSocketMessage, isRejectResponse,
    isNotificationResponse, isAckResponse, isRegistrationMessage,
    isRoutedMessage, isResponseMessage

    - ipc.ts: Has isIpcChannel, isNotificationType, isNotificationPriority,
    isLogMessagePayload, isNotificationAction, isNotifyShowPayload,
    isConfigSetPayload, isConfigChangedPayload, isAppVersionResponse


    Key observations:

    1. Many type guards already exist in individual files

    2. guards.ts should provide centralized/unified guards and more
    comprehensive validation utilities

    3. Need to implement generic helpers (isObject, isOneOf) that can be shared

    4. Need to implement ValidationResult/ValidationError types with detailed
    error reporting

    5. Need to implement validate* functions that return detailed error
    information


    Will now implement src/types/guards.ts following the task specification.
  - >-
    Created comprehensive type guards and validation utilities in
    src/types/guards.ts. The module provides:


    1. Generic validation helpers: isObject, isOneOf, isString,
    isNonEmptyStringRaw, isNumber, isBoolean, isArray, isArrayOf, isOptional -
    building blocks for creating type guards

    2. Validation result types: ValidationError and ValidationResult<T>
    interfaces for detailed error reporting

    3. Validation helper functions: validationOk, validationErr, makeError - for
    creating validation results

    4. Detailed validation functions with error reporting:
       - validateClientRegistration - validates ClientRegistration with field-by-field error details
       - validateMessageMetadata - validates MessageMetadata with path prefix support for nesting
       - validateRoutedMessage - validates RoutedMessage including nested metadata
       - validateClientResponse - validates ClientResponse
       - validateWebSocketMessage - validates the discriminated union with nested payload validation

    The module avoids duplicate exports of type guards already defined in
    ipc.ts, messages.ts, and config.ts. Instead, it focuses on providing generic
    utilities and detailed validation functions that return specific error
    information for each invalid field.


    Updated barrel export in src/types/index.ts to include the guards module.
    All 72 new tests pass, along with all 301 total tests across the codebase.
    Quality checks (lint, format, type-check) all pass.
schema: v1.0
childrenIds: []
created: 2026-01-29T02:36:36.244Z
updated: 2026-01-29T02:36:36.244Z
---

# Create Type Guards and Validation Utilities

## Context

This task implements runtime validation utilities and type guards for validating data received via IPC and WebSocket. While TypeScript provides compile-time safety, runtime validation is essential for data crossing process boundaries.

**Parent Feature**: F-core-types-ipc-architecture
**Depends On**:

- T-create-ipc-channel-definitions (for IPC payload types)
- T-create-websocket-message-types (for WebSocket message types)

## Objective

Create comprehensive type guards and validation functions that ensure runtime type safety for IPC messages and WebSocket communications. These utilities will be used by handlers to validate incoming data before processing.

## Implementation Details

### File to Create

`src/types/guards.ts` - Type guards and validation utilities

### Utilities to Implement

```typescript
import { LogLevel } from "./config";
import {
  IPC_CHANNELS,
  IpcChannel,
  LogMessagePayload,
  NotifyShowPayload,
  ConfigSetPayload,
} from "./ipc";
import {
  ClientRegistration,
  RoutedMessage,
  ClientResponse,
  WebSocketMessage,
  WebSocketMessageType,
} from "./messages";

// ============================================
// Generic Validation Helpers
// ============================================

/** Check if value is a non-null object */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Check if value is a non-empty string */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Check if value is one of the allowed values */
export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// ============================================
// Config Type Guards
// ============================================

/** Validate LogLevel value */
export function isLogLevel(value: unknown): value is LogLevel {
  return isOneOf(value, ["error", "warn", "info", "debug", "trace"]);
}

// ============================================
// IPC Payload Type Guards
// ============================================

/** Validate IPC channel name */
export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === "string" && Object.values(IPC_CHANNELS).includes(value as IpcChannel);
}

/** Validate LogMessagePayload */
export function isLogMessagePayload(value: unknown): value is LogMessagePayload {
  if (!isObject(value)) return false;

  return (
    isLogLevel(value.level) &&
    typeof value.message === "string" &&
    (value.context === undefined || isObject(value.context)) &&
    (value.timestamp === undefined || typeof value.timestamp === "string")
  );
}

/** Validate NotifyShowPayload */
export function isNotifyShowPayload(value: unknown): value is NotifyShowPayload {
  if (!isObject(value)) return false;

  return (
    typeof value.title === "string" &&
    typeof value.body === "string" &&
    isOneOf(value.type, ["info", "warning", "error", "success"]) &&
    isOneOf(value.priority, ["low", "medium", "high"]) &&
    (value.actions === undefined || Array.isArray(value.actions)) &&
    (value.timeout === undefined || typeof value.timeout === "number")
  );
}

/** Validate ConfigSetPayload */
export function isConfigSetPayload(value: unknown): value is ConfigSetPayload {
  if (!isObject(value)) return false;
  return isObject(value.updates);
  // Note: Deep validation of config updates happens in config service
}

// ============================================
// WebSocket Message Type Guards
// ============================================

/** Validate ClientRegistration */
export function isClientRegistration(value: unknown): value is ClientRegistration {
  if (!isObject(value)) return false;

  return (
    isNonEmptyString(value.name) &&
    typeof value.description === "string" &&
    (value.version === undefined || typeof value.version === "string") &&
    (value.capabilities === undefined ||
      (Array.isArray(value.capabilities) && value.capabilities.every((c) => typeof c === "string")))
  );
}

/** Validate RoutedMessage */
export function isRoutedMessage(value: unknown): value is RoutedMessage {
  if (!isObject(value)) return false;

  const metadata = value.metadata;
  if (!isObject(metadata)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.timestamp === "string" &&
    (metadata.confidence === undefined || typeof metadata.confidence === "number") &&
    (metadata.routingReason === undefined || typeof metadata.routingReason === "string") &&
    isOneOf(metadata.inputMethod, ["voice", "text"]) &&
    typeof metadata.directRouted === "boolean"
  );
}

/** Validate ClientResponse */
export function isClientResponse(value: unknown): value is ClientResponse {
  if (!isObject(value)) return false;

  return (
    typeof value.messageId === "string" &&
    isOneOf(value.type, ["ack", "reject", "notification"]) &&
    isObject(value.payload)
  );
}

/** Validate WebSocketMessage (discriminated union) */
export function isWebSocketMessage(value: unknown): value is WebSocketMessage {
  if (!isObject(value)) return false;

  switch (value.type) {
    case "registration":
      return isClientRegistration(value.payload);
    case "message":
      return isRoutedMessage(value.payload);
    case "response":
      return isClientResponse(value.payload);
    default:
      return false;
  }
}

// ============================================
// Validation Result Helpers
// ============================================

export interface ValidationError {
  path: string;
  message: string;
  received: unknown;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/** Validate and return result with errors */
export function validateClientRegistration(value: unknown): ValidationResult<ClientRegistration> {
  // Implementation provides detailed error messages
}

export function validateClientResponse(value: unknown): ValidationResult<ClientResponse> {
  // Implementation provides detailed error messages
}
```

### Update Barrel Export

Add to `src/types/index.ts`:

```typescript
export * from "./common";
export * from "./config";
export * from "./ipc";
export * from "./messages";
export * from "./guards";
```

## Technical Approach

1. Create `src/types/guards.ts`
2. Implement generic validation helpers first (isObject, isNonEmptyString, isOneOf)
3. Build specific type guards using the generic helpers
4. Create validation functions that return detailed error information
5. Ensure all guards are pure functions (no side effects)
6. Update barrel export

## Acceptance Criteria

1. [ ] `src/types/guards.ts` created
2. [ ] Generic helpers implemented: `isObject`, `isNonEmptyString`, `isOneOf`
3. [ ] `isLogLevel` type guard implemented
4. [ ] `isIpcChannel` type guard implemented
5. [ ] `isLogMessagePayload` type guard implemented
6. [ ] `isNotifyShowPayload` type guard implemented
7. [ ] `isConfigSetPayload` type guard implemented
8. [ ] `isClientRegistration` type guard implemented
9. [ ] `isRoutedMessage` type guard implemented
10. [ ] `isClientResponse` type guard implemented
11. [ ] `isWebSocketMessage` type guard implemented for discriminated union
12. [ ] `ValidationResult` and `ValidationError` types defined
13. [ ] Detailed validation functions implemented for complex types
14. [ ] Barrel export updated to include guards
15. [ ] All guards are pure functions

## Testing Requirements

Write comprehensive unit tests in `src/types/guards.test.ts`:

- Test each type guard with valid input returns true
- Test each type guard with invalid input returns false
- Test edge cases: null, undefined, empty objects, wrong types
- Test that type narrowing works correctly after guard
- Test validation functions return appropriate error details
- Test nested object validation (e.g., metadata in RoutedMessage)

## Security Considerations

- Guards must validate ALL fields, not just some
- Do not trust any incoming data without validation
- Validation should not throw - return false/errors instead
- Avoid prototype pollution by checking isObject first

## Dependencies

- T-create-ipc-channel-definitions (for IPC types to validate)
- T-create-websocket-message-types (for WebSocket types to validate)
