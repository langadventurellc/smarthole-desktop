---
id: F-routing-ipc-input-pipeline
title: Routing IPC & Input Pipeline Integration
status: in-progress
priority: high
parent: E-intelligent-routing-agent
prerequisites:
  - F-rejection-handling-fallback
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
    services, registered routing IPC handlers; Updated
    popupState.textInput.on('submitted') handler to route messages through
    RoutingAgentService instead of logging a TODO comment. Added async IIFE
    pattern with try-catch for proper error handling when routing services
    aren't initialized.
  src/ipc/routing-handlers.test.ts: Created new test file with 16 unit tests
    covering success cases, error handling, validation, and edge cases for both
    handlers
  src/types/ipc.test.ts: Updated channel count test to 46 and added test for routing channels
log: []
schema: v1.0
childrenIds:
  - T-wire-stt-pipeline-to-routing
  - T-wire-text-input-popup-to
  - T-implement-routing-ipc-handlers
created: 2026-02-01T01:57:40.172Z
updated: 2026-02-01T01:57:40.172Z
---

# Routing IPC & Input Pipeline Integration

## Purpose

Connect the routing agent to the input pipeline so that text and voice inputs are automatically routed to appropriate plugins. This completes the end-to-end flow from user input to plugin delivery.

## Scope

### 1. Input Pipeline Integration

Wire the routing agent into the existing input flow:

**Text Input Flow (from Text Input Popup):**

1. User submits text in popup
2. IPC handler receives text
3. Route via `RoutingAgentService.routeMessage()`
4. Handle routing outcome (success, no clients, failure)

**Voice Input Flow (from STT Pipeline):**

1. STT pipeline transcribes audio
2. Transcription sent via IPC event
3. Route transcribed text via `RoutingAgentService.routeMessage()`
4. Mark source as 'voice' in routing metadata

### 2. IPC Handlers

Create IPC handlers for routing operations:

**Channels:**

- `routing:submit-message` - Submit a message for routing (from renderer)
- `routing:status` - Get routing service status
- `routing:result` - Receive routing result (to renderer)

**Handler Implementation:**

```typescript
// src/ipc/routing-handlers.ts

export function registerRoutingHandlers(): void {
  ipcMain.handle("routing:submit-message", async (event, params) => {
    const { message, source } = params;
    const result = await getRoutingAgent().routeMessage({
      message,
      source: source ?? "text",
    });
    return result;
  });

  ipcMain.handle("routing:status", async () => {
    // Return routing service health status
    return {
      available: hasApiKey(),
      clientCount: getClientRegistry().getClientCount(),
    };
  });
}
```

### 3. Text Input Popup Integration

Update the text input popup to use routing:

- After user submits text, call `routing:submit-message`
- Show visual feedback during routing (optional spinner or status)
- Handle and display routing errors to user
- Close popup after successful routing

**Preload API Addition:**

```typescript
// Add to popupAPI
routeMessage: (message: string) => ipcRenderer.invoke('routing:submit-message', {
  message,
  source: 'text'
}),
```

### 4. STT Pipeline Integration

Connect STT transcription to routing:

- Listen for transcription complete events from STT pipeline
- Automatically route transcribed text
- Include voice source metadata

**Integration Point:**

```typescript
// In main.ts or dedicated integration module
sttPipeline.on("transcription:complete", async (result) => {
  if (result.success) {
    await getRoutingAgent().routeMessage({
      message: result.text,
      source: "voice",
      metadata: {
        audioLength: result.audioLength,
        confidence: result.confidence,
      },
    });
  }
});
```

### 5. Routing Status in Tray

Optionally expose routing status in tray menu:

- Show connected client count
- Show API availability status
- Indicate when routing is ready vs. not configured

### 6. Error Feedback

Provide user-visible feedback for routing issues:

- No API key configured: Prompt to add in settings
- No clients connected: Notify user to start a plugin
- Routing failed: Show notification with helpful message

## Implementation Location

- `src/ipc/routing-handlers.ts` - IPC handlers
- Update `src/preload/popup.ts` - Popup preload additions
- Update `src/main.ts` - Handler registration and STT integration
- Update `src/popup/` - UI integration for routing

## Dependencies

- `F-rejection-handling-fallback` - Complete routing system
- Existing text input popup system
- Existing STT pipeline system

## Acceptance Criteria

1. [ ] IPC handler for `routing:submit-message` implemented
2. [ ] Text input popup submits through routing service
3. [ ] STT transcriptions automatically routed
4. [ ] Voice messages marked with source: 'voice'
5. [ ] Routing status available via IPC
6. [ ] User notified when no API key configured
7. [ ] User notified when no clients connected
8. [ ] Routing errors displayed to user
9. [ ] IPC handlers registered in main.ts
10. [ ] End-to-end flow works: input → routing → plugin delivery
