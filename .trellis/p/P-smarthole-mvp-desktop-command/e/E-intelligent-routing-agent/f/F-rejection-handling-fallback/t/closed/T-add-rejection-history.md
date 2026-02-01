---
id: T-add-rejection-history
title: Add rejection history tracking and re-routing logic to RoutingAgent
status: done
priority: high
parent: F-rejection-handling-fallback
prerequisites: []
affectedFiles:
  src/types/routing.ts: Added RejectionRecord, RejectionHistory, and
    RoutingAgentEvents interfaces. Extended RoutingAgentService interface with
    on() and off() event subscription methods.
  src/services/routing-agent.ts: Extended RoutingAgentServiceImpl with rejection
    history tracking, re-routing logic, event emission, and cleanup
    functionality. Added NotificationService dependency. Implemented
    handleRejection(), reRouteMessage(), handleAllClientsRejected(),
    cleanupStaleHistory(), cleanup(), on(), and off() methods.
  src/services/routing-agent.test.ts: Added tests for rejection handling and
    routing events. Added NotificationService initialization. Added tests for
    event subscription/unsubscription and typed event handlers.
log:
  - >-
    Research phase completed. Verified:

    1. routing-agent.ts exists with RoutingAgentServiceImpl class

    2. routing.ts has RoutingAgentService interface and RoutingRequestParams
    with excludeClients/rejectionContext

    3. message-delivery.ts has MessageDeliveryEvents with 'response:reject'
    event

    4. tool-generator.ts has generateToolsExcluding() method

    5. notifications.ts has NotificationService with showWarning() method

    6. Existing test patterns in routing-agent.test.ts use vi.fn() mocks


    Starting implementation of rejection history tracking and re-routing logic.
  - >-
    Implemented rejection history tracking and re-routing logic in the
    RoutingAgent service. The implementation includes:


    1. **New Types in routing.ts**:
       - `RejectionRecord` interface for tracking individual rejections
       - `RejectionHistory` interface for tracking full routing context per message
       - `RoutingAgentEvents` interface for typed event subscriptions
       - Extended `RoutingAgentService` interface with `on()` and `off()` methods

    2. **RoutingAgent Implementation**:
       - Added rejection history Map for tracking per-message routing context
       - Subscribed to `MessageDeliveryService.on('response:reject')` events
       - Implemented `handleRejection()` - records rejection and triggers re-routing
       - Implemented `reRouteMessage()` - re-routes with excluded clients and rejection context
       - Implemented `handleAllClientsRejected()` - notifies user via NotificationService and emits events
       - Implemented `cleanupStaleHistory()` with 5-minute TTL to prevent memory leaks
       - Added `cleanup()` method for proper resource cleanup
       - Added typed event emitter with `on()`/`off()` methods
       - Emits `routing:success`, `routing:rejected`, and `routing:failed` events

    3. **Constants**:
       - `MAX_REJECTIONS = 3` - maximum re-routing attempts
       - `REJECTION_HISTORY_TTL_MS = 5 minutes` - history entry TTL
       - `CLEANUP_INTERVAL_MS = 1 minute` - cleanup interval

    4. **Tests**:
       - Added tests for rejection handling flow
       - Added tests for routing events subscription/unsubscription
       - Added tests for typed event handler signatures
       - All 28 routing-agent tests pass
schema: v1.0
childrenIds: []
created: 2026-02-01T04:04:51.340Z
updated: 2026-02-01T04:04:51.340Z
---

# Add rejection history tracking and re-routing logic to RoutingAgent

## Purpose

Extend the RoutingAgent service to handle client rejections by tracking rejection history per message and implementing re-routing logic with excluded clients.

## Scope

### 1. Rejection History Tracking

Add a data structure to track rejection history per message:

```typescript
interface RejectionHistory {
  messageId: string;
  originalMessage: string;
  source: InputMethod;
  metadata?: Record<string, unknown>;
  rejections: Array<{
    clientName: string;
    reason: string;
    rejectedAt: ISOTimestamp;
  }>;
}
```

- Store rejection history in a Map keyed by messageId
- Include cleanup mechanism to prevent memory leaks (e.g., TTL or size limit)

### 2. Subscribe to Rejection Events

Subscribe to `MessageDeliveryService.on('response:reject')` events:

- When a rejection is received for a tracked message:
  - Add the rejection to the message's history
  - Trigger re-routing with updated context

### 3. Re-routing Logic

Implement re-routing when a client rejects:

- Build rejection context string:
  ```
  Previous routing attempt: Routed to "{clientName}" but they rejected because: "{reason}"
  Please route to a different, more appropriate plugin.
  ```
- Use `toolGenerator.generateToolsExcluding()` to exclude clients that already rejected
- Call `routingApi.routeMessage()` with `excludeClients` and `rejectionContext` parameters
- Deliver to new client(s) if routing succeeds

### 4. Maximum Rejection Limit

Prevent infinite re-routing loops:

- Maximum rejections per message: 3 (or number of available clients, whichever is smaller)
- After limit reached, trigger all-clients-rejected handling
- Clean up rejection history for the message

### 5. All-Clients-Rejected Handling

When all available clients have rejected:

- Send user notification via NotificationService:
  - Title: "Unable to route message"
  - Body: Summary of which clients were tried and why they rejected
  - Use `showWarning()` method
- Log the full rejection chain for debugging
- Clean up rejection history for the message
- Emit `routing:rejected` event

### 6. Events

Emit routing events for observability:

- `routing:success` - Message successfully routed (initial or re-route)
- `routing:rejected` - All clients rejected
- `routing:failed` - Routing system failed

Update RoutingAgentService interface if needed to expose event subscription.

## Implementation Location

- `src/services/routing-agent.ts` - Extend existing service
- `src/types/routing.ts` - Add RejectionHistory type if not inlining

## Dependencies

- MessageDeliveryService (existing) for rejection events
- NotificationService (existing) for user feedback
- ToolGeneratorService.generateToolsExcluding() (existing)
- RoutingApiService with excludeClients/rejectionContext (existing)

## Acceptance Criteria

1. [ ] RejectionHistory interface defined and implemented
2. [ ] RoutingAgent subscribes to `response:reject` events
3. [ ] Rejected messages trigger re-routing with context
4. [ ] Rejecting client excluded from re-routing options
5. [ ] Rejection context communicated to LLM via rejectionContext parameter
6. [ ] Maximum rejection limit enforced (prevents infinite loops)
7. [ ] User notified when all clients reject (via NotificationService)
8. [ ] Routing events emitted (success, rejected, failed)
9. [ ] Rejection history cleaned up after completion
10. [ ] All routing failures logged with full context

## Testing

- Unit tests for rejection history management
- Unit tests for re-routing flow with mocked services
- Unit tests for maximum rejection limit
- Unit tests for event emission
