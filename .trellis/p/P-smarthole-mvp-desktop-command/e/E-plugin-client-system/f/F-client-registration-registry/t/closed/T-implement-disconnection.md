---
id: T-implement-disconnection
title: Implement Disconnection Handling & Registry Events
status: done
priority: high
parent: F-client-registration-registry
prerequisites:
  - T-implement-registration
affectedFiles:
  src/main.ts: "Added getClientRegistry import. Modified WebSocket 'disconnection'
    event handler to: (1) calculate connection duration, (2) call
    registry.unregisterById() to clean up registered clients, (3) log
    disconnection with client details including duration, code, and reason.
    Different log levels for registered vs unregistered clients."
log:
  - >-
    Research completed. Key findings:


    1. **ClientRegistry already has event emission**
    (`src/services/client-registry.ts`):
       - `registered` event emitted in `register()` method (line 243)
       - `unregistered` event emitted in `removeClient()` method (line 371)
       - `unregisterById(clientId, reason)` method exists for removing clients by connection ID

    2. **Event types already defined** (`src/types/client-registry.ts`):
       - `ClientRegisteredEvent` interface with client info
       - `ClientUnregisteredEvent` interface with client info and reason ('disconnect' | 'unregister' | 'error')
       - `ClientRegistryEvents` interface with registered/unregistered event signatures

    3. **WebSocket server** (`src/services/websocket-server.ts`):
       - Already emits `disconnection` event with ConnectionInfo, code, and reason (line 573)
       - ConnectionInfo includes `connectedAt: Date` which can be used for duration calculation

    4. **Main process wiring** (`src/main.ts`):
       - WebSocket server `disconnection` event is already subscribed to for status change broadcast (line 164-166)
       - However, it does NOT call registry.unregisterById() - this is the missing piece

    5. **Gap Analysis**:
       - Need to wire up WebSocket `disconnection` event to call `registry.unregisterById()`
       - Need to log connection duration on disconnect
       - Edge case: unregistered client disconnect - `unregisterById()` already returns false gracefully

    Implementation plan:

    1. Modify `src/main.ts` to call registry.unregisterById() on WebSocket
    disconnection

    2. Add logging with connection duration calculation

    3. Verify edge case handling (already handled by existing code)
  - >-
    Implemented disconnection handling by wiring up the WebSocket server's
    'disconnection' event to the client registry cleanup in the main process.


    Key implementation:

    1. Modified the WebSocket 'disconnection' event handler in main.ts to call
    `registry.unregisterById()` with reason 'disconnect'

    2. Added connection duration calculation (in seconds) based on the
    ConnectionInfo.connectedAt timestamp

    3. Added differentiated logging: info-level for registered clients,
    debug-level for unregistered connections

    4. Edge case handling: gracefully handles the case where an unregistered
    client disconnects (registry.unregisterById returns false)


    The existing ClientRegistry already emits 'registered' and 'unregistered'
    events (from T-implement-typescript-types), so downstream consumers can
    subscribe to these events for rebuilding tool definitions when clients
    connect/disconnect.
schema: v1.0
childrenIds: []
created: 2026-01-30T19:15:44.462Z
updated: 2026-01-30T19:15:44.462Z
---

# Implement Disconnection Handling & Registry Events

## Purpose

Detect client disconnections, clean up the client registry, and emit events that downstream systems (like the routing agent) can subscribe to for rebuilding tool definitions.

## Requirements

### Disconnection Detection

- Hook into WebSocket close events from existing server
- Handle both clean disconnects and network failures
- Associate disconnecting WebSocket with registered client name

### Registry Cleanup

- Remove disconnected client from registry
- Log disconnection events with client details (name, connection duration, reason)
- Handle edge case: unregistered client disconnects (no cleanup needed)

### Event Emission

- Emit `client:registered` event when client successfully registers (includes client info)
- Emit `client:unregistered` event when client disconnects (includes client info, reason)
- Events should be typed and include enough context for consumers
- Document event contracts for downstream consumers (routing agent)

## Files to Create/Modify

- `src/services/client-registry.ts` - Add event emission
- `src/services/websocket-server.ts` - Hook disconnection to registry cleanup
- `src/types/client-registry.ts` - Add event type definitions

## Dependencies

- T-implement-registration (registration must work first)

## Acceptance Criteria

- [ ] Disconnected clients removed from registry automatically
- [ ] Events emitted on register/unregister
- [ ] Log entries created for disconnection with client details
- [ ] Edge cases handled (unregistered client disconnect)
