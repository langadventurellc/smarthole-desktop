---
id: T-implement-main-process-audio
title: Implement main process audio coordination service
status: open
priority: high
parent: F-voice-recording-service
prerequisites:
  - T-add-audio-types-and-ipc
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-31T00:54:40.874Z
updated: 2026-01-31T00:54:40.874Z
---

# Implement Main Process Audio Coordination Service

## Purpose

Create the main process service that coordinates audio capture. This service manages the recording lifecycle, communicates with the renderer-side capture module via IPC, and integrates with the existing input state and hotkey systems.

## Scope

### Audio Capture Service (`src/services/audio-capture.ts`)

Follow the singleton pattern used by other services:

- `initializeAudioCapture()`: create the singleton instance
- `getAudioCapture()`: retrieve the instance
- `resetAudioCapture()`: cleanup (for testing)

### Service Interface

```typescript
interface AudioCaptureService {
  // Recording control
  startRecording(): Promise<boolean>;
  stopRecording(): Promise<void>;
  isRecording(): boolean;

  // Permission
  getPermissionStatus(): Promise<AudioCapturePermission>;

  // Mode handling
  getMode(): VoiceInputMode;
  setMode(mode: VoiceInputMode): void;

  // Events
  on<K extends keyof AudioCaptureEvents>(event: K, listener: AudioCaptureEvents[K]): void;
  off<K extends keyof AudioCaptureEvents>(event: K, listener: AudioCaptureEvents[K]): void;
}
```

### Event Integration

- Subscribe to `hotkey:activated` / `hotkey:released` from HotkeyManager for voice input hotkey
- Coordinate with InputStateService for state transitions (IDLE → RECORDING → PROCESSING)
- Emit events when audio capture completes for downstream STT processing

### Recording Modes

1. **Push-to-talk**:
   - Start recording on `hotkey:activated` (voiceInput)
   - Stop recording on `hotkey:released`
2. **Toggle**:
   - Start recording on first `hotkey:activated`
   - Stop recording on second `hotkey:activated`

### IPC Handlers (`src/ipc/audio-handler.ts`)

Create IPC handlers for audio channels:

- `AUDIO_START` handler
- `AUDIO_STOP` handler
- `AUDIO_DATA` handler (receive audio from renderer)
- `AUDIO_PERMISSION_GET` handler
- Broadcast functions for `AUDIO_STATE_CHANGED`

### Service Exports (`src/services/index.ts`)

Add export for the new audio capture service.

### IPC Exports (`src/ipc/index.ts`)

Add export for the new audio handlers.

## Technical Constraints

- Must initialize inside `app.whenReady()` after logger
- Uses IPC for renderer communication (cannot directly call Web Audio APIs)
- Integrates with existing InputStateService for state machine
- Follow existing patterns in hotkey-manager.ts and input-state.ts

## Acceptance Criteria

1. [ ] Service created at `src/services/audio-capture.ts`
2. [ ] IPC handlers created at `src/ipc/audio-handler.ts`
3. [ ] Push-to-talk mode works (hold to record, release to stop)
4. [ ] Toggle mode works (press to start, press again to stop)
5. [ ] Integrates with InputStateService state transitions
6. [ ] Subscribes to HotkeyManager events for voice input hotkey
7. [ ] Audio data event emitted when recording completes
8. [ ] Services exported from barrel exports
9. [ ] Unit tests for recording logic and state management
