# Protocol Reference

Complete specification of the SmartHole WebSocket protocol.

## Connection

| Property    | Value                 |
| ----------- | --------------------- |
| URL         | `ws://127.0.0.1:9473` |
| Protocol    | WebSocket (RFC 6455)  |
| Encoding    | JSON over text frames |
| Max payload | 1 MB                  |

SmartHole only accepts connections from localhost (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`). Connections from other addresses are rejected with HTTP 403.

## Message Flow

```
Client                                    SmartHole
   |                                          |
   |-------- WebSocket Connect -------------->|
   |                                          |
   |-------- registration ------------------->|
   |<------- registration_response -----------|
   |                                          |
   |           (client is now active)         |
   |                                          |
   |<------- message -------------------------|
   |-------- response (ack/reject/notify) --->|
   |                                          |
   |<------- ping ----------------------------|
   |-------- pong (automatic) --------------->|
   |                                          |
```

## Messages

All messages are JSON objects with `type` and `payload` fields:

```typescript
{
  type: string,
  payload: object
}
```

---

### Registration (Client → Server)

Send immediately after WebSocket connection opens.

```json
{
  "type": "registration",
  "payload": {
    "name": "my-client",
    "description": "I handle task management and to-do lists.",
    "version": "1.0.0",
    "capabilities": ["tasks", "reminders"]
  }
}
```

| Field          | Type     | Required | Description                                  |
| -------------- | -------- | -------- | -------------------------------------------- |
| `name`         | string   | Yes      | Unique identifier for your client            |
| `description`  | string   | Yes      | Natural language description for LLM routing |
| `version`      | string   | No       | Your client version (for debugging)          |
| `capabilities` | string[] | No       | Structured capability hints                  |

**Name validation rules:**

- Must start with a letter (a-z, A-Z)
- Only alphanumeric characters, hyphens (`-`), and underscores (`_`)
- Maximum 64 characters
- Must be unique among currently connected clients

**Description requirements:**

- Cannot be empty
- Maximum 1024 characters
- Should be written in natural language

---

### Registration Response (Server → Client)

Sent in response to a registration message.

**Success:**

```json
{
  "type": "registration_response",
  "payload": {
    "success": true,
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Client 'my-client' registered successfully"
  }
}
```

**Failure:**

```json
{
  "type": "registration_response",
  "payload": {
    "success": false,
    "code": "DUPLICATE_NAME",
    "message": "A client with name 'my-client' is already registered"
  }
}
```

| Error Code            | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `INVALID_NAME`        | Name doesn't meet validation rules                    |
| `INVALID_DESCRIPTION` | Description is empty or exceeds 1024 characters       |
| `DUPLICATE_NAME`      | Another client with this name is already connected    |
| `ALREADY_REGISTERED`  | This WebSocket connection already registered a client |
| `VALIDATION_ERROR`    | General validation failure                            |

---

### Routed Message (Server → Client)

A message routed to your client by SmartHole.

```json
{
  "type": "message",
  "payload": {
    "id": "msg-550e8400-e29b-41d4-a716-446655440000",
    "text": "Remember to buy groceries tomorrow",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "metadata": {
      "inputMethod": "voice",
      "directRouted": false,
      "confidence": 0.95,
      "routingReason": "User wants to remember something, which matches this client's note-taking capabilities"
    }
  }
}
```

| Field                    | Type                  | Description                                      |
| ------------------------ | --------------------- | ------------------------------------------------ |
| `id`                     | string                | Unique message ID (use in responses)             |
| `text`                   | string                | The user's transcribed or typed input            |
| `timestamp`              | string                | ISO 8601 timestamp when message was created      |
| `metadata.inputMethod`   | `"voice"` \| `"text"` | How the user provided input                      |
| `metadata.directRouted`  | boolean               | `true` if user used `clientname: message` syntax |
| `metadata.confidence`    | number \| undefined   | STT confidence score (0-1), only for voice input |
| `metadata.routingReason` | string \| undefined   | LLM's explanation for choosing this client       |

---

### Response (Client → Server)

Your response to a routed message. You can send multiple responses for the same message (e.g., ack followed by notification).

#### Acknowledge

Indicates successful receipt/processing:

```json
{
  "type": "response",
  "payload": {
    "messageId": "msg-550e8400-e29b-41d4-a716-446655440000",
    "type": "ack",
    "payload": {}
  }
}
```

#### Reject

Indicates you cannot or choose not to handle the message:

```json
{
  "type": "response",
  "payload": {
    "messageId": "msg-550e8400-e29b-41d4-a716-446655440000",
    "type": "reject",
    "payload": {
      "reason": "I only handle notes, not calendar events"
    }
  }
}
```

When you reject, SmartHole may re-route the message to another client. The rejection reason is provided to the LLM for better routing decisions.

| Field    | Type   | Required | Description                         |
| -------- | ------ | -------- | ----------------------------------- |
| `reason` | string | No       | Explanation of why you're rejecting |

#### Notification

Request SmartHole to show a system notification to the user:

```json
{
  "type": "response",
  "payload": {
    "messageId": "msg-550e8400-e29b-41d4-a716-446655440000",
    "type": "notification",
    "payload": {
      "title": "Note Saved",
      "body": "Your note has been saved to the daily journal.",
      "priority": "normal"
    }
  }
}
```

| Field      | Type                              | Required | Description                                  |
| ---------- | --------------------------------- | -------- | -------------------------------------------- |
| `title`    | string                            | No       | Notification title (defaults to client name) |
| `body`     | string                            | No       | Notification body text                       |
| `priority` | `"low"` \| `"normal"` \| `"high"` | No       | Priority level (defaults to "normal")        |

---

## Connection Health

### Heartbeat

SmartHole sends WebSocket ping frames every **30 seconds**. Your client must respond with pong frames. Most WebSocket libraries handle this automatically.

If no pong is received within **10 seconds**, SmartHole terminates the connection.

### Response Timeout

You have **30 seconds** to respond to a routed message. If no response is received:

- The message is treated as implicitly rejected
- Reason is recorded as "Response timeout"
- SmartHole may attempt to re-route to another client

### Reconnection

When disconnected, implement exponential backoff for reconnection:

```javascript
const BASE_DELAY = 1000; // 1 second
const MAX_DELAY = 30000; // 30 seconds
const MAX_ATTEMPTS = 10;

let attempts = 0;

function reconnect() {
  if (attempts >= MAX_ATTEMPTS) {
    console.error("Max reconnection attempts reached");
    process.exit(1);
  }

  const delay = Math.min(BASE_DELAY * Math.pow(2, attempts), MAX_DELAY);
  attempts++;

  console.log(`Reconnecting in ${delay}ms (attempt ${attempts}/${MAX_ATTEMPTS})...`);
  setTimeout(connect, delay);
}

// Reset attempts on successful connection
ws.on("open", () => {
  attempts = 0;
  // ... registration
});
```

---

## Direct Routing

Users can bypass LLM routing by prefixing their message with your client name:

```
notebook: remember to buy milk
notebook, remember to buy milk
```

Both `:` and `,` work as delimiters. The matching is **case insensitive**.

When direct-routed:

- `metadata.directRouted` is `true`
- `metadata.routingReason` is `undefined`
- The prefix is stripped from `text`

If the user types `notebook: buy milk`, your client receives `text: "buy milk"` (without the prefix).

---

## Multi-Client Routing

SmartHole can route a single message to multiple clients simultaneously. Each client processes independently and sends its own responses.

If you're one of multiple recipients, you'll receive the same message. The `id` will be the same, allowing you to correlate if needed.
