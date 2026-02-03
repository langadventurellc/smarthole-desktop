# Reference Implementation

An annotated walkthrough of a production-ready SmartHole client.

The full source is available at `scripts/test-harness-plugin.ts` in the SmartHole repository. This document explains the key patterns.

## Overview

The test harness plugin is a TypeScript client that:

- Connects to SmartHole via WebSocket
- Registers with a name and description
- Echoes received messages back as notifications
- Handles reconnection with exponential backoff
- Supports command-line flags for testing different behaviors

## Project Structure

```
my-client/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

## Full Implementation

```typescript
import WebSocket from "ws";

// ============================================================================
// Configuration
// ============================================================================

const WS_URL = "ws://127.0.0.1:9473";
const PLUGIN_NAME = "my-plugin";
const PLUGIN_DESCRIPTION = "I handle notes, memories, and things you want to remember for later.";
const PLUGIN_VERSION = "1.0.0";

// Reconnection settings
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ============================================================================
// Types (matching SmartHole protocol)
// ============================================================================

interface ClientRegistration {
  name: string;
  description: string;
  version: string;
}

interface WebSocketRegistrationMessage {
  type: "registration";
  payload: ClientRegistration;
}

interface RegistrationSuccessResponse {
  success: true;
  clientId: string;
  message: string;
}

interface RegistrationFailureResponse {
  success: false;
  code: string;
  message: string;
}

type RegistrationResponse = RegistrationSuccessResponse | RegistrationFailureResponse;

interface WebSocketRegistrationResponseMessage {
  type: "registration_response";
  payload: RegistrationResponse;
}

interface MessageMetadata {
  confidence?: number;
  routingReason?: string;
  inputMethod: "voice" | "text";
  directRouted: boolean;
}

interface RoutedMessage {
  id: string;
  text: string;
  timestamp: string;
  metadata: MessageMetadata;
}

interface WebSocketRoutedMessage {
  type: "message";
  payload: RoutedMessage;
}

interface ClientResponse {
  messageId: string;
  type: "ack" | "reject" | "notification";
  payload: Record<string, unknown>;
}

interface WebSocketResponseMessage {
  type: "response";
  payload: ClientResponse;
}

type IncomingMessage = WebSocketRegistrationResponseMessage | WebSocketRoutedMessage;

