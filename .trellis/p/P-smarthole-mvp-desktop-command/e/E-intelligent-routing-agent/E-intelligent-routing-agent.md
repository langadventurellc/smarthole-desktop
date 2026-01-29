---
id: E-intelligent-routing-agent
title: Intelligent Routing Agent
status: open
priority: high
parent: P-smarthole-mvp-desktop-command
prerequisites:
  - E-foundation-core-infrastructure
  - E-plugin-client-system
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
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

4-5 features covering API integration, tool generation, routing logic, direct routing, and rejection handling

## User Stories

- As a user, my messages are automatically routed to the most appropriate plugin
- As a user, I can directly address a plugin by name (e.g., "calendar: add meeting tomorrow")
- As a user, if a plugin rejects my message, SmartHole tries another appropriate plugin
- As a user, I'm notified if no plugin can handle my message

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
