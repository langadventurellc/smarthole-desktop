---
id: F-core-types-ipc-architecture
title: Core Types & IPC Architecture
status: done
priority: high
parent: E-foundation-core-infrastructure
prerequisites: []
affectedFiles:
  src/types/common.ts: Created core utility types including Result<T,E>,
    Brand<T,B>, MessageId, ClientId, ISOTimestamp, NonEmptyString with factory
    functions (createMessageId, createClientId, createTimestamp,
    createNonEmptyString), type guards (isMessageId, isClientId, isISOTimestamp,
    isNonEmptyString), and helpers (ok, err, parseTimestamp)
  src/types/index.ts: Created barrel export file re-exporting all types from
    common.ts; Updated barrel export to include config types export; Updated
    barrel export to include messages module; Updated barrel export to include
    IPC types; Updated barrel export to include guards module; Added ElectronAPI
    type export from preload module
  src/types/common.test.ts: Created comprehensive unit tests for all types and
    functions (37 tests) including type-level constraint verification
  src/types/config.ts: Created configuration type definitions including LogLevel,
    VoiceInputMode, SttBackend, LlmProvider, SttConfig, LlmConfig, HotkeyConfig,
    AppConfig interfaces plus DEFAULT_CONFIG values and type guards
  src/types/config.test.ts: Created comprehensive unit tests for configuration
    types (44 tests) covering type guards, DEFAULT_CONFIG values, interface
    validation, and type-level constraints
  src/types/messages.ts: Created WebSocket message type definitions including
    ClientRegistration, RegisteredClient, MessageMetadata, RoutedMessage,
    ClientResponse types, response payload types (RejectPayload,
    NotificationPayload, AckPayload), WebSocketMessage discriminated union, and
    type guards for all message and response types
  src/types/messages.test.ts: Created comprehensive unit tests (61 tests) covering
    all interfaces, type guards, discriminated union behavior, and type-level
    constraints using @ts-expect-error
  src/types/ipc.ts: Created IPC channel definitions and types including
    IPC_CHANNELS constant, IpcChannel type, all payload interfaces
    (LogMessagePayload, NotifyShowPayload, etc.), type maps (IpcPayloadMap,
    IpcResponseMap), and comprehensive type guards
  src/types/ipc.test.ts: Created 86 unit tests covering IPC channel values, all
    type guards, interface structures, type maps, and type-level constraints
    using @ts-expect-error
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
  src/preload.ts: Updated with fully-typed electronAPI object containing logging,
    notification, configuration, and app lifecycle methods using
    ipcRenderer.send and ipcRenderer.invoke patterns
  src/types/electron.d.ts: Created global Window interface augmentation declaring
    electronAPI property with ElectronAPI type
  src/preload.test.ts: Created comprehensive unit tests (29 tests) mocking
    ipcRenderer to verify IPC channels, payload structures, convenience methods,
    and onConfigChanged unsubscribe functionality
log:
  - "Starting feature implementation. Verified all 6 tasks exist with correct
    dependencies. Execution order: T-create-core-common-types-and →
    T-create-configuration-types → T-create-websocket-message-types →
    T-create-ipc-channel-definitions → T-create-type-guards-and →
    T-extend-preload-bridge-with"
  - Completed T-create-core-common-types-and. Created src/types/common.ts with
    Result, Brand, MessageId, ClientId, ISOTimestamp, NonEmptyString types and
    utilities. 37 tests passing. Proceeding to T-create-configuration-types.
  - Completed T-create-configuration-types. Created src/types/config.ts with
    LogLevel, VoiceInputMode, SttBackend, LlmProvider, SttConfig, LlmConfig,
    HotkeyConfig, AppConfig, DEFAULT_CONFIG, and type guards. 44 tests passing.
    Proceeding to T-create-websocket-message-types.
  - Completed T-create-websocket-message-types. Created src/types/messages.ts
    with ClientRegistration, RegisteredClient, RoutedMessage, MessageMetadata,
    ClientResponse types, WebSocketMessage discriminated union, and type guards.
    61 tests passing. Proceeding to T-create-ipc-channel-definitions.
  - Completed T-create-ipc-channel-definitions. Created src/types/ipc.ts with
    IPC_CHANNELS, IpcChannel type, all payload interfaces, IpcPayloadMap,
    IpcResponseMap, and type guards. 86 tests passing. Proceeding to
    T-create-type-guards-and.
  - Completed T-create-type-guards-and. Created src/types/guards.ts with generic
    validation helpers, ValidationResult/ValidationError types, and detailed
    validation functions for WebSocket messages. 72 tests passing. Proceeding to
    final task T-extend-preload-bridge-with.
  - "Auto-completed: All child tasks are complete"
  - Completed T-extend-preload-bridge-with. Updated src/preload.ts with
    fully-typed electronAPI (logging, notifications, config, app lifecycle
    methods). Created src/types/electron.d.ts for Window augmentation. 29 tests
    passing. All 6 tasks complete.
