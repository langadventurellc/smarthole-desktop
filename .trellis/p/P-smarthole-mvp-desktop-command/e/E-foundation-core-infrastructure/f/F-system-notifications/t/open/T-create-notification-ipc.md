---
id: T-create-notification-ipc
title: Create notification IPC handler for main process
status: open
priority: high
parent: F-system-notifications
prerequisites:
  - T-implement-notificationqueue
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T02:01:33.573Z
updated: 2026-01-30T02:01:33.573Z
---

# Create notification IPC handler for main process

## Context

This task implements the IPC handler that receives notification requests from the renderer process and forwards them to the NotificationQueue. This follows the same pattern as `src/ipc/log-handler.ts`.

**Related Issues:**

- Parent Feature: F-system-notifications
- Prerequisite: T-implement-notificationqueue (provides the queue for notification management)

**Reference Files:**

- `src/ipc/log-handler.ts` - Pattern for IPC handler implementation
- `src/types/ipc.ts` - Defines `IPC_CHANNELS.NOTIFY_SHOW`, `NotifyShowPayload`, `isNotifyShowPayload`
- `src/preload.ts` - Already has `notify()` method that sends to `NOTIFY_SHOW` channel

## Implementation Requirements

### 1. Create `src/ipc/notification-handler.ts`

```typescript
import { IpcMainEvent } from "electron";
import { isNotifyShowPayload } from "../types";
import { NotificationQueue } from "../services/notification-queue";
import { Logger } from "../services/logger";

export function createNotificationHandler(
  queue: NotificationQueue,
  ipcLogger: Logger
): (event: IpcMainEvent, payload: unknown) => void;

export function processNotification(
  payload: unknown,
  queue: NotificationQueue,
  ipcLogger: Logger
): boolean;
```

### 2. Handler Implementation

The handler should:

1. Validate incoming payload using `isNotifyShowPayload()` type guard
2. Log invalid payloads as warnings (don't throw)
3. Convert `NotifyShowPayload` to `NotificationOptions`
4. Enqueue the notification via `NotificationQueue`
5. Log successful enqueue at debug level

### 3. Payload Validation

Use the existing `isNotifyShowPayload()` type guard from `src/types/ipc.ts`:

- Returns false for invalid payloads
- Validates required fields: title, body, type, priority
- Validates optional fields: actions, timeout

### 4. Error Handling

- Never throw exceptions
- Log validation failures as warnings
- Log unexpected errors as errors
- Return boolean from `processNotification()` indicating success

## Technical Approach

1. Create factory function `createNotificationHandler()` that returns the handler
2. Extract core logic into `processNotification()` for testability
3. Validate payload with type guard before processing
4. Map `NotifyShowPayload` to `NotificationOptions` (they're compatible)
5. Enqueue and log result

## Acceptance Criteria

- [ ] `createNotificationHandler()` factory function created
- [ ] Handler validates payload using `isNotifyShowPayload()`
- [ ] Invalid payloads logged as warnings, not errors
- [ ] Valid payloads enqueued to NotificationQueue
- [ ] `processNotification()` exported for testing
- [ ] Handler integrates with existing logger for diagnostics

## Testing Requirements

Write unit tests in `src/ipc/notification-handler.test.ts`:

- Test valid payload is enqueued
- Test invalid payload (missing title) is rejected
- Test invalid payload (missing body) is rejected
- Test invalid payload (invalid type) is rejected
- Test invalid payload (invalid priority) is rejected
- Test warning logged for invalid payloads
- Test `processNotification()` returns correct boolean

## Files to Create/Modify

- Create: `src/ipc/notification-handler.ts`
- Create: `src/ipc/notification-handler.test.ts`
- Modify: `src/ipc/index.ts` (add exports)
