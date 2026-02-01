---
id: T-implement-direct-routing
title: Implement Direct Routing Bypass
status: open
priority: high
parent: F-routing-agent-core-logic
prerequisites:
  - T-add-routing-agent-types-and
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T02:40:36.761Z
updated: 2026-02-01T02:40:36.761Z
---

# Implement Direct Routing Bypass

## Purpose

Implement pattern matching logic that detects explicit routing requests in the format `{client_name}: {message}` or `{client_name}, {message}` and bypasses the LLM call entirely.

## Implementation

### Pattern Detection

```typescript
interface DirectRouteResult {
  clientName: string; // The matched client name (original casing from registry)
  message: string; // The message content after the prefix
  directRouted: true; // Marker for metadata
}

function tryDirectRoute(message: string, availableClients: string[]): DirectRouteResult | null {
  // Match pattern: "clientname: message" or "clientname, message"
  // - Client name: starts with letter, contains alphanumeric/dash/underscore
  // - Separator: colon or comma followed by optional whitespace
  // - Message: everything after (can be multiline)
  const match = message.match(/^([a-zA-Z][a-zA-Z0-9_-]*)[,:]\\s*(.+)$/s);
  if (!match) return null;

  const [, clientName, actualMessage] = match;

  // Case-insensitive client name lookup
  const matchedClient = availableClients.find((c) => c.toLowerCase() === clientName.toLowerCase());

  if (!matchedClient) return null;

  return {
    clientName: matchedClient, // Use original casing from registry
    message: actualMessage.trim(),
    directRouted: true,
  };
}
```

### Behavior

1. **Case Insensitive** - "NOTEBOOK: note" matches client "notebook"
2. **Return Original Casing** - The matched client name uses registry casing
3. **Trim Message** - Remove leading/trailing whitespace from extracted message
4. **Fallback to LLM** - If pattern matches but client not found, return null (fall through to LLM routing)
5. **Mark Metadata** - Set `directRouted: true` on the resulting message

### Integration Points

This function should be called in `RoutingAgentService.routeMessage()`:

1. Before calling `RoutingApiService.routeMessage()`
2. If result is non-null, skip LLM and deliver directly
3. Include `directRouted: true` in delivery info

### Test Cases

```typescript
// Matches
"notebook: Buy milk" → { clientName: "notebook", message: "Buy milk", directRouted: true }
"home-assistant, turn on lights" → { clientName: "home-assistant", message: "turn on lights", directRouted: true }
"NOTEBOOK: TEST" → { clientName: "notebook", message: "TEST", directRouted: true } // case insensitive

// No match (falls through to LLM)
"please note: something" → null  // "please note" not a registered client
"notebook buy milk" → null       // no separator
": message" → null               // no client name
"123app: test" → null            // client name doesn't start with letter
```

## Acceptance Criteria

1. [ ] Detects `{client}: {message}` pattern correctly
2. [ ] Detects `{client}, {message}` pattern correctly
3. [ ] Case-insensitive client name matching
4. [ ] Returns null when pattern matches but client not registered
5. [ ] Trims whitespace from extracted message
6. [ ] Handles multiline messages (dot-all matching)
7. [ ] Returns original client name casing from registry
