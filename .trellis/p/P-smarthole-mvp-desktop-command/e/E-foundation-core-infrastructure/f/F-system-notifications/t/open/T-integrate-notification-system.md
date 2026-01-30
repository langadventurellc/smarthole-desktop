---
id: T-integrate-notification-system
title: Integrate notification system into main process initialization
status: open
priority: medium
parent: F-system-notifications
prerequisites:
  - T-create-notification-ipc
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T02:01:50.868Z
updated: 2026-01-30T02:01:50.868Z
---

# Integrate notification system into main process initialization

## Context

This task wires up the notification system components (NotificationService, NotificationQueue, IPC handler) in the main process and handles platform-specific notification permissions.

**Related Issues:**

- Parent Feature: F-system-notifications
- Prerequisite: T-create-notification-ipc (provides the IPC handler)

**Reference Files:**

- `src/main.ts` - Main process entry point where initialization happens
- `src/ipc/log-handler.ts` - Shows how log handler is registered

## Implementation Requirements

### 1. Update `src/main.ts`

Add notification system initialization after logger initialization:

```typescript
import { ipcMain } from "electron";
import { initializeNotificationService, getNotificationService } from "./services/notifications";
import { initializeNotificationQueue, getNotificationQueue } from "./services/notification-queue";
import { createNotificationHandler } from "./ipc/notification-handler";
import { IPC_CHANNELS } from "./types";

// In app.whenReady() callback, after logger initialization:

// Initialize notification service
const notificationService = initializeNotificationService();
logger.info("Notification service initialized", {
  supported: notificationService.isSupported(),
});

// Initialize notification queue
const notificationQueue = initializeNotificationQueue(notificationService, {
  maxPerMinute: 10,
  maxQueueDepth: 20,
  minInterval: 1000,
});

// Create child logger for notification IPC
const notifyLogger = logger.child({ component: "NotificationIPC" });

// Register IPC handler
const notificationHandler = createNotificationHandler(notificationQueue, notifyLogger);
ipcMain.on(IPC_CHANNELS.NOTIFY_SHOW, notificationHandler);
```

### 2. Handle macOS Notification Permissions

On macOS, notification permissions may need to be requested:

```typescript
import { app } from "electron";

// Check/request notification permission on macOS
if (process.platform === "darwin") {
  // Electron handles this automatically in most cases
  // Log the permission status for diagnostics
  logger.debug("macOS notification permission check", {
    platform: process.platform,
    notificationsSupported: notificationService.isSupported(),
  });
}
```

### 3. Clean Shutdown

Add cleanup in app quit handler:

```typescript
app.on("will-quit", () => {
  getNotificationQueue()?.destroy();
});
```

### 4. Export Types for Renderer

Ensure the notification types are exported from `src/types/index.ts` if not already.

## Technical Approach

1. Import notification system components in main.ts
2. Initialize services in correct order (logger → notification service → queue)
3. Register IPC handler with ipcMain
4. Add cleanup on app quit
5. Log initialization status for diagnostics

## Acceptance Criteria

- [ ] NotificationService initialized in main.ts after logger
- [ ] NotificationQueue initialized with NotificationService
- [ ] IPC handler registered for `notify:show` channel
- [ ] Notification support status logged at startup
- [ ] Queue destroyed on app quit (timers cleaned up)
- [ ] Renderer can trigger notifications via `window.electronAPI.notify()`

## Testing Requirements

This is primarily integration work. Manual testing:

- Start app in development mode
- Verify notification support logged in startup
- From renderer console, call `window.electronAPI.notifyInfo("Test", "Hello")`
- Verify notification appears on system
- Verify no errors in console

## Files to Create/Modify

- Modify: `src/main.ts` (add initialization and IPC registration)
