# Getting Started

Build a working SmartHole client in 5 minutes.

## Prerequisites

- SmartHole desktop app running on your machine
- Node.js 18+ (or your preferred language with WebSocket support)

## Step 1: Create a New Project

```bash
mkdir my-smarthole-client
cd my-smarthole-client
npm init -y
npm install ws
```

## Step 2: Write the Client

Create `index.js`:

```javascript
const WebSocket = require("ws");

// Configuration
const SMARTHOLE_URL = "ws://127.0.0.1:9473";
const CLIENT_NAME = "my-first-client";
const CLIENT_DESCRIPTION = "A test client that echoes messages back as notifications.";

let ws = null;

function connect() {
  console.log("Connecting to SmartHole...");
  ws = new WebSocket(SMARTHOLE_URL);

  ws.on("open", () => {
    console.log("Connected! Sending registration...");

    ws.send(
      JSON.stringify({
        type: "registration",
        payload: {
          name: CLIENT_NAME,
          description: CLIENT_DESCRIPTION,
          version: "1.0.0",
        },
      })
    );
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    handleMessage(msg);
  });

  ws.on("close", (code, reason) => {
    console.log(`Disconnected: ${code} ${reason}`);
    // Reconnect after 3 seconds
    setTimeout(connect, 3000);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });
}

function handleMessage(msg) {
  switch (msg.type) {
    case "registration_response":
      if (msg.payload.success) {
        console.log(`Registered as "${CLIENT_NAME}" (ID: ${msg.payload.clientId})`);
      } else {
        console.error(`Registration failed: ${msg.payload.code} - ${msg.payload.message}`);
        process.exit(1);
      }
      break;

    case "message":
      handleRoutedMessage(msg.payload);
      break;

    default:
      console.log("Unknown message type:", msg.type);
  }
}

function handleRoutedMessage(message) {
  console.log(`\nReceived message [${message.id}]:`);
  console.log(`  Text: "${message.text}"`);
  console.log(`  Input: ${message.metadata.inputMethod}`);
  console.log(`  Direct routed: ${message.metadata.directRouted}`);

  // Send acknowledgment
  ws.send(
    JSON.stringify({
      type: "response",
      payload: {
        messageId: message.id,
        type: "ack",
        payload: {},
      },
    })
  );
  console.log("  Sent: ack");

  // Send a notification to show the user we received it
  ws.send(
    JSON.stringify({
      type: "response",
      payload: {
        messageId: message.id,
        type: "notification",
        payload: {
          title: "Message Received",
          body: `You said: ${message.text}`,
          priority: "normal",
        },
      },
    })
  );
  console.log("  Sent: notification");
}

// Start the client
connect();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  if (ws) {
    ws.close(1000, "Client shutting down");
  }
  process.exit(0);
});
```

## Step 3: Run It

```bash
node index.js
```

You should see:

```
Connecting to SmartHole...
Connected! Sending registration...
Registered as "my-first-client" (ID: abc123-...)
```

## Step 4: Test It

1. Use SmartHole's text input (hotkey or tray menu)
2. Type: `my-first-client: hello world`
3. Your client receives the message and shows a notification

The `my-first-client:` prefix triggers **direct routing**, bypassing the LLM. For normal routing, just type a message that matches your description.

## Step 5: Customize the Description

Edit the `CLIENT_DESCRIPTION` to match what your client actually does:

```javascript
// Bad - too vague
const CLIENT_DESCRIPTION = "Handles stuff.";

// Good - specific and natural
const CLIENT_DESCRIPTION =
  "I manage your personal notes, journal entries, and things you want to remember for later.";
```

The description is what the routing LLM uses to decide if your client should receive a message. See [Writing Descriptions](./writing-descriptions.md) for best practices.

## What's Next?

- **[Protocol Reference](./protocol-reference.md)** - Learn all message types
- **[Response Patterns](./response-patterns.md)** - When to ack, reject, or notify
- **[Reference Implementation](./reference-implementation.md)** - Production-ready TypeScript example
- **[Troubleshooting](./troubleshooting.md)** - Fix common issues
