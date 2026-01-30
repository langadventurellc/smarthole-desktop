---
id: T-implement-disconnection
title: Implement Disconnection Handling & Registry Events
status: open
priority: high
parent: F-client-registration-registry
prerequisites:
  - T-implement-registration
affectedFiles: {}
log: []
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
