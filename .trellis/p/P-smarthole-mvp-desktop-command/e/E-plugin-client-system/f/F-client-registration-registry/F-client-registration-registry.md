---
id: F-client-registration-registry
title: Client Registration & Registry
status: open
priority: high
parent: E-plugin-client-system
prerequisites:
  - F-websocket-server-foundation
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T06:24:55.280Z
updated: 2026-01-30T06:24:55.280Z
---

# Client Registration & Registry

## Purpose

Implement the registration protocol and in-memory registry that allows plugins to identify themselves and be tracked by SmartHole.

## Requirements

### Registration Protocol

- Handle registration messages from connecting clients
- Required fields: `name` (unique identifier), `description` (routing hint for LLM)
- Optional fields: `version`, `capabilities` array
- Send registration confirmation response on success
- Send rejection response with reason on failure

### Registration Validation

- Validate required fields are present and non-empty
- Validate client name uniqueness
- Handle duplicate names (reject with clear error message)
- Validate field formats/lengths

### Client Registry

- In-memory registry of connected clients
- Track per client: name, description, WebSocket connection, registration time, capabilities, version
- Client lookup by name
- List all registered clients
- Event emission on client register/unregister

### Disconnection Handling

- Detect client disconnections (WebSocket close, network failure)
- Clean up client from registry on disconnect
- Log disconnection events with client details
- Emit events for routing agent to rebuild tool definitions

## Technical Approach

- TypeScript types for registration messages and client records
- EventEmitter pattern for registry events
- Thread-safe registry operations (async-aware)

## Dependencies

- WebSocket Server Foundation (F-websocket-server-foundation)

## Acceptance Criteria

1. [ ] Clients can send registration messages after connecting
2. [ ] Registration validates required fields (name, description)
3. [ ] Duplicate client names are rejected with clear error
4. [ ] Registration confirmation sent on success
5. [ ] Client registry tracks all registered clients
6. [ ] Client lookup by name works correctly
7. [ ] List all clients returns complete registry
8. [ ] Disconnected clients removed from registry
9. [ ] Events emitted on register/unregister
