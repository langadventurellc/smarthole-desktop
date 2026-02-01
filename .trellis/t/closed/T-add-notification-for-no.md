---
id: T-add-notification-for-no
title: Add notification for "no clients connected" routing failure
status: done
priority: medium
parent: none
prerequisites: []
affectedFiles:
  src/services/routing-agent.ts: Added showWarning() call before returning
    no_clients outcome (lines 147-150). The notification displays title 'No
    plugins connected' with body explaining the issue and suggesting to start a
    plugin.
log:
  - Starting implementation. Adding showWarning() call in the no_clients case at
    lines 145-151 of src/services/routing-agent.ts, following the pattern used
    in other routing failure notifications (lines 461 and 671).
  - Added showWarning() notification call in the routing agent's no_clients
    case. When routeMessage() is called with no connected clients, a warning
    notification is now shown to the user with the title "No plugins connected"
    and a message explaining that no plugins are connected and suggesting they
    start a plugin. The implementation follows the same pattern as other routing
    failure notifications in the file (lines 461 and 671). All quality checks
    and 1322 tests pass.
schema: v1.0
childrenIds: []
created: 2026-02-01T16:22:42.340Z
updated: 2026-02-01T16:22:42.340Z
---

## Summary

When a user sends a message (via voice or text input) and no plugins are connected, the routing agent logs the failure but does not show a system notification to the user. The message appears to silently vanish, leaving the user with no feedback about what happened.

## Problem

In `src/services/routing-agent.ts:143-151`, the "no clients" case returns early without calling `notificationService.showWarning()`:

```typescript
if (clientCount === 0) {
  this.logger.info("No clients registered, cannot route message");
  return {
    type: "no_clients",
    message: "No plugins are currently connected. Please start a plugin and try again.",
  };
}
```

The comments in `src/main.ts:942-944` and `:1038-1040` incorrectly state "User notification already handled by routing agent" but no notification is actually shown.

## Implementation

Add a `showWarning()` call before returning the `no_clients` outcome, following the pattern used for other failure cases in the same file (see lines 461 and 671 for examples):

```typescript
if (clientCount === 0) {
  this.logger.info("No clients registered, cannot route message");
  this.notificationService.showWarning(
    "No plugins connected",
    "No plugins are currently connected. Please start a plugin and try again."
  );
  return {
    type: "no_clients",
    message: "No plugins are currently connected. Please start a plugin and try again.",
  };
}
```

## Files to Modify

- `src/services/routing-agent.ts` - Add notification call in the `routeMessage` method's no-clients check

## Acceptance Criteria

- [ ] When `routeMessage` is called with no connected clients, a warning notification is shown to the user
- [ ] The notification title is "No plugins connected"
- [ ] The notification body explains that no plugins are connected and suggests starting one
- [ ] Existing unit tests pass
- [ ] The notification follows the same pattern as other routing failure notifications in the file

## Testing

- Run `mise run test` to ensure existing tests pass
- Manual test: Start the app without any plugins connected, use voice or text input to send a message, verify a system notification appears

## Out of Scope

- Adding tests for this specific notification (the notification service is already tested)
- Modifying the comments in `main.ts` (they become accurate once this fix is applied)
- Any changes to notification content or styling
- Adding notifications for other routing outcomes