// ============================================================================
// Logging
// ============================================================================

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] ${level}: ${message}${dataStr}`);
}

// ============================================================================
// Plugin Implementation
// ============================================================================

class SmartHolePlugin {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private clientId: string | null = null;

  /**
   * Connect to SmartHole.
   */
  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    log("INFO", `Connecting to ${WS_URL}...`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.on("open", () => {
          log("INFO", "Connected, sending registration...");
          this.reconnectAttempts = 0;
          this.sendRegistration();
          resolve();
        });

        this.ws.on("message", (data: WebSocket.RawData) => {
          this.handleMessage(data);
        });

        this.ws.on("close", (code: number, reason: Buffer) => {
          const reasonStr = reason.toString() || "No reason provided";
          log("INFO", `Connection closed`, { code, reason: reasonStr });
          this.ws = null;
          this.clientId = null;

          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });

        this.ws.on("error", (error: Error) => {
          log("ERROR", `WebSocket error: ${error.message}`);
          // Don't reject here - error is followed by close event
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log("ERROR", `Failed to create WebSocket: ${errorMessage}`);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(data: WebSocket.RawData): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(data.toString());
    } catch {
      log("WARN", "Received non-JSON message, ignoring");
      return;
    }

    if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
      log("WARN", "Received invalid message format, ignoring");
      return;
    }

    const message = parsed as IncomingMessage;

    switch (message.type) {
      case "registration_response":
        this.handleRegistrationResponse(message.payload);
        break;

      case "message":
        this.handleRoutedMessage(message.payload);
        break;

      default:
        log("DEBUG", `Received unknown message type: ${(parsed as { type: string }).type}`);
    }
  }

  /**
   * Handle registration response from server.
   */
  private handleRegistrationResponse(response: RegistrationResponse): void {
    if (response.success) {
      this.clientId = response.clientId;
      log("INFO", `Registered successfully as "${PLUGIN_NAME}"`, {
        clientId: response.clientId,
        message: response.message,
      });
    } else {
      log("ERROR", `Registration failed: ${response.message}`, {
        code: response.code,
      });
      // Close connection - will trigger reconnect
      this.ws?.close();
    }
  }

  /**
   * Handle a routed message from SmartHole.
   *
   * This is where you implement your client's logic.
   */
  private handleRoutedMessage(message: RoutedMessage): void {
    const { id: messageId, text, metadata } = message;

    log("INFO", `Received message [${messageId}]: "${text}"`, {
      inputMethod: metadata.inputMethod,
      directRouted: metadata.directRouted,
      routingReason: metadata.routingReason,
    });

    // Always ack immediately
    this.sendAck(messageId);

    // =========================================
    // YOUR LOGIC HERE
    // Process the message however you need
    // =========================================

    // Example: Echo back as notification
    this.sendNotification(messageId, `Received`, `You said: ${text}`);
  }

  /**
   * Send registration message to server.
   */
  private sendRegistration(): void {
    const registration: WebSocketRegistrationMessage = {
      type: "registration",
      payload: {
        name: PLUGIN_NAME,
        description: PLUGIN_DESCRIPTION,
        version: PLUGIN_VERSION,
      },
    };

    this.send(registration);
    log("DEBUG", "Sent registration message");
  }

  /**
   * Send ack response.
   */
  private sendAck(messageId: string): void {
    const response: WebSocketResponseMessage = {
      type: "response",
      payload: {
        messageId,
        type: "ack",
        payload: {},
      },
    };

    this.send(response);
    log("DEBUG", `Sent ack for ${messageId}`);
  }

  /**
   * Send reject response.
   */
  private sendReject(messageId: string, reason: string): void {
    const response: WebSocketResponseMessage = {
      type: "response",
      payload: {
        messageId,
        type: "reject",
        payload: { reason },
      },
    };

    this.send(response);
    log("INFO", `Sent reject for ${messageId}`, { reason });
  }

  /**
   * Send notification response.
   */
  private sendNotification(
    messageId: string,
    title: string,
    body: string,
    priority: "low" | "normal" | "high" = "normal"
  ): void {
    const response: WebSocketResponseMessage = {
      type: "response",
      payload: {
        messageId,
        type: "notification",
        payload: { title, body, priority },
      },
    };

    this.send(response);
    log("INFO", `Sent notification for ${messageId}`);
  }

  /**
   * Send a message over the WebSocket connection.
   */
  private send(message: WebSocketRegistrationMessage | WebSocketResponseMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log("WARN", "Cannot send message: connection not open");
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log("ERROR", `Failed to send message: ${errorMessage}`);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  private scheduleReconnect(): void {
    if (this.isShuttingDown) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log("ERROR", "Max reconnection attempts reached. Exiting.");
      process.exit(1);
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );

    this.reconnectAttempts++;

    log(
      "INFO",
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((error) => {
        log(
          "ERROR",
          `Reconnection failed: ${error instanceof Error ? error.message : String(error)}`
        );
        this.scheduleReconnect();
      });
    }, delay);
  }

  /**
   * Shutdown gracefully.
   */
  shutdown(): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    log("INFO", "Shutting down...");

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Plugin shutting down");
      }
      this.ws = null;
    }

    log("INFO", "Shutdown complete");
    process.exit(0);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

function main(): void {
  log("INFO", "Starting plugin");

  const plugin = new SmartHolePlugin();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    log("INFO", "Received SIGINT");
    plugin.shutdown();
  });

  process.on("SIGTERM", () => {
    log("INFO", "Received SIGTERM");
    plugin.shutdown();
  });

  // Start the plugin
  plugin.connect().catch((error) => {
    log(
      "ERROR",
      `Initial connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
    // scheduleReconnect will be called from the close handler
  });
}

