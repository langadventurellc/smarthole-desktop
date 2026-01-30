# WebSocket Server

WebSocket server for plugin client connections, providing secure local IPC with external plugins.

## Initialization

```typescript
import { initializeWebSocketServer, shutdownWebSocketServer } from "./services/websocket-server";

app.whenReady().then(async () => {
  const wsServer = await initializeWebSocketServer({
    port: 9473,
    host: "127.0.0.1",
    maxConnections: 100,
  });
});

app.on("will-quit", async () => {
  await shutdownWebSocketServer();
});
```

## Configuration

```typescript
interface WebSocketServerConfig {
  port: number; // Default: 9473
  host: string; // Default: "127.0.0.1"
  maxConnections: number; // Default: 100
  heartbeatInterval: number; // Default: 30000ms
  heartbeatTimeout: number; // Default: 10000ms
}
```

## Features

- **Localhost-only binding**: Only accepts connections from 127.0.0.1 for security
- **Connection tracking**: Each connection gets a unique ID and metadata (connected time, last activity, remote address)
- **Heartbeat monitoring**: Ping-pong health checks with configurable intervals
- **Graceful shutdown**: Proper cleanup of all connections on app quit
- **Event-driven**: Emits events for connection, disconnection, and error

## Usage

### Main Process

```typescript
import { getWebSocketServer } from "./services/websocket-server";

const wsServer = getWebSocketServer();

// Check status
wsServer.isRunning();
wsServer.getConnectionCount();
wsServer.getActiveConnections();

// Subscribe to events
wsServer.on("connection", (info) => console.log(`New client: ${info.id}`));
wsServer.on("disconnection", (info, code, reason) => console.log(`Client ${info.id} disconnected`));
```

### Renderer Process

```typescript
// Get current status
const status = await window.electronAPI.getWebSocketStatus();
// status.state: "running" | "stopped" | "error"
// status.port: number
// status.activeConnections: number

// Subscribe to changes
const unsubscribe = window.electronAPI.onWebSocketStatusChange((status) => {
  console.log(`Server state: ${status.state}`);
});
```
