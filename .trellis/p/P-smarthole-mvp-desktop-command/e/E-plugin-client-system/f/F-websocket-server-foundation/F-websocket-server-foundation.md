---
id: F-websocket-server-foundation
title: WebSocket Server Foundation
status: open
priority: high
parent: E-plugin-client-system
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T05:15:28.223Z
updated: 2026-01-30T05:15:28.223Z
---

# WebSocket Server Foundation

## Purpose

Implement the core WebSocket server that plugins connect to, including server lifecycle management, connection handling, and localhost-only security restrictions.

## Requirements

### Server Lifecycle

- Start WebSocket server on `127.0.0.1:9473` (localhost only)
- Server starts automatically when app is ready (inside `app.whenReady()`)
- Server shuts down gracefully when app quits
- Configurable port via settings (default 9473)

### Connection Handling

- Accept incoming WebSocket connections
- Track active connections
- Properly close connections on server shutdown
- Handle connection errors gracefully

### Security

- Bind exclusively to `127.0.0.1` (not `0.0.0.0`)
- Reject connections from non-localhost origins
- Validate origin header on connection upgrade

## Technical Notes

- Use `ws` npm package for WebSocket implementation
- Create `src/services/websocket-server.ts` for server management
- Follow existing service patterns (initialize/get pattern like logger)
- Log server lifecycle events using centralized logger

## Acceptance Criteria

1. [ ] WebSocket server starts on 127.0.0.1:9473 during app startup
2. [ ] Server rejects non-localhost connection attempts
3. [ ] Server port is configurable (default 9473)
4. [ ] Server shuts down cleanly when app quits
5. [ ] Connection events are logged appropriately
6. [ ] Connection errors are handled without crashing
7. [ ] Server supports at least 20 concurrent client connections

## Dependencies

- Logger service (existing)
- Error handling framework (existing)
