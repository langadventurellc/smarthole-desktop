# Client Status IPC

IPC layer for exposing client connection status from the registry to the renderer process and system tray.

## IPC Channels

| Channel                 | Direction        | Description                                |
| ----------------------- | ---------------- | ------------------------------------------ |
| `clients:getCount`      | Renderer -> Main | Get number of registered clients           |
| `clients:getList`       | Renderer -> Main | Get list of client summaries               |
| `clients:getDetails`    | Renderer -> Main | Get full details for a specific client     |
| `clients:statusChanged` | Main -> Renderer | Broadcast when clients register/unregister |

## Types

```typescript
// Minimal client info for list view
interface ClientSummary {
  name: string; // Client-provided unique name
  description: string; // Free-form description
}

// Full client details
interface ClientDetails {
  id: string; // Server-assigned connection ID
  name: string; // Client-provided unique name
  description: string; // Free-form description
  version?: string; // Optional client version
  capabilities?: string[]; // Optional capability hints
  registeredAt: string; // ISO 8601 timestamp
}

// Status change broadcast payload
interface ClientStatusChangedPayload {
  event: "registered" | "unregistered";
  client: ClientSummary;
  count: number; // Current total count
}
```

## Renderer API

```typescript
// Get current client count
const count = await window.electronAPI.getClientCount();

// Get list of all clients
const clients = await window.electronAPI.getClientList();

// Get details for a specific client
const details = await window.electronAPI.getClientDetails("notebook");

// Subscribe to status changes
const unsubscribe = window.electronAPI.onClientStatusChange((payload) => {
  console.log(`${payload.event}: ${payload.client.name}, total: ${payload.count}`);
});
```

## Tray Menu Integration

The system tray menu displays client connection status:

- **Status label**: Shows "`N` client(s) connected" at the top of the menu
- **Connected Clients submenu**: When clients are connected, displays a submenu listing each client by name with their description as sublabel
- **Real-time updates**: Menu rebuilds automatically when clients register or unregister

The tray menu subscribes to registry `registered` and `unregistered` events to trigger updates.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Renderer       │  IPC    │  Main Process    │  Events │  Client         │
│  Process        │ ◄────── │  (IPC Handlers)  │ ◄────── │  Registry       │
└─────────────────┘         └──────────────────┘         └─────────────────┘
        │                            │                            ▲
        │                            │                            │
        ▼                            ▼                            │
   React UI /             Tray Menu Builder              WebSocket Server
   Status Display          (updates on events)           (connection events)
```

### Event Flow

1. Client connects via WebSocket and sends registration message
2. Registration handler validates and registers client in registry
3. Registry emits `registered` event
4. IPC handler broadcasts `clients:statusChanged` to all renderer windows
5. Tray menu handler rebuilds menu with updated client list

### Handler Registration

```typescript
// In main.ts
import {
  createClientCountHandler,
  createClientListHandler,
  createClientDetailsHandler,
  createRegisteredEventHandler,
  createUnregisteredEventHandler,
} from "./ipc/client-status-handler";

// Register IPC handlers
ipcMain.handle(IPC_CHANNELS.CLIENTS_GET_COUNT, createClientCountHandler(registryGetter, logger));
ipcMain.handle(IPC_CHANNELS.CLIENTS_GET_LIST, createClientListHandler(registryGetter, logger));
ipcMain.handle(
  IPC_CHANNELS.CLIENTS_GET_DETAILS,
  createClientDetailsHandler(registryGetter, logger)
);

// Subscribe to registry events for broadcasting
registry.on("registered", createRegisteredEventHandler(registryGetter));
registry.on("unregistered", createUnregisteredEventHandler(registryGetter));

// Subscribe to registry events for tray menu updates
registry.on("registered", () => updateTrayMenu());
registry.on("unregistered", () => updateTrayMenu());
```

## Error Handling

All handlers use graceful degradation:

- `getClientCount`: Returns `0` on error
- `getClientList`: Returns empty array `[]` on error
- `getClientDetails`: Returns `null` for unknown client or on error

Errors are logged with the `ClientStatusIPC` component logger.
