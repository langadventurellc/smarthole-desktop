---
id: E-intelligent-routing-agent
title: Intelligent Routing Agent
status: in-progress
priority: high
parent: P-smarthole-mvp-desktop-command
prerequisites:
  - E-foundation-core-infrastructure
  - E-plugin-client-system
affectedFiles:
  package.json: Added @anthropic-ai/sdk dependency (^0.72.1)
  package-lock.json: Updated with @anthropic-ai/sdk and its dependencies
  src/types/errors.ts: Added ROUTING_API_KEY_MISSING, ROUTING_REQUEST_FAILED,
    ROUTING_RATE_LIMITED, and ROUTING_NO_CLIENTS error codes
  src/types/routing.ts: Created new file with RoutingTool, RoutingDecision,
    RoutingError, RoutingResult, RoutingRequestParams, RoutingApiService,
    ToolGeneratorService interfaces and type guards; Added DeliveryInfo
    interface, RoutingOutcome discriminated union, RoutingAgentService
    interface, DirectRouteResult interface, and type guards (isDeliveryInfo,
    isRoutingOutcome, isDirectRouteResult); Added RejectionRecord,
    RejectionHistory, and RoutingAgentEvents interfaces. Extended
    RoutingAgentService interface with on() and off() event subscription
    methods.
  src/types/index.ts: Added export for routing module
  src/utils/error-messages.ts: Added user-facing messages for routing error codes
  src/services/tool-generator.ts: Created new file implementing
    ToolGeneratorService - generates tools from ClientRegistry, caches with
    event-driven invalidation, maintains tool name to client name mapping
  src/services/routing-api.ts: Created new file implementing RoutingApiService -
    wraps Anthropic SDK for Claude Haiku routing, handles errors and rate limit
    retries
  src/services/tool-generator.test.ts: Created comprehensive test suite for tool
    generator - sanitization, generation, caching, event invalidation, client
    name resolution
  src/services/routing-api.test.ts: Created comprehensive test suite for routing
    API - initialization, message routing, error handling, retry logic
  src/services/index.ts: Added exports for tool-generator and routing-api modules;
    Added export for direct-routing module; Added export for routing-agent
    module
  src/types/routing.test.ts: "Added comprehensive tests for new type guards:
    isDeliveryInfo (12 tests), isRoutingOutcome (17 tests across 3 variant
    groups), isDirectRouteResult (12 tests)"
  src/services/direct-routing.ts: Created new service with tryDirectRoute()
    function for direct routing pattern detection
  src/services/direct-routing.test.ts: Added 38 comprehensive tests covering all
    pattern matching scenarios and edge cases
  src/services/routing-agent.ts: Created new RoutingAgent service with singleton
    pattern, system prompt, direct routing integration, LLM routing integration,
    and message delivery; Extended RoutingAgentServiceImpl with rejection
    history tracking, re-routing logic, event emission, and cleanup
    functionality. Added NotificationService dependency. Implemented
    handleRejection(), reRouteMessage(), handleAllClientsRejected(),
    cleanupStaleHistory(), cleanup(), on(), and off() methods.; Added
    attemptDirectRoutingFallback() method. Modified routeViaLlm() to call
    fallback on LLM failures. Fallback attempts direct routing pattern matching
    and shows user notification on complete failure.
  src/services/routing-agent.test.ts: Added 19 comprehensive tests for
    initialization, no clients scenario, direct routing, LLM routing, error
    handling, message metadata, and source handling; Added tests for rejection
    handling and routing events. Added NotificationService initialization. Added
    tests for event subscription/unsubscription and typed event handlers.; Added
    comprehensive test suite 'API failure fallback to direct routing' with 11
    tests covering fallback behavior, event emission, and edge cases. Updated
    existing test to reflect new fallback behavior.
  scripts/test-harness-plugin.ts: Created new test harness plugin script with
    WebSocket client, registration handling, message echo functionality,
    exponential backoff reconnection, graceful shutdown, and CLI flag support
  mise.toml: Added test-plugin task to run the test harness plugin
  src/types/ipc.ts: Added ROUTING_SUBMIT_MESSAGE and ROUTING_GET_STATUS channels,
    routing IPC types (RoutingSubmitMessagePayload,
    RoutingSubmitMessageResponse, RoutingStatusResponse, RoutingInputSource,
    RoutingOutcomeType), type guard isRoutingSubmitMessagePayload, and entries
    in IpcPayloadMap and IpcResponseMap
  src/ipc/routing-handlers.ts: Created new file with createRoutingSubmitHandler
    and createRoutingStatusHandler factory functions for IPC handlers
  src/ipc/index.ts: Added export for routing-handlers module
  src/main.ts: Added imports for routing services and handlers, added routingState
    mutable state, initialized RoutingApi, ToolGenerator, and RoutingAgent
    services, registered routing IPC handlers
  src/ipc/routing-handlers.test.ts: Created new test file with 16 unit tests
    covering success cases, error handling, validation, and edge cases for both
    handlers
  src/types/ipc.test.ts: Updated channel count test to 46 and added test for routing channels
