---
id: T-implement-test-harness-plugin
title: Implement test harness plugin script with mise task
status: done
priority: medium
parent: F-test-harness-plugin
prerequisites: []
affectedFiles:
  scripts/test-harness-plugin.ts: Created new test harness plugin script with
    WebSocket client, registration handling, message echo functionality,
    exponential backoff reconnection, graceful shutdown, and CLI flag support
  mise.toml: Added test-plugin task to run the test harness plugin
log:
  - |-
    Research complete. Found:
    - WebSocket protocol uses "registration" type (not "register")
    - Server responds with "registration_response" message type
    - Response format uses type: "response" with ClientResponse payload
    - ws package available v8.19.0
    - Scripts directory at /Users/zach/code/smarthole-desktop/scripts/
    - Starting implementation
  - Implemented test harness plugin script that connects to SmartHole WebSocket
    server and echoes messages back. The plugin registers with the
    "test-harness" name, handles registration_response messages, sends ack and
    notification responses for received messages, implements exponential backoff
    reconnection (1s base, 30s max, 10 attempts max), gracefully shuts down on
    SIGINT/SIGTERM, and supports CLI flags (--reject, --delay <ms>, --silent).
    All logs include ISO 8601 timestamps. Added mise task "test-plugin" to run
    the plugin.
schema: v1.0
childrenIds: []
created: 2026-02-01T04:45:51.571Z
updated: 2026-02-01T04:45:51.571Z
---

# Implement Test Harness Plugin Script

## Overview

Create a standalone test plugin that connects to the SmartHole WebSocket server and echoes messages back. This serves as a reference implementation for plugin developers and enables MVP validation and debugging.

## Implementation

### 1. Create `scripts/test-harness-plugin.ts`

**Core Plugin Class:**

```typescript
#!/usr/bin/env npx tsx

import WebSocket from "ws";

const WS_URL = "ws://127.0.0.1:9473";
const PLUGIN_NAME = "test-harness";

interface CommandLineArgs {
  reject: boolean;
  delay: number;
  silent: boolean;
}

class TestHarnessPlugin {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000;
  private readonly args: CommandLineArgs;

  constructor(args: CommandLineArgs) {
    this.args = args;
  }

  async connect(): Promise<void> {
    /* ... */
  }
  private handleMessage(data: WebSocket.RawData): void {
    /* ... */
  }
  private sendRegistration(): void {
    /* ... */
  }
  private sendAck(messageId: string): void {
    /* ... */
  }
  private sendReject(messageId: string, reason: string): void {
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
```

**WebSocket Protocol Implementation:**

1. **Registration** (on connect):

   ```json
   {
     "type": "registration",
     "payload": {
       "name": "test-harness",
       "description": "A test plugin that echoes messages back. Use for debugging and testing the routing system.",
       "version": "1.0.0"
     }
   }
   ```

   Note: Use `"registration"` type (not `"register"`) per actual protocol in `src/types/messages.ts`.

2. **Registration Response Handling**:
   After sending registration, the server responds with a `registration_response` message:

   ```json
   {
     "type": "registration_response",
     "payload": {
       "success": true,
       "clientId": "client-abc123",
       "message": "Successfully registered as test-harness"
     }
   }
   ```

   Or on failure:

   ```json
   {
     "type": "registration_response",
     "payload": {
       "success": false,
       "code": "DUPLICATE_NAME",
       "message": "A client with this name is already registered"
     }
   }
   ```

   The plugin should parse this response, log the result, and handle failures appropriately (e.g., exit if registration fails).

3. **Message Handling** (when receiving `type: "message"`):
   - Parse incoming `WebSocketRoutedMessage`
   - If `--reject` flag: send reject response and return
   - If `--delay` flag: wait specified milliseconds
   - Send ack response
   - If not `--silent`: send notification response with echoed text

4. **Response Formats:**

   ```typescript
   // Ack
   { type: "response", payload: { type: "ack", messageId: "..." } }

   // Reject
   { type: "response", payload: { type: "reject", messageId: "...", reason: "..." } }

   // Notification
   { type: "response", payload: {
     type: "notification",
     messageId: "...",
     title: "Echo from test-harness",
     body: "You said: <original text>",
     priority: "normal"
   }}
   ```

**Reconnection Logic:**

- Base delay: 1 second
- Max delay: 30 seconds (capped with `Math.min`)
- Max attempts: 10 (then exit with error)
- Reset attempt counter on successful connection
- Use exponential backoff: `delay = min(baseDelay * 2^attempts, 30000)`

**Console Logging:**

- All logs should include ISO 8601 timestamps
- Log format: `[ISO_TIMESTAMP] LEVEL: message`
- Log events: connecting, connected, registration sent, registration result (success/failure with details), message received, responses sent, reconnecting, errors, shutdown

**Command-Line Arguments:**
Parse with simple argv handling (no dependencies):

- `--reject`: Always reject messages with reason "Test rejection mode"
- `--delay <ms>`: Add delay before responding (parse as integer)
- `--silent`: Only send ack, skip notification

**Signal Handling:**

```typescript
process.on("SIGINT", () => plugin.shutdown());
process.on("SIGTERM", () => plugin.shutdown());
```

### 2. Update `mise.toml`

Add task:

```toml
[tasks.test-plugin]
run = "npx tsx scripts/test-harness-plugin.ts"
description = "Run the test harness plugin"
```

## Files to Create/Modify

- **Create**: `scripts/test-harness-plugin.ts`
- **Modify**: `mise.toml` (add test-plugin task)

## Acceptance Criteria

1. [ ] Script created at `scripts/test-harness-plugin.ts`
2. [ ] Plugin connects to WebSocket server at ws://127.0.0.1:9473
3. [ ] Plugin registers with name "test-harness" using correct `"registration"` message type
4. [ ] Plugin handles `registration_response` message and logs success/failure
5. [ ] Plugin echoes received messages via notification response
6. [ ] Plugin sends ack response before/with notification
7. [ ] Console logs all activity with ISO 8601 timestamps
8. [ ] Reconnection with exponential backoff on disconnect (1s base, 30s max, 10 max attempts)
9. [ ] Graceful shutdown on SIGINT/SIGTERM
10. [ ] Mise task `mise run test-plugin` works
11. [ ] `--reject` flag causes all messages to be rejected
12. [ ] `--delay <ms>` flag adds delay before responding
13. [ ] `--silent` flag suppresses notification (only sends ack)

## Testing

Manual testing:

1. Start SmartHole desktop app (`mise run dev`)
2. In another terminal: `mise run test-plugin`
3. Verify registration success message is logged
4. Use the app to send a message, verify echo notification appears
5. Test `--reject` mode: `mise run test-plugin -- --reject`
6. Test `--delay` mode: `mise run test-plugin -- --delay 3000`
7. Test `--silent` mode: `mise run test-plugin -- --silent`
8. Kill the WebSocket server, verify reconnection attempts with backoff
9. Ctrl+C the plugin, verify graceful shutdown message
