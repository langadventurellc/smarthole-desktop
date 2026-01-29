---
id: F-core-types-ipc-architecture
title: Core Types & IPC Architecture
status: open
priority: high
parent: E-foundation-core-infrastructure
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
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
