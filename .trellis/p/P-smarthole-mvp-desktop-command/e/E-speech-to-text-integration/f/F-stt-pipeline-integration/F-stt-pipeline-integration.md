---
id: F-stt-pipeline-integration
title: STT Pipeline Integration
status: in-progress
priority: high
parent: E-speech-to-text-integration
prerequisites:
  - F-stt-service-core-cloud
affectedFiles:
  src/types/stt.ts: Added SttPipelineErrorCode, TranscriptionReadyEvent,
    TranscriptionErrorEvent, SttPipelineEvents types and type guards
  src/services/stt-pipeline.ts: Created new STT pipeline service with
    audio-to-transcription orchestration, error handling, and event emission
  src/services/stt-pipeline.test.ts: Created comprehensive test suite with 19 tests covering all scenarios
  src/main.ts: Wired STT pipeline to audioReady event and added transcriptionReady
    listener for downstream routing
  src/services/input-state.ts: Added IDLE -> PROCESSING valid transition for STT pipeline use case
  src/services/input-state.test.ts: Updated tests to reflect new valid IDLE -> PROCESSING transition
log: []
schema: v1.0
childrenIds:
  - T-add-stt-ipc-events-for
  - T-create-stt-pipeline-service
created: 2026-01-31T19:15:43.919Z
updated: 2026-01-31T19:15:43.919Z
---

# STT Pipeline Integration

## Purpose

Connect the audio capture system to the STT service, creating the complete voice-to-text pipeline. When the user finishes speaking (audio capture completes), the audio is automatically sent to the configured STT backend, and the transcription result is emitted for downstream routing.

## Key Components

### 1. Audio-to-STT Pipeline (`src/services/stt-pipeline.ts` or in `main.ts`)

Wire the audio capture `audioReady` event to the STT service:

```typescript
// In main.ts or dedicated pipeline module
audioCapture.on("audioReady", async (event: AudioReadyEvent) => {
  try {
    const result = await sttService.transcribe(event.result.audio);
    // Emit transcription result for routing agent
    emitTranscriptionResult(result, event.result);
  } catch (error) {
    // Handle STT failure
    handleSttError(error, event.result);
  }
});
```

### 2. Transcription Result Event

Define and emit an event when transcription completes:

```typescript
interface TranscriptionReadyEvent {
  text: string; // Transcribed text
  confidence?: number; // Confidence score if available
  inputMethod: "voice"; // Always "voice" for STT results
  audioMetadata: {
    durationMs: number; // Original audio duration
    startedAt: string; // When recording started
    stoppedAt: string; // When recording stopped
  };
  sttMetadata: {
    backendUsed: SttBackendType; // Which backend transcribed
    processingTimeMs: number; // How long transcription took
  };
}
```

### 3. STT Error Handling & User Feedback

When STT fails, provide clear feedback:

1. **Show notification** to user explaining what went wrong
2. **Suggest fallback** - "Transcription failed. Try text input instead."
3. **Log error** with appropriate error code
4. **Reset input state** back to IDLE so user can try again

Error scenarios to handle:

- No API key configured (for cloud backends)
- Network error / API unreachable
- API rate limit exceeded
- Invalid audio format
- Transcription returned empty text
- Local server not available

### 4. Input State Integration

Update InputState machine during STT processing:

```
RECORDING → STOPPED → PROCESSING (STT running) → IDLE
                                  ↓
                              (on error) → IDLE
```

The `PROCESSING` state should already be set by audio-capture when it transitions to STOPPED. The pipeline should:

- Keep state as PROCESSING during STT call
- Transition to IDLE after result is emitted
- Transition to IDLE on error (with appropriate notification)

### 5. IPC Events for Renderer

Emit transcription events to renderer for UI feedback:

| Channel            | Direction       | Payload                              | Description            |
| ------------------ | --------------- | ------------------------------------ | ---------------------- |
| `stt:transcribing` | Main → Renderer | `{ audioId: string }`                | STT started            |
| `stt:result`       | Main → Renderer | `TranscriptionReadyEvent`            | Transcription complete |
| `stt:error`        | Main → Renderer | `{ error: string, code: ErrorCode }` | Transcription failed   |

### 6. Tray Icon State (Optional Enhancement)

Consider updating tray icon during transcription to show processing state. This may already be handled by existing input state integration.

## Technical Requirements

- Wire in `main.ts` after both `audioCapture` and `sttService` are initialized
- Use async/await with proper error boundaries
- Track processing time for performance monitoring
- Emit events via BrowserWindow.webContents.send()
- Integrate with existing notification service for user feedback

## Dependencies

- **F-stt-service-core-cloud**: Provides `SttService` to call
- Existing: `audio-capture`, `input-state`, `notifications`, `logger`

## Acceptance Criteria

1. [ ] `audioReady` event triggers STT transcription automatically
2. [ ] `TranscriptionReadyEvent` emitted on successful transcription
3. [ ] Processing time tracked and included in result metadata
4. [ ] STT errors show user notification with helpful message
5. [ ] STT errors suggest text input as fallback
6. [ ] Input state correctly transitions through PROCESSING → IDLE
7. [ ] IPC events emitted for renderer to display status
8. [ ] Empty transcription results handled (notify user, don't route empty text)
9. [ ] Logging captures STT requests/results at appropriate verbosity

## Testing Requirements

- Unit tests for:
  - Pipeline wiring (mock audio events trigger STT)
  - Error handling paths
  - Event emission
- Integration test (can be manual):
  - Record audio → STT → transcription result logged

## Security Considerations

- Transcription text may contain sensitive information
- Only log transcription text if `logMessageContent` is enabled
- Audio data should not be persisted after transcription

## Implementation Guidance

- Look at `wireAudioCaptureToHotkey()` in `ipc/audio-handler.ts` for event wiring patterns
- Look at `notifications.ts` for how to show user notifications
- The routing agent (future epic) will consume `TranscriptionReadyEvent`
- For now, just log the transcription result; routing integration comes later

## Future Integration Points

This pipeline produces transcription events that will be consumed by:

- **Routing Agent** (E-intelligent-routing): Takes transcription text and routes to appropriate client
- **Text Input Popup**: May share the same downstream event format for unified handling
