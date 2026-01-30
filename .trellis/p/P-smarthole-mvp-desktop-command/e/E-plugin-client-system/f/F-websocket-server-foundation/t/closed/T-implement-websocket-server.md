---
id: T-implement-websocket-server
title: Implement WebSocket server core with lifecycle management
status: done
priority: high
parent: F-websocket-server-foundation
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
  - Starting implementation. Analyzed existing service patterns in logger.ts,
    notifications.ts, and notification-queue.ts. Will follow singleton pattern
    with initializeWebSocketServer/getWebSocketServer/shutdownWebSocketServer
    API.
  - Implemented WebSocket server core with lifecycle management. Created the
    `websocket-server.ts` service following existing patterns (singleton with
    init/get/shutdown API). The server binds to 127.0.0.1:9473 by default,
    rejects non-localhost connections via verifyClient callback, handles startup
    errors (EADDRINUSE, EACCES, etc.) with clear logging, and integrates with
    the app lifecycle (starts in app.whenReady(), stops in will-quit). Added 12
    focused unit tests covering initialization, lifecycle, and error handling.
schema: v1.0
childrenIds: []
created: 2026-01-30T06:30:53.307Z
updated: 2026-01-30T06:30:53.307Z
---

# WebSocket Server Core with Lifecycle Management

## Purpose

Set up the core WebSocket server infrastructure including initialization, configuration, and proper lifecycle management within the Electron app.

## Requirements

### Server Setup

- Install `ws` npm package
- Create WebSocket server service at `src/services/websocket-server.ts`
- Bind to `127.0.0.1` only (localhost security)
- Default port: 9473
- Reject connections from non-localhost origins

### Configuration

- Port configurable via settings (future-proofing, can use hardcoded default initially)
- Server options (e.g., max connections) configurable

### Lifecycle Management

- Initialize server inside `app.whenReady()` (after logger initialization)
- Stop server gracefully on app quit (`app.on('will-quit')` or `app.on('before-quit')`)
- Handle server errors:
  - Port already in use (EADDRINUSE)
  - Bind failures
  - Other startup errors
- Log all server state changes using existing logger service

### API Design

- `initializeWebSocketServer(options?)` - Initialize and start the server
- `getWebSocketServer()` - Get server instance (after initialization)
- `shutdownWebSocketServer()` - Graceful shutdown

## Technical Notes

- Follow existing service patterns (see `logger.ts`, `notifications.ts`)
- Use singleton pattern with lazy initialization guard
- Integrate with existing logging infrastructure

## Acceptance Criteria

- [ ] `ws` package installed
- [ ] WebSocket server binds to 127.0.0.1:9473
- [ ] Non-localhost connections rejected
- [ ] Server starts automatically with app (inside `app.whenReady()`)
- [ ] Server stops gracefully on app quit
- [ ] Port conflict errors handled with clear log messages
- [ ] All state changes logged appropriately
