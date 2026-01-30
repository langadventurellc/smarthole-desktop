---
id: T-expose-message-delivery-to
title: Expose message delivery to renderer via IPC
status: open
priority: medium
parent: F-message-delivery-to-clients
prerequisites:
  - T-implement-core-message
affectedFiles: {}
log: []
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
