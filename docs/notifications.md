# Notification System

Native OS notification system built on Electron's Notification API, with a queue that provides rate limiting, priority ordering, and notification coalescing.

## Initialization

Initialize the notification service after the logger, inside `app.whenReady()`:

```typescript
import { initializeNotificationService } from "./services/notifications";
import { initializeNotificationQueue } from "./services/notification-queue";

app.whenReady().then(() => {
  const notificationService = initializeNotificationService();
  const notificationQueue = initializeNotificationQueue(notificationService, {
    maxPerMinute: 10,
    maxQueueDepth: 20,
    minInterval: 1000,
  });
});
```

## Usage

### Main Process

```typescript
import { getNotificationQueue } from "./services/notification-queue";

const queue = getNotificationQueue();
queue.enqueue({
  title: "Notification Title",
  body: "Notification body text",
  type: "info", // "info" | "warning" | "error" | "success"
  priority: "medium", // "low" | "medium" | "high"
});
```

### Renderer Process

```typescript
// Convenience methods
window.electronAPI.notifyInfo("Title", "Body text");
window.electronAPI.notifyWarning("Warning", "Something needs attention");
window.electronAPI.notifyError("Error", "Something went wrong");
window.electronAPI.notifySuccess("Success", "Operation completed");

// Full options
window.electronAPI.notify({
  title: "Custom Notification",
  body: "With all options",
  type: "info",
  priority: "high",
});
```

## Queue Features

- **Priority Ordering**: High priority notifications shown before medium/low
- **Rate Limiting**: Configurable max per minute and minimum interval
- **Coalescing**: Similar notifications combined (e.g., "3 occurrences")
- **Queue Overflow**: Low priority dropped first when queue is full
