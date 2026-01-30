---
id: T-implement-notificationqueue
title: Implement NotificationQueue with priority ordering and rate limiting
status: open
priority: high
parent: F-system-notifications
prerequisites:
  - T-create-notificationservice
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T02:01:18.650Z
updated: 2026-01-30T02:01:18.650Z
---

# Implement NotificationQueue with priority ordering and rate limiting

## Context

This task implements the `NotificationQueue` that manages notification delivery to prevent spam and ensure important notifications are shown promptly. The queue sits between IPC handlers and the `NotificationService`.

**Related Issues:**

- Parent Feature: F-system-notifications
- Prerequisite: T-create-notificationservice (provides the NotificationService to display notifications)

**Reference Files:**

- `src/services/notifications.ts` - The NotificationService this queue will use
- `src/types/ipc.ts` - Defines `NotificationPriority` (low, medium, high)

## Implementation Requirements

### 1. Create `src/services/notification-queue.ts`

```typescript
import { NotificationOptions, NotificationService } from "./notifications";

export interface NotificationQueueConfig {
  /** Maximum notifications per minute (default: 10) */
  maxPerMinute: number;
  /** Maximum queue depth before dropping low priority (default: 20) */
  maxQueueDepth: number;
  /** Minimum interval between notifications in ms (default: 1000) */
  minInterval: number;
}

export interface NotificationQueue {
  enqueue(notification: NotificationOptions): void;
  clear(): void;
  getQueueLength(): number;
  destroy(): void;
}
```

### 2. Queue Management Features

**Priority Ordering:**

- High priority notifications skip the queue and display immediately (unless rate limited)
- Medium priority notifications are queued normally
- Low priority notifications are queued but dropped first when queue overflows

**Rate Limiting:**

- Track notifications shown in the last minute using a sliding window
- Enforce maximum notifications per minute (configurable, default 10)
- Enforce minimum interval between notifications (configurable, default 1000ms)

**Notification Coalescing:**

- Group similar notifications to prevent spam
- Coalescing key = `${type}:${title}` (e.g., "error:Connection Failed")
- When coalescing, update body to indicate count (e.g., "Connection failed (3 occurrences)")
- Only coalesce within a short window (5 seconds)

**Queue Overflow:**

- When queue exceeds `maxQueueDepth`, drop oldest low-priority notifications first
- If no low-priority to drop, log warning and drop oldest medium-priority
- Never drop high-priority notifications

### 3. Processing Logic

```typescript
class NotificationQueueImpl implements NotificationQueue {
  private queue: QueuedNotification[] = [];
  private recentNotifications: number[] = []; // timestamps
  private lastShown: number = 0;
  private processTimer: NodeJS.Timeout | null = null;
  private coalescingMap: Map<string, CoalescedNotification> = new Map();

  enqueue(notification: NotificationOptions): void {
    // 1. Check for coalescing opportunity
    // 2. If high priority and not rate limited, show immediately
    // 3. Otherwise, add to queue with priority
    // 4. Enforce queue depth limits
    // 5. Schedule queue processing if not already scheduled
  }

  private processQueue(): void {
    // 1. Check rate limit
    // 2. Get highest priority notification from queue
    // 3. Show notification via NotificationService
    // 4. Update rate limiting counters
    // 5. Schedule next processing if queue not empty
  }
}
```

### 4. Singleton Pattern

- `initializeNotificationQueue(service: NotificationService, config?: Partial<NotificationQueueConfig>)`
- `getNotificationQueue()`
- `resetNotificationQueue()`

## Technical Approach

1. Create `QueuedNotification` interface with notification + metadata (timestamp, priority)
2. Implement sliding window rate limiting using timestamp array
3. Implement priority queue using sorted array (or simple array with priority-based dequeue)
4. Implement coalescing using Map with TTL-based cleanup
5. Use `setTimeout` for non-blocking queue processing
6. Clean up timers in `destroy()` method

## Acceptance Criteria

- [ ] `NotificationQueue` class created in `src/services/notification-queue.ts`
- [ ] High priority notifications display immediately when not rate limited
- [ ] Rate limiting enforces max notifications per minute
- [ ] Rate limiting enforces minimum interval between notifications
- [ ] Notification coalescing groups similar notifications within 5-second window
- [ ] Queue overflow drops low priority notifications first
- [ ] Queue processing is non-blocking (uses setTimeout, not while loops)
- [ ] `clear()` method empties the queue
- [ ] `destroy()` method cleans up timers
- [ ] Singleton pattern with initialize/get/reset functions

## Testing Requirements

Write unit tests in `src/services/notification-queue.test.ts`:

- Test high priority notifications shown immediately
- Test rate limiting blocks excessive notifications
- Test queue ordering (high > medium > low priority)
- Test notification coalescing updates body text
- Test queue overflow drops low priority first
- Test clear() empties queue
- Test destroy() cleans up timers
- Use fake timers (vi.useFakeTimers) for timing-dependent tests

## Files to Create/Modify

- Create: `src/services/notification-queue.ts`
- Create: `src/services/notification-queue.test.ts`
- Modify: `src/services/index.ts` (add exports)
