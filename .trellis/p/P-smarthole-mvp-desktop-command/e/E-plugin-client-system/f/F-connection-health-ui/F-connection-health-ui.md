---
id: F-connection-health-ui
title: Connection Health & UI Integration
status: done
priority: medium
parent: E-plugin-client-system
prerequisites:
  - F-client-registration-registry
affectedFiles:
  src/types/ipc.ts: Added 4 client status IPC channels, ClientSummary,
    ClientDetails, ClientGetDetailsPayload, and ClientStatusChangedPayload
    types, plus payload/response map entries
  src/ipc/client-status-handler.ts: Created new IPC handler file with
    createClientCountHandler, createClientListHandler,
    createClientDetailsHandler, broadcastClientStatusChange,
    createRegisteredEventHandler, and createUnregisteredEventHandler functions
  src/ipc/client-status-handler.test.ts: Added comprehensive tests for all handler
    functions and broadcast behavior (14 tests)
  src/ipc/index.ts: Added export for client-status-handler module
  src/main.ts: "Registered client status IPC handlers and subscribed to registry
    events for real-time broadcasts; Refactored tray menu to support dynamic
    updates: added buildTrayMenu() function that builds menu with client status
    from registry, added updateTrayMenu() function to rebuild menu on status
    change, modified createTray() to use buildTrayMenu(), subscribed to registry
    'registered' and 'unregistered' events to trigger menu updates"
  src/preload.ts: Added getClientCount, getClientList, getClientDetails, and
    onClientStatusChange methods to the preload API
  src/types/ipc.test.ts: Updated channel count test and added tests for new client status channels
log:
  - "Started implementation. Created feature branch
    feature/F-connection-health-ui. Execution order:
    T-implement-client-status-ipc → T-integrate-client-connection"
  - Completed T-implement-client-status-ipc. Committed as b290c04.
    Implementation adds client status IPC layer with 4 channels, handler
    functions, preload API extensions, and 14 tests. Review passed with no
    blocking issues.
  - "Auto-completed: All child tasks are complete"
schema: v1.0
childrenIds:
  - T-implement-client-status-ipc
  - T-integrate-client-connection
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
