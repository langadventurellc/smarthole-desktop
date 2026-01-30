---
id: T-integrate-notification
title: Integrate notification responses with notification queue
status: done
priority: high
parent: F-client-response-handling
prerequisites: []
affectedFiles:
  src/main.ts: Added imports for NotificationPayload, ClientNotificationPriority,
    NotificationPriority. Added mapClientPriorityToQueuePriority() helper to map
    client 'normal' priority to queue 'medium'. Added hasNotificationContent()
    helper to validate notifications. Added response:notification event listener
    that validates, maps, and enqueues client notifications.
log:
  - >-
    Research complete. Key findings:

    - NotificationPayload from client has optional title/body and priority with
    "normal" value

    - NotificationQueue.enqueue() expects NotificationOptions with required
    title/body, type, and priority using "medium"

    - Need to map client's "normal" priority to queue's "medium"

    - Event listener wiring goes after initializeMessageDelivery() in main.ts

    - Will add validation to skip empty notifications (no title AND no body)
  - >-
    Integrated notification responses with the notification queue system. Added
    event listener for `response:notification` events from
    MessageDeliveryService that:

    1. Validates notifications have content (title or body) before enqueueing

    2. Maps client notification payload to NotificationOptions format (title,
    body, type='info', priority)

    3. Maps client priority values to queue priority (normal -> medium)

    4. Uses client name as fallback title when not provided

    5. Logs both empty notification warnings and successful routing
schema: v1.0
childrenIds: []
created: 2026-01-30T21:55:26.746Z
updated: 2026-01-30T21:55:26.746Z
---

# Integrate Notification Responses with Notification Queue

## Purpose

When a plugin client sends a `notification` response, the notification should be displayed to the user via the existing notification queue system.

## Current State

- `response:notification` events are emitted by MessageDeliveryService when notification responses arrive
- NotificationQueue exists with `enqueue()` method that handles rate limiting and priority
- These two systems are not connected

## Requirements

1. Wire up `response:notification` event listener in main.ts
2. Map client notification payload to NotificationOptions:
   - `title` → `title` (required for system notifications)
   - `body` → `body`
   - `priority` → `priority` (map `normal` to `medium`)
   - Set `type` to `'client'` or similar identifier
3. Validate notification has required fields before enqueueing
4. Log successful routing of notification

## Technical Approach

In `main.ts`, after initializing message delivery:

```typescript
wsState.messageDelivery.on("response:notification", (messageId, clientName, notification) => {
  // Validate notification has content
  if (!notification.title && !notification.body) {
    logger.warn("Empty notification from client", { clientName, messageId });
    return;
  }

  // Map and enqueue
  notificationQueue.enqueue({
    title: notification.title ?? clientName,
    body: notification.body ?? "",
    type: "client",
    priority: mapPriority(notification.priority),
  });
});
```

## Files to Modify

- `src/main.ts` - Add event listener wiring

## Acceptance Criteria

1. [ ] Notification responses from clients display as system notifications
2. [ ] Notification priority is respected (maps to queue priority)
3. [ ] Empty notifications are logged and skipped
4. [ ] Tests verify the integration
