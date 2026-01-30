---
id: T-handle-client-message
title: Handle client message responses (ack/reject)
status: open
priority: medium
parent: F-message-delivery-to-clients
prerequisites:
  - T-implement-core-message
affectedFiles: {}
log: []
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
