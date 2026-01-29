---
id: T-create-ipc-channel-definitions
title: Create IPC channel definitions and types
status: open
priority: high
parent: F-core-types-ipc-architecture
prerequisites:
  - T-create-configuration-types
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-29T02:35:41.297Z
updated: 2026-01-29T02:35:41.297Z
---

# Create IPC Channel Definitions and Types

## Context

This task defines the type-safe IPC (Inter-Process Communication) layer between Electron's main process and renderer process. It establishes channel naming conventions and typed payloads for all IPC communication.

**Parent Feature**: F-core-types-ipc-architecture
**Depends On**: T-create-configuration-types (for LogLevel type)

## Objective

Create IPC channel constants and type definitions that ensure type-safe communication between main and renderer processes. This includes request/response types for logging, notifications, and configuration.

## Implementation Details

### File to Create

`src/types/ipc.ts` - IPC channel definitions and types

### Types to Implement

```typescript
import { LogLevel, AppConfig, PartialAppConfig } from "./config";

// ============================================
// IPC Channel Definitions
// ============================================

/**
 * IPC channel constants using const assertion for type safety.
 * Naming convention: {domain}:{action}
 */
export const IPC_CHANNELS = {
  // Logging channels
  LOG_MESSAGE: "log:message",

  // Notification channels
  NOTIFY_SHOW: "notify:show",

  // Configuration channels
  CONFIG_GET: "config:get",
  CONFIG_SET: "config:set",
  CONFIG_CHANGED: "config:changed", // Main -> Renderer broadcast

  // App lifecycle channels
  APP_QUIT: "app:quit",
  APP_VERSION: "app:version",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ============================================
// Logging IPC Types
// ============================================

export interface LogMessagePayload {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp?: string; // ISO 8601, auto-generated if not provided
}

// ============================================
// Notification IPC Types
// ============================================

export type NotificationType = "info" | "warning" | "error" | "success";
export type NotificationPriority = "low" | "medium" | "high";

export interface NotificationAction {
  label: string;
  actionId: string;
}

export interface NotifyShowPayload {
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  actions?: NotificationAction[];
  timeout?: number; // Auto-dismiss in ms
}

export interface NotificationClickedPayload {
  actionId?: string; // Which action was clicked, if any
}

// ============================================
// Configuration IPC Types
// ============================================

export interface ConfigGetResponse {
  config: AppConfig;
}

export interface ConfigSetPayload {
  updates: PartialAppConfig;
}

export interface ConfigChangedPayload {
  config: AppConfig;
  changedKeys: string[]; // Dot-notation paths that changed
}

// ============================================
// App Lifecycle IPC Types
// ============================================

export interface AppVersionResponse {
  version: string;
  electronVersion: string;
  nodeVersion: string;
}

// ============================================
// IPC Type Map (for type-safe handlers)
// ============================================

/**
 * Maps IPC channels to their payload types.
 * Used for type-safe IPC handler registration.
 */
export interface IpcPayloadMap {
  [IPC_CHANNELS.LOG_MESSAGE]: LogMessagePayload;
  [IPC_CHANNELS.NOTIFY_SHOW]: NotifyShowPayload;
  [IPC_CHANNELS.CONFIG_GET]: void; // No payload needed
  [IPC_CHANNELS.CONFIG_SET]: ConfigSetPayload;
  [IPC_CHANNELS.CONFIG_CHANGED]: ConfigChangedPayload;
  [IPC_CHANNELS.APP_QUIT]: void;
  [IPC_CHANNELS.APP_VERSION]: void;
}

/**
 * Maps IPC channels to their response types.
 * For invoke-style IPC that returns data.
 */
export interface IpcResponseMap {
  [IPC_CHANNELS.CONFIG_GET]: ConfigGetResponse;
  [IPC_CHANNELS.APP_VERSION]: AppVersionResponse;
}
```

### Update Barrel Export

Add to `src/types/index.ts`:

```typescript
export * from "./common";
export * from "./config";
export * from "./ipc";
```

## Technical Approach

1. Create `src/types/ipc.ts`
2. Use const assertions for channel names to get literal types
3. Define payload interfaces for each IPC channel
4. Create type maps (`IpcPayloadMap`, `IpcResponseMap`) for type-safe handler registration
5. Use discriminated unions where appropriate
6. Update barrel export

## Acceptance Criteria

1. [ ] `src/types/ipc.ts` created
2. [ ] `IPC_CHANNELS` const object defined with all planned channels
3. [ ] `IpcChannel` type derived from channel constants
4. [ ] `LogMessagePayload` interface defined with level, message, context
5. [ ] Notification types defined (`NotifyShowPayload`, `NotificationAction`, etc.)
6. [ ] Configuration IPC types defined (get, set, changed)
7. [ ] App lifecycle types defined (quit, version)
8. [ ] `IpcPayloadMap` maps channels to payload types
9. [ ] `IpcResponseMap` maps invoke channels to response types
10. [ ] Barrel export updated to include IPC types
11. [ ] No `any` types used (use `unknown` with type guards for dynamic data)

## Testing Requirements

Write unit tests in `src/types/ipc.test.ts`:

- Verify `IPC_CHANNELS` contains expected channel strings
- Use `@ts-expect-error` to verify type map constraints
- Test that channel type narrowing works correctly

## Security Considerations

- IPC channels are explicitly defined (no dynamic channel creation)
- All payloads have defined shapes for validation
- No sensitive data in channel names

## Dependencies

- T-create-configuration-types (for LogLevel, AppConfig, PartialAppConfig types)
