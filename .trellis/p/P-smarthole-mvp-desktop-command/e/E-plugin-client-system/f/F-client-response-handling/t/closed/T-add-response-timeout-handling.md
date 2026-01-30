---
id: T-add-response-timeout-handling
title: Add response timeout handling for implicit rejection
status: done
priority: high
parent: F-client-response-handling
prerequisites: []
affectedFiles:
  src/services/message-delivery.ts: Added responseTimeoutMs config option,
    pendingResponses Map for timer tracking,
    startResponseTimer/cancelResponseTimer/clearAllPendingTimers/handleTimeout
    methods, timer start on successful delivery, timer cancel on response
    received, timer cleanup on reset
  src/services/message-delivery.test.ts: "Added 7 new tests for response timeout:
    default 30s timeout, custom timeout, status update on timeout, timer
    cancellation on response, no timer for failed deliveries, multiple
    concurrent timeouts, timer cleanup on reset"
log:
  - >-
    Started implementation. Reviewed existing message-delivery.ts and test file.
    Key findings:

    - MessageDeliveryConfig exists with maxHistorySize option

    - Need to add responseTimeoutMs option

    - sendToClient() already records delivery status

    - processResponse() handles responses and emits events

    - Need to add pendingResponses Map for timer tracking

    - Need to implement handleTimeout() method

    - Need to clear timers in resetMessageDelivery()
  - 'Implemented response timeout handling for implicit rejection. Added
    configurable responseTimeoutMs option (default: 30 seconds) to
    MessageDeliveryConfig. Timers are tracked using a Map with
    ${messageId}:${clientName} keys. On successful delivery, a timer starts and
    fires handleTimeout() after the configured duration, which emits
    response:reject event and updates DeliveryStatus with reason "Response
    timeout". Timers are cancelled when a response is received and cleared on
    service reset. Added 7 comprehensive tests using Vitest fake timers.'
schema: v1.0
childrenIds: []
created: 2026-01-30T21:55:26.882Z
updated: 2026-01-30T21:55:26.882Z
---

# Add Response Timeout Handling for Implicit Rejection

## Purpose

When a message is delivered to a client and no response is received within a timeout period, treat it as an implicit rejection.

## Current State

- Messages are delivered to clients via `sendToClient()`
- Responses are processed via `handleResponse()`
- No timeout mechanism exists for pending responses

## Requirements

1. **Configurable timeout** (default: 30 seconds)
2. **Timeout triggers implicit rejection**:
   - Emit `response:reject` event with reason "Response timeout"
   - Update DeliveryStatus with timeout info
   - Log the timeout event
3. **Timer management**:
   - Start timer when message is delivered successfully
   - Cancel timer when response is received
   - Clean up timers on service reset/shutdown

## Technical Approach

### Configuration

Add to `MessageDeliveryConfig`:

```typescript
interface MessageDeliveryConfig {
  maxHistorySize?: number;
  responseTimeoutMs?: number; // Default: 30000 (30 seconds)
}
```

### Timer Tracking

Add a Map to track pending response timers:

```typescript
private readonly pendingResponses: Map<string, NodeJS.Timeout> = new Map();
// Key: `${messageId}:${clientName}` for unique tracking
```

### On Successful Delivery

In `sendToClient()` after successful send:

```typescript
if (result.success) {
  const key = `${message.id}:${clientName}`;
  const timer = setTimeout(() => {
    this.handleTimeout(message.id, clientName);
  }, this.config.responseTimeoutMs);
  this.pendingResponses.set(key, timer);
}
```

### On Response Received

In `processResponse()`, cancel the timer:

```typescript
const key = `${messageId}:${clientName}`;
const timer = this.pendingResponses.get(key);
if (timer) {
  clearTimeout(timer);
  this.pendingResponses.delete(key);
}
```

### Timeout Handler

```typescript
private handleTimeout(messageId: MessageId, clientName: string): void {
  const key = `${messageId}:${clientName}`;
  this.pendingResponses.delete(key);

  // Update delivery status
  const status = this.findDeliveryStatusForUpdate(messageId, clientName);
  if (status) {
    status.response = {
      type: "reject",
      receivedAt: createTimestamp(),
      payload: { reason: "Response timeout" },
    };
  }

  this.logger.warn("Response timeout", { messageId, clientName });
  this.emitter.emit("response:reject", messageId, clientName, "Response timeout");
}
```

## Files to Modify

- `src/services/message-delivery.ts` - Add timeout logic
- `src/services/message-delivery.test.ts` - Add timeout tests

## Acceptance Criteria

1. [ ] Timeout is configurable (default 30s)
2. [ ] Timeout emits `response:reject` event
3. [ ] Timeout updates DeliveryStatus appropriately
4. [ ] Timer is cancelled when response is received
5. [ ] Timers are cleaned up on service reset
6. [ ] Tests verify timeout behavior with fake timers
