---
id: F-message-delivery-to-clients
title: Message Delivery to Clients
status: open
priority: high
parent: E-plugin-client-system
prerequisites:
  - F-client-registration-registry
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T05:15:28.357Z
updated: 2026-01-30T05:15:28.357Z
---

# Message Delivery to Clients

## Purpose

Implement the message delivery system that sends routed messages to connected plugin clients, supporting single and multi-client delivery with delivery status tracking.

## Requirements

### Message Delivery

- Deliver RoutedMessage to specified client(s) by name
- Message format:
  ```json
  {
    "type": "message",
    "id": "uuid",
    "text": "user input text",
    "timestamp": "ISO timestamp",
    "metadata": {
      "confidence": 0.95,
      "routingReason": "User mentioned email keywords",
      "inputMethod": "keyboard",
      "directRouted": false
    }
  }
  ```

### Multi-Client Routing

- Support delivering same message to multiple clients
- Each client receives its own copy of the message
- Track delivery status per client

### Delivery Status Tracking

- Track which messages have been sent to which clients
- Track delivery success/failure per client
- Provide delivery status lookup by message ID

### Failure Handling

- Handle delivery failures (client disconnected mid-delivery)
- Log delivery failures with relevant context
- Return delivery status indicating which clients received the message

## Technical Notes

- Create `src/services/message-delivery.ts` for delivery logic
- Integrate with client registry for client lookup
- Message IDs should be UUIDs for uniqueness
- Consider async delivery with Promise.allSettled for multi-client

## Acceptance Criteria

1. [ ] Messages can be delivered to a client by name
2. [ ] Messages are delivered in the correct JSON format
3. [ ] Multi-client routing delivers to all specified clients
4. [ ] Delivery status tracks success/failure per client
5. [ ] Delivery failures are logged appropriately
6. [ ] Disconnected clients during delivery are handled gracefully
7. [ ] Delivery function returns status indicating results
8. [ ] Message delivery latency is under 50ms from delivery call to WebSocket send

## Dependencies

- F-client-registration-registry (client registry must exist)
