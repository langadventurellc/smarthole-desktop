---
id: T-create-websocket-message-types
title: Create WebSocket message types
status: done
priority: high
parent: F-core-types-ipc-architecture
prerequisites:
  - T-create-core-common-types-and
affectedFiles:
  src/types/messages.ts: Created WebSocket message type definitions including
    ClientRegistration, RegisteredClient, MessageMetadata, RoutedMessage,
    ClientResponse types, response payload types (RejectPayload,
    NotificationPayload, AckPayload), WebSocketMessage discriminated union, and
    type guards for all message and response types
  src/types/messages.test.ts: Created comprehensive unit tests (61 tests) covering
    all interfaces, type guards, discriminated union behavior, and type-level
    constraints using @ts-expect-error
  src/types/index.ts: Updated barrel export to include messages module
log:
  - >-
    Starting implementation. Verified:

    - common.ts exists with MessageId, ClientId, ISOTimestamp branded types

    - Test patterns established in common.test.ts (using vitest with
    @ts-expect-error for type constraints)

    - MVP requirements reviewed for WebSocket message protocol details

    - index.ts barrel export exists and needs to be updated
  - >-
    Created comprehensive WebSocket message type definitions for the SmartHole
    plugin communication protocol. Implemented all required types including:


    **Client Registration**: `ClientRegistration` and `RegisteredClient`
    interfaces for plugin connection lifecycle.


    **Message Routing**: `InputMethod`, `MessageMetadata`, and `RoutedMessage`
    types for message delivery to clients.


    **Client Responses**: `ClientResponseType`, `ClientNotificationPriority`,
    `RejectPayload`, `NotificationPayload`, `AckPayload`, and `ClientResponse`
    for handling client replies.


    **Type Guards**: `isRejectResponse`, `isNotificationResponse`,
    `isAckResponse` for response type narrowing with runtime validation.


    **Wire Format**: `WebSocketMessage` discriminated union with
    `WebSocketRegistrationMessage`, `WebSocketRoutedMessage`, and
    `WebSocketResponseMessage` variants, plus type guards `isWebSocketMessage`,
    `isRegistrationMessage`, `isRoutedMessage`, and `isResponseMessage`.


    All types use branded types from common.ts (MessageId, ClientId,
    ISOTimestamp) ensuring type safety. 61 unit tests verify runtime behavior
    and type constraints.
schema: v1.0
childrenIds: []
created: 2026-01-29T02:36:08.392Z
updated: 2026-01-29T02:36:08.392Z
---

# Create WebSocket Message Types

## Context

This task defines TypeScript interfaces for the WebSocket protocol used for communication between SmartHole and client plugins. These types are defined directly from the MVP requirements specification.

**Parent Feature**: F-core-types-ipc-architecture
**Related Requirements**: [smarthole-mvp.md](/docs/requirements/smarthole-mvp.md) - Plugin/Client System section
**Depends On**: T-create-core-common-types-and (for MessageId, ClientId, ISOTimestamp)

## Objective

Create comprehensive type definitions for the WebSocket-based plugin communication protocol, including client registration, message routing, and client responses.

## Implementation Details

### File to Create

`src/types/messages.ts` - WebSocket message type definitions

### Types to Implement

Based directly on the requirements document:

