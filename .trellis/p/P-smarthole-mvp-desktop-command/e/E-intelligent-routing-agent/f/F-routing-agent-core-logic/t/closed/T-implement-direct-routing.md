---
id: T-implement-direct-routing
title: Implement Direct Routing Bypass
status: done
priority: high
parent: F-routing-agent-core-logic
prerequisites:
  - T-add-routing-agent-types-and
affectedFiles:
  src/services/direct-routing.ts: Created new service with tryDirectRoute()
    function for direct routing pattern detection
  src/services/direct-routing.test.ts: Added 38 comprehensive tests covering all
    pattern matching scenarios and edge cases
  src/services/index.ts: Added export for direct-routing module
log:
  - >-
    Research phase completed. Analyzed:

    - src/types/routing.ts: DirectRouteResult interface and type guard already
    defined

    - src/services/routing-api.ts: Service pattern with singleton management
    (initializeX, getX, resetX)

    - src/services/client-registry.ts: Example of getting client names via
    getAllClients()

    - src/services/tool-generator.test.ts: Test patterns with vitest, mock
    WebSocket creation

    - src/services/index.ts: Service exports


    Key findings:

    1. DirectRouteResult interface is already defined in routing.ts

    2. Services use singleton pattern with initializeX/getX/resetX

    3. Tests follow describe/it pattern with beforeEach/afterEach for
    setup/teardown

    4. ClientRegistry provides getAllClients() to get client names


    Implementation plan:

    1. Create src/services/direct-routing.ts with tryDirectRoute function

    2. Create src/services/direct-routing.test.ts with comprehensive tests

    3. Export from src/services/index.ts
  - >-
    Implemented direct routing bypass pattern matching that detects explicit
    routing requests in the format `{client_name}: {message}` or `{client_name},
    {message}`.


    Key implementation details:

    - Created `tryDirectRoute()` function that parses the direct routing pattern
    and matches against registered clients

    - Client name matching is case-insensitive but returns original casing from
    registry

    - Message content is trimmed after extraction; empty messages return null

    - Pattern requires client name to start with a letter and can contain
    alphanumeric, dash, or underscore characters

    - Returns null (falls through to LLM routing) when pattern doesn't match OR
    client isn't registered


    All acceptance criteria met:

    1. Detects `{client}: {message}` pattern correctly

    2. Detects `{client}, {message}` pattern correctly  

    3. Case-insensitive client name matching

    4. Returns null when pattern matches but client not registered

    5. Trims whitespace from extracted message

    6. Handles multiline messages (dot-all matching)

    7. Returns original client name casing from registry


    Tests: 38 tests covering colon/comma patterns, case insensitivity, special
    characters, trimming, multiline, and various edge cases.
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
