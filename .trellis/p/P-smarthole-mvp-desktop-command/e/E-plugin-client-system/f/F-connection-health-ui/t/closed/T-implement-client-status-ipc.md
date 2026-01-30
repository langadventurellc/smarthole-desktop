---
id: T-implement-client-status-ipc
title: Implement Client Status IPC and Preload API
status: done
priority: medium
parent: F-connection-health-ui
prerequisites: []
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
  src/main.ts: Registered client status IPC handlers and subscribed to registry
    events for real-time broadcasts
  src/preload.ts: Added getClientCount, getClientList, getClientDetails, and
    onClientStatusChange methods to the preload API
  src/types/ipc.test.ts: Updated channel count test and added tests for new client status channels
log:
  - |-
    Research complete. Key files analyzed:
    - websocket-status-handler.ts: Pattern for IPC handlers and broadcast
    - types/ipc.ts: IPC channel definitions and type maps
    - preload.ts: Pattern for exposing API via contextBridge
    - main.ts: Pattern for registering IPC handlers and event subscriptions
    - client-registry.ts (service): Registry API and events
    - types/client-registry.ts: RegistryClientInfo type

    Implementation plan:
    1. Add client status IPC channels to ipc.ts
    2. Add ClientSummary, ClientDetails types and map entries
    3. Create client-status-handler.ts with handlers and broadcast
    4. Register handlers in main.ts with registry event subscriptions
    5. Extend preload.ts with new API methods
    6. Add tests in client-status-handler.test.ts
    7. Export from ipc/index.ts
  - Implemented Client Status IPC layer to expose client registry data to the
    renderer process. Added 4 new IPC channels (CLIENTS_GET_COUNT,
    CLIENTS_GET_LIST, CLIENTS_GET_DETAILS, CLIENTS_STATUS_CHANGED), created
    handler functions following the existing websocket-status-handler pattern,
    extended the preload API with getClientCount, getClientList,
    getClientDetails, and onClientStatusChange methods, and registered handlers
    with main process including subscription to registry events for real-time
    status broadcasts.
schema: v1.0
childrenIds: []
created: 2026-01-30T21:11:34.946Z
updated: 2026-01-30T21:11:34.946Z
---

# Implement Client Status IPC and Preload API

## Context

The F-connection-health-ui feature requires exposing client connection status to the renderer process. The client registry (`src/services/client-registry.ts`) already provides the core functionality (`getClientCount()`, `getAllClients()`, `getClient()`, events), but this data is not yet accessible from the renderer.

This task creates the IPC layer to expose client status to the UI, following the existing pattern established by the WebSocket status handler (`src/ipc/websocket-status-handler.ts`).

## Implementation Requirements

### 1. Add IPC Channel Constants

In `src/types/ipc.ts`, add new channels:

```typescript
// Client status channels
CLIENTS_GET_COUNT: "clients:getCount",
CLIENTS_GET_LIST: "clients:getList",
CLIENTS_GET_DETAILS: "clients:getDetails",
CLIENTS_STATUS_CHANGED: "clients:statusChanged",  // Main -> Renderer broadcast
```

### 2. Add IPC Types

In `src/types/ipc.ts`, add types for the client status API:

- `ClientSummary` - Minimal client info (name, description) for list view
- `ClientDetails` - Full `RegistryClientInfo` for detailed view
- Response types for each channel
- Payload/response map entries

### 3. Create IPC Handler

Create `src/ipc/client-status-handler.ts` following the pattern of `websocket-status-handler.ts`:

- `createClientCountHandler()` - Returns client count from registry
- `createClientListHandler()` - Returns array of client summaries
- `createClientDetailsHandler(clientName)` - Returns detailed info for specific client
- `broadcastClientStatusChange()` - Broadcasts to all renderer windows when clients change

### 4. Register Handlers in Main Process

In `src/main.ts`:

- Import and register the IPC handlers with `ipcMain.handle()`
- Subscribe to client registry events (`registered`, `unregistered`) to broadcast status changes

### 5. Extend Preload API

In `src/preload.ts`, add methods:

- `getClientCount(): Promise<number>`
- `getClientList(): Promise<ClientSummary[]>`
- `getClientDetails(name: string): Promise<ClientDetails | null>`
- `onClientStatusChange(callback): () => void` - Subscribe to real-time updates

### 6. Update Type Definitions

In `src/types/electron.d.ts`, add the new methods to the `ElectronAPI` interface.

### 7. Add Tests

Create `src/ipc/client-status-handler.test.ts` with tests for:

- Handler functions return correct data from registry
- Broadcast function sends to all windows
- Error handling for missing clients

## Technical Notes

- Follow the existing pattern from `websocket-status-handler.ts`
- Use the existing `ClientRegistryService` interface - do not modify the registry
- The registry already emits `registered` and `unregistered` events - subscribe to these for real-time updates
- Export handler from `src/ipc/index.ts`

## Acceptance Criteria

1. [ ] IPC channels defined in `IPC_CHANNELS` constant
2. [ ] Handler functions query the client registry correctly
3. [ ] `clients:getCount` returns the number of registered clients
4. [ ] `clients:getList` returns array of client summaries
5. [ ] `clients:getDetails` returns full client info or null if not found
6. [ ] `clients:statusChanged` broadcasts when clients register/unregister
7. [ ] Preload API exposes all methods with proper TypeScript types
8. [ ] `onClientStatusChange` returns unsubscribe function
9. [ ] Unit tests pass with good coverage

## Out of Scope

- Tray menu integration (separate task)
- Modifying the client registry service
- Health monitoring/heartbeat changes (already implemented in WebSocket server)
- UI components in renderer