log: []
schema: v1.0
childrenIds:
  - F-anthropic-api-client-tool
  - F-rejection-handling-fallback
  - F-routing-agent-core-logic
  - F-routing-ipc-input-pipeline
  - F-test-harness-plugin
created: 2026-01-29T01:45:26.388Z
updated: 2026-01-29T01:45:26.388Z
---

# Intelligent Routing Agent

## Purpose and Goals

Implement the LLM-powered routing system that analyzes user input and determines which connected plugin(s) should receive the message. Uses Claude Haiku with a tool-based architecture where each registered client is exposed as a callable tool, enabling the LLM to make intelligent routing decisions.

## Major Components and Deliverables

### 1. Anthropic API Integration

- Claude Haiku API client setup using `@anthropic-ai/sdk`
- API key management (from secure storage)
- Request/response handling
- Rate limiting and retry logic (respect API rate limits)
- Error handling (API errors, network failures, timeouts)

### 2. Dynamic Tool Generation

- Generate tool definitions from registered clients
- Tool naming pattern: `route_to_{client_name}` (sanitized)
- Tool parameters: `message` (required), `reason` (optional explanation)
- Tool description: client's description (routing hint)
- Rebuild tool definitions when clients connect/disconnect
- Handle empty client list (no routing possible)

### 3. Routing Agent Logic

- System prompt engineering for routing decisions
- Invoke Claude Haiku with user message and available tools
- Parse tool call responses to determine target client(s)
- Support multi-client routing (multiple tool calls in response)
- Extract routing reason from tool call parameters

### 4. Direct Routing Bypass

- Pattern matching for explicit routing: `{client_name}: {message}` or `{client_name}, {message}`
- Bypass LLM when direct routing pattern detected
- Case-insensitive client name matching
- Mark messages as `directRouted: true` in metadata

### 5. Rejection Handling & Re-routing

- Receive rejection from client (via Plugin Client System)
- Re-invoke routing agent with rejection context
- Exclude rejecting client from available tools
- Maintain rejection history for the message
- Handle case where all clients reject (notify user)

### 6. Fallback Handling

- Handle routing agent API failures gracefully
- Fall back to direct routing pattern matching if available
- Notify user if routing completely fails
- Log all routing decisions and failures

### 7. Test Harness Plugin

A standalone test plugin that mirrors how real plugins work, providing:

- **MVP Validation**: A working plugin to demonstrate the complete flow (input capture → STT → routing → plugin delivery → response)
- **Debugging Tool**: Simple echo functionality useful for troubleshooting the system

**Implementation Approach: External Script**

Create a standalone Node.js script at `scripts/test-harness-plugin.ts` that:

- Connects to the WebSocket server at `ws://127.0.0.1:9473`
- Registers as a plugin with name `test-harness` and a descriptive routing hint
- Echoes received messages back via notification responses
- Logs all activity to console for visibility
- Handles reconnection if the server restarts

