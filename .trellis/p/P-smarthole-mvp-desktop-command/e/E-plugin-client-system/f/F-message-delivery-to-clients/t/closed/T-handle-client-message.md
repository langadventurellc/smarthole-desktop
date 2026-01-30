---
id: T-handle-client-message
title: Handle client message responses (ack/reject)
status: done
priority: medium
parent: F-message-delivery-to-clients
prerequisites:
  - T-implement-core-message
affectedFiles:
  src/services/message-delivery.ts: "Extended with response handling: added
    DeliveryResponse interface, ResponseContext, ResponseProcessResult types,
    MessageDeliveryEvents interface for typed events, handleResponse() and
    on/off() methods to MessageDeliveryService interface, processResponse() and
    findDeliveryStatusForUpdate() private methods, EventEmitter for events,
    parseMessage() helper function"
  src/services/message-delivery.test.ts: "Added handleResponse test suite with 10
    tests covering: ack/reject/notification response processing, delivery status
    updates, event emission for all response types, handling unknown messageIds,
    invalid JSON, non-response messages, and invalid message formats"
  src/main.ts: "Integrated message delivery service: added import, added
    messageDelivery to wsState, initialized service after registration handler,
    wired up response handling in WebSocket message event handler"
log:
  - >-
    Research completed. Key findings:


    1. **Existing types in src/types/messages.ts:**
       - `ClientResponse` interface with `messageId`, `type`, and `payload`
       - `WebSocketResponseMessage` wire format with type: "response"
       - Type guards: `isResponseMessage()`, `isAckResponse()`, `isRejectResponse()`, `isNotificationResponse()`
       - Response types: "ack", "reject", "notification"
       - Payload types: `AckPayload`, `RejectPayload`, `NotificationPayload`

    2. **Existing message-delivery.ts patterns:**
       - Singleton pattern with `initializeMessageDelivery()`, `getMessageDelivery()`, `resetMessageDelivery()`
       - `DeliveryStatus` interface with `messageId`, `clientName`, `result`, `attemptedAt`
       - History tracking with LRU eviction
       - Logger child component pattern

    3. **Registration handler pattern (to follow):**
       - `processMessage(data, context)` method taking RawData and context
       - Returns `MessageProcessResult` discriminated union
       - Uses `parseMessage()` helper for JSON parsing
       - Type guards for message validation

    4. **Main.ts integration pattern:**
       - Wire up via `wsState.server.on("message", ...)` event
       - Similar context passing with connectionId

    5. **EventEmitter pattern from websocket-server.ts:**
       - Define typed events interface
       - Use internal EventEmitter with typed on/off methods

    Implementation approach:

    - Add response handling directly to MessageDeliveryService (simpler than
    separate handler)

    - Add `response` field to DeliveryStatus interface

    - Add EventEmitter for response events

    - Add `handleResponse()` method to process incoming responses

    - Integrate in main.ts alongside registration handling
  - Implemented client message response handling in the message delivery
    service. Added `handleResponse()` method to process incoming WebSocket
    response messages (ack, reject, notification). The implementation validates
    messages using existing type guards, updates delivery status with response
    information, emits typed events (response:ack, response:reject,
    response:notification), and integrates with main.ts WebSocket message
    handling. Includes 10 unit tests covering all response types, event
    emission, and error cases.
schema: v1.0
childrenIds: []
created: 2026-01-30T19:49:29.612Z
updated: 2026-01-30T19:49:29.612Z
---

# Handle Client Message Responses

## Context

After messages are delivered to clients, clients can respond with ack, reject, or notification responses. This task implements the handling of those responses and updates delivery status accordingly.

**Related:**

- Feature: `F-message-delivery-to-clients`
- Depends on: `T-implement-core-message` (core delivery service)
- Message types: `src/types/messages.ts` (already defines `ClientResponse` type)
- Registration handler pattern: `src/services/registration-handler.ts`

## Requirements

### Response Processing

Handle incoming `WebSocketResponseMessage` from clients:

```typescript
// Already defined in src/types/messages.ts
interface ClientResponse {
  messageId: MessageId;
  type: "ack" | "reject" | "notification";
  payload: AckPayload | RejectPayload | NotificationPayload;
}
```

### Update Delivery Status

When a response is received:

1. Find the delivery record by `messageId`
2. Update the status with response information:

```typescript
interface DeliveryStatus {
  messageId: MessageId;
  clientName: string;
  result: DeliveryResult;
  attemptedAt: ISOTimestamp;
  // New fields:
  response?: {
    type: "ack" | "reject" | "notification";
    receivedAt: ISOTimestamp;
    payload?: RejectPayload | NotificationPayload;
  };
}
```

### Event Emission

Emit events when responses are received so other parts of the system can react:

```typescript
interface MessageDeliveryEvents {
  "response:ack": (messageId: MessageId, clientName: string) => void;
  "response:reject": (messageId: MessageId, clientName: string, reason: string) => void;
  "response:notification": (
    messageId: MessageId,
    clientName: string,
    notification: NotificationPayload
  ) => void;
}
```

## Technical Approach

1. **Add response handler to message delivery service** or create a separate response handler (follow registration-handler pattern)
2. **Hook into WebSocket server's message event** to intercept `type: "response"` messages
3. **Use existing type guards** from `src/types/messages.ts`: `isResponseMessage()`, `isAckResponse()`, `isRejectResponse()`, `isNotificationResponse()`
4. **Update the delivery status** in the service's internal tracking
5. **Emit events** using EventEmitter pattern (like websocket-server.ts)
6. **Log responses** with appropriate log levels (info for ack, warn for reject)

### Integration Point

In `src/main.ts`, wire up the response handler similar to registration handler:

```typescript
wsState.server.on("message", (info, ws, data) => {
  // Existing: registration handler
  const regResult = wsState.registrationHandler.processMessage(data, {...});

  // New: response handler
  if (isResponseMessage(parsed)) {
    wsState.messageDelivery.handleResponse(data, { connectionId: info.id });
  }
});
```

## Acceptance Criteria

1. [ ] `ClientResponse` messages are correctly parsed and validated
2. [ ] Delivery status updated when ack/reject/notification received
3. [ ] Events emitted for each response type
4. [ ] Responses for unknown messageIds logged but don't throw
5. [ ] Integration with WebSocket server message handling in main.ts
6. [ ] Unit tests for:
   - Processing ack response
   - Processing reject response with reason
   - Processing notification response
   - Handling response for unknown messageId

## Out of Scope

- Automatic retry on reject - fire-and-forget approach
- Notification display (handled by notification service)
- IPC exposure to renderer - separate task
