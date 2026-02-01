---
id: F-test-harness-plugin
title: Test Harness Plugin
status: open
priority: medium
parent: E-intelligent-routing-agent
prerequisites:
  - F-routing-agent-core-logic
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T01:57:12.099Z
updated: 2026-02-01T01:57:12.099Z
---

# Test Harness Plugin

## Purpose

Create a standalone test plugin that demonstrates the complete message flow and serves as a reference implementation for plugin developers. This is essential for MVP validation and debugging.

## Scope

### 1. Standalone Plugin Script

Create `scripts/test-harness-plugin.ts`:

**Plugin Behavior:**

1. **Startup**: Connect to WebSocket at `ws://127.0.0.1:9473`
2. **Registration**: Register with:
   - `name`: "test-harness"
   - `description`: "A test plugin that echoes messages back. Use for debugging and testing the routing system."
   - `version`: "1.0.0"
3. **Message Handling**:
   - Log received message to console
   - Send `ack` response immediately
   - Send `notification` response with echoed message text
4. **Reconnection**: Attempt reconnect with exponential backoff if disconnected
5. **Graceful Shutdown**: Clean disconnect on SIGINT/SIGTERM

**Script Structure:**

```typescript
#!/usr/bin/env npx tsx

import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:9473";
const PLUGIN_NAME = "test-harness";

class TestHarnessPlugin {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;

  async connect(): Promise<void> {
    /* ... */
  }
  private handleMessage(data: WebSocket.RawData): void {
    /* ... */
  }
  private sendAck(messageId: string): void {
    /* ... */
  }
  private sendNotification(messageId: string, text: string): void {
    /* ... */
  }
  private scheduleReconnect(): void {
    /* ... */
  }
  shutdown(): void {
    /* ... */
  }
}

// Main entry point
const plugin = new TestHarnessPlugin();
plugin.connect();

process.on("SIGINT", () => plugin.shutdown());
process.on("SIGTERM", () => plugin.shutdown());
```

### 2. WebSocket Communication

Implement the plugin-side WebSocket protocol:

**Registration Message:**

```json
{
  "type": "register",
  "payload": {
    "name": "test-harness",
    "description": "A test plugin that echoes messages back...",
    "version": "1.0.0"
  }
}
```

**Ack Response:**

```json
{
  "type": "response",
  "payload": {
    "type": "ack",
    "messageId": "msg-123"
  }
}
```

**Notification Response:**

```json
{
  "type": "response",
  "payload": {
    "type": "notification",
    "messageId": "msg-123",
    "title": "Echo from test-harness",
    "body": "You said: {original message}",
    "priority": "normal"
  }
}
```

### 3. Console Logging

Log all activity for visibility:

- Connection status (connecting, connected, disconnected)
- Registration result (success/failure)
- Received messages (timestamp, message ID, content)
- Sent responses (type, message ID)
- Reconnection attempts
- Errors

**Log Format:**

```
[2024-01-15T10:30:00.000Z] INFO: Connecting to ws://127.0.0.1:9473...
[2024-01-15T10:30:00.100Z] INFO: Connected, sending registration...
[2024-01-15T10:30:00.150Z] INFO: Registered successfully as "test-harness"
[2024-01-15T10:30:15.000Z] INFO: Received message [msg-abc123]: "Hello world"
[2024-01-15T10:30:15.001Z] INFO: Sent ack for msg-abc123
[2024-01-15T10:30:15.002Z] INFO: Sent notification for msg-abc123
```

### 4. Reconnection Logic

Implement robust reconnection with exponential backoff:

- Base delay: 1 second
- Max delay: 30 seconds
- Max attempts: 10 (then log error and exit)
- Reset attempts counter on successful reconnection

```typescript
private scheduleReconnect(): void {
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    console.error('Max reconnection attempts reached. Exiting.');
    process.exit(1);
  }

  const delay = Math.min(
    this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
    30000
  );

  console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})...`);
  setTimeout(() => this.connect(), delay);
  this.reconnectAttempts++;
}
```

### 5. Mise Task

Add to `mise.toml`:

```toml
[tasks.test-plugin]
run = "npx tsx scripts/test-harness-plugin.ts"
description = "Run the test harness plugin"
```

### 6. Alternative Behaviors (Optional Arguments)

Support command-line flags for testing different scenarios:

- `--reject`: Always reject messages (for testing rejection flow)
- `--delay <ms>`: Add delay before responding (for testing timeouts)
- `--silent`: Don't send notification, only ack

```bash
mise run test-plugin             # Normal echo behavior
mise run test-plugin -- --reject # Always reject
mise run test-plugin -- --delay 5000 # 5 second delay
```

## Implementation Location

- `scripts/test-harness-plugin.ts`
- Update `mise.toml` with task

## Dependencies

- `ws` package (already installed)
- Existing WebSocket server running on port 9473

## Acceptance Criteria

1. [ ] Script created at `scripts/test-harness-plugin.ts`
2. [ ] Plugin connects to WebSocket server at ws://127.0.0.1:9473
3. [ ] Plugin registers with name "test-harness" and descriptive routing hint
4. [ ] Plugin echoes received messages via notification response
5. [ ] Plugin sends ack response before notification
6. [ ] Console logs all activity with timestamps
7. [ ] Reconnection with exponential backoff on disconnect
8. [ ] Graceful shutdown on SIGINT/SIGTERM
9. [ ] Mise task added: `mise run test-plugin`
10. [ ] Optional flags for testing rejection and delay scenarios
