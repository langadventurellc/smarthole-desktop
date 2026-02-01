---
id: T-add-api-failure-fallback-to
title: Add API failure fallback to direct routing in RoutingAgent
status: done
priority: medium
parent: F-rejection-handling-fallback
prerequisites:
  - T-add-rejection-history
affectedFiles:
  src/services/routing-agent.ts: Added attemptDirectRoutingFallback() method.
    Modified routeViaLlm() to call fallback on LLM failures. Fallback attempts
    direct routing pattern matching and shows user notification on complete
    failure.
  src/services/routing-agent.test.ts: Added comprehensive test suite 'API failure
    fallback to direct routing' with 11 tests covering fallback behavior, event
    emission, and edge cases. Updated existing test to reflect new fallback
    behavior.
log:
  - >-
    Started implementation. Research complete:

    - Reviewed routing-agent.ts - understand routeViaLlm() method and existing
    flow

    - Reviewed routing types - understand RoutingOutcome with routing_failed and
    fallbackAttempted field

    - Reviewed direct-routing.ts - understand tryDirectRoute() function for
    fallback

    - Reviewed existing tests for test patterns


    Implementation plan:

    1. Modify routeViaLlm() to attempt direct routing as fallback when LLM fails

    2. Set fallbackAttempted field appropriately

    3. Show user notification when complete routing failure occurs

    4. Add comprehensive tests for fallback behavior
  - >-
    Implemented API failure fallback to direct routing in RoutingAgent.


    Key changes:

    1. Added `attemptDirectRoutingFallback()` method that attempts direct
    routing pattern matching when LLM routing fails

    2. Modified `routeViaLlm()` to call fallback on: API failures, no routing
    decisions, and all deliveries failing

    3. Fallback shows user notification with title "Routing unavailable" and
    helpful message about direct routing syntax when complete failure occurs

    4. Sets `fallbackAttempted: true` in `routing_failed` outcomes when fallback
    was attempted

    5. Properly emits `routing:failed` event when routing completely fails

    6. Logs all fallback attempts with context


    Tests added:

    - Falls back to direct routing when LLM API fails

    - Falls back to direct routing when LLM returns no decisions

    - Falls back to direct routing when all LLM deliveries fail

    - Returns routing_failed with fallbackAttempted=true when no direct route
    found

    - Emits routing:failed event when fallback fails

    - Emits routing:success when fallback succeeds

    - Avoids double-attempt for direct routing messages

    - Handles fallback delivery failure gracefully

    - Preserves original error message in failure outcome

    - Stores rejection history for fallback delivery
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
