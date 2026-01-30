---
id: F-client-response-handling
title: Client Response Handling
status: open
priority: high
parent: E-plugin-client-system
prerequisites:
  - F-message-delivery-to-clients
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T05:15:28.415Z
updated: 2026-01-30T05:15:28.415Z
---

# Client Response Handling

## Purpose

Implement the system for parsing and handling client responses to delivered messages, including acknowledgments, rejections, and notification requests.

## Requirements

### Response Types

#### Acknowledgment (`ack`)

- Client confirms message was accepted and will be processed
- Format: `{ "type": "ack", "messageId": "uuid" }`
- Action: Log success

#### Rejection (`reject`)

- Client rejects the message with a reason
- Format: `{ "type": "reject", "messageId": "uuid", "reason": "Not my domain" }`
- Action: Emit event for re-routing flow (to be handled by routing system)

#### Notification (`notification`)

- Client requests a system notification be displayed
- Format:
  ```json
  {
    "type": "notification",
    "title": "Task Complete",
    "body": "Email sent successfully",
    "priority": "medium"
  }
  ```
- Action: Display notification via notification service
- Priority maps to notification priority: "low" | "medium" | "high"

### Response Timeout

- Configure timeout for expected responses
- Default timeout: 30 seconds
- Emit timeout event if client doesn't respond in time
- Log timeout occurrences

### Response Validation

- Validate response format matches expected schema
- Log malformed responses
- Handle unknown response types gracefully

## Technical Notes

- Create `src/services/response-handler.ts` for response processing
- Integrate with existing notification service for `notification` responses
- Use EventEmitter pattern for rejection events (routing agent subscribes)
- Store pending message expectations with timeout timers

## Acceptance Criteria

1. [ ] `ack` responses are parsed and logged
2. [ ] `reject` responses are parsed and emit re-routing event
3. [ ] `notification` responses trigger system notifications
4. [ ] Notification priority is respected
5. [ ] Response timeout is configurable (default 30s)
6. [ ] Timeout events are emitted when clients don't respond
7. [ ] Malformed responses are logged but don't crash
8. [ ] Unknown response types are handled gracefully

## Dependencies

- F-message-delivery-to-clients (message delivery must exist)
- Notification service (existing)
