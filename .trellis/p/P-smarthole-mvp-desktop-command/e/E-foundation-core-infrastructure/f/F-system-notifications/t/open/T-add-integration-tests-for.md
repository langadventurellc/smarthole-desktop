---
id: T-add-integration-tests-for
title: Add integration tests for notification system end-to-end flow
status: open
priority: low
parent: F-system-notifications
prerequisites:
  - T-integrate-notification-system
affectedFiles: {}
log: []
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