main();
```

## Key Patterns Explained

### 1. Immediate Registration

```typescript
this.ws.on("open", () => {
  this.sendRegistration(); // Send immediately on connection
});
```

SmartHole expects registration right after connection. Don't wait or the connection may be terminated.

### 2. Type-Safe Message Handling

```typescript
private handleMessage(data: WebSocket.RawData): void {
  let parsed: unknown;

  try {
    parsed = JSON.parse(data.toString());
  } catch {
    log('WARN', 'Received non-JSON message, ignoring');
    return;
  }

  // Validate structure before type assertion
  if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
    log('WARN', 'Received invalid message format, ignoring');
    return;
  }

  const message = parsed as IncomingMessage;
  // Now safe to switch on message.type
}
```

Always validate the message structure before assuming its type.

### 3. Exponential Backoff Reconnection

```typescript
private scheduleReconnect(): void {
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
    MAX_RECONNECT_DELAY_MS
  );

  this.reconnectAttempts++;

  setTimeout(() => {
    this.connect();
  }, delay);
}
```

Delays: 1s → 2s → 4s → 8s → 16s → 30s (capped)

Reset `reconnectAttempts` to 0 on successful connection.

### 4. Graceful Shutdown

```typescript
process.on('SIGINT', () => plugin.shutdown());
process.on('SIGTERM', () => plugin.shutdown());

shutdown(): void {
  this.isShuttingDown = true;  // Prevent reconnection

  if (this.reconnectTimeout) {
    clearTimeout(this.reconnectTimeout);
  }

  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.close(1000, 'Plugin shutting down');
  }
}
```

Clean shutdown prevents dangling connections and reconnect loops.

### 5. Send Helper with Safety Checks

```typescript
private send(message: WebSocketRegistrationMessage | WebSocketResponseMessage): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    log('WARN', 'Cannot send message: connection not open');
    return;
  }

  try {
    this.ws.send(JSON.stringify(message));
  } catch (error) {
    log('ERROR', `Failed to send message: ${error.message}`);
  }
}
```

Always check connection state before sending. Wrap in try-catch for safety.

## Running the Reference Implementation

The SmartHole repository includes a runnable test harness:

```bash
# From the SmartHole repository
mise run test-plugin

# With options
mise run test-plugin -- --reject      # Always reject messages
mise run test-plugin -- --delay 3000  # Add 3s delay before responding
mise run test-plugin -- --silent      # Don't send notifications
```

## Adapting for Other Languages

The patterns translate to any language:

### Python

```python
import asyncio
import websockets
import json

async def main():
    uri = "ws://127.0.0.1:9473"

    async with websockets.connect(uri) as ws:
        # Register
        await ws.send(json.dumps({
            "type": "registration",
            "payload": {
                "name": "python-client",
                "description": "A Python-based SmartHole client",
                "version": "1.0.0"
            }
        }))

        # Handle messages
        async for message in ws:
            data = json.loads(message)

            if data["type"] == "message":
                # Ack immediately
                await ws.send(json.dumps({
                    "type": "response",
                    "payload": {
                        "messageId": data["payload"]["id"],
                        "type": "ack",
                        "payload": {}
                    }
                }))

asyncio.run(main())
```

### Go

```go
package main

import (
    "encoding/json"
    "github.com/gorilla/websocket"
    "log"
)

func main() {
    conn, _, err := websocket.DefaultDialer.Dial("ws://127.0.0.1:9473", nil)
    if err != nil {
        log.Fatal(err)
    }
    defer conn.Close()

    // Register
    registration := map[string]interface{}{
        "type": "registration",
        "payload": map[string]string{
            "name":        "go-client",
            "description": "A Go-based SmartHole client",
            "version":     "1.0.0",
        },
    }
    conn.WriteJSON(registration)

    // Handle messages
    for {
        _, message, err := conn.ReadMessage()
        if err != nil {
            log.Println("read:", err)
            return
        }

        var msg map[string]interface{}
        json.Unmarshal(message, &msg)

        if msg["type"] == "message" {
            payload := msg["payload"].(map[string]interface{})
            messageId := payload["id"].(string)

            // Ack
            conn.WriteJSON(map[string]interface{}{
                "type": "response",
                "payload": map[string]interface{}{
                    "messageId": messageId,
                    "type":      "ack",
                    "payload":   map[string]interface{}{},
                },
            })
        }
    }
}
```
