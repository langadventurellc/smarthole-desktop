---
id: T-implement-core-message
title: Implement core message delivery service
status: done
priority: high
parent: F-message-delivery-to-clients
prerequisites: []
affectedFiles:
  src/services/message-delivery.ts: Created new message delivery service with
    singleton pattern, DeliveryResult/DeliveryError/DeliveryStatus types,
    sendToClient/sendToClients methods, delivery history tracking with LRU
    eviction, and structured logging
  src/services/message-delivery.test.ts: Added comprehensive unit tests covering
    initialization, single/multi-client delivery, error handling for all failure
    modes, delivery history tracking, and history eviction behavior
log:
  - Started implementation. Reviewed existing patterns in client-registry.ts,
    registration-handler.ts, and messages.ts. Will create message-delivery.ts
    following the same singleton pattern.
  - 'Implemented the core message delivery service following the established
    singleton pattern. The service provides fire-and-forget message delivery to
    registered plugin clients via WebSocket. Key features include:
    sendToClient/sendToClients for single and multi-client delivery, delivery
    status tracking with configurable history size (default 100), LRU-style
    eviction of old entries, and structured logging with component
    "MessageDelivery". All delivery attempts return typed DeliveryResult with
    specific error codes (CLIENT_NOT_FOUND, CLIENT_NOT_CONNECTED, SEND_FAILED).
    Unit tests cover successful delivery, error handling, multi-client
    scenarios, and history eviction.'
schema: v1.0
childrenIds: []
created: 2026-01-30T19:49:11.710Z
updated: 2026-01-30T19:49:11.710Z
---

# Implement Core Message Delivery Service

## Context

This task implements the core message delivery service that routes `RoutedMessage` objects from SmartHole to connected plugin clients. This is the foundation of the message delivery system.

**Related:**

- Feature: `F-message-delivery-to-clients`
- Prerequisite feature: `F-client-registration-registry` (already implemented)
- WebSocket server: `src/services/websocket-server.ts`
- Client registry: `src/services/client-registry.ts`
- Message types: `src/types/messages.ts`

## Requirements

### Service Interface

Create `src/services/message-delivery.ts` following the singleton pattern used by other services:

```typescript
export interface MessageDeliveryService {
  // Send message to a single client by name
  sendToClient(clientName: string, message: RoutedMessage): DeliveryResult;

  // Send message to multiple clients
  sendToClients(clientNames: string[], message: RoutedMessage): Map<string, DeliveryResult>;

  // Get delivery status for a message
  getDeliveryStatus(messageId: MessageId): DeliveryStatus | undefined;

  // Get all recent delivery statuses (for debugging/UI)
  getRecentDeliveries(limit?: number): DeliveryStatus[];

  // Clear delivery history
  clearDeliveryHistory(): void;
}
```

### Delivery Result Type

```typescript
type DeliveryResult =
  | { success: true; deliveredAt: ISOTimestamp }
  | { success: false; error: DeliveryError };

type DeliveryError =
  | "CLIENT_NOT_FOUND" // Client name not in registry
  | "CLIENT_NOT_CONNECTED" // Client registered but WebSocket closed
  | "SEND_FAILED"; // WebSocket send threw an error

interface DeliveryStatus {
  messageId: MessageId;
  clientName: string;
  result: DeliveryResult;
  attemptedAt: ISOTimestamp;
}
```

### Message Format

Messages must be sent in the `WebSocketRoutedMessage` wire format defined in `src/types/messages.ts`:

```typescript
{
  type: "message",
  payload: RoutedMessage  // { id, text, timestamp, metadata }
}
```

### Delivery Tracking

- Track last N deliveries (configurable, default 100) for debugging/audit
- Log all delivery attempts using the logger service with component `"MessageDelivery"`
- Include `messageId`, `clientName`, `success/failure`, and `error` (if any) in logs

## Technical Approach

1. **Create the service file** at `src/services/message-delivery.ts`
2. **Implement singleton pattern** with `initializeMessageDelivery()`, `getMessageDelivery()`, `resetMessageDelivery()`
3. **Get WebSocket connection from client registry** using `registry.getClient(name)` → `client.connection`
4. **Use `ws.send()`** to transmit JSON-serialized `WebSocketRoutedMessage`
5. **Track delivery in internal array** with LRU-style eviction when limit reached
6. **Create child logger** with `{ component: "MessageDelivery" }`

### Error Handling (Fire and Forget)

- Attempt delivery once
- If client not in registry → return `CLIENT_NOT_FOUND`
- If WebSocket connection is not open → return `CLIENT_NOT_CONNECTED`
- If `ws.send()` throws → return `SEND_FAILED`
- Log all failures but don't retry

## Acceptance Criteria

1. [ ] `MessageDeliveryService` interface exported from `src/services/message-delivery.ts`
2. [ ] Single-client delivery works: `sendToClient("notebook", message)` delivers message
3. [ ] Multi-client delivery works: `sendToClients(["notebook", "terminal"], message)` delivers to all
4. [ ] Delivery status tracked per message/client pair
5. [ ] Failures return appropriate error codes without throwing
6. [ ] All delivery attempts logged with structured data
7. [ ] Service follows singleton pattern consistent with other services
8. [ ] Unit tests for:
   - Successful single delivery
   - Successful multi-client delivery
   - Error handling (client not found, not connected)
   - Delivery history tracking/eviction

## Out of Scope

- Client response handling (ack/reject) - separate task
- Rate limiting - explicitly excluded from this feature
- Retry queues - using fire-and-forget approach
- IPC exposure to renderer - separate task
