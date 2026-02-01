---
id: F-rejection-handling-fallback
title: Rejection Handling & Fallback System
status: done
priority: medium
parent: E-intelligent-routing-agent
prerequisites:
  - F-routing-agent-core-logic
affectedFiles:
  src/types/routing.ts: Added RejectionRecord, RejectionHistory, and
    RoutingAgentEvents interfaces. Extended RoutingAgentService interface with
    on() and off() event subscription methods.
  src/services/routing-agent.ts: Extended RoutingAgentServiceImpl with rejection
    history tracking, re-routing logic, event emission, and cleanup
    functionality. Added NotificationService dependency. Implemented
    handleRejection(), reRouteMessage(), handleAllClientsRejected(),
    cleanupStaleHistory(), cleanup(), on(), and off() methods.; Added
    attemptDirectRoutingFallback() method. Modified routeViaLlm() to call
    fallback on LLM failures. Fallback attempts direct routing pattern matching
    and shows user notification on complete failure.
  src/services/routing-agent.test.ts: Added tests for rejection handling and
    routing events. Added NotificationService initialization. Added tests for
    event subscription/unsubscription and typed event handlers.; Added
    comprehensive test suite 'API failure fallback to direct routing' with 11
    tests covering fallback behavior, event emission, and edge cases. Updated
    existing test to reflect new fallback behavior.
log:
  - "Auto-completed: All child tasks are complete"
schema: v1.0
childrenIds:
  - T-add-api-failure-fallback-to
  - T-add-rejection-history
created: 2026-02-01T01:56:42.544Z
updated: 2026-02-01T01:56:42.544Z
---

# Rejection Handling & Fallback System

## Purpose

Implement the re-routing logic when clients reject messages, and graceful fallback handling when the routing API fails. This ensures resilient message routing that can recover from failures.

## Scope

### 1. Rejection Handling & Re-routing

When a client rejects a message, re-invoke the routing agent:

**Rejection Flow:**

1. Client sends `reject` response with reason
2. `MessageDeliveryService` emits `response:reject` event
3. Routing agent receives rejection notification
4. Re-invoke routing with:
   - Original message
   - Rejection context (which client rejected and why)
   - Excluded clients list (clients that already rejected)
5. If new routing succeeds, deliver to new client(s)
6. If all clients reject, notify user

**Re-routing Context Format:**
Add rejection context to the system prompt or user message addendum:

```
Previous routing attempt: Routed to "{clientName}" but they rejected because: "{reason}"
Please route to a different, more appropriate plugin.
```

**Rejection History Tracking:**

```typescript
interface RejectionHistory {
  messageId: string;
  originalMessage: string;
  rejections: Array<{
    clientName: string;
    reason: string;
    rejectedAt: ISOTimestamp;
  }>;
}
```

### 2. Maximum Rejection Limit

Prevent infinite re-routing loops:

- Maximum rejections per message: 3 (or number of available clients, whichever is smaller)
- After limit reached, notify user that no client could handle the request
- Include list of tried clients and their rejection reasons in notification

### 3. All-Clients-Rejected Handling

When all available clients have rejected:

- Send user notification with:
  - Title: "Unable to route message"
  - Body: Summary of which clients were tried and why they rejected
  - Priority: "normal"
- Log the full rejection chain for debugging
- Clean up rejection history for this message

### 4. API Failure Fallback

Handle routing API failures gracefully:

**Fallback Chain:**

1. API fails (network error, timeout, rate limit exhausted)
2. Attempt direct routing pattern matching (if not already tried)
3. If direct route found, deliver message
4. If no direct route, notify user of routing failure

**User Notification for API Failure:**

- Title: "Routing unavailable"
- Body: "Unable to determine the best plugin for your message. Please try again or use direct routing (e.g., 'calendar: your message')."
- Include tip about direct routing syntax

### 5. Event Integration

Subscribe to and emit routing events:

**Subscribe to:**

- `MessageDeliveryService.on('response:reject')` - Trigger re-routing

**Emit:**

- `routing:success` - Message successfully routed
- `routing:rejected` - All clients rejected
- `routing:failed` - Routing system failed

### 6. Notification Integration

Use existing `NotificationService` for user feedback:

- Import and use `getNotificationService()` or emit via IPC
- Ensure notifications don't spam user (use notification service's coalescing)

## Implementation Location

- Extend `src/services/routing-agent.ts`
- `src/services/rejection-handler.ts` (optional, or inline in routing-agent)
- Update `src/types/routing.ts`

## Dependencies

- `F-routing-agent-core-logic` - Core routing logic
- Existing `MessageDeliveryService` for rejection events
- Existing `NotificationService` for user feedback

## Acceptance Criteria

1. [ ] Rejected messages trigger re-routing with context
2. [ ] Rejecting client excluded from re-routing options
3. [ ] Rejection history maintained per message
4. [ ] Maximum rejection limit enforced (prevents infinite loops)
5. [ ] User notified when all clients reject
6. [ ] API failures fall back to direct routing pattern
7. [ ] User notified when routing completely fails
8. [ ] All routing failures logged with full context
9. [ ] Re-routing context communicated to LLM appropriately
10. [ ] Rejection reasons included in failure notifications
