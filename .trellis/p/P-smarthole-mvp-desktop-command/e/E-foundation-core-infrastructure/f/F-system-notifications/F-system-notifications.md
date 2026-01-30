---
id: F-system-notifications
title: System Notifications
status: in-progress
priority: medium
parent: E-foundation-core-infrastructure
prerequisites:
  - F-core-types-ipc-architecture
  - F-error-handling-framework
affectedFiles:
  src/services/notifications.ts: Created new NotificationService with singleton
    pattern, Electron Notification API wrapper, content sanitization, and
    graceful degradation
  src/services/notifications.test.ts: Created comprehensive unit tests (33 tests)
    for NotificationService including singleton pattern, all methods, content
    sanitization, and graceful degradation
  src/services/index.ts: Added export for notifications module; Added export for
    notification-queue module
  src/services/notification-queue.ts: Created NotificationQueue class with
    priority ordering, rate limiting (sliding window), notification coalescing,
    queue overflow handling, and singleton pattern
  src/services/notification-queue.test.ts: Created comprehensive unit tests (34
    tests) covering singleton pattern, priority ordering, rate limiting,
    coalescing, queue overflow, clear/destroy methods, and edge cases
  src/ipc/notification-handler.ts: Created IPC notification handler with
    createNotificationHandler() factory function and processNotification() for
    testing. Validates payloads using isNotifyShowPayload(), logs invalid
    payloads as warnings, converts valid payloads to NotificationOptions, and
    enqueues via NotificationQueue.
  src/ipc/notification-handler.test.ts: Created comprehensive unit tests (31
    tests) covering payload validation (missing title/body/type/priority,
    invalid types), valid payload processing, notification enqueuing, error
    handling when queue throws, and edge cases (empty strings, long content,
    special characters).
  src/ipc/index.ts: Added export for notification-handler module to barrel export file.
log:
  - "Starting feature implementation. Created feature branch
    feature/F-system-notifications. All 5 tasks verified with correct
    dependencies. Execution order: T-create-notificationservice →
    T-implement-notificationqueue → T-create-notification-ipc →
    T-integrate-notification-system → T-add-integration-tests-for"
  - Completed T-create-notificationservice. Created
    src/services/notifications.ts with singleton NotificationService, show()
    method, convenience methods (showInfo, showWarning, showError, showSuccess),
    content sanitization, and graceful degradation. 33 tests passing. Committed
    as 75b58da. Proceeding to T-implement-notificationqueue.
  - Completed T-implement-notificationqueue. Created
    src/services/notification-queue.ts with priority ordering, rate limiting,
    notification coalescing, queue overflow handling, and singleton pattern. 34
    tests passing. Committed as bc2a8aa. Proceeding to
    T-create-notification-ipc.
schema: v1.0
childrenIds:
  - T-add-integration-tests-for
  - T-create-notification-ipc
  - T-integrate-notification-system
  - T-create-notificationservice
  - T-implement-notificationqueue
created: 2026-01-29T02:21:31.116Z
updated: 2026-01-29T02:21:31.116Z
---

# System Notifications

## Purpose

Implement native OS notification integration using Electron's Notification API. This feature provides a queue-managed notification system with priority handling, ensuring users receive timely feedback for important events like recording start/stop and errors.

## Key Components

### 1. Notification Service (`src/services/notifications.ts`)

Core notification service with:

- Wrapper around Electron's Notification API
- Notification type definitions (info, warning, error, success)
- Support for notification actions (buttons)
- Click handlers for notification interaction

```typescript
interface NotificationOptions {
  title: string;
  body: string;
  type: "info" | "warning" | "error" | "success";
  priority: "low" | "medium" | "high";
  actions?: NotificationAction[];
  onClick?: () => void;
  timeout?: number; // auto-dismiss
}

interface NotificationService {
  show(options: NotificationOptions): void;
  showInfo(title: string, body: string): void;
  showWarning(title: string, body: string): void;
  showError(title: string, body: string): void;
  showSuccess(title: string, body: string): void;
}
```

### 2. Notification Queue (`src/services/notification-queue.ts`)

Queue management for notifications:

- Prevent notification spam (rate limiting)
- Priority-based ordering (high priority notifications show immediately)
- Coalescing similar notifications (e.g., multiple errors become "N errors occurred")
- Maximum queue depth with overflow handling

### 3. Platform-Specific Handling

- Handle macOS notification permissions
- Handle Windows notification center behavior
- Graceful fallback if notifications unavailable

### 4. IPC Integration

- Implement notification IPC channel handler in main process
- Allow renderer to trigger notifications via preload bridge
- Support notification responses (action clicks) back to renderer

## Technical Requirements

- Use Electron's built-in `Notification` API (no external libraries)
- Integrate with types from F-core-types-ipc-architecture
- Use error handling patterns from F-error-handling-framework
- Service should be singleton pattern

## Implementation Guidance

**Files to Create/Modify:**

- Create `src/services/notifications.ts`
- Create `src/services/notification-queue.ts`
- Update `src/services/index.ts` with exports

**Notification Service Pattern:**

```typescript
// In main process
import { Notification } from "electron";

class NotificationService {
  private queue: NotificationQueue;

  show(options: NotificationOptions): void {
    if (!Notification.isSupported()) {
      logger.warn("Notifications not supported on this platform");
      return;
    }

    this.queue.enqueue(options);
  }

  private displayNotification(options: NotificationOptions): void {
    const notification = new Notification({
      title: options.title,
      body: options.body,
      // icon: nativeImage for app icon
    });

    notification.on("click", () => options.onClick?.());
    notification.show();
  }
}
```

**IPC Handler:**

```typescript
// In main process
ipcMain.on(IPC_CHANNELS.NOTIFY, (event, options: NotificationOptions) => {
  notificationService.show(options);
});
```

**Renderer Usage:**

```typescript
window.electronAPI.notify({
  title: "Recording Complete",
  body: "Your audio has been processed",
  type: "success",
  priority: "medium",
});
```

## Acceptance Criteria

1. [ ] NotificationService created with show, showInfo, showWarning, showError, showSuccess methods
2. [ ] Notification types (info, warning, error, success) have distinct visual presentation
3. [ ] Priority-based queue implemented (high priority shows immediately)
4. [ ] Rate limiting prevents notification spam (max N notifications per minute)
5. [ ] Similar notifications coalesce (e.g., multiple errors grouped)
6. [ ] Notification click handlers work
7. [ ] Platform check - graceful handling when notifications not supported
8. [ ] macOS notification permissions handled appropriately
9. [ ] IPC channel handler receives and displays notifications from renderer
10. [ ] Preload bridge `notify` method implemented
11. [ ] Notifications work on both macOS and Windows

## Testing Requirements

- Unit tests for notification queue logic (priority ordering, rate limiting)
- Unit tests for notification coalescing
- Test graceful degradation when notifications unsupported
- Manual testing on macOS and Windows

## Performance Requirements

- Queue processing should not block main process
- Notification display should be non-blocking

## Security Considerations

- Notification content must not include sensitive data
- Sanitize any user-provided content before display
- Notification actions should validate before executing

## Non-Functional Requirements

- Notifications must respect OS notification settings (Do Not Disturb, etc.)
- High-priority notifications should use OS urgent/critical notification features where available

## Dependencies

- F-core-types-ipc-architecture (for notification types, IPC channel definitions)
- F-error-handling-framework (for error handling patterns in notification service)
