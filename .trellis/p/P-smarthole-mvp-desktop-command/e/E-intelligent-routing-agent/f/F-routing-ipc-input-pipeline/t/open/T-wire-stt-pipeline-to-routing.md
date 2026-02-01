---
id: T-wire-stt-pipeline-to-routing
title: Wire STT pipeline to routing service
status: open
priority: high
parent: F-routing-ipc-input-pipeline
prerequisites:
  - T-implement-routing-ipc-handlers
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T05:17:42.477Z
updated: 2026-02-01T05:17:42.477Z
---

# Wire STT Pipeline to Routing Service

## Purpose

Connect the STT pipeline's transcription output to the routing service so that voice input is automatically routed to appropriate plugins after transcription.

## Current State

The STT pipeline currently:

1. Audio is captured and sent to transcription
2. Transcription completes and emits `transcriptionReady` event
3. main.ts listens for the event with a TODO comment (lines 955-962):
   ```typescript
   sttPipelineState.sttPipeline.on("transcriptionReady", (event) => {
     logger.info("Transcription ready for routing", {
       textLength: event.text.length,
       backend: event.sttMetadata.backendUsed,
       processingTimeMs: event.sttMetadata.processingTimeMs,
     });
     // TODO: Route to message processing in future task
   });
   ```

## Implementation

### 1. Update main.ts Event Handler

Replace the TODO with actual routing:

```typescript
// Import at top (may already be imported from text input task)
import { getRoutingAgent } from "./services/routing-agent";

// In the transcriptionReady handler
sttPipelineState.sttPipeline.on("transcriptionReady", async (event) => {
  logger.info("Transcription complete, routing voice message", {
    textLength: event.text.length,
    backend: event.sttMetadata.backendUsed,
    processingTimeMs: event.sttMetadata.processingTimeMs,
  });

  try {
    const routingAgent = getRoutingAgent();
    const outcome = await routingAgent.routeMessage({
      message: event.text,
      source: "voice",
      metadata: {
        audioDurationMs: event.audioMetadata.durationMs,
        confidence: event.confidence,
        sttBackend: event.sttMetadata.backendUsed,
        sttProcessingTimeMs: event.sttMetadata.processingTimeMs,
      },
    });

    if (outcome.type === "no_clients") {
      logger.info("No clients available for voice routing");
    } else if (outcome.type === "routing_failed") {
      logger.warn("Voice routing failed", { error: outcome.error });
    } else {
      logger.info("Voice message routed successfully", {
        deliveryCount: outcome.deliveries.length,
      });
    }
  } catch (error) {
    logger.error("Unexpected error routing voice message", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

### 2. Voice-Specific Metadata

Include voice-specific metadata in the routing call:

- `audioDurationMs` - How long the audio recording was
- `confidence` - STT confidence score
- `sttBackend` - Which STT backend was used (e.g., "groq-whisper")
- `sttProcessingTimeMs` - How long transcription took

This metadata flows through to plugins and can be used for analytics or special handling.

### 3. Edge Cases

The routing agent handles these cases with appropriate notifications:

- No clients connected
- No API key configured (falls back to direct routing)
- Routing failure

The STT pipeline separately handles:

- Empty transcription result → shows notification, doesn't trigger routing
- Transcription errors → shows notification, doesn't trigger routing

No additional error handling needed.

## Dependencies

- Task: "Implement routing IPC handlers" (must be completed first)
- Task: "Wire text input popup to routing service" (can be done in parallel)
- STT pipeline must be initialized in main.ts (already done)
- RoutingAgentService must be initialized in main.ts (already done)

## Acceptance Criteria

1. [ ] Transcribed text is routed through RoutingAgentService
2. [ ] Source is correctly set to "voice"
3. [ ] Voice-specific metadata is included
4. [ ] Routing outcomes are logged appropriately
5. [ ] Error handling catches unexpected exceptions
6. [ ] No duplicate notifications (both STT pipeline and routing agent handle their own)
