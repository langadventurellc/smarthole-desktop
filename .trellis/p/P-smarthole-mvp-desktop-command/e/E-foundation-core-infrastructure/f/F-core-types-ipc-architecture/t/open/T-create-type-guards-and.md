---
id: T-create-type-guards-and
title: Create type guards and validation utilities
status: open
priority: high
parent: F-core-types-ipc-architecture
prerequisites:
  - T-create-ipc-channel-definitions
  - T-create-websocket-message-types
affectedFiles: {}
log: []
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
