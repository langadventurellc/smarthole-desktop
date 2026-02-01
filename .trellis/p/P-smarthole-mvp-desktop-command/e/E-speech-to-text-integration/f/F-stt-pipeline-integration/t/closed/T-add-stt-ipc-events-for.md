---
id: T-add-stt-ipc-events-for
title: Add STT IPC Events for Renderer Feedback
status: done
priority: medium
parent: F-stt-pipeline-integration
prerequisites:
  - T-create-stt-pipeline-service
affectedFiles:
  src/types/ipc.ts: Added STT IPC channels (STT_TRANSCRIBING, STT_RESULT,
    STT_ERROR), SttTranscribingPayload interface, re-exported
    TranscriptionReadyEvent and TranscriptionErrorEvent, added entries to
    IpcPayloadMap
  src/ipc/stt-handler.ts: Created new STT IPC handler with
    broadcastSttTranscribing, broadcastSttResult, and broadcastSttError
    functions
  src/ipc/stt-handler.test.ts: Created test suite with 10 tests covering all broadcast functions
  src/services/stt-pipeline.ts: Wired STT pipeline to emit IPC events via broadcast functions
  src/services/stt-pipeline.test.ts: Added BrowserWindow mock to electron mock for IPC integration
  src/preload/preload.ts: Added onSttTranscribing, onSttResult, onSttError event
    listeners to electronAPI
  src/types/ipc.test.ts: Added test for STT channels and updated channel count from 41 to 44
log:
  - >-
    Starting implementation of STT IPC Events for Renderer Feedback.


    Research completed:

    - Reviewed src/types/ipc.ts for existing IPC channel patterns

    - Reviewed src/ipc/audio-handler.ts for broadcast function patterns

    - Reviewed src/preload/preload.ts for event listener exposure patterns

    - Reviewed src/services/stt-pipeline.ts for integration points

    - Reviewed src/types/stt.ts for TranscriptionReadyEvent and
    TranscriptionErrorEvent types

    - Reviewed src/ipc/audio-handler.test.ts for testing patterns


    Key patterns identified:

    1. Broadcast functions use BrowserWindow.getAllWindows() and check
    isDestroyed()

    2. Preload functions return unsubscribe functions for cleanup

    3. IPC channels follow {domain}:{action} naming convention

    4. Tests mock BrowserWindow and verify send calls


    Implementation plan:

    1. Add STT IPC channels to src/types/ipc.ts

    2. Create src/ipc/stt-handler.ts with broadcast functions

    3. Wire pipeline to IPC in src/services/stt-pipeline.ts

    4. Add preload exposure in src/preload/preload.ts

    5. Create src/ipc/stt-handler.test.ts with tests
  - >-
    Implemented STT IPC Events for Renderer Feedback.


    Added three new IPC channels for STT pipeline communication:

    - STT_TRANSCRIBING: Sent when STT processing starts

    - STT_RESULT: Sent when transcription completes successfully

    - STT_ERROR: Sent when transcription fails


    Created broadcast functions in stt-handler.ts that follow the existing
    audio-handler.ts pattern:

    - broadcastSttTranscribing()

    - broadcastSttResult()

    - broadcastSttError()


    Wired the STT pipeline to emit IPC events at appropriate times:

    - Broadcasts transcribing event when transitioning to PROCESSING state

    - Broadcasts result event after emitting transcriptionReady

    - Broadcasts error event after emitting transcriptionError


    Exposed event listeners in preload.ts for renderer consumption:

    - onSttTranscribing() - Listen for transcription start events

    - onSttResult() - Listen for transcription result events

    - onSttError() - Listen for transcription error events


    All functions return unsubscribe functions for proper cleanup, following
    existing patterns.


    Tests: Created comprehensive test suite in stt-handler.test.ts with 10 tests
    covering all broadcast functions, including multi-window broadcasting and
    destroyed window handling. Updated stt-pipeline.test.ts to mock
    BrowserWindow for IPC integration. Updated ipc.test.ts to verify new STT
    channels.


    All 1081 tests pass. All quality checks (lint, format, type-check) pass.
schema: v1.0
childrenIds: []
created: 2026-01-31T20:25:58.537Z
updated: 2026-01-31T20:25:58.537Z
---

# Add STT IPC Events for Renderer Feedback

## Purpose

Emit IPC events from the STT pipeline to the renderer process so the UI can display transcription status, results, and errors.

## Implementation Details

### 1. Define IPC Channels

Add new STT-specific channels to `src/types/ipc.ts`:

```typescript
export const IpcChannel = {
  // ... existing channels
  STT_TRANSCRIBING: "stt:transcribing",
  STT_RESULT: "stt:result",
  STT_ERROR: "stt:error",
} as const;
```

### 2. Create STT IPC Handler (`src/ipc/stt-handler.ts`)

Create broadcast functions for STT events:

```typescript
export function broadcastSttTranscribing(audioId: string): void {
  // Send to all BrowserWindows
}

export function broadcastSttResult(result: TranscriptionReadyEvent): void {
  // Send to all BrowserWindows
}

export function broadcastSttError(error: { error: string; code: string }): void {
  // Send to all BrowserWindows
}
```

### 3. Wire Pipeline to IPC

In `stt-pipeline.ts`, emit IPC events:

- Emit `STT_TRANSCRIBING` when transcription starts
- Emit `STT_RESULT` when transcription completes successfully
- Emit `STT_ERROR` when transcription fails

### 4. Add Preload Exposure

Expose STT events in preload for renderer consumption:

```typescript
// In preload.ts
stt: {
  onTranscribing: (callback: (audioId: string) => void) => {
    ipcRenderer.on(IpcChannel.STT_TRANSCRIBING, (_, data) => callback(data.audioId));
  },
  onResult: (callback: (result: TranscriptionReadyEvent) => void) => {
    ipcRenderer.on(IpcChannel.STT_RESULT, (_, data) => callback(data));
  },
  onError: (callback: (error: { error: string; code: string }) => void) => {
    ipcRenderer.on(IpcChannel.STT_ERROR, (_, data) => callback(data));
  },
}
```

## Files to Create/Modify

- **Create**: `src/ipc/stt-handler.ts` - STT-specific IPC broadcast functions
- **Modify**: `src/types/ipc.ts` - Add STT channel constants
- **Modify**: `src/preload/preload.ts` - Expose STT event listeners
- **Modify**: `src/services/stt-pipeline.ts` - Call broadcast functions

## Testing Requirements

Unit tests in `src/ipc/stt-handler.test.ts`:

- Test broadcast functions send to all windows
- Test event payloads match expected format
- Integration test: pipeline emits IPC events correctly

## Acceptance Criteria

1. [ ] IPC channels defined for transcribing/result/error
2. [ ] Broadcast functions created for each event type
3. [ ] Pipeline emits IPC events at appropriate times
4. [ ] Preload exposes event listeners for renderer
5. [ ] Unit tests pass

## Dependencies

- **T-create-stt-pipeline-service**: Must exist before wiring IPC
