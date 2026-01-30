---
id: T-create-notificationservice
title: Create NotificationService with Electron Notification API wrapper
status: done
priority: high
parent: F-system-notifications
prerequisites: []
affectedFiles:
  src/services/notifications.ts: Created new NotificationService with singleton
    pattern, Electron Notification API wrapper, content sanitization, and
    graceful degradation
  src/services/notifications.test.ts: Created comprehensive unit tests (33 tests)
    for NotificationService including singleton pattern, all methods, content
    sanitization, and graceful degradation
  src/services/index.ts: Added export for notifications module
log:
  - >-
    Research phase completed:

    - Reviewed logger.ts for singleton pattern implementation

    - Reviewed types/ipc.ts for existing notification types (NotifyShowPayload,
    NotificationType, NotificationPriority, NotificationAction)

    - Reviewed logger.test.ts for testing patterns (mocking approach, test
    structure)

    - Verified services/index.ts for export pattern


    Implementation plan:

    1. Create src/services/notifications.ts with:
       - NotificationService interface matching task requirements
       - NotificationServiceImpl class with private constructor (singleton pattern)
       - initializeNotificationService(), getNotificationService(), resetNotificationService() functions
       - show(), showInfo(), showWarning(), showError(), showSuccess() methods
       - isSupported() method using Electron's Notification.isSupported()
       - Content sanitization helper (stripHtmlTags)
       - Graceful degradation with logging

    2. Create src/services/notifications.test.ts with:
       - Mock Electron's Notification API
       - Test singleton pattern (initialize, get, reset)
       - Test all convenience methods
       - Test content sanitization
       - Test graceful degradation

    3. Update src/services/index.ts with new exports
  - >-
    Implemented NotificationService with Electron Notification API wrapper
    following the singleton pattern established by logger.ts.


    Key implementation details:

    - Created NotificationService interface with show(), showInfo(),
    showWarning(), showError(), showSuccess(), and isSupported() methods

    - Implemented NotificationServiceImpl class with private constructor
    enforcing singleton pattern

    - Added singleton management functions: initializeNotificationService(),
    getNotificationService(), resetNotificationService()

    - Implemented content sanitization via stripHtmlTags() to prevent HTML
    rendering in notifications

    - Added graceful degradation: when notifications are not supported, warnings
    are logged but no errors thrown

    - Integrated with existing logger service for diagnostic logging

    - Uses existing types from src/types/ipc.ts (NotifyShowPayload,
    NotificationType, NotificationPriority)

    - Comprehensive error handling that never throws exceptions that could crash
    the main process


    Testing:

    - Created 33 unit tests covering singleton pattern, all methods, content
    sanitization, and graceful degradation

    - Used vi.hoisted() for proper Electron module mocking with Vitest

    - All tests pass, all quality checks (lint, type-check, format) pass
schema: v1.0
childrenIds: []
created: 2026-01-30T02:00:55.013Z
updated: 2026-01-30T02:00:55.013Z
---

# Create NotificationService with Electron Notification API wrapper

## Context

This task implements the core `NotificationService` that wraps Electron's built-in `Notification` API. The service follows the singleton pattern established by `src/services/logger.ts` and integrates with the existing type definitions in `src/types/ipc.ts`.

**Related Issues:**

- Parent Feature: F-system-notifications
- Prerequisites: F-core-types-ipc-architecture (completed), F-error-handling-framework (completed)

**Reference Files:**

- `src/services/logger.ts` - Pattern for singleton service initialization
- `src/types/ipc.ts` - Already defines `NotificationType`, `NotificationPriority`, `NotificationAction`, `NotifyShowPayload`

## Implementation Requirements

### 1. Create `src/services/notifications.ts`

Create the notification service with the following structure:

```typescript
import { Notification } from "electron";
import { getLogger, Logger } from "./logger";
import { NotifyShowPayload, NotificationType, NotificationPriority } from "../types";

export interface NotificationOptions extends NotifyShowPayload {
  onClick?: () => void;
}

export interface NotificationService {
  show(options: NotificationOptions): void;
  showInfo(title: string, body: string): void;
  showWarning(title: string, body: string): void;
  showError(title: string, body: string): void;
  showSuccess(title: string, body: string): void;
  isSupported(): boolean;
}
```

### 2. Service Implementation

- **Platform Support Check**: Use `Notification.isSupported()` to check if notifications are available
- **Graceful Degradation**: If notifications not supported, log a warning and return silently
- **Click Handlers**: Support optional `onClick` callback for notification clicks
- **Logging**: Log notification display events at debug level for diagnostics
- **Content Sanitization**: Sanitize title and body to prevent script injection (strip HTML tags)

### 3. Singleton Pattern

Follow the pattern from `logger.ts`:

- `initializeNotificationService()` - Initialize the singleton
- `getNotificationService()` - Get the singleton instance (throws if not initialized)
- `resetNotificationService()` - Reset for testing

### 4. Error Handling

- Wrap notification creation in try/catch
- Log errors using the logger service
- Never throw exceptions that could crash the main process

## Technical Approach

1. Create the `NotificationService` class with private constructor
2. Implement `show()` method that:
   - Checks `Notification.isSupported()`
   - Creates `new Notification({ title, body })`
   - Attaches click handler if provided
   - Calls `notification.show()`
3. Implement convenience methods (`showInfo`, `showWarning`, etc.) that call `show()` with appropriate defaults
4. Add content sanitization helper function

## Acceptance Criteria

- [ ] `NotificationService` class created in `src/services/notifications.ts`
- [ ] `show()` method creates and displays Electron notifications
- [ ] Convenience methods (`showInfo`, `showWarning`, `showError`, `showSuccess`) work correctly
- [ ] `isSupported()` returns correct value based on platform
- [ ] Graceful handling when notifications not supported (logs warning, doesn't crash)
- [ ] Click handlers are invoked when notification is clicked
- [ ] Content is sanitized (HTML tags stripped from title/body)
- [ ] Singleton pattern with `initializeNotificationService()`, `getNotificationService()`, `resetNotificationService()`
- [ ] Service integrates with existing logger for diagnostics

## Testing Requirements

Write unit tests in `src/services/notifications.test.ts`:

- Test `isSupported()` returns correct value
- Test `show()` creates notification with correct parameters
- Test convenience methods set correct type/priority defaults
- Test graceful degradation when notifications not supported
- Test content sanitization strips HTML
- Test singleton pattern (initialize, get, reset)
- Mock Electron's Notification API for testing

## Files to Create/Modify

- Create: `src/services/notifications.ts`
- Create: `src/services/notifications.test.ts`
- Modify: `src/services/index.ts` (add exports)