schema: v1.0
childrenIds:
  - T-create-configuration-types
  - T-create-core-common-types-and
  - T-create-ipc-channel-definitions
  - T-create-type-guards-and
  - T-create-websocket-message-types
  - T-extend-preload-bridge-with
created: 2026-01-29T02:20:24.861Z
updated: 2026-01-29T02:20:24.861Z
---

# Core Types & IPC Architecture

## Purpose

Establish the foundational TypeScript type definitions and type-safe IPC (Inter-Process Communication) architecture that all other features will build upon. This feature creates the shared contracts for data structures and communication patterns between Electron's main and renderer processes.

## Key Components

### 1. Core Type Definitions (`src/types/`)

Create TypeScript interfaces for shared data structures:

- **Message Types**: Interfaces for messages being processed (content, metadata, timestamps)
- **Configuration Types**: Application settings structure (log levels, privacy options, etc.)
- **Client Types**: Interfaces for external service clients (API clients, etc.)
- **Common Types**: Shared utility types (Result, Option patterns, branded types if needed)

### 2. IPC Architecture (`src/preload.ts` + `src/types/ipc.ts`)

Define the type-safe IPC communication layer:

- **Channel Definitions**: Typed channel names as const enums or string literal types
- **Request/Response Types**: Type-safe payloads for each IPC channel
- **Bridge API Structure**: Extend the existing `electronAPI` in preload.ts with typed method signatures
- **Type Guards**: Runtime validation utilities for IPC message validation

### 3. Barrel Exports

- Create `src/types/index.ts` with clean re-exports
- Establish export patterns for other features to follow

## Technical Requirements

- Use strict TypeScript (already configured in tsconfig.json)
- No `any` types - use `unknown` with type guards where needed
- Use branded types for IDs where appropriate (e.g., `MessageId`, `ClientId`)
- Define IPC channels using const assertions for type safety
- Leverage TypeScript's template literal types for channel naming conventions

## Implementation Guidance

**IPC Pattern to Follow:**

```typescript
// In src/types/ipc.ts
export const IPC_CHANNELS = {
  LOG: "log:message",
  NOTIFY: "notify:show",
  // ... etc
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// In preload.ts - extend with typed methods
contextBridge.exposeInMainWorld("electronAPI", {
  log: (level: LogLevel, message: string, context?: Record<string, unknown>) =>
    ipcRenderer.send(IPC_CHANNELS.LOG, { level, message, context }),
  // ... etc
});
```

**Directory Creation:**

- Create `src/types/` directory
- Files: `index.ts`, `ipc.ts`, `config.ts`, `common.ts`

## Acceptance Criteria

1. [ ] `src/types/` directory created with barrel export (`index.ts`)
2. [ ] Core configuration type (`AppConfig`) defined with all settings
3. [ ] Log level enum/type defined (Error, Warn, Info, Debug, Trace)
4. [ ] IPC channel constants defined with type safety
5. [ ] IPC request/response types defined for planned channels (log, notify)
6. [ ] Preload bridge extended with typed method stubs (implementations in later features)
7. [ ] Type guards created for IPC message validation
8. [ ] No `any` types used - all types are explicit
9. [ ] Types are exported and importable from `src/types`

## Testing Requirements

- Type-level tests using `tsd` or TypeScript's `@ts-expect-error` comments
- Unit tests for type guard functions
- Verify barrel exports work correctly

## Security Considerations

- IPC channels must be explicitly defined (no dynamic channel names)
- Type guards must validate all incoming IPC data from renderer
- Preload script must use contextBridge (already established pattern)

## Dependencies

None - this is the foundational feature
