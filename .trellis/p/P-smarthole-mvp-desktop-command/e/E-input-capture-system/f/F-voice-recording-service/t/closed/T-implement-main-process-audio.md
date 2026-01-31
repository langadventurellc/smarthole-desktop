---
id: T-implement-main-process-audio
title: Implement main process audio coordination service
status: done
priority: high
parent: F-voice-recording-service
prerequisites:
  - T-add-audio-types-and-ipc
affectedFiles:
  src/services/audio-capture.ts: Created main process audio capture service with
    singleton pattern, recording lifecycle management (start/stop/isRecording),
    macOS permission checking, push-to-talk and toggle mode support,
    handleAudioData for receiving audio from renderer, and EventEmitter for
    state/permission/audioReady/error events
  src/services/audio-capture.test.ts: Created 24 unit tests covering singleton
    management, recording lifecycle, audio data handling, voice input modes,
    permission status, permission denied scenarios, event subscription, and
    reset functionality
  src/ipc/audio-handler.ts: Created IPC handlers including broadcast functions
    (broadcastAudioStateChanged, broadcastAudioPermissionChanged,
    broadcastAudioStart, broadcastAudioStop), createAudioDataHandler for
    AUDIO_DATA channel, createAudioPermissionHandler for AUDIO_PERMISSION_GET
    channel, wireAudioCaptureToIpc, wireAudioCaptureToHotkey, and
    registerAudioHandlers
  src/ipc/audio-handler.test.ts: Created 20 unit tests covering broadcast
    functions, handler creators, IPC wiring, and hotkey integration for both
    push-to-talk and toggle modes
  src/services/index.ts: Added export for audio-capture service
  src/ipc/index.ts: Added export for audio-handler
log:
  - >-
    Research phase complete. Reviewed:

    - hotkey-manager.ts and input-state.ts for singleton pattern and
    EventEmitter usage

    - audio.ts types (AudioCaptureState, AudioCapturePermission,
    AudioCaptureEvents, etc.)

    - ipc.ts for IPC channel definitions (AUDIO_* channels)

    - hotkey-handler.ts, input-state-handler.ts, text-input-handler.ts for IPC
    handler patterns

    - main.ts for service initialization order


    Starting implementation of:

    1. src/services/audio-capture.ts - Main service with singleton pattern

    2. src/ipc/audio-handler.ts - IPC handlers for audio channels

    3. Updates to barrel exports

    4. Unit tests
  - >-
    Implementation complete:


    1. Created `src/services/audio-capture.ts`:
       - Singleton pattern with initializeAudioCapture(), getAudioCapture(), resetAudioCapture()
       - AudioCaptureService interface with all required methods
       - Recording lifecycle: startRecording, stopRecording, isRecording, getState
       - Permission checking via Electron's systemPreferences (macOS-aware)
       - Voice input mode handling (push-to-talk / toggle)
       - handleAudioData for receiving audio from renderer
       - EventEmitter for AudioCaptureEvents (stateChanged, permissionChanged, audioReady, error)

    2. Created `src/ipc/audio-handler.ts`:
       - Broadcast functions: broadcastAudioStateChanged, broadcastAudioPermissionChanged, broadcastAudioStart, broadcastAudioStop
       - createAudioDataHandler for AUDIO_DATA channel (receives audio from renderer)
       - createAudioPermissionHandler for AUDIO_PERMISSION_GET channel
       - wireAudioCaptureToIpc to connect service events to IPC broadcasts
       - wireAudioCaptureToHotkey to handle push-to-talk and toggle modes
       - registerAudioHandlers for easy ipcMain registration

    3. Updated barrel exports:
       - `src/services/index.ts` - Added audio-capture export
       - `src/ipc/index.ts` - Added audio-handler export

    4. Created unit tests:
       - `src/services/audio-capture.test.ts` - 24 tests covering singleton, lifecycle, modes, permissions, events
       - `src/ipc/audio-handler.test.ts` - 20 tests covering handlers, broadcasts, and hotkey wiring

    All 752 tests pass. Quality checks (lint, format, type-check) all pass.
  - Implemented the main process audio coordination service with push-to-talk
    and toggle mode support. The service follows the singleton pattern used by
    other services, integrates with Electron's systemPreferences for macOS
    microphone permission checking, and coordinates audio capture through IPC
    channels. The implementation includes IPC handlers for receiving audio data
    from the renderer process and broadcasting state/permission changes. Both
    the service and handlers are fully tested with 44 new unit tests.
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
