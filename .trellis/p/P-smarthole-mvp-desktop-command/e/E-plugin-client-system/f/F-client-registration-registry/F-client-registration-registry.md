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
created: 2026-01-30T05:15:28.295Z
updated: 2026-01-30T05:15:28.295Z
---

# Client Registration & Registry

## Purpose

Implement the client registration protocol and in-memory registry that tracks connected plugins, their metadata, and provides lookup capabilities for the routing system.

## Requirements

### Registration Protocol

- Handle registration messages from connecting clients
- Required fields: `name` (unique identifier), `description` (routing hint for LLM)
- Optional fields: `version`, `capabilities` array
- Send registration confirmation response on success
- Send registration rejection response on failure (with reason)

### Name Validation

- Validate client name uniqueness
- Reject duplicate names with clear error message
- Names must be non-empty strings

### Client Registry

- In-memory registry of connected clients
- Track per client:
  - `name`: unique identifier
  - `description`: routing hint for LLM
  - `version`: optional version string
  - `capabilities`: optional array of capability strings
  - `connection`: WebSocket connection reference
  - `registrationTime`: timestamp of registration
- Client lookup by name
- List all registered clients (for routing agent tool generation)

### Event Emission

- Emit events on client connect (after successful registration)
- Emit events on client disconnect
- Events should include client name and metadata for subscribers

## Technical Notes

- Create `src/services/client-registry.ts` for registry management
- Create types in `src/types/plugin-client.ts`
- Use EventEmitter or similar pattern for events
- Registration message format:
  ```json
  {
    "type": "register",
    "name": "my-plugin",
    "description": "Handles email tasks",
    "version": "1.0.0",
    "capabilities": ["email", "calendar"]
  }
  ```
- Response format:
  ```json
  {
    "type": "register-response",
    "success": true,
    "message": "Registration successful"
  }
  ```

## Acceptance Criteria

1. [ ] Clients can send registration messages after connecting
2. [ ] Registration validates required fields (name, description)
3. [ ] Registration rejects empty or invalid names
4. [ ] Duplicate client names are rejected with clear error
5. [ ] Successful registration sends confirmation response
6. [ ] Failed registration sends rejection response with reason
7. [ ] Client registry tracks all registered clients with metadata
8. [ ] Clients can be looked up by name
9. [ ] All registered clients can be listed
10. [ ] Events emitted on client connect/disconnect

## Dependencies

- F-websocket-server-foundation (WebSocket server must exist)
