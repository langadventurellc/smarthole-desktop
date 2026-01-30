---
id: T-expose-websocket-server
title: Expose WebSocket server status for UI
status: done
priority: medium
parent: F-websocket-server-foundation
prerequisites:
  - T-implement-connection-handling
affectedFiles:
  src/types/ipc.ts: Added WEBSOCKET_STATUS_GET and WEBSOCKET_STATUS_CHANGED IPC
    channels, WebSocketServerState type, WebSocketServerStatus interface,
    isWebSocketServerState and isWebSocketServerStatus type guards, and updated
    IpcPayloadMap/IpcResponseMap
  src/ipc/websocket-status-handler.ts: Created new IPC handler with
    buildWebSocketStatus helper function, createWebSocketStatusHandler factory
    function, and broadcastWebSocketStatusChange for pushing status updates to
    renderer windows
  src/ipc/websocket-status-handler.test.ts: Added 9 unit tests covering
    buildWebSocketStatus state mapping and createWebSocketStatusHandler behavior
  src/preload.ts: Added getWebSocketStatus() and onWebSocketStatusChange(callback)
    methods to the electronAPI
  src/main.ts: Added WebSocket state tracking with wsState object, status change
    broadcasting on connection events, and registered WebSocket status IPC
    handler with ipcMain.handle()
  src/types/ipc.test.ts: Updated tests to include new WebSocket channels,
    increased channel count from 7 to 9, and updated naming convention regex to
    allow domain:action:sub pattern
log:
  - >-
    Research phase completed. Analyzed:

    - Existing IPC handlers (log-handler.ts, notification-handler.ts) - use
    factory pattern with logger injection

    - preload.ts patterns - uses ipcRenderer.invoke for request/response,
    ipcRenderer.on for event subscriptions  

    - websocket-server.ts - has getState(), getPort(), getConnectionCount()
    methods already implemented

    - types/ipc.ts - IPC_CHANNELS const, payload types, type guards


    Key findings:

    1. IPC handlers use createXxxHandler factory functions

    2. Preload uses sections (Logging, Notifications, Configuration, App
    Lifecycle)

    3. For status subscription, use pattern from onConfigChanged:
    ipcRenderer.on() with removeListener unsubscribe

    4. Need to add: WEBSOCKET_STATUS channel, WebSocketServerStatus type, type
    guard, IPC handler
  - Implemented WebSocket server status exposure for the UI layer. Created IPC
    handler for status queries with support for both request/response
    (getWebSocketStatus) and status change events (onWebSocketStatusChange). The
    implementation follows existing IPC patterns with proper type definitions,
    type guards, and comprehensive testing.
schema: v1.0
childrenIds: []
created: 2026-01-30T06:30:53.522Z
updated: 2026-01-30T06:30:53.522Z
---

# Expose WebSocket Server Status for UI

## Purpose

Make WebSocket server status information available to the UI layer (tray menu and any future windows) so users can see server health and connection state.

## Requirements

### Status Information

- Server running state (running/stopped/error)
- Current port number
- Number of active connections
- Last error message (if any)

### IPC Integration

- Create IPC handler for server status queries
- Expose via preload script (`electronAPI`)
- Support both request/response and status change events

### API Design

Renderer-side API:

```typescript
window.electronAPI.getWebSocketStatus(); // Returns current status
window.electronAPI.onWebSocketStatusChange(callback); // Subscribe to changes
```

### Status Object Shape

```typescript
interface WebSocketServerStatus {
  state: "running" | "stopped" | "error";
  port: number;
  activeConnections: number;
  error?: string;
}
```

## Technical Notes

- Follow existing IPC patterns (see `log-handler.ts`, `notification-handler.ts`)
- Create `src/ipc/websocket-status-handler.ts`
- Update `preload.ts` with new API methods
- Consider using IPC event emitter for status changes

## Dependencies

- Requires T-websocket-connection-handling to be completed first (needs connection count)

## Acceptance Criteria

- [ ] Server status queryable from renderer via IPC
- [ ] Status includes: state, port, connection count
- [ ] Status change events available for UI subscription
- [ ] Preload script exposes status API
- [ ] IPC handler follows existing patterns
