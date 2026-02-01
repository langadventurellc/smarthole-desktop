---
id: T-implement-routing-agent
title: Implement Routing Agent Service
status: done
priority: high
parent: F-routing-agent-core-logic
prerequisites:
  - T-add-routing-agent-types-and
  - T-implement-direct-routing
affectedFiles:
  src/services/routing-agent.ts: Created new RoutingAgent service with singleton
    pattern, system prompt, direct routing integration, LLM routing integration,
    and message delivery
  src/services/routing-agent.test.ts: Added 19 comprehensive tests for
    initialization, no clients scenario, direct routing, LLM routing, error
    handling, message metadata, and source handling
  src/services/index.ts: Added export for routing-agent module
log:
  - >-
    Research phase complete. Analyzed:

    - src/types/routing.ts - DeliveryInfo, RoutingOutcome, RoutingAgentService
    interfaces

    - src/services/direct-routing.ts - tryDirectRoute() function

    - src/services/routing-api.ts - RoutingApiService singleton pattern

    - src/services/message-delivery.ts - MessageDeliveryService, RoutedMessage
    creation

    - src/services/tool-generator.ts - ToolGeneratorService for generating
    routing tools

    - src/services/client-registry.ts - ClientRegistryService for checking
    clients

    - src/types/messages.ts - RoutedMessage, MessageMetadata structure

    - src/types/common.ts - createMessageId, createTimestamp utilities


    Key findings:

    1. Follow singleton pattern with
    initializeRoutingAgent/getRoutingAgent/resetRoutingAgent

    2. Use crypto.randomUUID() for message IDs

    3. Integration with RoutingApiService, ToolGeneratorService,
    MessageDeliveryService, ClientRegistryService

    4. Direct routing bypasses LLM calls

    5. Need to create RoutedMessage with proper metadata


    Starting implementation.
  - >-
    Implemented the RoutingAgent service that orchestrates message routing by
    combining direct routing detection, LLM-based routing via RoutingApiService,
    and message delivery via MessageDeliveryService.


    Key features implemented:

    1. Singleton pattern
    (initializeRoutingAgent/getRoutingAgent/resetRoutingAgent)

    2. Direct routing detection via tryDirectRoute - bypasses LLM for
    "clientname: message" pattern

    3. LLM routing via RoutingApiService with a well-crafted system prompt

    4. Message delivery via MessageDeliveryService with proper RoutedMessage
    creation

    5. No clients handling returns user-friendly "no_clients" outcome

    6. Proper message metadata including inputMethod, directRouted, and
    routingReason

    7. Multi-client routing support for LLM decisions

    8. Partial delivery failure handling - continues delivering to other clients

    9. Comprehensive logging of all routing decisions

    10. 19 comprehensive tests covering all scenarios
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
