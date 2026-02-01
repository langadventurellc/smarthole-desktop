---
id: T-implement-routing-ipc-handlers
title: Implement routing IPC handlers
status: done
priority: high
parent: F-routing-ipc-input-pipeline
prerequisites: []
affectedFiles:
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
log:
  - >-
    Started implementation. Researched codebase patterns:

    - IPC handlers follow factory function pattern: `createXHandler(deps,
    logger)` returning `(event, payload?) => Promise<Response>`

    - IPC channels defined in src/types/ipc.ts as const object with IPC_CHANNELS

    - Handlers registered in main.ts using `ipcMain.handle(channel, handlerFn)`

    - Payload and response types added to IpcPayloadMap and IpcResponseMap

    - Handler files export individual factory functions, not a registration
    function (though some do use registerXHandlers pattern)

    - Tests mock services and logger, check handler behavior


    Plan:

    1. Add ROUTING_SUBMIT_MESSAGE and ROUTING_GET_STATUS channels to
    IPC_CHANNELS

    2. Add RoutingSubmitMessagePayload, RoutingSubmitMessageResponse, and
    RoutingStatusResponse types

    3. Add type guard for RoutingSubmitMessagePayload

    4. Create routing-handlers.ts with createRoutingSubmitHandler and
    createRoutingStatusHandler

    5. Export from ipc/index.ts

    6. Register handlers in main.ts (along with RoutingAgent initialization
    which already exists)

    7. Write unit tests
  - >-
    Implemented routing IPC handlers that allow renderer processes to submit
    messages for routing and query routing service status.


    Key changes:

    1. Added IPC channel definitions (ROUTING_SUBMIT_MESSAGE,
    ROUTING_GET_STATUS) to src/types/ipc.ts

    2. Added routing IPC types (RoutingSubmitMessagePayload,
    RoutingSubmitMessageResponse, RoutingStatusResponse, RoutingInputSource,
    RoutingOutcomeType)

    3. Added type guard isRoutingSubmitMessagePayload for payload validation

    4. Created src/ipc/routing-handlers.ts with createRoutingSubmitHandler and
    createRoutingStatusHandler

    5. Exported routing-handlers from src/ipc/index.ts

    6. Registered handlers in main.ts along with initialization of RoutingApi,
    ToolGenerator, and RoutingAgent services

    7. Created comprehensive unit tests (16 tests) in
    src/ipc/routing-handlers.test.ts

    8. Updated channel count test in src/types/ipc.test.ts


    The handlers:

    - createRoutingSubmitHandler: Validates payload, calls
    RoutingAgentService.routeMessage(), and maps RoutingOutcome to IPC response
    format

    - createRoutingStatusHandler: Checks if API key is configured and returns
    client count for status display
schema: v1.0
childrenIds: []
created: 2026-02-01T05:17:15.440Z
updated: 2026-02-01T05:17:15.440Z
---

# Implement Routing IPC Handlers

## Purpose

Create IPC handlers that allow renderer processes to submit messages for routing and query routing service status. This enables the text input popup and other UI components to trigger message routing through the RoutingAgentService.

## Implementation

### 1. Add IPC Channel Definitions

Add new channels to `src/types/ipc.ts`:

```typescript
// Routing channels
ROUTING_SUBMIT_MESSAGE: "routing:submitMessage",   // Submit message for routing
ROUTING_GET_STATUS: "routing:getStatus",           // Get routing service status
ROUTING_RESULT: "routing:result",                  // Broadcast routing result to renderer
```

### 2. Add IPC Types

Add to `src/types/ipc.ts`:

```typescript
// ============================================================================
// Routing IPC Types
// ============================================================================

/** Payload for routing:submitMessage IPC channel */
export interface RoutingSubmitMessagePayload {
  /** The message text to route */
  message: string;
  /** Input source: 'text' or 'voice' */
  source: "text" | "voice";
  /** Optional metadata about the input */
  metadata?: Record<string, unknown>;
}

/** Response for routing:submitMessage IPC channel */
export interface RoutingSubmitMessageResponse {
  /** Whether routing succeeded */
  success: boolean;
  /** Routing outcome type */
  outcomeType: "routed" | "no_clients" | "routing_failed";
  /** Number of clients the message was delivered to (if routed) */
  deliveryCount?: number;
  /** Error message if routing failed */
  error?: string;
}

/** Response for routing:getStatus IPC channel */
export interface RoutingStatusResponse {
  /** Whether the routing service is available (API key configured) */
  available: boolean;
  /** Number of connected clients that can receive messages */
  clientCount: number;
}
```

Add to IpcPayloadMap and IpcResponseMap.

### 3. Create Routing Handlers File

Create `src/ipc/routing-handlers.ts`:

```typescript
/**
 * IPC handlers for message routing operations.
 * Bridges the RoutingAgentService to IPC channels.
 */

import { IpcMainInvokeEvent } from "electron";
import { getRoutingAgent } from "../services/routing-agent";
import { getClientRegistry } from "../services/client-registry";
import { getCredentialManager } from "../services/credential-manager";
import { Logger } from "../services/logger";
import {
  RoutingSubmitMessagePayload,
  RoutingSubmitMessageResponse,
  RoutingStatusResponse,
  IPC_CHANNELS,
} from "../types";

export function createRoutingSubmitHandler(
  logger: Logger
): (
  event: IpcMainInvokeEvent,
  payload: RoutingSubmitMessagePayload
) => Promise<RoutingSubmitMessageResponse> {
  return async (_event, payload) => {
    // Validate payload
    // Call getRoutingAgent().routeMessage()
    // Map RoutingOutcome to RoutingSubmitMessageResponse
  };
}

export function createRoutingStatusHandler(
  logger: Logger
): (event: IpcMainInvokeEvent) => Promise<RoutingStatusResponse> {
  return async () => {
    // Check if API key is configured
    // Get client count from registry
    // Return status
  };
}

export function registerRoutingHandlers(ipcMain: Electron.IpcMain, logger: Logger): void {
  ipcMain.handle(IPC_CHANNELS.ROUTING_SUBMIT_MESSAGE, createRoutingSubmitHandler(logger));
  ipcMain.handle(IPC_CHANNELS.ROUTING_GET_STATUS, createRoutingStatusHandler(logger));
  logger.info("Routing IPC handlers registered");
}
```

### 4. Register Handlers in main.ts

Add to main.ts after RoutingAgent initialization:

```typescript
// Register routing IPC handlers
const routingLogger = logger.child({ component: "RoutingIPC" });
registerRoutingHandlers(ipcMain, routingLogger);
```

### 5. Export from IPC Index

Update `src/ipc/index.ts` to export the routing handlers.

## Dependencies

- Requires `RoutingAgentService` to be initialized (already done in main.ts via epic F-rejection-handling-fallback)
- Requires `ClientRegistry` for status checking
- Requires `CredentialManager` for API key availability check

## Acceptance Criteria

1. [ ] IPC channel constants defined in types/ipc.ts
2. [ ] IPC payload/response types defined with type guards
3. [ ] routing-handlers.ts created with submit and status handlers
4. [ ] Handlers registered in main.ts
5. [ ] Handlers exported from ipc/index.ts
6. [ ] Unit tests for routing handlers
