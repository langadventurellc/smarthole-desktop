---
id: T-integrate-client-connection
title: Integrate Client Connection Status into Tray Menu
status: open
priority: medium
parent: F-connection-health-ui
prerequisites:
  - T-implement-client-status-ipc
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T21:11:52.865Z
updated: 2026-01-30T21:11:52.865Z
---

# Integrate Client Connection Status into Tray Menu

## Context

The F-connection-health-ui feature requires showing plugin connection status in the system tray menu. This task updates the tray menu to display the number of connected clients and optionally show a submenu listing connected client names.

This task depends on T-implement-client-status-ipc which provides the IPC layer to access client status from the registry.

## Implementation Requirements

### 1. Refactor Tray Menu to Support Dynamic Updates

Currently in `src/main.ts`, the tray menu is created once in `createTray()`. Refactor to:

- Extract tray menu building to a separate function `buildTrayMenu()`
- Store reference to tray instance for menu updates
- Create `updateTrayMenu()` function that rebuilds and sets the context menu

### 2. Add Connection Status to Menu

Update the tray menu template to include:

```typescript
{
  label: `${clientCount} client${clientCount !== 1 ? 's' : ''} connected`,
  enabled: false,  // Display-only label
},
// Optional: submenu with client names when clients are connected
{
  label: 'Connected Clients',
  submenu: connectedClients.map(client => ({
    label: client.name,
    sublabel: client.description,  // Shows description as secondary text
    enabled: false,
  })),
  visible: clientCount > 0,  // Only show when clients exist
},
{ type: 'separator' },
```

### 3. Subscribe to Registry Events

In `src/main.ts`, after initializing the client registry:

- Subscribe to `registered` and `unregistered` events
- Call `updateTrayMenu()` when events fire
- Update menu immediately after registry initialization

### 4. Handle Edge Cases

- Initial state: Show "0 clients connected" on startup
- Graceful handling when registry is not yet initialized
- Menu updates should be debounced if many rapid connect/disconnect events occur (optional optimization)

## Technical Notes

- The client registry is already initialized in `app.whenReady()` and emits events
- Use `getClientRegistry().getAllClients()` to get current client list
- Use `getClientRegistry().getClientCount()` for the count
- Tray menu is rebuilt entirely on each update (Electron limitation - no partial updates)
- Keep the existing "About SmartHole" and "Quit" menu items

## Acceptance Criteria

1. [ ] Tray menu displays current client count (e.g., "2 clients connected")
2. [ ] Menu updates automatically when a client registers
3. [ ] Menu updates automatically when a client unregisters
4. [ ] Correct pluralization ("1 client" vs "2 clients")
5. [ ] Connected clients submenu shows client names (when clients > 0)
6. [ ] Existing menu items (About, Quit) remain functional
7. [ ] App starts with "0 clients connected" displayed

## Out of Scope

- IPC handlers for client status (handled by T-implement-client-status-ipc)
- Renderer UI components for connection status
- Health monitoring/heartbeat logic (already implemented)
- Tray icon changes based on connection status
- Notification popups for connect/disconnect events
