---
id: T-implement-routing-agent
title: Implement Routing Agent Service
status: open
priority: high
parent: F-routing-agent-core-logic
prerequisites:
  - T-add-routing-agent-types-and
  - T-implement-direct-routing
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T02:40:22.274Z
updated: 2026-02-01T02:40:22.274Z
---

# Implement Routing Agent Service

## Purpose

Create the main routing agent service that orchestrates message routing by combining direct routing detection, LLM-based routing via `RoutingApiService`, and message delivery via `MessageDeliveryService`.

## Implementation

### File Location

- `src/services/routing-agent.ts`

### Service Interface

```typescript
interface RoutingAgentService {
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

### Routing Flow

1. **Check for registered clients** - If none, return `no_clients` outcome
2. **Try direct routing** - Check for `{client_name}: {message}` pattern
3. **If direct routing matched** - Bypass LLM, deliver directly
4. **If no direct match** - Call `RoutingApiService.routeMessage()` with tools and system prompt
5. **Deliver messages** - Use `MessageDeliveryService.sendToClient()` for each routing decision
6. **Return outcome** - Include delivery info for each routed message

### Dependencies

- `RoutingApiService` (existing) - for LLM-based routing
- `ToolGeneratorService` (existing) - for generating tools from clients
- `MessageDeliveryService` (existing) - for delivering messages
- `ClientRegistry` (existing) - for checking client availability
- System prompt (defined in this task)

### System Prompt

Define a constant system prompt that:

- Establishes the agent's role as a message router
- Instructs it to analyze user intent and call appropriate routing tools
- Allows multiple tool calls for multi-client routing
- Encourages providing a reason for routing decisions
- Directs it to always attempt routing (no conversational responses)

### Singleton Pattern

Follow existing patterns:

- `initializeRoutingAgent()` - creates singleton instance
- `getRoutingAgent()` - retrieves instance
- `resetRoutingAgent()` - for testing

### Logging

Log all routing decisions with context:

- Message source (text/voice)
- Whether direct routing was used
- Which clients received the message
- Any routing failures

## Acceptance Criteria

1. [ ] Service follows singleton pattern
2. [ ] System prompt guides routing decisions effectively
3. [ ] Integrates with existing `RoutingApiService` for LLM calls
4. [ ] Creates `RoutedMessage` objects with proper structure (id, content, metadata)
5. [ ] Uses `MessageDeliveryService` for delivery
6. [ ] Empty client list returns user-friendly `no_clients` outcome
7. [ ] All routing decisions logged with context
8. [ ] Multi-client routing supported (multiple routing decisions → multiple deliveries)