```typescript
import { MessageId, ClientId, ISOTimestamp } from "./common";

// ============================================
// Client Registration
// ============================================

/**
 * Sent by client immediately after WebSocket connection.
 * @see smarthole-mvp.md - Client Registration section
 */
export interface ClientRegistration {
  /** Unique identifier for the client (e.g., "notebook", "home-assistant") */
  name: string;

  /** Free-form description for LLM routing decisions */
  description: string;

  /** Optional client version for debugging */
  version?: string;

  /** Optional structured capability hints */
  capabilities?: string[];
}

/**
 * Internal representation of a registered client.
 * Extends registration with server-assigned metadata.
 */
export interface RegisteredClient extends ClientRegistration {
  /** Server-assigned unique ID */
  id: ClientId;

  /** Timestamp when client connected */
  connectedAt: ISOTimestamp;

  /** Connection status */
  status: "connected" | "disconnected";
}

// ============================================
// Message Routing
// ============================================

/** How the message was input by the user */
export type InputMethod = "voice" | "text";

/**
 * Metadata attached to routed messages.
 */
export interface MessageMetadata {
  /** STT confidence score if available */
  confidence?: number;

  /** Routing agent's reason for selecting this client */
  routingReason?: string;

  /** How the user provided input */
  inputMethod: InputMethod;

  /** True if message bypassed routing agent (e.g., "notebook: remember this") */
  directRouted: boolean;
}

/**
 * Message sent from SmartHole to a client plugin.
 * @see smarthole-mvp.md - Message Delivery section
 */
export interface RoutedMessage {
  /** Unique message ID for correlation */
  id: MessageId;

  /** Raw transcribed text (unmodified from user input) */
  text: string;

  /** ISO 8601 timestamp when message was created */
  timestamp: ISOTimestamp;

  /** Additional metadata about the message */
  metadata: MessageMetadata;
}

// ============================================
// Client Responses
// ============================================

/** Response type from client back to SmartHole */
export type ClientResponseType = "ack" | "reject" | "notification";

/** Priority level for client-requested notifications */
export type ClientNotificationPriority = "low" | "normal" | "high";

/**
 * Payload for 'reject' response type.
 */
export interface RejectPayload {
  /** Why the client cannot handle this message */
  reason?: string;
}

/**
 * Payload for 'notification' response type.
 * Client requests SmartHole to show a notification to the user.
 */
export interface NotificationPayload {
  title?: string;
  body?: string;
  priority?: ClientNotificationPriority;
}

/**
 * Response from a client to a routed message.
 * @see smarthole-mvp.md - Client Responses section
 */
export interface ClientResponse {
  /** Correlates to RoutedMessage.id */
  messageId: MessageId;

  /** Type of response */
  type: ClientResponseType;

  /** Response-specific payload */
  payload: RejectPayload | NotificationPayload | Record<string, never>;
}

// ============================================
// Type Guards for Response Types
// ============================================

export function isRejectResponse(
  response: ClientResponse
): response is ClientResponse & { type: "reject"; payload: RejectPayload };

export function isNotificationResponse(
  response: ClientResponse
): response is ClientResponse & { type: "notification"; payload: NotificationPayload };

export function isAckResponse(
  response: ClientResponse
): response is ClientResponse & { type: "ack" };

// ============================================
// WebSocket Protocol Messages (Wire Format)
// ============================================

/**
 * Discriminated union of all WebSocket message types.
 * Used for parsing incoming messages.
 */
export type WebSocketMessage =
  | { type: "registration"; payload: ClientRegistration }
  | { type: "message"; payload: RoutedMessage }
  | { type: "response"; payload: ClientResponse };

export type WebSocketMessageType = WebSocketMessage["type"];
```

### Update Barrel Export

Add to `src/types/index.ts`:

```typescript
export * from "./common";
export * from "./config";
export * from "./ipc";
export * from "./messages";
```

## Technical Approach

1. Create `src/types/messages.ts`
2. Define types directly matching the MVP requirements document
3. Use branded types from common.ts for IDs and timestamps
4. Create discriminated union for wire-format message parsing
5. Add type guards for response type narrowing
6. Update barrel export

## Acceptance Criteria

1. [ ] `src/types/messages.ts` created
2. [ ] `ClientRegistration` interface matches requirements spec exactly
3. [ ] `RegisteredClient` extends registration with server metadata
4. [ ] `RoutedMessage` interface matches requirements spec exactly
5. [ ] `MessageMetadata` includes all fields from requirements
6. [ ] `ClientResponse` interface matches requirements spec exactly
7. [ ] Response payload types defined (RejectPayload, NotificationPayload)
8. [ ] Type guards implemented for response type narrowing
9. [ ] `WebSocketMessage` discriminated union defined for wire format
10. [ ] Barrel export updated to include message types
11. [ ] No `any` types used

## Testing Requirements

Write unit tests in `src/types/messages.test.ts`:

- Test type guards correctly identify response types
- Test that `isRejectResponse` returns true only for reject type
- Test that `isNotificationResponse` returns true only for notification type
- Use `@ts-expect-error` to verify type constraints

## Security Considerations

- Message text is typed as string but may contain sensitive content
- Client names should be validated before use in tool generation (handled by plugin system)
- Type guards should validate runtime data, not just type narrow

## Dependencies

- T-create-core-common-types-and (for MessageId, ClientId, ISOTimestamp branded types)
