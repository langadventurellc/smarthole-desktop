---
id: E-plugin-client-system
title: Plugin Client System
status: in-progress
priority: high
parent: P-smarthole-mvp-desktop-command
prerequisites:
  - E-foundation-core-infrastructure
affectedFiles:
  src/services/websocket-server.ts: Created new WebSocket server service with
    singleton pattern, localhost-only binding, connection validation, lifecycle
    management, and error handling
  src/services/websocket-server.test.ts: Added focused unit tests for
    initialization, lifecycle, and localhost validation
  src/main.ts: Integrated WebSocket server initialization in app.whenReady() and
    shutdown in will-quit event
  package.json: Added @types/ws as a dev dependency (ws was already installed)
log: []
schema: v1.0
childrenIds:
  - F-client-registration-registry
  - F-client-response-handling
  - F-connection-health-ui
  - F-message-delivery-to-clients
  - F-websocket-server-foundation
created: 2026-01-29T01:45:03.912Z
updated: 2026-01-29T01:45:03.912Z
---

# Plugin Client System

## Purpose and Goals

Implement the WebSocket server and client management system that allows plugins to connect to SmartHole, register themselves, receive routed messages, and send responses. This epic establishes the communication protocol between SmartHole and external plugin applications.

## Major Components and Deliverables

### 1. WebSocket Server

- Local WebSocket server bound to 127.0.0.1:9473 (localhost only)
- Server lifecycle management (start on app launch, stop on quit)
- Connection handling (accept, track, close)
- Configurable port (default 9473)
- Security: reject connections from non-localhost origins

### 2. Client Registration Protocol

- Handle registration messages from connecting clients
- Required fields: `name` (unique identifier), `description` (routing hint for LLM)
- Optional fields: `version`, `capabilities` array
- Validate client name uniqueness (reject duplicates or handle collisions)
- Send registration confirmation/rejection response

### 3. Client Registry

- In-memory registry of connected clients
- Track: client name, description, WebSocket connection, registration time, capabilities
- Client lookup by name
- List all registered clients (for routing agent tool generation)
- Event emission on client connect/disconnect
- **Expose connection status to UI layer** (for tray menu display)

### 4. Message Delivery

- Deliver RoutedMessage to specified client(s)
- Message format: `{ id, text, timestamp, metadata: { confidence, routingReason, inputMethod, directRouted } }`
- Handle multi-client routing (same message to multiple clients)
- Track message delivery status
- Handle delivery failures (client disconnected mid-delivery)

### 5. Client Response Handling

- Parse client responses: `ack`, `reject`, `notification`
- `ack`: Message accepted, log success
- `reject`: Message rejected with reason, trigger re-routing flow
- `notification`: Display system notification (title, body, priority)
- Response timeout handling

### 6. Disconnection Detection

- Detect client disconnections (WebSocket close, network failure)
- Clean up client from registry
- Log disconnection events
- Emit events for routing agent to rebuild tool definitions

### 7. Message Rate Limiting

- Optional rate limiting for message throughput
- Configurable messages-per-second threshold
- Queue or reject excess messages with user notification
- Prevent overwhelming connected clients

## Technical Considerations

- Use `ws` npm package for WebSocket server
- Message format: JSON over WebSocket
- Consider heartbeat/ping-pong for connection health
- Thread-safe client registry (though Node.js is single-threaded, async operations need care)
- Rate limiting: token bucket or sliding window algorithm

## Dependencies

- **E-foundation-core-infrastructure**: Logging, error handling, types, notifications

## Estimated Scale

4-5 features covering WebSocket server, registration, registry, message delivery, and response handling

## User Stories

- As a plugin developer, I can connect my application to SmartHole via WebSocket
- As a plugin developer, I register my plugin with a name and description
- As a plugin, I receive routed messages with full context (text, metadata)
- As a plugin, I can acknowledge messages, reject them with a reason, or send notifications
- As SmartHole, I detect when plugins disconnect and update the routing options
- As a user, I can see how many plugins are connected via the tray menu

## Non-Functional Requirements

- WebSocket server must only accept localhost connections (security)
- Connection handling must support at least 20 concurrent clients
- Message delivery latency < 50ms from routing decision to client receipt
- Client disconnection detected within 5 seconds

## Acceptance Criteria

1. [ ] WebSocket server starts on 127.0.0.1:9473
2. [ ] Server rejects non-localhost connection attempts
3. [ ] Clients can connect and send registration messages
4. [ ] Registration validates required fields (name, description)
5. [ ] Duplicate client names are handled (reject or rename)
6. [ ] Client registry tracks all connected clients
7. [ ] Messages delivered to clients in correct format
8. [ ] Multi-client routing delivers to all specified clients
9. [ ] Client `ack` responses logged appropriately
10. [ ] Client `reject` responses trigger re-routing flow
11. [ ] Client `notification` responses displayed as system notifications
12. [ ] Disconnected clients removed from registry
13. [ ] Events emitted on connect/disconnect for routing agent
14. [ ] Client connection status exposed to UI layer (client count and names available via IPC)
15. [ ] Tray menu shows connection status (e.g., "2 clients connected")
