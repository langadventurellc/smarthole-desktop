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
    management, and error handling; Added connection tracking with Map<ClientId,
    ConnectionInfo>, heartbeat monitoring with configurable interval/timeout,
    event emitters for connection/disconnection/error events, TrackedWebSocket
    interface for isAlive flag pattern, getActiveConnections() and
    getConnection() APIs, startHeartbeat/stopHeartbeat/performHeartbeat private
    methods; Added 'message' event to WebSocketServerEvents, updated
    'connection' event signature, added message handler in handleConnection
    method.
  src/services/websocket-server.test.ts: Added focused unit tests for
    initialization, lifecycle, and localhost validation; Added 9 new tests for
    connection tracking (track connections, remove on disconnect, emit events,
    get by ID) and heartbeat monitoring (lastActivity updates, event
    unsubscription)
  src/main.ts: "Integrated WebSocket server initialization in app.whenReady() and
    shutdown in will-quit event; Added WebSocket state tracking with wsState
    object, status change broadcasting on connection events, and registered
    WebSocket status IPC handler with ipcMain.handle(); Added client registry
    and registration handler initialization, wired up message event to
    registration handler.; Added getClientRegistry import. Modified WebSocket
    'disconnection' event handler to: (1) calculate connection duration, (2)
    call registry.unregisterById() to clean up registered clients, (3) log
    disconnection with client details including duration, code, and reason.
    Different log levels for registered vs unregistered clients.; Integrated
    message delivery service: added import, added messageDelivery to wsState,
    initialized service after registration handler, wired up response handling
    in WebSocket message event handler; Registered message delivery IPC handlers
    using registerMessageDeliveryHandlers inside app.whenReady()."
  package.json: Added @types/ws as a dev dependency (ws was already installed)
  src/types/ipc.ts: Added WEBSOCKET_STATUS_GET and WEBSOCKET_STATUS_CHANGED IPC
    channels, WebSocketServerState type, WebSocketServerStatus interface,
    isWebSocketServerState and isWebSocketServerStatus type guards, and updated
    IpcPayloadMap/IpcResponseMap; Added 4 new IPC channels (MESSAGE_SEND,
    MESSAGE_SEND_MULTIPLE, MESSAGE_GET_STATUS, MESSAGE_GET_RECENT),
    IpcDeliveryResult, IpcDeliveryStatus, IpcRoutedMessage types for IPC
    serialization, and payload/response types for all new channels. Updated
    IpcPayloadMap and IpcResponseMap.
  src/ipc/websocket-status-handler.ts: Created new IPC handler with
    buildWebSocketStatus helper function, createWebSocketStatusHandler factory
    function, and broadcastWebSocketStatusChange for pushing status updates to
    renderer windows
  src/ipc/websocket-status-handler.test.ts: Added 9 unit tests covering
    buildWebSocketStatus state mapping and createWebSocketStatusHandler behavior
  src/preload.ts: "Added getWebSocketStatus() and
    onWebSocketStatusChange(callback) methods to the electronAPI; Added 4 new
    methods to electronAPI: sendMessage, sendMessageMultiple, getMessageStatus,
    getRecentDeliveries with full TypeScript types."
  src/types/ipc.test.ts: Updated tests to include new WebSocket channels,
    increased channel count from 7 to 9, and updated naming convention regex to
    allow domain:action:sub pattern; Updated test for channel count (9 to 13),
    updated naming convention regex to allow camelCase actions, added test for
    new message delivery channels.
  src/types/client-registry.ts: Created new type definitions file with
    RegistryClient, RegistryClientInfo, RegistrationSuccess,
    RegistrationFailure, RegistrationResponse, RegistrationErrorCode,
    ClientRegisteredEvent, ClientUnregisteredEvent, ClientRegistryEvents,
    WebSocketRegistrationResponse, and validation helpers
  src/types/index.ts: Added export for client-registry types
  src/services/client-registry.ts: Created ClientRegistry service with
    EventEmitter pattern, Map-based storage, register/unregister operations,
    lookup methods, and singleton management (initializeClientRegistry,
    getClientRegistry, resetClientRegistry)
  src/services/index.ts: Added export for client-registry service; Added export
    for registration-handler module.
  src/services/client-registry.test.ts: Added 14 unit tests covering
    initialization, registration, unregistration, lookup operations, and clear
    functionality
  src/services/registration-handler.ts: Created new registration handler service
    with message parsing, validation, and response sending. Includes singleton
    pattern with initialize/get/reset functions.
  src/services/registration-handler.test.ts: Added 13 unit tests covering
    initialization, message parsing, validation, and registration flow.
  src/services/message-delivery.ts: "Created new message delivery service with
    singleton pattern, DeliveryResult/DeliveryError/DeliveryStatus types,
    sendToClient/sendToClients methods, delivery history tracking with LRU
    eviction, and structured logging; Extended with response handling: added
    DeliveryResponse interface, ResponseContext, ResponseProcessResult types,
    MessageDeliveryEvents interface for typed events, handleResponse() and
    on/off() methods to MessageDeliveryService interface, processResponse() and
    findDeliveryStatusForUpdate() private methods, EventEmitter for events,
    parseMessage() helper function"
  src/services/message-delivery.test.ts: "Added comprehensive unit tests covering
    initialization, single/multi-client delivery, error handling for all failure
    modes, delivery history tracking, and history eviction behavior; Added
    handleResponse test suite with 10 tests covering: ack/reject/notification
    response processing, delivery status updates, event emission for all
    response types, handling unknown messageIds, invalid JSON, non-response
    messages, and invalid message formats"
  src/ipc/message-delivery-handlers.ts: Created new file with handler factory
    functions (createMessageSendHandler, createMessageSendMultipleHandler,
    createMessageGetStatusHandler, createMessageGetRecentHandler) and
    registerMessageDeliveryHandlers convenience function. Includes type
    conversion helpers for branded types and Map serialization.
  src/ipc/message-delivery-handlers.test.ts: Created new test file with 11 unit
    tests covering all handlers, error handling when service not initialized,
    Map-to-array serialization, and proper type conversion.
  docs/message-delivery.md: Created new documentation file covering message
    delivery initialization, sending messages, delivery results, response
    handling with event subscriptions, delivery status tracking, IPC interface
    with all 4 channels, renderer usage examples, configuration options, wire
    format, and singleton pattern
  CLAUDE.md: Updated project structure to include message-delivery in services
    list, added link to new message-delivery.md documentation in Detailed
    Documentation section
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
