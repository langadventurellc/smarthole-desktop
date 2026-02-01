# Routing API

Intelligent message routing using Claude 4.5 Haiku to determine which registered clients should handle user requests.

## Overview

The routing system uses Claude 4.5 Haiku (via the `claude-haiku-4-5` model alias) with tool calling to analyze user messages and route them to appropriate clients. Tools are dynamically generated from the client registry, and routing decisions include both the target client and the transformed message.

> **Note**: The routing API uses Claude model aliases (e.g., `claude-haiku-4-5`) which automatically point to the latest model snapshots, ensuring you always use the most up-to-date version without code changes.

> **Note**: This document covers the low-level routing API components. For the high-level orchestration layer that combines direct routing, LLM routing, and message delivery, see [Routing Agent](routing-agent.md).

## Architecture

```
User Message
     |
     v
+----------------+     +------------------+
| RoutingApi     |---->| Anthropic SDK    |
|                |     | (Claude 4.5)     |
+----------------+     +------------------+
     |                        |
     v                        v
+----------------+     +------------------+
| ToolGenerator  |     | Tool Definitions |
|                |<----| from Registry    |
+----------------+     +------------------+
     |
     v
ClientRegistry
```

## Services

### ToolGenerator

Generates Claude tool definitions from registered clients. Tools are cached and automatically invalidated when clients connect or disconnect.

#### Initialization

```typescript
import { initializeToolGenerator, getToolGenerator } from "./services/tool-generator";

// Inside app.whenReady(), after client registry
initializeToolGenerator();

// Later retrieval
const toolGenerator = getToolGenerator();
```

#### API

| Method                                             | Description                               |
| -------------------------------------------------- | ----------------------------------------- |
| `generateTools(): RoutingTool[]`                   | Generate tools for all registered clients |
| `generateToolsExcluding(names): RoutingTool[]`     | Generate tools excluding specific clients |
| `resolveClientName(toolName): string \| undefined` | Map tool name back to client name         |

#### Tool Naming

Tools are named using the pattern `route_to_{sanitized_name}`:

- Non-alphanumeric characters become underscores
- Leading underscores are removed
- Names not starting with a letter get `client_` prefix

Examples:

- `notebook` -> `route_to_notebook`
- `home-assistant` -> `route_to_home_assistant`
- `123app` -> `route_to_client_123app`

#### Tool Schema

Each generated tool has:

```typescript
{
  name: "route_to_notebook",
  description: "Client's description field",
  input_schema: {
    type: "object",
    properties: {
      message: { type: "string", description: "The message to route to this client" },
      reason: { type: "string", description: "Explanation for why this client was chosen" }
    },
    required: ["message"]
  }
}
```

### RoutingApi

Wraps the Anthropic SDK to invoke Claude 4.5 Haiku for routing decisions.

#### Initialization

```typescript
import { initializeRoutingApi, getRoutingApi } from "./services/routing-api";

// Inside app.whenReady(), after credential manager and tool generator
initializeRoutingApi();

// Later retrieval
const routingApi = getRoutingApi();
```

#### API

```typescript
interface RoutingApiService {
  routeMessage(params: RoutingRequestParams): Promise<RoutingResult>;
}

interface RoutingRequestParams {
  userMessage: string;
  tools: RoutingTool[];
  systemPrompt: string;
  excludeClients?: string[]; // For re-routing after rejection
  rejectionContext?: string; // Context from previous rejection
}

type RoutingResult =
  | { success: true; decisions: RoutingDecision[] }
  | { success: false; error: RoutingError };

interface RoutingDecision {
  clientName: string;
  message: string;
  reason?: string;
}
```

#### Usage

```typescript
const toolGenerator = getToolGenerator();
const routingApi = getRoutingApi();

const result = await routingApi.routeMessage({
  userMessage: "Turn on the living room lights",
  tools: toolGenerator.generateTools(),
  systemPrompt: "Route user requests to appropriate clients...",
});

if (result.success) {
  for (const decision of result.decisions) {
    console.log(`Route to ${decision.clientName}: ${decision.message}`);
  }
} else {
  console.error(`Routing failed: ${result.error.message}`);
}
```

#### Re-routing After Rejection

When a client rejects a message, the routing can be retried with context:

```typescript
const result = await routingApi.routeMessage({
  userMessage: "Turn on the living room lights",
  tools: toolGenerator.generateToolsExcluding(["home-assistant"]),
  systemPrompt: "...",
  excludeClients: ["home-assistant"],
  rejectionContext: "home-assistant rejected: Device not found",
});
```

## API Key Configuration

The routing API retrieves the Anthropic API key from the credential manager:

- **Credential Key**: `anthropic-api-key`
- **Configuration**: Via Settings UI or credential manager API
- **Security**: Key is never exposed to renderer process

See [Credential System](credential-system.md) for details.

## Error Handling

### Error Codes

| Code                      | Description                       | Retryable |
| ------------------------- | --------------------------------- | --------- |
| `ROUTING_API_KEY_MISSING` | API key not configured or invalid | No        |
| `ROUTING_REQUEST_FAILED`  | API request failed                | No        |
| `ROUTING_RATE_LIMITED`    | Rate limit exceeded               | Yes       |
| `ROUTING_NO_CLIENTS`      | No clients available for routing  | No        |

### Rate Limit Retry

Rate limit errors (HTTP 429) are automatically retried with exponential backoff:

- Initial delay: 1 second
- Maximum retries: 3
- Backoff multiplier: 2x

### Authentication Errors

Invalid API keys trigger client invalidation, prompting re-initialization with fresh credentials on the next request.

## Caching

Tool definitions are cached and lazily rebuilt:

- **Cache Invalidation**: On `registered` or `unregistered` registry events
- **Rebuild Trigger**: Next call to `generateTools()` after invalidation
- **Client Mapping**: Tool-to-client name mapping maintained alongside cache

## Singleton Pattern

Both services follow the standard singleton pattern:

```typescript
// Initialize once in main.ts (inside app.whenReady())
initializeToolGenerator();
initializeRoutingApi();

// Retrieve anywhere
const toolGenerator = getToolGenerator();
const routingApi = getRoutingApi();

// Reset for testing
resetToolGenerator();
resetRoutingApi();
```

## Dependencies

The routing services depend on:

- **ToolGenerator**: ClientRegistry (for client information and events)
- **RoutingApi**: CredentialManager (for API key), ToolGenerator (for client resolution)

Initialize in order: `ClientRegistry` -> `ToolGenerator` -> `RoutingApi`

## Testing

```bash
mise run test src/services/tool-generator.test.ts
mise run test src/services/routing-api.test.ts
mise run test src/types/routing.test.ts
```
