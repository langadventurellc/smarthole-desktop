---
id: T-add-audio-types-and-ipc
title: Add audio types and IPC channels
status: done
priority: high
parent: F-voice-recording-service
prerequisites: []
affectedFiles:
  src/types/audio.ts: Created new file with AudioCaptureState enum,
    AudioCapturePermission enum, AudioBuffer, AudioCaptureConfig (with
    DEFAULT_AUDIO_CAPTURE_CONFIG), AudioCaptureResult, AudioPermissionStatus
    interfaces, AudioCaptureEvents interface with all event types, and type
    guards (isAudioCaptureState, isAudioCapturePermission, isAudioFormat,
    isAudioBuffer, isAudioCaptureResult, isAudioPermissionStatus,
    isAudioErrorCode, isAudioStateChangedEvent, isAudioPermissionChangedEvent)
  src/types/ipc.ts: Added import for audio types, added 6 new IPC channels
    (AUDIO_START, AUDIO_STOP, AUDIO_DATA, AUDIO_PERMISSION_GET,
    AUDIO_PERMISSION_CHANGED, AUDIO_STATE_CHANGED), added AudioStartPayload and
    AudioDataPayload interfaces, re-exported AudioStateChangedEvent and
    AudioPermissionChangedEvent, updated IpcPayloadMap with audio channels,
    updated IpcResponseMap with AUDIO_PERMISSION_GET response type
  src/types/index.ts: Added export for audio types module
  src/types/audio.test.ts: Created new file with 47 unit tests for all audio type guards
  src/types/ipc.test.ts: Added test for audio capture channels, updated channel count from 26 to 32
log:
  - |-
    Completed research phase. Reviewed existing patterns in:
    - src/types/ipc.ts - IPC channels, payload maps, type guards
    - src/types/input.ts - State enums using const assertion pattern
    - src/types/hotkey.ts - Event type patterns
    - src/types/guards.ts - Validation helpers and patterns
    - Test patterns in ipc.test.ts and guards.test.ts

    Will implement:
    1. src/types/audio.ts with enums, types, interfaces, and type guards
    2. Add IPC channels to src/types/ipc.ts
    3. Export from src/types/index.ts
    4. Create unit tests for type guards

    Starting implementation.
  - Implemented audio capture TypeScript types and IPC infrastructure for the
    voice recording service. Created `src/types/audio.ts` with AudioCaptureState
    and AudioCapturePermission enums (using const assertion pattern consistent
    with existing code), AudioBuffer, AudioCaptureConfig, AudioCaptureResult,
    AudioPermissionStatus interfaces, and AudioCaptureEvents with audioReady,
    stateChanged, permissionChanged, and error events. Added comprehensive type
    guards (isAudioCaptureState, isAudioCapturePermission, isAudioBuffer,
    isAudioCaptureResult, isAudioPermissionStatus, isAudioStateChangedEvent,
    isAudioPermissionChangedEvent). Added 6 new IPC channels to
    `src/types/ipc.ts` (AUDIO_START, AUDIO_STOP, AUDIO_DATA,
    AUDIO_PERMISSION_GET, AUDIO_PERMISSION_CHANGED, AUDIO_STATE_CHANGED) with
    proper payload and response type mappings. All types exported from barrel
    export. Created 47 unit tests for type guards in `src/types/audio.test.ts`.
    All 707 tests pass and quality checks (lint, format, type-check) complete
    successfully.
schema: v1.0
childrenIds: []
created: 2026-01-31T00:54:11.760Z
updated: 2026-01-31T00:54:11.760Z
---

# Add Audio Types and IPC Channels

## Purpose

Define the TypeScript types and IPC channel infrastructure needed for audio capture coordination between main and renderer processes.

## Scope

### New Types (`src/types/audio.ts`)

- `AudioCaptureState`: enum for capture states (idle, recording, stopped, error)
- `AudioCapturePermission`: enum for permission states (granted, denied, prompt, unknown)
- `AudioBuffer`: type for captured audio data (raw PCM or WAV)
- `AudioCaptureConfig`: interface for audio settings (sample rate, channels, etc.)
- `AudioCaptureResult`: interface for recording result with audio data and metadata
- `AudioPermissionStatus`: interface for permission query response
- `AudioCaptureEvents`: interface for event types emitted by audio capture, including:
  - `audioReady`: emitted when recording completes with audio data ready for STT
  - `stateChanged`: emitted when capture state changes
  - `permissionChanged`: emitted when permission status changes
  - `error`: emitted on capture errors

### Type Guards (`src/types/audio.ts`)

Place type guards in the audio types file (consistent with how IPC type guards are in ipc.ts):

- `isAudioCaptureResult()`: validate audio capture result payloads
- `isAudioCaptureState()`: validate state enum values
- `isAudioCapturePermission()`: validate permission enum values

### IPC Channels (`src/types/ipc.ts`)

Add these channels to `IPC_CHANNELS`:

- `AUDIO_START`: `"audio:start"` - trigger recording start
- `AUDIO_STOP`: `"audio:stop"` - trigger recording stop
- `AUDIO_DATA`: `"audio:data"` - renderer → main with captured audio
- `AUDIO_PERMISSION_GET`: `"audio:permission:get"` - query microphone permission status
- `AUDIO_PERMISSION_CHANGED`: `"audio:permission:changed"` - broadcast permission changes
- `AUDIO_STATE_CHANGED`: `"audio:stateChanged"` - broadcast capture state changes

Add corresponding payload types and update `IpcPayloadMap` and `IpcResponseMap`.

### Type Exports (`src/types/index.ts`)

Export new audio types from the barrel export.

## Technical Constraints

- Audio format: 16kHz sample rate, mono channel (suitable for Whisper)
- Follow existing patterns in `src/types/ipc.ts` for channel naming and payload structure
- Include type guards for runtime validation

## Acceptance Criteria

1. [ ] `src/types/audio.ts` created with all audio-related types
2. [ ] AudioCaptureEvents interface includes `audioReady` event for STT handoff
3. [ ] Type guards in `src/types/audio.ts`
4. [ ] IPC channels added to `src/types/ipc.ts` with payload types
5. [ ] All types exported from `src/types/index.ts`
6. [ ] Types pass TypeScript compilation
7. [ ] Unit tests for type guards
