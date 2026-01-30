---
id: F-connection-health-ui
title: Connection Health & UI Integration
status: open
priority: medium
parent: E-plugin-client-system
prerequisites:
  - F-client-registration-registry
  - F-client-response-handling
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T05:15:28.477Z
updated: 2026-01-30T05:15:28.477Z
---

# Connection Health & UI Integration

## Purpose

Implement connection health monitoring (disconnection detection, heartbeat), message rate limiting, and expose client connection status to the UI layer for tray menu display.

## Requirements

### Disconnection Detection

- Detect client disconnections (WebSocket close event, network failure)
- Clean up client from registry on disconnect
- Log disconnection events with client info
- Emit events for routing agent to rebuild tool definitions
- Detection within 5 seconds of actual disconnection

### Heartbeat/Ping-Pong

- Implement ping-pong for connection health monitoring
- Configurable ping interval (default 15 seconds)
- Consider client as disconnected if pong not received within timeout
- Use WebSocket protocol-level ping/pong when available

### Message Rate Limiting

- Optional rate limiting for message throughput per client
- Configurable messages-per-second threshold (default: 10/second)
- Queue or reject excess messages based on configuration
- Notify user if messages are being rate limited
- Use token bucket or sliding window algorithm

### UI Integration

- Expose connection status to UI layer via IPC
- Provide: total connected client count, list of client names
- IPC channel: `clients:status` for status queries
- IPC channel: `clients:status-changed` for status updates (push)
- Enable tray menu to show "X clients connected"

## Technical Notes

- Extend `src/services/websocket-server.ts` for heartbeat
- Extend `src/services/client-registry.ts` for rate limiting
- Create `src/ipc/client-status-handler.ts` for IPC
- Update preload.ts to expose client status methods

## Acceptance Criteria

1. [ ] Disconnected clients are detected within 5 seconds
2. [ ] Disconnected clients are removed from registry
3. [ ] Disconnection events are logged with client info
4. [ ] Events emitted on disconnect for routing agent
5. [ ] Heartbeat ping-pong keeps connections healthy
6. [ ] Rate limiting prevents message flooding (configurable)
7. [ ] Rate limited messages are queued or rejected per config
8. [ ] User notified when rate limiting is active
9. [ ] Client count available via IPC
10. [ ] Client names list available via IPC
11. [ ] UI receives push updates when client status changes
12. [ ] Tray menu can display "X clients connected"

## Dependencies

- F-client-registration-registry (registry must exist)
- F-client-response-handling (for full message flow)
- Notification service (existing)
