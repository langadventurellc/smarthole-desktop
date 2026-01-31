---
id: T-add-stt-ipc-events-for
title: Add STT IPC Events for Renderer Feedback
status: open
priority: medium
parent: F-stt-pipeline-integration
prerequisites:
  - T-create-stt-pipeline-service
affectedFiles: {}
log: []
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
