---
id: T-create-stt-pipeline-service
title: Create STT Pipeline Service with Audio-to-Transcription Wiring
status: done
priority: high
parent: F-stt-pipeline-integration
prerequisites: []
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
log:
  - >-
    Research phase completed. Key findings:

    - Studied stt-service.ts singleton pattern

    - Understood audio-capture.ts EventEmitter pattern

    - Reviewed input-state.ts for state transitions (IDLE, RECORDING,
    PROCESSING)

    - Found audioReady handler in main.ts at line 882-889 (TODO comment exists)

    - Identified notification service patterns from notifications.ts

    - Reviewed existing test patterns from stt-service.test.ts


    Implementation plan verified:

    1. Add types to src/types/stt.ts (TranscriptionReadyEvent, error types)

    2. Create src/services/stt-pipeline.ts with singleton pattern

    3. Modify main.ts to wire pipeline to audioReady event

    4. Create comprehensive tests in src/services/stt-pipeline.test.ts
  - >-
    Implemented the STT Pipeline Service that orchestrates the
    audio-to-transcription flow. Key changes:


    1. Added new types to src/types/stt.ts:
       - SttPipelineErrorCode type for error classification
       - TranscriptionReadyEvent interface for successful transcription events
       - TranscriptionErrorEvent interface for error events
       - SttPipelineEvents interface for typed event emission
       - Type guards: isSttPipelineErrorCode, isTranscriptionReadyEvent, isTranscriptionErrorEvent

    2. Created src/services/stt-pipeline.ts:
       - SttPipelineService interface with processAudio, isReady, on/off, reset methods
       - SttPipelineServiceImpl class with full error handling and event emission
       - Error-to-notification mapping with user-friendly messages
       - Singleton pattern (initializeSttPipeline, getSttPipeline, resetSttPipeline)
       - State management integration (IDLE -> PROCESSING -> IDLE)

    3. Modified src/main.ts:
       - Added imports for stt-pipeline service
       - Added sttPipelineState mutable state object
       - Wired audioReady event to pipeline's processAudio method
       - Added transcriptionReady event listener for downstream routing
       - Added cleanup in app.on("will-quit")

    4. Updated src/services/input-state.ts:
       - Added IDLE -> PROCESSING as valid transition for STT pipeline use case

    5. Created comprehensive tests in src/services/stt-pipeline.test.ts:
       - Singleton initialization tests
       - Successful transcription flow tests
       - Error handling tests for all error types (NO_API_KEY, NETWORK_ERROR, RATE_LIMIT, EMPTY_RESULT, INVALID_AUDIO, TRANSCRIPTION_FAILED)
       - State transition tests
       - Event subscription tests

    All 1070 tests pass and quality checks (lint, format, type-check) are clean.
schema: v1.0
childrenIds: []
created: 2026-01-31T20:25:58.245Z
updated: 2026-01-31T20:25:58.245Z
---

# Create STT Pipeline Service with Audio-to-Transcription Wiring

## Purpose

Create the core STT pipeline service that connects the audio capture system to the STT service, handling the complete voice-to-text flow including error handling, state management, and event emission.

## Implementation Details

### 1. Create STT Pipeline Service (`src/services/stt-pipeline.ts`)

Create a new service that orchestrates the STT flow:

```typescript
interface TranscriptionReadyEvent {
  text: string;
  confidence?: number;
  inputMethod: "voice";
  audioMetadata: {
    durationMs: number;
    startedAt: string;
    stoppedAt: string;
  };
  sttMetadata: {
    backendUsed: SttBackendType;
    processingTimeMs: number;
  };
}

interface SttPipeline extends EventEmitter {
  // Process audio and emit transcription result
  processAudio(audioResult: AudioCaptureResult): Promise<void>;

  // Check if pipeline is ready (STT service configured)
  isReady(): Promise<boolean>;
}
```

The pipeline should:

- Accept `AudioCaptureResult` from the `audioReady` event
- Call `sttService.transcribe()` with the audio buffer
- Track processing time
- Emit `transcriptionReady` event with `TranscriptionReadyEvent` payload
- Emit `transcriptionError` event on failure
- Handle empty transcription results (treat as error)

### 2. Wire Pipeline in main.ts

Replace the TODO at the existing `audioReady` event handler (~line 888):

```typescript
// Initialize STT pipeline after STT service
const sttPipeline = initializeSttPipeline();

audioState.audioCapture.on("audioReady", async (event) => {
  await sttPipeline.processAudio(event.result);
});
```

### 3. Error Handling

Handle all STT error scenarios with appropriate user notifications:

| Error Scenario | Notification Title     | Notification Body                                               |
| -------------- | ---------------------- | --------------------------------------------------------------- |
| No API key     | "STT Not Configured"   | "Please add your API key in Settings"                           |
| Network error  | "Transcription Failed" | "Could not reach transcription service. Check your connection." |
| Rate limit     | "Too Many Requests"    | "Please wait a moment before trying again."                     |
| Empty result   | "No Speech Detected"   | "Try speaking more clearly or closer to the microphone."        |
| Invalid audio  | "Audio Error"          | "Recording format issue. Please try again."                     |
| Generic error  | "Transcription Failed" | "An error occurred. Try text input instead."                    |

### 4. State Management Integration

**Important Note**: The current `audio-capture.ts` transitions InputState to IDLE in `handleAudioData()` BEFORE emitting the `audioReady` event. This means by the time the pipeline receives audio, the state is already IDLE.

The pipeline should:

- Transition InputState to PROCESSING at the START of `processAudio()` (since audio-capture leaves it at IDLE)
- Transition back to IDLE after processing completes (success or error)
- This ensures the UI shows a "processing" state during STT transcription

### 5. Logging

- Log at INFO level: start of transcription, completion with duration
- Log at DEBUG level: audio metadata, backend used
- Never log transcription text (sensitive data)
- Log errors at ERROR level with error code

## Files to Create/Modify

- **Create**: `src/services/stt-pipeline.ts` - New pipeline service
- **Modify**: `src/main.ts` - Wire pipeline to audioReady event, initialize service
- **Modify**: `src/types/stt.ts` - Add TranscriptionReadyEvent type (keep all STT types together)
- **Modify**: `src/types/index.ts` - Export new type if needed

## Testing Requirements

Unit tests in `src/services/stt-pipeline.test.ts`:

- Test successful transcription flow (mock STT service returns result)
- Test error handling for each error type
- Test empty transcription result handling
- Test event emission (transcriptionReady, transcriptionError)
- Test state transitions: IDLE → PROCESSING → IDLE
- Test processing time tracking

## Acceptance Criteria

1. [ ] `audioReady` event triggers STT transcription automatically
2. [ ] `transcriptionReady` event emitted on successful transcription
3. [ ] Processing time tracked and included in result metadata
4. [ ] STT errors show user notification with helpful message
5. [ ] Empty transcription results handled as errors
6. [ ] Input state transitions: IDLE → PROCESSING → IDLE during pipeline
7. [ ] Service follows singleton pattern (initializeSttPipeline/getSttPipeline)
8. [ ] Unit tests pass for all scenarios

## Dependencies

- Existing: stt-service, audio-capture, input-state, notifications, logger
