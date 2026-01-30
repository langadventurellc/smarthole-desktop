---
id: T-expose-message-delivery-to
title: Expose message delivery to renderer via IPC
status: done
priority: medium
parent: F-message-delivery-to-clients
prerequisites:
  - T-implement-core-message
affectedFiles:
  src/types/ipc.ts: Added 4 new IPC channels (MESSAGE_SEND, MESSAGE_SEND_MULTIPLE,
    MESSAGE_GET_STATUS, MESSAGE_GET_RECENT), IpcDeliveryResult,
    IpcDeliveryStatus, IpcRoutedMessage types for IPC serialization, and
    payload/response types for all new channels. Updated IpcPayloadMap and
    IpcResponseMap.
  src/ipc/message-delivery-handlers.ts: Created new file with handler factory
    functions (createMessageSendHandler, createMessageSendMultipleHandler,
    createMessageGetStatusHandler, createMessageGetRecentHandler) and
    registerMessageDeliveryHandlers convenience function. Includes type
    conversion helpers for branded types and Map serialization.
  src/ipc/message-delivery-handlers.test.ts: Created new test file with 11 unit
    tests covering all handlers, error handling when service not initialized,
    Map-to-array serialization, and proper type conversion.
  src/preload.ts: "Added 4 new methods to electronAPI: sendMessage,
    sendMessageMultiple, getMessageStatus, getRecentDeliveries with full
    TypeScript types."
  src/main.ts: Registered message delivery IPC handlers using
    registerMessageDeliveryHandlers inside app.whenReady().
  src/types/ipc.test.ts: Updated test for channel count (9 to 13), updated naming
    convention regex to allow camelCase actions, added test for new message
    delivery channels.
log:
  - >-
    Research phase completed. Examined:

    - Existing IPC handlers: notification-handler.ts, log-handler.ts,
    websocket-status-handler.ts

    - Handler patterns: factory function pattern for handlers, buildXxx helper
    functions for status

    - preload.ts structure: methods grouped by domain, invoke for
    request/response, send for fire-and-forget

    - IPC types: IPC_CHANNELS const, IpcPayloadMap, IpcResponseMap for type
    safety

    - Message delivery service: DeliveryResult, DeliveryStatus types,
    sendToClient, sendToClients, getDeliveryStatus, getRecentDeliveries methods


    Implementation plan:

    1. Add IPC channels to types/ipc.ts

    2. Create message-delivery-handlers.ts with handlers following
    websocket-status-handler.ts pattern

    3. Update preload.ts with new methods

    4. Register handlers in main.ts

    5. Write unit tests
  - Implemented IPC handlers to expose message delivery service to the renderer
    process. Added 4 new IPC channels (message:send, message:sendMultiple,
    message:getStatus, message:getRecent) with full type safety. Created handler
    factory functions following existing patterns, with proper Map-to-array
    serialization for IPC transport. Updated preload.ts with 4 new methods
    (sendMessage, sendMessageMultiple, getMessageStatus, getRecentDeliveries).
    Registered handlers in main.ts. Added 11 unit tests covering all handlers,
    error cases, and serialization. All quality checks and 523 tests pass.
schema: v1.0
childrenIds: []
created: 2026-01-30T19:49:44.449Z
updated: 2026-01-30T19:49:44.449Z
---

# Expose Message Delivery to Renderer via IPC

## Context

The renderer process needs to be able to send messages to clients and view delivery status. This task exposes the message delivery service via Electron IPC.

**Related:**

- Feature: `F-message-delivery-to-clients`
- Depends on: `T-implement-core-message` (core delivery service)
- Existing IPC pattern: `src/ipc/` directory
- Preload bridge: `src/preload.ts`

## Requirements

### IPC Channels

Add the following IPC channels:

```typescript
// Main → Renderer (invoke/handle)
"message:send"; // Send message to single client
"message:sendMultiple"; // Send message to multiple clients
"message:getStatus"; // Get delivery status for a message
"message:getRecent"; // Get recent delivery history
```

### Preload API

Expose in `window.electron`:

```typescript
interface ElectronAPI {
  // Existing...

  // New message delivery methods
  sendMessage(clientName: string, message: RoutedMessage): Promise<DeliveryResult>;
  sendMessageMultiple(
    clientNames: string[],
    message: RoutedMessage
  ): Promise<Map<string, DeliveryResult>>;
  getMessageStatus(messageId: string): Promise<DeliveryStatus | null>;
  getRecentDeliveries(limit?: number): Promise<DeliveryStatus[]>;
}
```

### Type Safety

- Use proper TypeScript types in preload definitions
- Serialize/deserialize Map properly for IPC (convert to/from array of entries)

## Technical Approach

1. **Create IPC handler file** at `src/ipc/message-delivery-handlers.ts` following existing patterns
2. **Register handlers** in main.ts during initialization
3. **Update preload.ts** with new contextBridge methods
4. **Update types** in `src/types/` for the API exposed to renderer

### Handler Implementation

```typescript
// src/ipc/message-delivery-handlers.ts
import { ipcMain } from "electron";
import { getMessageDelivery } from "../services/message-delivery";

export function registerMessageDeliveryHandlers(): void {
  ipcMain.handle("message:send", async (_, clientName: string, message: RoutedMessage) => {
    const delivery = getMessageDelivery();
    return delivery.sendToClient(clientName, message);
  });

  // ... other handlers
}
```

### Main.ts Integration

Register handlers inside `app.whenReady()` after message delivery service is initialized.

## Acceptance Criteria

1. [ ] IPC handlers registered in main.ts
2. [ ] `sendMessage` callable from renderer and delivers to client
3. [ ] `sendMessageMultiple` delivers to all specified clients
4. [ ] `getMessageStatus` returns status or null
5. [ ] `getRecentDeliveries` returns array of recent statuses
6. [ ] TypeScript types properly defined for renderer API
7. [ ] Map serialization/deserialization works correctly
8. [ ] Unit tests for IPC handlers

## Out of Scope

- React UI components for message sending
- Event subscriptions for response notifications (could be added later)
- Direct WebSocket access from renderer
