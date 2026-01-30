---
id: T-add-integration-tests-for
title: Add integration tests for notification system end-to-end flow
status: done
priority: low
parent: F-system-notifications
prerequisites:
  - T-integrate-notification-system
affectedFiles:
  src/services/notifications.integration.test.ts: "Created new integration test
    file with 28 tests covering full notification system flow: IPC handler ->
    NotificationQueue -> NotificationService. Tests include full flow
    validation, high priority immediate display, rate limiting integration,
    invalid payload rejection, graceful degradation when notifications not
    supported, coalescing integration, content sanitization, and queue overflow
    handling."
log:
  - >-
    Started implementation. Researched existing code:

    - Reviewed logger.integration.test.ts for integration test patterns

    - Reviewed notifications.ts, notification-queue.ts, and
    notification-handler.ts for implementation details

    - Reviewed existing unit tests for mocking patterns

    - Reviewed types/ipc.ts for NotifyShowPayload and type guards


    Ready to implement integration tests covering:

    1. Full flow: IPC -> Queue -> Service

    2. High priority immediate display

    3. Rate limiting across integration

    4. Invalid payload rejection at IPC layer

    5. Graceful degradation when notifications not supported
  - >-
    Created comprehensive integration tests for the notification system
    end-to-end flow. The tests verify the complete flow from IPC message receipt
    through NotificationQueue to NotificationService display, including:


    1. Full flow tests (IPC -> Queue -> Service -> Display)

    2. High priority notification immediate display behavior

    3. Rate limiting enforcement across the integrated system

    4. Invalid payload rejection at the IPC layer

    5. Graceful degradation when notifications are not supported

    6. Notification coalescing through the full flow

    7. Content sanitization (HTML stripping)

    8. Queue overflow handling with priority-based dropping


    All 28 integration tests pass, along with the existing 804 tests (832
    total). Quality checks (lint, format, type-check) all pass.
schema: v1.0
childrenIds: []
created: 2026-01-30T02:02:08.328Z
updated: 2026-01-30T02:02:08.328Z
---

# Add integration tests for notification system end-to-end flow

## Context

This task adds integration tests that verify the notification system works end-to-end, from IPC message receipt through queue processing to notification display.

**Related Issues:**

- Parent Feature: F-system-notifications
- Prerequisite: T-integrate-notification-system (complete system to test)

**Reference Files:**

- `src/services/logger.integration.test.ts` - Pattern for integration tests

## Implementation Requirements

### 1. Create `src/services/notifications.integration.test.ts`

Integration tests that verify the full flow:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initializeNotificationService, resetNotificationService } from "./notifications";
import { initializeNotificationQueue, resetNotificationQueue } from "./notification-queue";
import { processNotification } from "../ipc/notification-handler";
import { createLogger } from "./logger";

describe("Notification System Integration", () => {
  // Setup and teardown
  // Test cases for full flow
});
```

### 2. Test Scenarios

**Full Flow Tests:**

- Notification enqueued via IPC handler → queued → displayed
- High priority notification shows immediately
- Rate limiting prevents spam across the integration

**Error Handling Tests:**

- Invalid payload rejected at IPC layer
- Notification service failure handled gracefully

**Platform Handling Tests:**

- Test behavior when notifications not supported (mock `Notification.isSupported()` to return false)
- Verify graceful degradation (no errors, warning logged)

### 3. Mock Electron's Notification API

```typescript
vi.mock("electron", () => ({
  Notification: class MockNotification {
    static isSupported = vi.fn(() => true);
    constructor(public options: { title: string; body: string }) {}
    on = vi.fn();
    show = vi.fn();
  },
}));
```

### 4. Test Rate Limiting Integration

```typescript
it("rate limits notifications across the system", async () => {
  vi.useFakeTimers();

  // Send 15 notifications rapidly
  for (let i = 0; i < 15; i++) {
    processNotification(validPayload, queue, logger);
  }

  // Only maxPerMinute should have been shown
  expect(mockNotificationShow).toHaveBeenCalledTimes(10);

  // Advance time and verify more can be shown
  vi.advanceTimersByTime(60000);
  processNotification(validPayload, queue, logger);
  expect(mockNotificationShow).toHaveBeenCalledTimes(11);

  vi.useRealTimers();
});
```

## Technical Approach

1. Create integration test file
2. Mock Electron's Notification API
3. Initialize real services (not mocked)
4. Test full flow from IPC → Queue → Service
5. Use fake timers for rate limiting tests
6. Clean up after each test

## Acceptance Criteria

- [ ] Integration test file created
- [ ] Full flow test: IPC → Queue → Display
- [ ] High priority bypass test
- [ ] Rate limiting integration test
- [ ] Error handling test (invalid payload)
- [ ] Platform unavailable test (graceful degradation)
- [ ] All tests pass with `mise run test`

## Testing Requirements

This task IS the testing task. Run with:

```bash
mise run test
```

Verify:

- All integration tests pass
- No console errors during test run
- Tests clean up properly (no timer leaks)

## Files to Create/Modify

- Create: `src/services/notifications.integration.test.ts`
