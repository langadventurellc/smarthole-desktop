---
id: F-websocket-server-foundation
title: WebSocket Server Foundation
status: in-progress
priority: high
parent: E-plugin-client-system
prerequisites: []
affectedFiles:
  src/services/websocket-server.ts: Created new WebSocket server service with
    singleton pattern, localhost-only binding, connection validation, lifecycle
    management, and error handling
  src/services/websocket-server.test.ts: Added focused unit tests for
    initialization, lifecycle, and localhost validation
  src/main.ts: Integrated WebSocket server initialization in app.whenReady() and
    shutdown in will-quit event
  package.json: Added @types/ws as a dev dependency (ws was already installed)
log:
  - "Started implementation. Created feature branch
    feature/F-websocket-server-foundation. Execution order:
    T-implement-websocket-server → T-implement-connection-handling →
    T-expose-websocket-server"
schema: v1.0
childrenIds:
  - T-expose-websocket-server
  - T-implement-connection-handling
  - T-implement-websocket-server
created: 2026-01-30T06:24:55.210Z
updated: 2026-01-30T06:24:55.210Z
---

# WebSocket Server Foundation

## Purpose

Implement the core WebSocket server that enables plugins to connect to SmartHole. This is the foundational networking layer for the entire plugin client system.

## Requirements

### Server Configuration

- Local WebSocket server bound to 127.0.0.1 (localhost only)
- Default port: 9473
- Configurable port via settings
- Security: reject connections from non-localhost origins

### Server Lifecycle

- Start server on app launch (inside `app.whenReady()`)
- Stop server gracefully on app quit
- Handle server errors (port in use, bind failures)
- Log server state changes

### Connection Handling

- Accept incoming WebSocket connections
- Track active connections
- Handle connection close events
- Implement heartbeat/ping-pong for connection health detection

## Technical Approach

- Use `ws` npm package for WebSocket server
- Integrate with existing logging service
- Expose server status for tray menu display

## Acceptance Criteria

1. [ ] WebSocket server starts on 127.0.0.1:9473
2. [ ] Server rejects non-localhost connection attempts
3. [ ] Server starts automatically with app
4. [ ] Server stops gracefully on app quit
5. [ ] Port conflicts handled with clear error messages
6. [ ] Connection health monitored via ping-pong
7. [ ] Server status exposed for UI layer
