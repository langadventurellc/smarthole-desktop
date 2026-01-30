# Message Delivery System

Routes messages from the LLM to registered plugin clients via WebSocket connections. Provides fire-and-forget delivery with status tracking for debugging.

## Initialization

```typescript
import { initializeMessageDelivery } from "./services/message-delivery";

app.whenReady().then(async () => {
  // After logger, client registry, and WebSocket server are initialized
  const delivery = initializeMessageDelivery();
});
```

## Sending Messages

```typescript
import { getMessageDelivery } from "./services/message-delivery";

const delivery = getMessageDelivery();

// Send to a single client
const result = delivery.sendToClient("notebook", {
  id: "msg-123" as MessageId,
  text: "Create a new note",
  timestamp: new Date().toISOString() as ISOTimestamp,
  metadata: { priority: "high" },
});

// Send to multiple clients
const results = delivery.sendToClients(["notebook", "home-assistant"], message);
```

## Delivery Results

```typescript
type DeliveryResult =
  | { success: true; deliveredAt: ISOTimestamp }
  | { success: false; error: DeliveryError };

type DeliveryError =
  | "CLIENT_NOT_FOUND" // Client name not in registry
  | "CLIENT_NOT_CONNECTED" // Client registered but WebSocket closed
  | "SEND_FAILED"; // WebSocket send threw an error
```

## Response Handling

Clients can respond to messages with acknowledgments, rejections, or notification requests:

```typescript
// Subscribe to response events
delivery.on("response:ack", (messageId, clientName) => {
  console.log(`${clientName} acknowledged ${messageId}`);
});

delivery.on("response:reject", (messageId, clientName, reason) => {
  console.log(`${clientName} rejected ${messageId}: ${reason}`);
});

delivery.on("response:notification", (messageId, clientName, notification) => {
  console.log(`${clientName} requests notification: ${notification.title}`);
});
```

### Client Response Types

```typescript
// Acknowledge - message was processed successfully
{ type: "response", payload: { type: "ack", messageId: "msg-123" } }

// Reject - message could not be processed
{ type: "response", payload: { type: "reject", messageId: "msg-123", reason: "Invalid format" } }

// Notification - client wants to show a notification to the user
{ type: "response", payload: { type: "notification", messageId: "msg-123", title: "Done", body: "Task completed" } }
```

### Response Timeout

If a client does not respond within the configured timeout (default 30 seconds), the message is treated as implicitly rejected:

- A `response:reject` event is emitted with reason `"Response timeout"`
- The `DeliveryStatus` is updated with a reject response
- The timeout is logged as a warning

This ensures the system doesn't accumulate indefinitely-pending messages and provides a clear signal when clients fail to respond.

### Notification Routing

When clients respond with a notification request, the notification is automatically routed to the notification queue in `main.ts`:

```typescript
// Wired up during initialization in main.ts
messageDelivery.on("response:notification", (messageId, clientName, notification) => {
  notificationQueue.enqueue({
    title: notification.title ?? clientName,
    body: notification.body ?? "",
    type: "info",
    priority: mapClientPriorityToQueuePriority(notification.priority),
  });
});
```

This ensures client-requested notifications flow through the same rate limiting and coalescing as other system notifications.

## Delivery Status Tracking

The service maintains a history of recent deliveries for debugging:

```typescript
// Get status for a specific message
const status = delivery.getDeliveryStatus("msg-123" as MessageId);

// Get recent deliveries (newest first)
const recent = delivery.getRecentDeliveries(10);

// Clear history
delivery.clearDeliveryHistory();
```

### DeliveryStatus Structure

```typescript
interface DeliveryStatus {
  messageId: MessageId;
  clientName: string;
  result: DeliveryResult;
  attemptedAt: ISOTimestamp;
  response?: {
    type: "ack" | "reject" | "notification";
    receivedAt: ISOTimestamp;
    payload?: RejectPayload | NotificationPayload;
  };
}
```

## IPC Interface

Message delivery is exposed to the renderer process via IPC:

| Channel                | Method                | Description                       |
| ---------------------- | --------------------- | --------------------------------- |
| `message:send`         | `sendMessage`         | Send message to a single client   |
| `message:sendMultiple` | `sendMessageMultiple` | Send message to multiple clients  |
| `message:getStatus`    | `getMessageStatus`    | Get delivery status for a message |
| `message:getRecent`    | `getRecentDeliveries` | Get recent delivery history       |

### Renderer Usage

```typescript
// In renderer process
const result = await window.electronAPI.sendMessage("notebook", {
  id: "msg-123",
  text: "Create a new note",
  timestamp: new Date().toISOString(),
});

if (result.success) {
  console.log("Delivered at:", result.deliveredAt);
} else {
  console.error("Delivery failed:", result.error);
}

// Get delivery history
const recent = await window.electronAPI.getRecentDeliveries(10);
```

## Configuration

```typescript
const delivery = initializeMessageDelivery({
  maxHistorySize: 100, // Maximum delivery statuses to keep (default: 100)
  responseTimeoutMs: 30000, // Timeout for client responses in ms (default: 30000)
});
```

### Configuration Options

| Option              | Type   | Default | Description                                                              |
| ------------------- | ------ | ------- | ------------------------------------------------------------------------ |
| `maxHistorySize`    | number | 100     | Maximum number of delivery statuses to keep in history                   |
| `responseTimeoutMs` | number | 30000   | Timeout in milliseconds before treating a message as implicitly rejected |

## Wire Format

Messages are sent to clients in this format:

```typescript
interface WebSocketRoutedMessage {
  type: "message";
  payload: {
    id: string; // Unique message ID
    text: string; // Message content
    timestamp: string; // ISO 8601 timestamp
    metadata?: Record<string, unknown>; // Optional context
  };
}
```

## Singleton Pattern

Like other services, message delivery follows the singleton pattern:

```typescript
// Initialize once in main.ts
initializeMessageDelivery();

// Retrieve anywhere else
const delivery = getMessageDelivery();
```

For testing, use `resetMessageDelivery()` to clear the singleton instance.
