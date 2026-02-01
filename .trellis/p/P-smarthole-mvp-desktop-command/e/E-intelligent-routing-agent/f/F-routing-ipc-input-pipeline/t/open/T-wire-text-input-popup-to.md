---
id: T-wire-text-input-popup-to
title: Wire text input popup to routing service
status: open
priority: high
parent: F-routing-ipc-input-pipeline
prerequisites:
  - T-implement-routing-ipc-handlers
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T05:17:29.945Z
updated: 2026-02-01T05:17:29.945Z
---

# Wire Text Input Popup to Routing Service

## Purpose

Connect the text input popup's submit flow to the routing service so that text entered by users is automatically routed to appropriate plugins.

## Current State

The text input popup currently:

1. User submits text via `popupAPI.submit()`
2. IPC handler receives the text and emits a `submitted` event
3. main.ts listens for `submitted` and has a TODO comment (lines 894-899):
   ```typescript
   popupState.textInput.on("submitted", (payload) => {
     logger.info("Text input ready for processing", {
       textLength: payload.text.length,
     });
     // TODO: Route to message processing in future task
   });
   ```

## Implementation

### 1. Update main.ts Event Handler

Replace the TODO with actual routing:

```typescript
// Import at top
import { getRoutingAgent } from "./services/routing-agent";

// In the submitted handler
popupState.textInput.on("submitted", async (payload) => {
  logger.info("Text input submitted, routing message", {
    textLength: payload.text.length,
  });

  try {
    const routingAgent = getRoutingAgent();
    const outcome = await routingAgent.routeMessage({
      message: payload.text,
      source: "text",
    });

    if (outcome.type === "no_clients") {
      // User notification already handled by routing agent
      logger.info("No clients available for text routing");
    } else if (outcome.type === "routing_failed") {
      // User notification already handled by routing agent
      logger.warn("Text routing failed", { error: outcome.error });
    } else {
      logger.info("Text message routed successfully", {
        deliveryCount: outcome.deliveries.length,
      });
    }
  } catch (error) {
    logger.error("Unexpected error routing text message", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

### 2. Handle Edge Cases

The routing agent already handles:

- No clients connected → shows notification
- No API key → falls back to direct routing, then shows notification
- Routing failure → shows notification with helpful message

No additional error handling needed in the popup integration.

### 3. Optional: Show Loading State

Consider adding a brief loading indicator in the popup before it closes. This would require:

- Adding an IPC channel for routing status feedback
- Updating the popup UI to show a spinner

This is optional and can be deferred - the popup closes immediately and routing happens async.

## Dependencies

- Task: "Implement routing IPC handlers" (must be completed first to ensure RoutingAgent is fully initialized)
- RoutingAgentService must be initialized in main.ts

## Acceptance Criteria

1. [ ] Text submitted via popup is routed through RoutingAgentService
2. [ ] Source is correctly set to "text"
3. [ ] Routing outcomes are logged appropriately
4. [ ] Error handling catches unexpected exceptions
5. [ ] No duplicate notifications (routing agent handles user feedback)
