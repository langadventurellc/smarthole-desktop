# Troubleshooting

Common issues and how to fix them.

## Connection Issues

### "Connection refused" / ECONNREFUSED

**Symptom:** Client can't connect to `ws://127.0.0.1:9473`

**Causes:**

1. SmartHole isn't running
2. SmartHole's WebSocket server failed to start
3. Another application is using port 9473

**Solutions:**

1. Start SmartHole from your Applications folder
2. Check SmartHole's logs for startup errors
3. If port conflict, SmartHole needs to be configured for a different port (check Settings)

### Connection closes immediately after opening

**Symptom:** WebSocket connects but closes within seconds

**Causes:**

1. Not sending registration message
2. Registration message is malformed
3. Client name validation failed

**Solutions:**

1. Send registration immediately in the `open` event handler
2. Verify your registration message matches the expected format
3. Check the close code and reason - SmartHole provides error details

```javascript
ws.on("close", (code, reason) => {
  console.log(`Closed: ${code} - ${reason.toString()}`);
});
```

### "Forbidden: Non-localhost connections not allowed"

**Symptom:** HTTP 403 when connecting

**Cause:** You're trying to connect from a different machine

**Solution:** SmartHole only accepts connections from localhost. Your client must run on the same machine as SmartHole.

---

## Registration Issues

### INVALID_NAME

**Symptom:** Registration fails with `INVALID_NAME` error

**Cause:** Your client name doesn't meet validation rules

**Rules:**

- Must start with a letter (a-z, A-Z)
- Only alphanumeric characters, hyphens, and underscores
- Maximum 64 characters

**Examples:**

```javascript
// Invalid
"123client"; // Starts with number
"my client"; // Contains space
"my.client"; // Contains period
""; // Empty

// Valid
"my-client";
"myClient";
"my_client_v2";
"NoteTaker";
```

### INVALID_DESCRIPTION

**Symptom:** Registration fails with `INVALID_DESCRIPTION` error

**Causes:**

1. Description is empty
2. Description exceeds 1024 characters

**Solution:** Provide a non-empty description under 1024 characters.

### DUPLICATE_NAME

**Symptom:** Registration fails with `DUPLICATE_NAME` error

**Cause:** Another client with the same name is already connected

**Solutions:**

1. Use a unique name for your client
2. Check if you have another instance of your client running
3. If your previous instance crashed, wait a moment for SmartHole to detect the disconnect

### ALREADY_REGISTERED

**Symptom:** Registration fails with `ALREADY_REGISTERED` error

**Cause:** You sent a second registration message on the same WebSocket connection

**Solution:** Only send one registration message per connection. If you need to re-register, close the connection and create a new one.

---

## Message Handling Issues

### Not receiving messages

**Symptom:** Client is registered but never receives messages

**Causes:**

1. Your description doesn't match any user messages
2. Another client's description is a better match
3. User is routing directly to a different client

**Solutions:**

1. Test with direct routing: `yourclientname: test message`
2. Review and improve your description (see [Writing Descriptions](./writing-descriptions.md))
3. Make your description more specific to your use case

### Messages timing out

**Symptom:** SmartHole reports "Response timeout" for your messages

**Cause:** You're not responding within 30 seconds

**Solution:** Always send an `ack` immediately when you receive a message, even if processing takes time:

```javascript
function handleMessage(message) {
  // ACK IMMEDIATELY
  sendAck(message.id);

  // Then do your slow processing
  processAsync(message);
}
```

### "Unknown message type" warnings

**Symptom:** Your client logs warnings about unknown message types

**Cause:** SmartHole may send new message types in future versions

**Solution:** This is expected. Log and ignore unknown types:

```javascript
switch (message.type) {
  case "registration_response":
    // handle
    break;
  case "message":
    // handle
    break;
  default:
    console.debug(`Unknown message type: ${message.type}`);
  // Don't crash - just ignore
}
```

---

## Response Issues

### Notifications not appearing

**Symptom:** You send notification responses but user doesn't see them

**Causes:**

1. System notifications are disabled for SmartHole
2. Notifications are being rate-limited
3. "Do Not Disturb" mode is active

**Solutions:**

1. Check system notification settings for SmartHole
2. Don't send excessive notifications - they may be throttled
3. Check system DND status

### Rejection not triggering re-routing

**Symptom:** You reject a message but it doesn't go to another client

**Causes:**

1. No other clients are connected
2. Maximum re-routing attempts (3) reached
3. The message was direct-routed

**Note:** Direct-routed messages (`metadata.directRouted: true`) are not re-routed when rejected - the user explicitly chose your client.

---

## Connection Stability Issues

### Frequent disconnections

**Symptom:** Client keeps getting disconnected

**Causes:**

1. Not responding to heartbeat pings
2. Network issues
3. SmartHole is restarting

**Solutions:**

1. Most WebSocket libraries handle ping/pong automatically. If using a low-level library, ensure you respond to pings.
2. Implement reconnection with exponential backoff
3. This is normal during SmartHole updates - reconnect automatically

### "Terminating stale connection" in SmartHole logs

**Symptom:** SmartHole terminates your connection citing no heartbeat response

**Cause:** Your client isn't responding to WebSocket ping frames

**Solution:** Use a WebSocket library that handles ping/pong automatically. If implementing manually:

```javascript
ws.on("ping", () => {
  ws.pong();
});
```

---

## Debugging Tips

### Enable verbose logging

Add timestamps and structured data to your logs:

```javascript
function log(level, message, data = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...data,
    })
  );
}
```

### Test with the test harness

SmartHole includes a test harness plugin. Run it alongside your client to compare behavior:

```bash
# From SmartHole repository
mise run test-plugin
```

### Use direct routing for testing

Bypass LLM routing to test your client directly:

```
yourclientname: test message
```

This confirms your client is registered and receiving messages.

### Check SmartHole logs

SmartHole logs client connections, registrations, and message routing. Look for:

- Client connection/disconnection events
- Registration success/failure
- Routing decisions
- Delivery results

### Inspect WebSocket frames

Use a WebSocket debugging tool to see raw frames:

- **wscat**: `npx wscat -c ws://127.0.0.1:9473`
- **websocat**: `websocat ws://127.0.0.1:9473`

---

## Getting Help

If you're still stuck:

1. Check the [Protocol Reference](./protocol-reference.md) for exact message formats
2. Review the [Reference Implementation](./reference-implementation.md) for working code
3. Open an issue on the SmartHole GitHub repository with:
   - Your client code (minimal reproduction)
   - SmartHole version
   - Error messages or unexpected behavior
   - Steps to reproduce
