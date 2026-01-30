---
id: T-expose-websocket-server
title: Expose WebSocket server status for UI
status: open
priority: medium
parent: F-websocket-server-foundation
prerequisites:
  - T-implement-connection-handling
affectedFiles: {}
log: []
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
