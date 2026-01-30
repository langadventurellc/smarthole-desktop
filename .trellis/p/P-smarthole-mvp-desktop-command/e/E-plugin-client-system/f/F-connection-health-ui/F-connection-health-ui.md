---
id: F-connection-health-ui
title: Connection Health & UI Integration
status: open
priority: medium
parent: E-plugin-client-system
prerequisites:
  - F-client-registration-registry
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T06:24:55.457Z
updated: 2026-01-30T06:24:55.457Z
---

# Connection Health & UI Integration

## Purpose

Expose plugin connection status to the UI layer and implement connection health monitoring for the tray menu display.

## Requirements

### Connection Status API

- Get count of connected clients
- Get list of connected client names and descriptions
- Get detailed client info (registration time, capabilities)
- Real-time status updates via IPC

### IPC Integration

- Expose connection status via preload API
- IPC handlers for:
  - `clients:getCount` - Returns number of connected clients
  - `clients:getList` - Returns array of client summaries
  - `clients:getDetails` - Returns detailed info for specific client

### Tray Menu Integration

- Show connection status in tray menu (e.g., "2 clients connected")
- Update tray menu when clients connect/disconnect
- Optional: submenu showing connected client names

### Health Monitoring

- Client disconnection detected within 5 seconds
- Ping-pong heartbeat for connection validation
- Configurable heartbeat interval
- Dead connection cleanup

## Technical Approach

- IPC handlers in main process
- Preload API extensions
- Integration with tray service
- EventEmitter subscription for real-time updates

## Dependencies

- Client Registration & Registry (F-client-registration-registry)

## Acceptance Criteria

1. [ ] Client connection status exposed via IPC
2. [ ] Renderer can query client count and list
3. [ ] Tray menu shows connection status
4. [ ] Tray updates in real-time on connect/disconnect
5. [ ] Client disconnection detected within 5 seconds
6. [ ] Dead connections cleaned up automatically
