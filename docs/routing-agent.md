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
| MessageDelivery  |<---+
+------------------+    |
           |            |
           v            |
     Clients (WebSocket)|
           |            |
           v            |
     +----------+       |
     | Rejection|-------+ (re-route)
     +----------+
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
  // - NotificationService

  initializeRoutingAgent();
});
```

## Input Pipeline Integration

The routing agent is wired into the application's input pipeline in `main.ts`. Both text and voice inputs automatically flow through the routing system:

**Text Input (from Text Input Popup):**

```
User types → Popup submits → popupState.textInput 'submitted' event → RoutingAgent.routeMessage()
```

**Voice Input (from STT Pipeline):**

```
User speaks → Audio captured → STT transcribes → sttPipeline 'transcriptionReady' event → RoutingAgent.routeMessage()
```

Voice inputs include additional metadata:

- `audioDurationMs` - Length of the audio recording
- `confidence` - STT confidence score (if available)
- `sttBackend` - Which STT backend was used (e.g., "groq-whisper")
- `sttProcessingTimeMs` - How long transcription took

## IPC Access

Renderer processes can submit messages and query status via IPC:

| Channel                 | Direction     | Payload                       | Response                       |
| ----------------------- | ------------- | ----------------------------- | ------------------------------ |
| `routing:submitMessage` | Renderer→Main | `RoutingSubmitMessagePayload` | `RoutingSubmitMessageResponse` |
| `routing:getStatus`     | Renderer→Main | (none)                        | `RoutingStatusResponse`        |

### IPC Types

```typescript
interface RoutingSubmitMessagePayload {
  message: string;
  source: "text" | "voice";
  metadata?: Record<string, unknown>;
}

interface RoutingSubmitMessageResponse {
  success: boolean;
  outcomeType: "routed" | "no_clients" | "routing_failed";
  deliveryCount?: number;
  error?: string;
}

interface RoutingStatusResponse {
  available: boolean; // API key configured
  clientCount: number; // Connected plugins
}
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

## Rejection Handling & Re-routing

When a client rejects a message, the routing agent automatically attempts to re-route:

1. **Rejection recorded**: Client rejection is added to the message's history
2. **Re-routing triggered**: LLM is called again with rejection context
3. **Excluded clients**: Previously-rejected clients are excluded from new routing
4. **Limit enforced**: Maximum 3 rejections (or available client count, whichever is lower)
5. **User notified**: If all clients reject, user sees a notification with details

### Rejection Flow

```typescript
// Rejection context sent to LLM:
// "Previous routing attempt: Routed to 'notebook' but they rejected because: 'Not a note'"
// "Please route to a different, more appropriate plugin."
```

### Constants

| Constant                | Value     | Description                           |
| ----------------------- | --------- | ------------------------------------- |
| `MAX_REJECTIONS`        | 3         | Maximum re-route attempts per message |
| `REJECTION_HISTORY_TTL` | 5 minutes | How long rejection history is kept    |
| `CLEANUP_INTERVAL`      | 1 minute  | Interval for cleaning stale history   |

## API Failure Fallback

When LLM routing fails (API error, timeout, no decisions), the agent falls back to direct routing:

1. **LLM fails**: Network error, rate limit, or empty response
2. **Direct routing attempted**: Pattern matching tried on original message
3. **Fallback succeeds**: Message delivered via direct route
4. **Fallback fails**: User notified with routing unavailable message

The `fallbackAttempted` field in `RoutingOutcome` indicates whether fallback was tried.

## Routing Events

Subscribe to routing events for observability:

```typescript
import { getRoutingAgent } from "./services/routing-agent";

const agent = getRoutingAgent();

// Message successfully routed (initial or re-route)
agent.on("routing:success", (messageId, clientName, isReRoute) => {
  console.log(`Routed ${messageId} to ${clientName}${isReRoute ? " (re-route)" : ""}`);
});

// All available clients rejected the message
agent.on("routing:rejected", (messageId, rejections) => {
  console.log(`All clients rejected ${messageId}:`, rejections);
});

// Routing system failed (API error, no clients, etc.)
agent.on("routing:failed", (messageId, error) => {
  console.error(`Routing failed for ${messageId}: ${error}`);
});

// Unsubscribe
agent.off("routing:success", myHandler);
```

### Event Types

| Event              | Parameters                                    | Description                    |
| ------------------ | --------------------------------------------- | ------------------------------ |
| `routing:success`  | `(messageId, clientName, isReRoute: boolean)` | Message delivered successfully |
| `routing:rejected` | `(messageId, rejections: RejectionRecord[])`  | All clients rejected           |
| `routing:failed`   | `(messageId, error: string)`                  | Routing system error           |

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

| Service                | Purpose                         |
| ---------------------- | ------------------------------- |
| ClientRegistry         | Check registered clients        |
| RoutingApiService      | LLM-based routing decisions     |
| ToolGeneratorService   | Generate tools from clients     |
| MessageDeliveryService | Send messages, rejection events |
| NotificationService    | User notifications for failures |

Initialize dependencies in this order:

1. Logger
2. ClientRegistry
3. ToolGenerator
4. RoutingApi
5. MessageDelivery
6. NotificationService
7. **RoutingAgent** (last)

## Singleton Pattern

```typescript
// Initialize once in main.ts (inside app.whenReady())
initializeRoutingAgent();

// Retrieve anywhere
const agent = getRoutingAgent();

// Reset for testing (also calls cleanup())
resetRoutingAgent();
```

## Cleanup

The routing agent subscribes to MessageDeliveryService events and maintains internal timers. Call `cleanup()` or `resetRoutingAgent()` to release resources:

```typescript
// Manual cleanup (unsubscribes from events, clears timers and history)
agent.cleanup();

// Or via reset (for testing)
resetRoutingAgent();
```

## Testing

```bash
mise run test src/services/routing-agent.test.ts
mise run test src/services/direct-routing.test.ts
mise run test src/types/routing.test.ts
mise run test src/ipc/routing-handlers.test.ts
```

## Related Documentation

- [Routing API](routing-api.md) - LLM routing and tool generation details
- [Message Delivery](message-delivery.md) - How messages reach clients
- [Client Registration](client-registration.md) - How clients register and describe themselves
