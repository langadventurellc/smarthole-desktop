---
id: T-add-api-failure-fallback-to
title: Add API failure fallback to direct routing in RoutingAgent
status: open
priority: medium
parent: F-rejection-handling-fallback
prerequisites:
  - T-add-rejection-history
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T04:05:04.205Z
updated: 2026-02-01T04:05:04.205Z
---

# Add API failure fallback to direct routing in RoutingAgent

## Purpose

Implement graceful fallback handling when the routing API fails, attempting direct routing as a fallback before notifying the user of complete failure.

## Scope

### 1. API Failure Detection

Identify routing API failures that should trigger fallback:

- Network errors (connection failures, timeouts)
- Rate limit exhausted (after retries exhausted)
- Other API errors (500s, etc.)

The existing `routeViaLlm()` method returns `routing_failed` outcomes - use these as trigger points.

### 2. Fallback Chain

When LLM routing fails:

1. Check if direct routing was already attempted (avoid double-attempt)
2. If direct routing wasn't tried yet, attempt pattern matching
3. If direct route found, deliver message and return success
4. If no direct route found, notify user of routing failure

### 3. User Notification for Complete Failure

When both LLM and direct routing fail:

- Use NotificationService to show warning:
  - Title: "Routing unavailable"
  - Body: "Unable to determine the best plugin for your message. Please try again or use direct routing (e.g., 'notebook: your message')."
- Include helpful tip about direct routing syntax in the notification

### 4. Update RoutingOutcome

The existing `routing_failed` outcome has `fallbackAttempted: boolean`:

- Set to `true` when fallback was attempted
- Set to `false` when no fallback was possible (e.g., direct routing already tried)

### 5. Logging

Log all fallback attempts with context:

- Why the original routing failed
- Whether fallback was attempted
- Result of fallback attempt
- Final outcome

## Implementation Location

- `src/services/routing-agent.ts` - Modify `routeMessage()` and `routeViaLlm()` methods

## Dependencies

- NotificationService (existing) for user feedback
- Direct routing (existing) via `tryDirectRoute()`
- T-add-rejection-history for routing events infrastructure

## Acceptance Criteria

1. [ ] API failures trigger fallback to direct routing
2. [ ] Fallback only attempted if direct routing wasn't already tried
3. [ ] Direct routing fallback success returns `routed` outcome
4. [ ] User notified when routing completely fails (via NotificationService)
5. [ ] Notification includes direct routing syntax tip
6. [ ] `fallbackAttempted` flag correctly set in failure outcomes
7. [ ] All fallback attempts logged with context
8. [ ] Emit `routing:failed` event when routing completely fails

## Testing

- Unit tests for fallback flow when LLM fails
- Unit tests for no double-attempt of direct routing
- Unit tests for user notification on complete failure
- Unit tests for fallbackAttempted flag
- Unit tests for routing:failed event emission
