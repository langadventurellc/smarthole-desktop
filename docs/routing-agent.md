# Routing Agent

Orchestrates message routing by combining direct pattern matching, LLM-based routing, and message delivery. The routing agent is the central service that receives user input and determines which plugin(s) should handle the message.

## Overview

The routing agent provides a single entry point for all message routing:

1. **Direct Routing**: Pattern matching for explicit client targeting (e.g., `notebook: remember this`)
2. **LLM Routing**: Claude Haiku-based intelligent routing when no direct pattern matches
3. **Message Delivery**: Forwards routed messages to clients via MessageDeliveryService

## Architecture

```
User Input (text or voice)
         |
         v
+------------------+
| RoutingAgent     |
+------------------+
         |
    +----+----+
    |         |
    v         v
+--------+  +------------+     +------------------+
| Direct |  | LLM Routing|---->| RoutingApiService|
| Route? |  | (Haiku)    |     +------------------+
+--------+  +------------+
    |              |
    +------+-------+
           |
           v
+------------------+
| MessageDelivery  |
+------------------+
           |
           v
     Clients (via WebSocket)
```

## Initialization

```typescript
import { initializeRoutingAgent, getRoutingAgent } from "./services/routing-agent";

app.whenReady().then(async () => {
  // After all dependencies are initialized:
  // - Logger
  // - ClientRegistry
  // - RoutingApiService
  // - ToolGeneratorService
  // - MessageDeliveryService

  initializeRoutingAgent();
});
```

## Usage

```typescript
import { getRoutingAgent } from "./services/routing-agent";

const agent = getRoutingAgent();

const outcome = await agent.routeMessage({
  message: "Turn on the living room lights",
  source: "text", // or "voice"
  metadata: { sessionId: "abc123" },
});

switch (outcome.type) {
  case "routed":
    console.log(`Delivered to ${outcome.deliveries.length} client(s)`);
    for (const delivery of outcome.deliveries) {
      console.log(`  - ${delivery.clientName} (${delivery.messageId})`);
    }
    break;

  case "no_clients":
    console.log(outcome.message);
    // "No plugins are currently connected. Please start a plugin and try again."
    break;

  case "routing_failed":
    console.error(`Routing failed: ${outcome.error}`);
    break;
}
```

## Direct Routing

Direct routing allows users to explicitly target a client using a prefix pattern:

- **Colon syntax**: `clientname: message content`
- **Comma syntax**: `clientname, message content`

### Behavior

- **Case insensitive**: `Notebook: test` matches client `notebook`
- **Registry casing preserved**: The matched client name uses the casing from the registry
- **LLM bypass**: Direct-routed messages skip the Claude API call entirely
- **Fallback**: If the pattern matches but the client doesn't exist, falls through to LLM routing

### Examples

```typescript
// Matches - routes directly to notebook
"notebook: remember to buy milk"; // -> { clientName: "notebook", message: "remember to buy milk" }

// Matches with comma
"home-assistant, turn on lights"; // -> { clientName: "home-assistant", message: "turn on lights" }

// Case insensitive
"NOTEBOOK: test"; // -> { clientName: "notebook", message: "test" }

// No match - client not in registry
"please note: something"; // -> null (falls through to LLM routing)

// No match - missing message
"notebook:"; // -> null (falls through to LLM routing)
```

## Routing Outcomes

The `routeMessage` method returns a discriminated union with three possible outcomes:

### Routed

```typescript
{
  type: "routed",
  deliveries: [
    {
      clientName: "notebook",
      messageId: "msg-abc123",
      directRouted: true,
      reason: undefined  // Only present for LLM-routed messages
    }
  ]
}
```

### No Clients

```typescript
{
  type: "no_clients",
  message: "No plugins are currently connected. Please start a plugin and try again."
}
```

### Routing Failed

```typescript
{
  type: "routing_failed",
  error: "API request failed: 500 Internal Server Error",
  fallbackAttempted: false
}
```

## Message Metadata

Routed messages include metadata about how they were routed:

```typescript
interface RoutedMessageMetadata {
  inputMethod: "text" | "voice";
  directRouted: boolean;
  routingReason?: string; // LLM's explanation for the routing decision
}
```

## System Prompt

The LLM routing uses a carefully designed system prompt:

- **Role**: Message router, not an assistant
- **Always route**: Must call at least one tool per message
- **Multi-routing**: Can route to multiple clients when appropriate
- **Full message**: Passes complete user message, not summaries
- **Include reasons**: Provides routing rationale when possible

## Dependencies

| Service                | Purpose                     |
| ---------------------- | --------------------------- |
| ClientRegistry         | Check registered clients    |
| RoutingApiService      | LLM-based routing decisions |
| ToolGeneratorService   | Generate tools from clients |
| MessageDeliveryService | Send messages to clients    |

Initialize dependencies in this order:

1. Logger
2. ClientRegistry
3. ToolGenerator
4. RoutingApi
5. MessageDelivery
6. **RoutingAgent** (last)

## Singleton Pattern

```typescript
// Initialize once in main.ts (inside app.whenReady())
initializeRoutingAgent();

// Retrieve anywhere
const agent = getRoutingAgent();

// Reset for testing
resetRoutingAgent();
```

## Testing

```bash
mise run test src/services/routing-agent.test.ts
mise run test src/services/direct-routing.test.ts
mise run test src/types/routing.test.ts
```

## Related Documentation

- [Routing API](routing-api.md) - LLM routing and tool generation details
- [Message Delivery](message-delivery.md) - How messages reach clients
- [Client Registration](client-registration.md) - How clients register and describe themselves