This approach mirrors how real plugins work (external process, WebSocket connection) making it valuable for:

- Testing the actual WebSocket communication path
- Validating the registration protocol
- Demonstrating message delivery and response handling
- Serving as reference implementation for plugin developers

**Plugin Behavior:**

1. On startup: Connect and register with description like "A test plugin that echoes messages back. Use for debugging and testing the routing system."
2. On message received: Log to console, send `ack` response, send `notification` response with echoed text
3. On disconnect: Attempt reconnection with backoff
4. On SIGINT: Graceful shutdown

**Mise Task:**

```toml
[tasks.test-plugin]
run = "npx tsx scripts/test-harness-plugin.ts"
description = "Run the test harness plugin"
```

## Technical Considerations

- Use `@anthropic-ai/sdk` for Claude API
- Model: claude-3-haiku for fast, cost-effective routing
- Tool name sanitization: replace spaces/special chars with underscores
- System prompt should emphasize routing accuracy over verbosity
- Consider caching tool definitions to avoid regeneration on every request
- Implement exponential backoff for API rate limit handling

## Open Questions to Resolve

These questions from the project requirements should be addressed during implementation:

1. **System prompt engineering for reliable routing behavior**
   - How directive should the prompt be?
   - Should it include examples of good routing decisions?
   - How to handle ambiguous requests (ask user vs best guess)?

2. **Rejection context representation for re-routing**
   - How to communicate "already tried X, they rejected because Y" to the agent?
   - Should rejection reasons influence which client is tried next?
   - Format: system message, user message addendum, or tool result?

3. **Tool name sanitization rules**
   - What characters to allow/replace in client names?
   - How to handle collision if sanitized names match?

## Dependencies

- **E-foundation-core-infrastructure**: Logging, error handling, types, secure storage
- **E-plugin-client-system**: Client registry, client events, message delivery

## Estimated Scale

5-6 features covering API integration, tool generation, routing logic, direct routing, rejection handling, and test harness plugin

## User Stories

- As a user, my messages are automatically routed to the most appropriate plugin
- As a user, I can directly address a plugin by name (e.g., "calendar: add meeting tomorrow")
- As a user, if a plugin rejects my message, SmartHole tries another appropriate plugin
- As a user, I'm notified if no plugin can handle my message
- As a developer, I can run a test harness plugin to validate the system end-to-end
- As a developer, I can use the test harness as a reference for building my own plugins

## Non-Functional Requirements

- Routing decision latency < 2 seconds (Haiku API call)
- Routing accuracy: correct plugin selected >90% of the time for clear requests
- Direct routing bypass adds < 10ms latency
- Graceful handling of API rate limits (exponential backoff, user notification if persistent)

## Acceptance Criteria

1. [ ] Anthropic SDK integrated with API key from secure storage
2. [ ] Tool definitions generated dynamically from registered clients
3. [ ] Tool names sanitized for valid function names
4. [ ] System prompt guides routing decisions effectively
5. [ ] Claude Haiku invoked with message and tools
6. [ ] Tool call response parsed to determine target client(s)
7. [ ] Multi-client routing supported (multiple tool calls)
8. [ ] Direct routing pattern (`client: message`) bypasses LLM
9. [ ] Direct-routed messages marked with `directRouted: true`
10. [ ] Rejected messages trigger re-routing with context
11. [ ] Rejecting client excluded from re-routing options
12. [ ] User notified when no client can handle message
13. [ ] API failures fall back to direct routing or notify user
14. [ ] All routing decisions logged with reasoning
15. [ ] API rate limits handled gracefully with backoff and user feedback
16. [ ] Test harness plugin script created at `scripts/test-harness-plugin.ts`
17. [ ] Test harness connects, registers, and echoes messages
18. [ ] Test harness includes reconnection logic
19. [ ] Mise task added for running test harness plugin
