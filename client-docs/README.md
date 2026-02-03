# SmartHole Client Developer Guide

Build plugins that receive voice and text commands from SmartHole.

## What is SmartHole?

SmartHole is a desktop application that captures user input (voice or text) and intelligently routes it to connected client plugins. You speak or type a command, and SmartHole's routing agent decides which plugin should handle it.

**Example flow:**

1. User says: "Remember to buy milk tomorrow"
2. SmartHole transcribes the audio
3. Routing agent analyzes the message and your plugin's description
4. Your "notebook" plugin receives the message
5. Your plugin saves the note and sends a confirmation notification

## Quick Links

| Document                                                  | Description                                 |
| --------------------------------------------------------- | ------------------------------------------- |
| [Getting Started](./getting-started.md)                   | Connect your first client in 5 minutes      |
| [Protocol Reference](./protocol-reference.md)             | Complete WebSocket message specification    |
| [Writing Descriptions](./writing-descriptions.md)         | How to write effective routing descriptions |
| [Response Patterns](./response-patterns.md)               | When to ack, reject, or notify              |
| [Reference Implementation](./reference-implementation.md) | Annotated TypeScript example                |
| [Troubleshooting](./troubleshooting.md)                   | Common issues and solutions                 |

## Key Concepts

### Localhost-Only Communication

SmartHole's WebSocket server binds to `127.0.0.1:9473`. Connections from other machines are rejected. This means:

- No authentication is required
- Your client must run on the same machine as SmartHole
- Communication is inherently secure

### Description-Based Routing

SmartHole uses an LLM (Claude Haiku) to route messages. The **only thing the LLM sees** about your client is the `description` field you provide during registration. Write it like you're explaining to a person what your plugin handles.

### Fire-and-Forget Delivery

SmartHole delivers messages but doesn't queue them. If your client is disconnected when a message arrives, that message is lost. Design your client to stay connected and reconnect automatically.

## Supported Languages

SmartHole uses standard WebSocket protocol. Any language with WebSocket support works:

- **TypeScript/JavaScript**: Use `ws` package (Node.js) or native WebSocket (browser/Deno)
- **Python**: Use `websockets` or `websocket-client`
- **Go**: Use `gorilla/websocket`
- **Rust**: Use `tungstenite` or `tokio-tungstenite`
- **Any other language**: If it has WebSocket support, it works

## Minimal Example (Node.js)

```javascript
const WebSocket = require("ws");

const ws = new WebSocket("ws://127.0.0.1:9473");

ws.on("open", () => {
  // Register immediately after connecting
  ws.send(
    JSON.stringify({
      type: "registration",
      payload: {
        name: "my-plugin",
        description: "I handle task management and to-do lists.",
        version: "1.0.0",
      },
    })
  );
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);

  if (msg.type === "registration_response") {
    if (msg.payload.success) {
      console.log("Registered successfully!");
    } else {
      console.error("Registration failed:", msg.payload.message);
    }
  }

  if (msg.type === "message") {
    console.log("Received:", msg.payload.text);

    // Acknowledge the message
    ws.send(
      JSON.stringify({
        type: "response",
        payload: {
          messageId: msg.payload.id,
          type: "ack",
          payload: {},
        },
      })
    );
  }
});
```

## Next Steps

1. **[Getting Started](./getting-started.md)** - Build a working client step by step
2. **[Protocol Reference](./protocol-reference.md)** - Understand every message type
3. **[Writing Descriptions](./writing-descriptions.md)** - Make routing work well for your use case
