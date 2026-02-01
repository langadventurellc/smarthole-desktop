---
id: T-add-routing-agent-types-and
title: Add Routing Agent Types and Update Type Exports
status: done
priority: medium
parent: F-routing-agent-core-logic
prerequisites: []
affectedFiles:
  src/types/routing.ts: Added DeliveryInfo interface, RoutingOutcome discriminated
    union, RoutingAgentService interface, DirectRouteResult interface, and type
    guards (isDeliveryInfo, isRoutingOutcome, isDirectRouteResult)
  src/types/routing.test.ts: "Added comprehensive tests for new type guards:
    isDeliveryInfo (12 tests), isRoutingOutcome (17 tests across 3 variant
    groups), isDirectRouteResult (12 tests)"
log:
  - >-
    ## Research Complete


    Analyzed existing codebase patterns:

    - `src/types/routing.ts` already exists with existing routing types

    - Type guards follow consistent pattern checking for object, null, required
    fields, and optional fields

    - Tests exist in `routing.test.ts` with comprehensive guard testing

    - Barrel file already exports routing.ts


    ## Implementation Plan


    1. Add new types to `src/types/routing.ts`:
       - `RoutingOutcome` discriminated union
       - `DeliveryInfo` interface
       - `RoutingAgentService` interface
       - `DirectRouteResult` interface

    2. Add type guards:
       - `isDeliveryInfo`
       - `isRoutingOutcome`
       - `isDirectRouteResult`

    3. Add tests for new type guards in `routing.test.ts`


    4. Run quality checks
  - >-
    Added TypeScript types for the routing agent service to
    `src/types/routing.ts`:


    1. **DeliveryInfo interface** - Tracks information about a message delivery
    to a client (clientName, messageId, directRouted flag, optional reason)


    2. **RoutingOutcome discriminated union** - Represents all possible routing
    outcomes:
       - `routed`: Message(s) successfully delivered with DeliveryInfo array
       - `no_clients`: No clients available with user-friendly message
       - `routing_failed`: Routing failed with error string and fallbackAttempted flag

    3. **RoutingAgentService interface** - Main service interface for routing
    messages with routeMessage method accepting message, source (text/voice),
    and optional metadata


    4. **DirectRouteResult interface** - Result type for direct routing pattern
    detection (clientName, message, directRouted: true)


    5. **Type guards** - Added isDeliveryInfo, isRoutingOutcome, and
    isDirectRouteResult for runtime validation


    All types are automatically exported via the existing barrel file
    (`src/types/index.ts`). Comprehensive tests added for all type guards (30+
    new test cases).
schema: v1.0
childrenIds: []
created: 2026-02-01T02:40:42.525Z
updated: 2026-02-01T02:40:42.525Z
---

# Add Routing Agent Types and Update Type Exports

## Purpose

Define TypeScript types for the routing agent service and export them from the types barrel file.

## Implementation

### New Types in `src/types/routing.ts`

```typescript
// Routing outcome types
export type RoutingOutcome =
  | { type: "routed"; deliveries: DeliveryInfo[] }
  | { type: "no_clients"; message: string }
  | { type: "routing_failed"; error: string; fallbackAttempted: boolean };

export interface DeliveryInfo {
  clientName: string;
  messageId: string;
  directRouted: boolean;
  reason?: string;
}

// Routing agent service interface
export interface RoutingAgentService {
  routeMessage(params: {
    message: string;
    source: "text" | "voice";
    metadata?: Record<string, unknown>;
  }): Promise<RoutingOutcome>;
}

// Direct routing result
export interface DirectRouteResult {
  clientName: string;
  message: string;
  directRouted: true;
}
```

### Type Guards

Add type guards for runtime validation:

```typescript
export function isRoutingOutcome(value: unknown): value is RoutingOutcome {
  // Implementation
}

export function isDeliveryInfo(value: unknown): value is DeliveryInfo {
  // Implementation
}
```

### Update Barrel Export

Ensure new types are exported from `src/types/index.ts`.

## Acceptance Criteria

1. [ ] `RoutingOutcome` type defined with all three variants
2. [ ] `DeliveryInfo` interface defined
3. [ ] `RoutingAgentService` interface defined
4. [ ] `DirectRouteResult` interface defined
5. [ ] Type guards implemented for runtime validation
6. [ ] Types exported from barrel file
