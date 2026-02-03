# Response Patterns

How to respond to messages from SmartHole.

## Response Types

| Type           | Purpose             | When to Use                                   |
| -------------- | ------------------- | --------------------------------------------- |
| `ack`          | Acknowledge receipt | You received and will/did process the message |
| `reject`       | Decline to handle   | The message isn't appropriate for your client |
| `notification` | Show user feedback  | You want to display something to the user     |

You can send **multiple responses** for the same message. A common pattern is `ack` followed by `notification`.

## Acknowledge (ack)

Send `ack` to confirm you received and are handling the message.

```javascript
function sendAck(messageId) {
  ws.send(
    JSON.stringify({
      type: "response",
      payload: {
        messageId: messageId,
        type: "ack",
        payload: {},
      },
    })
  );
}
```

**When to use:**

- You've received the message successfully
- You're processing it (or will process it)
- Even if processing is async, ack immediately to prevent timeout

**Important:** The `payload` for `ack` must be an empty object `{}`.

## Reject

Send `reject` when you can't or shouldn't handle this message.

```javascript
function sendReject(messageId, reason) {
  ws.send(
    JSON.stringify({
      type: "response",
      payload: {
        messageId: messageId,
        type: "reject",
        payload: {
          reason: reason, // Optional but recommended
        },
      },
    })
  );
}
```

**When to use:**

- The message doesn't match what your client handles
- You're unable to process it (e.g., required service is down)
- The request is ambiguous and you're not confident you should handle it

**What happens next:**

1. SmartHole may re-route the message to another client
2. Your rejection reason is passed to the LLM for better routing
3. Maximum 3 re-routing attempts before user is notified

**Good rejection reasons:**

```javascript
// Specific and helpful for re-routing
sendReject(id, "I only handle notes, not calendar events");
sendReject(id, "I can't control that device - try the smart home client");
sendReject(id, "I need a specific song name to play music");

// Less helpful but still valid
sendReject(id, "Unable to process this request");
sendReject(id); // No reason - treated as generic rejection
```

## Notification

Request SmartHole to show a system notification to the user.

```javascript
function sendNotification(messageId, title, body, priority = "normal") {
  ws.send(
    JSON.stringify({
      type: "response",
      payload: {
        messageId: messageId,
        type: "notification",
        payload: {
          title: title, // Optional, defaults to client name
          body: body, // Optional
          priority: priority, // 'low', 'normal', or 'high'
        },
      },
    })
  );
}
```

**Priority levels:**
| Priority | Behavior |
|----------|----------|
| `low` | May be batched or delayed |
| `normal` | Standard notification timing |
| `high` | Shown immediately, may include sound |

**Examples:**

```javascript
// Confirmation
sendNotification(id, "Note Saved", "Your note has been added to today's journal");

// Status update
sendNotification(id, "Lights", "Living room lights turned on");

// Error feedback
sendNotification(id, "Error", "Could not find that song in your library", "high");
```

## Common Patterns

### Pattern 1: Ack + Notification

The most common pattern. Acknowledge immediately, then notify with the result.

```javascript
function handleMessage(message) {
  const { id, text } = message;

  // Ack immediately
  sendAck(id);

  // Process the message
  const result = processNote(text);

  // Notify the user
  sendNotification(id, "Note Saved", `Saved: "${text.substring(0, 50)}..."`);
}
```

### Pattern 2: Async Processing

For long-running operations, ack immediately to prevent timeout.

```javascript
async function handleMessage(message) {
  const { id, text } = message;

  // Ack immediately to prevent 30-second timeout
  sendAck(id);

  try {
    // Long-running operation
    const result = await someLongOperation(text);
    sendNotification(id, "Complete", result.summary);
  } catch (error) {
    sendNotification(id, "Error", error.message, "high");
  }
}
```

### Pattern 3: Validation Before Ack

Check if you can handle the message before acknowledging.

```javascript
function handleMessage(message) {
  const { id, text } = message;

  // Validate the message
  if (!canHandle(text)) {
    sendReject(id, "This doesn't look like a note. Try the calendar for events.");
    return;
  }

  // Now ack and process
  sendAck(id);
  processNote(text);
  sendNotification(id, "Note Saved", "Got it!");
}
```

### Pattern 4: Multiple Notifications

You can send multiple notifications for progress updates.

```javascript
async function handleMessage(message) {
  const { id, text } = message;

  sendAck(id);

  sendNotification(id, "Processing", "Starting analysis...", "low");

  const result = await analyze(text);

  sendNotification(id, "Complete", result.summary);
}
```

## Timeout Behavior

You have **30 seconds** to send at least one response (`ack`, `reject`, or `notification`).

If no response is received:

- SmartHole treats it as an implicit rejection
- Reason: "Response timeout"
- The message may be re-routed to another client

**Best practice:** Always `ack` immediately, even for async operations.

## Response Timing Examples

```javascript
// Good - immediate ack
ws.on("message", (data) => {
  const msg = JSON.parse(data);
  if (msg.type === "message") {
    sendAck(msg.payload.id); // Within milliseconds
    processAsync(msg.payload);
  }
});

// Bad - ack after processing
ws.on("message", async (data) => {
  const msg = JSON.parse(data);
  if (msg.type === "message") {
    await slowOperation(msg.payload); // Could take > 30 seconds
    sendAck(msg.payload.id); // Too late - already timed out
  }
});
```

## Error Handling

If something goes wrong during processing, you have options:

```javascript
async function handleMessage(message) {
  const { id, text } = message;

  sendAck(id); // Ack first

  try {
    await process(text);
    sendNotification(id, "Done", "Task completed");
  } catch (error) {
    // Option 1: Notify the user of the error
    sendNotification(id, "Error", error.message, "high");

    // Option 2: Reject so SmartHole can re-route (if appropriate)
    // Note: This is unusual after an ack, but valid
    // sendReject(id, `Processing failed: ${error.message}`);
  }
}
```
