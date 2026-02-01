---
id: F-routing-agent-core-logic
title: Routing Agent Core Logic
status: in-progress
priority: high
parent: E-intelligent-routing-agent
prerequisites:
  - F-anthropic-api-client-tool
affectedFiles:
  src/types/routing.ts: Added DeliveryInfo interface, RoutingOutcome discriminated
    union, RoutingAgentService interface, DirectRouteResult interface, and type
    guards (isDeliveryInfo, isRoutingOutcome, isDirectRouteResult)
  src/types/routing.test.ts: "Added comprehensive tests for new type guards:
    isDeliveryInfo (12 tests), isRoutingOutcome (17 tests across 3 variant
    groups), isDirectRouteResult (12 tests)"
  src/services/direct-routing.ts: Created new service with tryDirectRoute()
    function for direct routing pattern detection
  src/services/direct-routing.test.ts: Added 38 comprehensive tests covering all
    pattern matching scenarios and edge cases
  src/services/index.ts: Added export for direct-routing module
log: []
schema: v1.0
childrenIds:
  - T-implement-direct-routing
  - T-implement-routing-agent
  - T-add-routing-agent-types-and
created: 2026-02-01T01:56:15.123Z
updated: 2026-02-01T01:56:15.123Z
---

# Routing Agent Core Logic

## Purpose

Implement the core routing agent that analyzes user input and determines which connected plugin(s) should receive the message. This is the "brain" of the intelligent routing system.

## Scope

### 1. Routing Agent Service

Create the main routing service that orchestrates message routing:

**Service Interface:**

```typescript
interface RoutingAgentService {
  // Route a message to appropriate client(s)
  routeMessage(params: {
    message: string;
    source: "text" | "voice";
    metadata?: Record<string, unknown>;
  }): Promise<RoutingOutcome>;
}

type RoutingOutcome =
  | { type: "routed"; deliveries: DeliveryInfo[] }
  | { type: "no_clients"; message: string }
  | { type: "routing_failed"; error: string; fallbackAttempted: boolean };

interface DeliveryInfo {
  clientName: string;
  messageId: string;
  directRouted: boolean;
  reason?: string;
}
```

### 2. System Prompt Engineering

Design an effective system prompt for routing decisions:

- **Clear Role**: The agent is a message router, not an assistant
- **Decision Framework**: Consider client descriptions, capabilities, and message intent
- **Tool Usage**: Must call at least one tool, can call multiple for multi-client routing
- **Reason Parameter**: Encourage providing routing rationale
- **Handling Ambiguity**: When unclear, route to the most likely candidate (don't ask)
- **No Small Talk**: Always attempt routing, never respond conversationally

**System Prompt Template:**

```
You are a message routing agent. Your job is to analyze user messages and route them to the appropriate connected plugins.

Available plugins are provided as tools. Each tool's description explains what that plugin handles.

For each message:
1. Analyze the user's intent
2. Call the appropriate routing tool(s)
3. If multiple plugins could handle the request, you may call multiple tools
4. Include a brief reason in your tool call to explain your routing decision

Always route to at least one plugin. If no plugin seems appropriate, route to the one that's closest to handling the request.
```

### 3. Direct Routing Bypass

Implement pattern matching for explicit routing:

- **Patterns**: `{client_name}: {message}` or `{client_name}, {message}`
- **Case Insensitive**: Match client names regardless of case
- **Bypass LLM**: Skip Haiku invocation when pattern matches
- **Mark Metadata**: Set `directRouted: true` on routed messages
- **Fallback**: If pattern matches but client not found, fall through to LLM routing

**Direct Routing Logic:**

```typescript
function tryDirectRoute(message: string, availableClients: string[]): DirectRouteResult | null {
  // Check for "clientname: message" or "clientname, message" pattern
  const match = message.match(/^([a-zA-Z][a-zA-Z0-9_-]*)[,:]\s*(.+)$/s);
  if (!match) return null;

  const [, clientName, actualMessage] = match;
  const matchedClient = availableClients.find((c) => c.toLowerCase() === clientName.toLowerCase());

  if (!matchedClient) return null;

  return {
    clientName: matchedClient,
    message: actualMessage.trim(),
    directRouted: true,
  };
}
```

### 4. Message Delivery Integration

Integrate with existing `MessageDeliveryService`:

- Create `RoutedMessage` objects with proper structure
- Use `sendToClient` or `sendToClients` for delivery
- Track message IDs for response correlation
- Subscribe to response events for rejection handling

### 5. Empty Client Handling

When no clients are registered:

- Return `no_clients` outcome
- Include user-friendly message: "No plugins are currently connected. Please start a plugin and try again."
- Log the condition for debugging

## Implementation Location

- `src/services/routing-agent.ts` - Main routing service
- Update `src/types/routing.ts` - Additional types

## Dependencies

- `F-anthropic-api-client-tool` - API client and tool generation
- Existing `MessageDeliveryService` for message delivery
- Existing `ClientRegistry` for client information

## Acceptance Criteria

1. [ ] Routing agent service created with singleton pattern
2. [ ] System prompt effectively guides routing decisions
3. [ ] Direct routing pattern detection works (case-insensitive)
4. [ ] Direct-routed messages bypass LLM call
5. [ ] Direct-routed messages marked with `directRouted: true`
6. [ ] Multi-client routing supported (multiple tool calls)
7. [ ] Routing decisions include reason when LLM provides one
8. [ ] Empty client list handled gracefully with user message
9. [ ] Messages delivered via MessageDeliveryService
10. [ ] All routing decisions logged with context
